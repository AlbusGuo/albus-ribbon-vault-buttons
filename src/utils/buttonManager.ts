import { App, ItemView, TFile, WorkspaceLeaf, normalizePath, setIcon, setTooltip } from 'obsidian';
import { ButtonGroupTrigger, CustomButton, ButtonItem, DividerItem } from '../types';
import { PointerSortController, PointerSortItem } from './pointerSortController';
import { MorphIconManager } from './morphIconManager';
import { ButtonGroupMenuManager } from './buttonGroupMenuManager';

interface InternalRibbon {
	ribbonActionsEl?: HTMLElement;
	ribbonSettingEl?: HTMLElement;
	makeRibbonItemButton(
		icon: string,
		tooltip: string,
		callback: (event: MouseEvent) => void,
	): HTMLElement;
}

interface InternalApp extends App {
	commands: {
		executeCommandById(commandId: string): unknown;
	};
	openVaultChooser(): void;
	openHelp(): void;
	setting: {
		open(): void;
	};
}

/**
 * 按钮管理器类
 * 负责管理所有按钮的创建, 销毁和交互
 */
export class ButtonManager {
	private ribbonMap = new Map<string, HTMLElement>();
	private buttonElements = new Map<string, Set<HTMLElement>>();
	private pageHeaderButtons = new WeakMap<ItemView, Map<string, HTMLElement>>();
	private ribbonSortController: PointerSortController | null = null;
	private toggleStates = new Map<string, boolean>();
	private buttonConfigs = new Map<string, CustomButton>();
	private morphIconManager: MorphIconManager;
	private buttonGroupMenuManager: ButtonGroupMenuManager;
	private scheduledAnimationFrames = new Set<number>();
	private layoutSyncScheduled = false;
	private destroyed = false;

	constructor(
		private app: App,
		private onIconStateChange: (buttonId: string, iconState: boolean) => Promise<void>,
		private onReorderButtons: (sourceIndex: number, targetIndex: number) => Promise<void>,
		private onRibbonReorderSettled: () => void,
		private waitForSettingsWrites: () => Promise<void>,
		private getButtonGroupTrigger: () => ButtonGroupTrigger,
		private renderIntegratedIcon: (element: HTMLElement, iconName: string) => boolean
	) {
		this.morphIconManager = new MorphIconManager(this.renderIntegratedIcon);
		this.buttonGroupMenuManager = new ButtonGroupMenuManager(
			this.getButtonGroupTrigger,
			(button) => this.runRibbonAction(() => this.handleButtonClick(button)),
		);
	}

	/**
	 * 初始化所有按钮
	 */
	initVaultButtons(
		leftRibbonItems: ButtonItem[],
		pageHeaderItems: CustomButton[],
		noteToolbarItems: ButtonItem[],
		selectionToolbarItems: ButtonItem[],
		hideBuiltInButtons: boolean = true,
	) {
		if (this.destroyed) {
			return;
		}

		this.cancelScheduledAnimationFrames();

		this.clearAllButtons();
		this.initLeftRibbonItems(leftRibbonItems);
		this.initCustomButtonItems(pageHeaderItems, 'page');
		this.initToolbarButtonItems(noteToolbarItems, 'note');
		this.initToolbarButtonItems(selectionToolbarItems, 'selection');
		this.addPageHeaderButtons(pageHeaderItems);
		if (hideBuiltInButtons) {
			this.initBuiltInButtons();
		}
		this.initRibbonSorting(leftRibbonItems);
	}

	/**
	 * 清除所有按钮
	 */
	private clearAllButtons() {
		this.buttonGroupMenuManager.clear();
		this.morphIconManager.clearElements();
		this.ribbonSortController?.destroy();
		this.ribbonSortController = null;
		this.ribbonMap.forEach((element) => element.remove());
		this.removeButtonsFromAllLeaves();
		this.ribbonMap.clear();
		this.buttonElements.clear();
		this.toggleStates.clear();
		this.buttonConfigs.clear();
	}

	/**
	 * 初始化按钮项 (包含按钮和分割线)
	 */
	private initLeftRibbonItems(buttonItems: ButtonItem[]) {
		buttonItems.forEach((item, index) => {
			if (item.type === 'divider') {
				this.createDivider(item);
			} else {
				this.createCustomButton(item, index, 'left');
			}
		});
	}

	private initCustomButtonItems(
		buttonItems: CustomButton[],
		area: 'page' | 'note' | 'selection',
	): void {
		buttonItems.forEach((item, index) => {
			this.createCustomButton(item, index, area);
		});
	}

	/**
	 * 初始化内置按钮
	 */
	private initBuiltInButtons() {
		this.createRibbonButton('vault', '切换库', 'vault', () => this.showVaultChooser());
		this.createRibbonButton('help', '帮助', 'help', () => this.showHelp());
		this.createRibbonButton('settings', '设置', 'settings', () => this.showSettings());
	}

	private initToolbarButtonItems(
		buttonItems: ButtonItem[],
		area: 'note' | 'selection',
	): void {
		buttonItems.forEach((item, index) => {
			if (item.type !== 'divider') this.createCustomButton(item, index, area);
		});
	}

	/**
	 * 创建自定义按钮
	 */
	private createCustomButton(
		button: CustomButton,
		index: number,
		area: 'left' | 'page' | 'note' | 'selection',
	) {
		const buttonId = `${area}-${index}`;
		
		this.buttonConfigs.set(buttonId, button);

		const savedState = button.type !== 'button-group' && (button.iconState || false);
		this.toggleStates.set(buttonId, savedState);

		const initialIcon = savedState ? (button.toggleIcon || button.icon) : button.icon;
		
		if (area === 'left') {
			let ribbonButtonEl: HTMLElement | null = null;
			const onClick = () => {
				if (
					ribbonButtonEl &&
					this.buttonGroupMenuManager.openIfPresent(ribbonButtonEl, button, 'ribbon')
				) {
					return;
				}
				return this.activateCustomButton(buttonId, button);
			};
			ribbonButtonEl = this.createRibbonButton(
				buttonId,
				button.tooltip,
				initialIcon,
				onClick,
				true,
			);
			if (ribbonButtonEl) this.buttonGroupMenuManager.bind(ribbonButtonEl, button, 'ribbon');
		}
	}

	/**
	 * 创建分割线
	 */
	private createDivider(divider: DividerItem) {
		const ribbonContainer = this.getRibbonContainer();
		if (!ribbonContainer) {
			return;
		}

		const dividerEl = document.createElement('div');
		dividerEl.className = 'custom-ribbon-divider';
		ribbonContainer.appendChild(dividerEl);
		this.ribbonMap.set(divider.id, dividerEl);
	}

	/**
	 * 处理按钮点击事件
	 */
	private async activateCustomButton(buttonId: string, button: CustomButton): Promise<void> {
		await this.toggleButtonIcon(buttonId);
		await this.waitForSettingsWrites();
		await this.handleButtonClick(button);
	}

	syncWorkspaceLayout(
		leftRibbonItems: ButtonItem[],
		pageHeaderItems: CustomButton[],
		hideBuiltInButtons: boolean,
	): void {
		if (this.destroyed || this.layoutSyncScheduled) {
			return;
		}

		this.layoutSyncScheduled = true;
		this.scheduleAnimationFrame(() => {
			this.layoutSyncScheduled = false;
			const expectedRibbonItemCount = leftRibbonItems.length + (hideBuiltInButtons ? 3 : 0);
			const ribbonWasRebuilt = this.ribbonMap.size !== expectedRibbonItemCount ||
				Array.from(this.ribbonMap.values()).some(
					(element) => !element.isConnected,
			);

			if (ribbonWasRebuilt) {
				this.onRibbonReorderSettled();
				return;
			}

			this.app.workspace.iterateAllLeaves((leaf) => {
				this.addButtonsToLeaf(leaf, pageHeaderItems);
			});
		});
	}

	createContentToolbarButton(
		parentEl: HTMLElement,
		button: CustomButton,
		index: number,
		area: 'note' | 'selection',
	): HTMLButtonElement {
		const buttonId = `${area}-${index}`;
		const iconName = (this.toggleStates.get(buttonId) || false)
			? (button.toggleIcon || button.icon)
			: button.icon;
		const buttonEl = parentEl.createEl('button', {
			cls: ['clickable-icon', 'basic-vault-content-toolbar-button'],
			attr: { type: 'button', 'aria-label': button.tooltip },
		});
		setTooltip(buttonEl, button.tooltip);
		if (area === 'selection') {
			buttonEl.addEventListener('pointerdown', (event) => event.preventDefault());
		}
		buttonEl.addEventListener('click', (event) => {
			event.stopPropagation();
			if (this.buttonGroupMenuManager.openIfPresent(buttonEl, button, area)) return;
			void this.runRibbonAction(() => this.activateCustomButton(buttonId, button)).catch((error) => {
				console.error('Custom Buttons toolbar action failed:', error);
			});
		});
		this.buttonGroupMenuManager.bind(buttonEl, button, area);

		this.registerButtonElement(buttonId, buttonEl);
		this.setButtonIcon(buttonEl, iconName);
		return buttonEl;
	}

	refreshButtonIcons(): void {
		if (this.destroyed) {
			return;
		}
		this.morphIconManager.invalidate();

		for (const [buttonId, buttonConfig] of this.buttonConfigs.entries()) {
			const currentIcon = (this.toggleStates.get(buttonId) || false)
				? (buttonConfig.toggleIcon || buttonConfig.icon)
				: buttonConfig.icon;
			for (const buttonEl of this.buttonElements.get(buttonId) ?? []) {
				this.setButtonIcon(buttonEl, currentIcon);
			}
		}
	}

	private async handleButtonClick(button: CustomButton): Promise<void> {
		switch (button.type) {
			case 'command':
				if (button.command) {
					this.executeCommand(button.command);
				}
				break;
			case 'command-group':
				if (button.commands.length > 0) {
					await this.executeCommandGroup(button.commands);
				}
				break;
			case 'file':
				if (button.file) {
					this.openFile(button.file);
				}
				break;
			case 'url':
				if (button.url) {
					this.openUrl(button.url);
				}
				break;
			case 'button-group':
				break;
		}
	}

	private async executeCommandGroup(commandIds: string[]) {
		for (const commandId of commandIds) {
			if (!commandId) {
				continue;
			}

			try {
				await Promise.resolve(
					this.internalApp.commands.executeCommandById(commandId)
				);
			} catch {
				// 单个命令失败时继续后续命令, 避免整组中断
			}
		}
	}

	/**
	 * 切换按钮图标
	 */
	private async toggleButtonIcon(buttonId: string): Promise<void> {
		const buttonConfig = this.buttonConfigs.get(buttonId);
		
		if (!buttonConfig) return;

		const primaryIcon = buttonConfig.icon;
		const toggleIcon = buttonConfig.toggleIcon || primaryIcon;
		if (primaryIcon === toggleIcon) {
			return;
		}

		const currentState = this.toggleStates.get(buttonId) || false;
		const newState = !currentState;
		this.toggleStates.set(buttonId, newState);
		const previousIcon = currentState ? toggleIcon : primaryIcon;
		const newIcon = newState ? toggleIcon : primaryIcon;

		buttonConfig.iconState = newState;
		const saveState = this.onIconStateChange(buttonId, newState);

		for (const buttonEl of this.buttonElements.get(buttonId) ?? []) {
			if (!this.morphIconManager.transition(buttonEl, previousIcon, newIcon)) {
				this.setButtonIcon(buttonEl, newIcon);
			}
		}

		await saveState;
	}

	/**
	 * 设置按钮图标 (支持自定义图标)
	 */
	private setButtonIcon(buttonEl: HTMLElement, iconName: string): void {
		this.morphIconManager.resetElement(buttonEl);
		if (this.renderIntegratedIcon(buttonEl, iconName)) return;
		try {
			setIcon(buttonEl, iconName);
			if (!buttonEl.querySelector('svg')) setIcon(buttonEl, 'help-circle');
		} catch {
			setIcon(buttonEl, 'help-circle');
		}
	}

	/**
	 * 打开文件
	 */
	private openFile(filePath: string) {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(filePath));
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf('tab');
			void leaf.openFile(file);
		}
	}

	private openUrl(url: string) {
		try {
			const parsedUrl = new URL(url);
			if (!['http:', 'https:', 'mailto:', 'obsidian:'].includes(parsedUrl.protocol)) {
				return;
			}

			window.open(parsedUrl.toString(), '_blank', 'noopener,noreferrer');
		} catch {
			// 无效网址不执行任何操作.
		}
	}

	/**
	 * 创建缎带按钮
	 */
	private createRibbonButton(
		id: string,
		tooltip: string,
		icon: string,
		onClick: () => void | Promise<void>,
		sortable = false,
	): HTMLElement | null {
		const leftRibbon = this.getLeftRibbon();
		const ribbonContainer = this.getRibbonContainer(leftRibbon);
		if (!leftRibbon || !ribbonContainer) {
			return null;
		}

		const requiresDeferredIcon = icon.startsWith('CI-');
		const button = leftRibbon.makeRibbonItemButton(
			requiresDeferredIcon ? 'help-circle' : icon,
			tooltip,
			(event: MouseEvent) => {
				if (sortable && this.ribbonSortController?.consumeSuppressedClick(id)) {
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				event.stopPropagation();
				void this.runRibbonAction(onClick).catch((error) => {
					console.error('Custom Buttons ribbon action failed:', error);
				});
			},
		);

		this.setButtonIcon(button, icon);

		if (sortable) this.registerButtonElement(id, button);
		this.ribbonMap.set(id, button);
		ribbonContainer.appendChild(button);
		return button;
	}

	private getLeftRibbon(): InternalRibbon | null {
		const workspace = this.app.workspace as typeof this.app.workspace & {
			leftRibbon?: InternalRibbon;
		};
		return workspace.leftRibbon ?? null;
	}

	private get internalApp(): InternalApp {
		return this.app as InternalApp;
	}

	private getRibbonContainer(leftRibbon = this.getLeftRibbon()): HTMLElement | null {
		return leftRibbon?.ribbonActionsEl ?? leftRibbon?.ribbonSettingEl ?? null;
	}

	private async runRibbonAction(action: () => void | Promise<void>): Promise<void> {
		await this.waitForSettingsWrites();
		await action();
	}

	private registerButtonElement(id: string, element: HTMLElement) {
		if (!this.buttonElements.has(id)) {
			this.buttonElements.set(id, new Set());
		}

		this.buttonElements.get(id)?.add(element);
	}

	private unregisterButtonElement(id: string, element: HTMLElement) {
		const elements = this.buttonElements.get(id);
		if (!elements) {
			return;
		}

		elements.delete(element);
		if (elements.size === 0) {
			this.buttonElements.delete(id);
		}
	}

	private addPageHeaderButtons(buttonItems: CustomButton[]) {
		this.scheduleAnimationFrame(() => {
			this.app.workspace.iterateAllLeaves((leaf) => {
				this.addButtonsToLeaf(leaf, buttonItems);
			});
		});
	}

	private addButtonsToLeaf(leaf: WorkspaceLeaf, buttonItems: CustomButton[]) {
		const { view } = leaf;
		if (!(view instanceof ItemView)) {
			return;
		}

		const buttons = this.buttonsFor(view, true);
		if (!buttons) {
			return;
		}

		for (const [buttonId, element] of buttons.entries()) {
			if (!element.isConnected) {
				this.unregisterButtonElement(buttonId, element);
				buttons.delete(buttonId);
			}
		}

		buttonItems.forEach((item, index) => {
			const buttonId = `page-${index}`;
			if (buttons.has(buttonId)) {
				return;
			}

			const iconName = (this.toggleStates.get(buttonId) || false)
				? (item.toggleIcon || item.icon)
				: item.icon;

			let actionEl: HTMLElement;
			actionEl = view.addAction('help-circle', item.tooltip, () => {
				this.app.workspace.setActiveLeaf(leaf, { focus: true });
				if (this.buttonGroupMenuManager.openIfPresent(actionEl, item, 'header')) return;
				return this.activateCustomButton(buttonId, item);
			});

			actionEl.addClass('basic-vault-page-header-button');
			buttons.set(buttonId, actionEl);
			this.registerButtonElement(buttonId, actionEl);
			this.setButtonIcon(actionEl, iconName);
			this.buttonGroupMenuManager.bind(actionEl, item, 'header');
		});
	}

	private buttonsFor(view: ItemView, create = false) {
		if (create && !this.pageHeaderButtons.has(view)) {
			this.pageHeaderButtons.set(view, new Map());
		}

		return this.pageHeaderButtons.get(view);
	}

	private removeButtonsFromAllLeaves() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof ItemView)) {
				return;
			}

			const buttons = this.buttonsFor(leaf.view);
			if (!buttons) {
				return;
			}

			for (const element of buttons.values()) element.remove();
			buttons.clear();
		});
	}

	private scheduleAnimationFrame(callback: () => void) {
		if (this.destroyed) {
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
			this.scheduledAnimationFrames.delete(frameId);
			if (!this.destroyed) {
				callback();
			}
		});
		this.scheduledAnimationFrames.add(frameId);
	}

	private cancelScheduledAnimationFrames() {
		for (const frameId of this.scheduledAnimationFrames) {
			window.cancelAnimationFrame(frameId);
		}
		this.scheduledAnimationFrames.clear();
		this.layoutSyncScheduled = false;
	}

	private initRibbonSorting(buttonItems: ButtonItem[]): void {
		const ribbonContainer = this.getRibbonContainer();
		if (!ribbonContainer) return;

		const sortableItems: PointerSortItem[] = [];
		buttonItems.forEach((item, index) => {
			const key = item.type === 'divider' ? item.id : `left-${index}`;
			const element = this.ribbonMap.get(key);
			if (element) sortableItems.push({ key, element });
		});
		if (sortableItems.length < 2) return;

		this.ribbonSortController = new PointerSortController({
			containerEl: ribbonContainer,
			items: sortableItems,
			scrollEl: ribbonContainer,
			onReorder: this.onReorderButtons,
			onSettled: this.onRibbonReorderSettled,
			onError: (error) => {
				console.error('Custom Buttons failed to save ribbon order:', error);
			},
		});
	}

	/**
	 * 执行命令
	 */
	private executeCommand(commandId: string) {
		try {
			this.internalApp.commands.executeCommandById(commandId);
		} catch {
			// 命令执行失败, 静默失败
		}
	}

	/**
	 * 显示库选择器
	 */
	private showVaultChooser() {
		try {
			this.internalApp.openVaultChooser();
		} catch {
			// 库选择器打开失败, 静默失败
		}
	}

	/**
	 * 显示帮助
	 */
	private showHelp() {
		try {
			this.internalApp.openHelp();
		} catch {
			// 帮助打开失败, 静默失败
		}
	}

	/**
	 * 显示设置
	 */
	private showSettings() {
		try {
			this.internalApp.setting.open();
		} catch {
			// 设置打开失败, 静默失败
		}
	}

	/**
	 * 应用样式设置 - 通过切换 body 类来控制 CSS 可见性
	 */
	applyStyleSettings(hideBuiltInButtons: boolean = true) {
		document.body.classList.toggle('crb-show-builtin', !hideBuiltInButtons);
	}

	/**
	 * 应用默认功能区样式设置 - 通过切换 body 类来控制 CSS 可见性
	 */
	applyDefaultActionsStyle(hideDefaultActions: boolean = false) {
		document.body.classList.toggle('crb-hide-default-actions', hideDefaultActions);
	}

	/**
	 * 清理资源
	 */
	destroy() {
		this.destroyed = true;
		this.cancelScheduledAnimationFrames();
		this.clearAllButtons();
		this.buttonGroupMenuManager.destroy();
		this.morphIconManager.destroy();
		document.body.classList.remove('crb-show-builtin', 'crb-hide-default-actions');
	}
}
