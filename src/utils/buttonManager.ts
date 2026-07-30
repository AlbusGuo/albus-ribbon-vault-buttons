import { App, ItemView, TFile, WorkspaceLeaf, normalizePath, setIcon } from 'obsidian';
import { CustomButton, ButtonItem, DividerItem } from '../types';
import { CustomIconManager } from './customIconManager';

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
 * 拖拽状态
 */
interface DragState {
	isDragging: boolean;
	dragSource: string | null;
}

/**
 * 按钮管理器类
 * 负责管理所有按钮的创建, 销毁和交互
 */
export class ButtonManager {
	private ribbonMap = new Map<string, HTMLElement>();
	private buttonElements = new Map<string, Set<HTMLElement>>();
	private pageHeaderButtons = new WeakMap<ItemView, Map<string, HTMLElement>>();
	private dragState: DragState = {
		isDragging: false,
		dragSource: null
	};
	// 跟踪每个按钮的图标切换状态: true表示显示切换图标, false表示显示主图标
	private toggleStates = new Map<string, boolean>();
	// 存储按钮配置
	private buttonConfigs = new Map<string, CustomButton>();
	// 自定义图标管理器
	private customIconManager: CustomIconManager;
	private scheduledAnimationFrames = new Set<number>();
	private layoutSyncScheduled = false;
	private destroyed = false;

	constructor(
		private app: App,
		private onIconStateChange: (buttonId: string, iconState: boolean) => Promise<void>,
		private onReorderButtons: (sourceIndex: number, targetIndex: number) => Promise<void>,
		private waitForSettingsWrites: () => Promise<void>,
		private shouldMaskCustomIcons: () => boolean
	) {
		this.customIconManager = CustomIconManager.getInstance(this.app);
	}

	/**
	 * 初始化所有按钮
	 */
	initVaultButtons(
		leftRibbonItems: ButtonItem[],
		pageHeaderItems: CustomButton[],
		hideBuiltInButtons: boolean = true,
		loadUncachedIcons = true,
	) {
		if (this.destroyed) {
			return;
		}

		this.cancelScheduledAnimationFrames();

		this.clearAllButtons();
		this.initLeftRibbonItems(leftRibbonItems, loadUncachedIcons);
		this.initPageHeaderItems(pageHeaderItems);
		this.addPageHeaderButtons(pageHeaderItems, loadUncachedIcons);
		if (hideBuiltInButtons) {
			this.initBuiltInButtons();
		}
	}

	/**
	 * 清除所有按钮
	 */
	private clearAllButtons() {
		this.ribbonMap.forEach((value) => {
			if (value && value.parentElement) {
				value.remove();
			}
		});
		this.removeButtonsFromAllLeaves();
		this.ribbonMap.clear();
		this.buttonElements.clear();
		this.toggleStates.clear();
		this.buttonConfigs.clear();
	}

	/**
	 * 初始化按钮项 (包含按钮和分割线)
	 */
	private initLeftRibbonItems(buttonItems: ButtonItem[], loadUncachedIcons: boolean) {
		buttonItems.forEach((item, index) => {
			if (item.type === 'divider') {
				this.createDivider(item, index);
			} else {
				this.createCustomButton(item, index, 'left', loadUncachedIcons);
			}
		});
	}

	private initPageHeaderItems(buttonItems: CustomButton[]) {
		buttonItems.forEach((item, index) => {
			this.createCustomButton(item, index, 'page');
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

	/**
	 * 创建自定义按钮
	 */
	private createCustomButton(
		button: CustomButton,
		index: number,
		area: 'left' | 'page',
		loadUncachedIcon = true,
	) {
		const buttonId = `${area}-${index}`;
		
		// 存储按钮配置
		this.buttonConfigs.set(buttonId, button);
		
		// 从settings恢复图标状态, 默认为false (显示主图标)
		const savedState = button.iconState || false;
		this.toggleStates.set(buttonId, savedState);
		
		// 根据保存的状态选择初始图标
		const initialIcon = savedState ? (button.toggleIcon || button.icon) : button.icon;
		
		const onClick = () => this.activateCustomButton(buttonId, button);

		if (area === 'left') {
			this.createRibbonButton(buttonId, button.tooltip, initialIcon, onClick, true, index, loadUncachedIcon);
		}
	}

	/**
	 * 创建分割线
	 */
	private createDivider(divider: DividerItem, index: number) {
		const ribbonContainer = this.getRibbonContainer();
		if (!ribbonContainer) {
			return;
		}

		const dividerEl = document.createElement('div');
		dividerEl.className = 'custom-ribbon-divider';
		dividerEl.dataset.arrayIndex = index.toString();
		this.makeRibbonItemDraggable(dividerEl, divider.id);
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
				this.initVaultButtons(leftRibbonItems, pageHeaderItems, hideBuiltInButtons);
				return;
			}

			this.app.workspace.iterateAllLeaves((leaf) => {
				this.addButtonsToLeaf(leaf, pageHeaderItems);
			});
		});
	}

	refreshButtonIcons(iconName?: string, loadUncachedIcons = true): void {
		if (this.destroyed) {
			return;
		}

		for (const [buttonId, buttonConfig] of this.buttonConfigs.entries()) {
			const currentIcon = (this.toggleStates.get(buttonId) || false)
				? (buttonConfig.toggleIcon || buttonConfig.icon)
				: buttonConfig.icon;
			if (iconName && currentIcon !== iconName) {
				continue;
			}

			for (const buttonEl of this.buttonElements.get(buttonId) ?? []) {
				void this.setButtonIcon(buttonEl, currentIcon, loadUncachedIcons);
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

		// 获取当前切换状态
		const currentState = this.toggleStates.get(buttonId) || false;
		// 切换状态
		const newState = !currentState;
		this.toggleStates.set(buttonId, newState);
		
		// 保存状态到按钮配置
		buttonConfig.iconState = newState;
		await this.onIconStateChange(buttonId, newState);

		// 根据新状态选择图标
		const newIcon = newState ? toggleIcon : primaryIcon;

		for (const buttonEl of this.buttonElements.get(buttonId) ?? []) {
			void this.setButtonIcon(buttonEl, newIcon);
		}
	}

	/**
	 * 设置按钮图标 (支持自定义图标)
	 */
	private async setButtonIcon(buttonEl: HTMLElement, iconName: string, loadUncachedIcon = true) {
		if (this.customIconManager.isCustomIcon(iconName)) {
			if (this.customIconManager.renderIconFromCache(iconName, buttonEl, this.shouldMaskCustomIcons())) {
				return;
			}

			if (!loadUncachedIcon) {
				setIcon(buttonEl, 'help-circle');
				return;
			}

			const rendered = await this.customIconManager.renderIcon(iconName, buttonEl, this.shouldMaskCustomIcons());
			if (!rendered) {
				setIcon(buttonEl, 'help-circle');
			}
		} else {
			setIcon(buttonEl, iconName);
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
		draggable = false,
		arrayIndex = -1,
		loadUncachedIcon = true,
	): void {
		const leftRibbon = this.getLeftRibbon();
		const ribbonContainer = this.getRibbonContainer(leftRibbon);
		if (!leftRibbon || !ribbonContainer) {
			return;
		}

		const isCustomIcon = this.customIconManager.isCustomIcon(icon);
		const button = leftRibbon.makeRibbonItemButton(
			isCustomIcon ? 'help-circle' : icon,
			tooltip,
			(event: MouseEvent) => {
				event.stopPropagation();
				void this.runRibbonAction(onClick).catch((error) => {
					console.error('Custom Buttons ribbon action failed:', error);
				});
			},
		);

		if (
			isCustomIcon &&
			!this.customIconManager.renderIconFromCache(icon, button, this.shouldMaskCustomIcons()) &&
			loadUncachedIcon
		) {
			void this.setButtonIcon(button, icon);
		}

		if (arrayIndex >= 0) {
			button.dataset.arrayIndex = arrayIndex.toString();
		}

		if (draggable) {
			button.classList.add('custom-ribbon-button');
			this.makeRibbonItemDraggable(button, id);
		}

		this.registerButtonElement(id, button);
		this.ribbonMap.set(id, button);
		ribbonContainer.appendChild(button);
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

	private addPageHeaderButtons(buttonItems: CustomButton[], loadUncachedIcons: boolean) {
		this.scheduleAnimationFrame(() => {
			this.app.workspace.iterateAllLeaves((leaf) => {
				this.addButtonsToLeaf(leaf, buttonItems, loadUncachedIcons);
			});
		});
	}

	private addButtonsToLeaf(leaf: WorkspaceLeaf, buttonItems: CustomButton[], loadUncachedIcons = true) {
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

			const buttonConfig = item;
			const iconName = (this.toggleStates.get(buttonId) || false)
				? (buttonConfig.toggleIcon || buttonConfig.icon)
				: buttonConfig.icon;

			const actionEl = view.addAction('help-circle', buttonConfig.tooltip, () => {
				this.app.workspace.setActiveLeaf(leaf, { focus: true });
				return this.activateCustomButton(buttonId, buttonConfig);
			});

			actionEl.addClass('basic-vault-page-header-button');
			actionEl.dataset.arrayIndex = index.toString();
			buttons.set(buttonId, actionEl);
			this.registerButtonElement(buttonId, actionEl);
			void this.setButtonIcon(actionEl, iconName, loadUncachedIcons);
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

			for (const [buttonId, element] of buttons.entries()) {
				this.unregisterButtonElement(buttonId, element);
				element.remove();
			}
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

	/**
	 * 使按钮可拖拽
	 */
	private makeRibbonItemDraggable(element: HTMLElement, itemId: string) {
		element.setAttribute('draggable', 'true');

		element.addEventListener('dragstart', (event) => {
			this.dragState.isDragging = true;
			this.dragState.dragSource = itemId;
			element.classList.add('dragging');
			if (event.dataTransfer) {
				event.dataTransfer.effectAllowed = 'move';
				event.dataTransfer.setData('text/plain', itemId);
			}
		});

		element.addEventListener('dragend', () => {
			this.dragState.isDragging = false;
			this.dragState.dragSource = null;
			element.classList.remove('dragging');
			this.clearRibbonDragOver();
		});

		element.addEventListener('dragover', (event) => {
			if (this.dragState.isDragging && this.dragState.dragSource !== itemId) {
				event.preventDefault();
				if (event.dataTransfer) {
					event.dataTransfer.dropEffect = 'move';
				}
				element.classList.add('drag-over');
			}
		});

		element.addEventListener('dragenter', (event) => {
			if (this.dragState.isDragging && this.dragState.dragSource !== itemId) {
				event.preventDefault();
				element.classList.add('drag-over');
			}
		});

		element.addEventListener('dragleave', (event) => {
			if (!element.contains(event.relatedTarget as Node)) {
				element.classList.remove('drag-over');
			}
		});

		element.addEventListener('drop', (event) => {
			event.preventDefault();
			element.classList.remove('drag-over');

			if (this.dragState.isDragging && this.dragState.dragSource && this.dragState.dragSource !== itemId) {
				this.handleReorderButtons(this.dragState.dragSource, itemId);
			}
		});
	}

	private clearRibbonDragOver(): void {
		for (const element of this.ribbonMap.values()) {
			element.classList.remove('drag-over');
		}
	}

	/**
	 * 处理按钮重新排序
	 */
	private handleReorderButtons(sourceId: string, targetId: string) {
		// 通过存储的索引信息找到实际的数组索引
		const sourceElement = this.ribbonMap.get(sourceId);
		const targetElement = this.ribbonMap.get(targetId);
		
		if (!sourceElement || !targetElement) return;
		
		const sourceIndex = Number.parseInt(sourceElement.dataset.arrayIndex || '-1', 10);
		const targetIndex = Number.parseInt(targetElement.dataset.arrayIndex || '-1', 10);
		
		if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

		// 调用外部回调来处理数组重新排序
		void this.onReorderButtons(sourceIndex, targetIndex).catch((error) => {
			console.error('Custom Buttons failed to save ribbon order:', error);
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
		if (hideBuiltInButtons) {
			document.body.classList.remove('crb-show-builtin');
		} else {
			document.body.classList.add('crb-show-builtin');
		}
	}

	/**
	 * 应用默认功能区样式设置 - 通过切换 body 类来控制 CSS 可见性
	 */
	applyDefaultActionsStyle(hideDefaultActions: boolean = false) {
		if (hideDefaultActions) {
			document.body.classList.add('crb-hide-default-actions');
		} else {
			document.body.classList.remove('crb-hide-default-actions');
		}
	}

	/**
	 * 清理资源
	 */
	destroy() {
		this.destroyed = true;
		this.cancelScheduledAnimationFrames();
		this.clearAllButtons();
		document.body.classList.remove('crb-show-builtin');
		document.body.classList.remove('crb-hide-default-actions');
	}
}
