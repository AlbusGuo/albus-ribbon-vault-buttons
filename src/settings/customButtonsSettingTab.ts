import { App, Plugin, PluginSettingTab, Setting, SettingGroup, setIcon, setTooltip } from 'obsidian';
import { CustomButton, RibbonVaultButtonsSettings } from '../types';
import { createButtonGroup, createCustomButton, createDivider } from '../settings';
import { ButtonStudioModal } from '../modals/buttonStudioModal';
import { ConfirmModal } from '../modals/confirmModal';
import { getRegisteredCommands } from '../utils/commandRegistry';
import { PointerSortController, PointerSortItem } from '../utils/pointerSortController';
import { CustomIconsIntegration } from '../integrations/customIconsIntegration';
import { MorphIconManager } from '../utils/morphIconManager';
import { isButtonConfigurationComplete } from '../utils/buttonValidation';

type SettingsTabKey = RibbonVaultButtonsSettings['settingsTab'];
type ButtonArea = Exclude<SettingsTabKey, 'general'>;
const ICON_PREVIEW_INTERVAL = 2000;

interface RibbonVaultButtonsPlugin extends Plugin {
	settings: RibbonVaultButtonsSettings;
	saveSettings(): Promise<void>;
	initVaultButtons(): void;
	buttonManager: {
		applyStyleSettings(hideBuiltInButtons?: boolean): void;
		applyDefaultActionsStyle(hideDefaultActions?: boolean): void;
	};
	customIconsIntegration: CustomIconsIntegration;
}

export class CustomButtonsSettingTab extends PluginSettingTab {
	plugin: RibbonVaultButtonsPlugin;
	private sortController: PointerSortController | null = null;
	private commandNameById = new Map<string, string>();
	private readonly scrollTopByTab = new Map<SettingsTabKey, number>();
	private readonly previewMorphManager: MorphIconManager;
	private readonly previewCycleTimers = new Map<HTMLElement, { id: number; win: Window }>();
	private renderedTab: SettingsTabKey | null = null;

	icon: string = 'panel-left';

	constructor(app: App, plugin: RibbonVaultButtonsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.previewMorphManager = new MorphIconManager(
			(element, iconName) => this.plugin.customIconsIntegration.renderIcon(element, iconName),
		);
	}

	display(): void {
		const { containerEl } = this;
		this.rememberScrollPosition();
		this.destroySortController();
		this.clearPreviewCycles();
		this.previewMorphManager.clearElements();
		containerEl.empty();
		containerEl.addClass('basic-vault-settings-root');
		this.commandNameById.clear();

		// 固定顶部标签栏
		const tabsEl = containerEl.createEl('div', { cls: 'basic-vault-settings-tabs' });

		this.createTabButton(tabsEl, 'general', '通用');
		this.createTabButton(tabsEl, 'left-ribbon', '左侧边栏');
		this.createTabButton(tabsEl, 'page-header', '标题栏');
		this.createTabButton(tabsEl, 'note-toolbar', '笔记工具栏');
		this.createTabButton(tabsEl, 'selection-toolbar', '选中文本工具栏');

		// 可滚动内容区域
		const scrollEl = containerEl.createDiv({ cls: 'basic-vault-settings-scroll' });
		const contentEl = scrollEl.createDiv({ cls: 'basic-vault-settings-content' });

		this.renderActiveTab(contentEl);
		this.renderedTab = this.plugin.settings.settingsTab;
		this.restoreScrollPosition(
			scrollEl,
			this.scrollTopByTab.get(this.renderedTab) ?? 0,
		);
	}

	hide(): void {
		this.rememberScrollPosition();
		this.destroySortController();
		this.clearPreviewCycles();
		this.previewMorphManager.clearElements();
		super.hide();
	}

	refreshIntegratedIconPreviews(): void {
		this.previewMorphManager.invalidate();
		const previewEls = this.containerEl.querySelectorAll<HTMLElement>(
			'.basic-vault-button-name-icon-layer[data-primary-icon]',
		);
		for (const previewEl of Array.from(previewEls)) {
			const iconName = previewEl.dataset.primaryIcon;
			if (iconName) this.renderNameIconPreview(previewEl, iconName);
		}
	}

	private rememberScrollPosition(): void {
		if (!this.renderedTab) return;
		const scrollEl = this.containerEl.querySelector<HTMLElement>('.basic-vault-settings-scroll');
		if (scrollEl) this.scrollTopByTab.set(this.renderedTab, scrollEl.scrollTop);
	}

	private restoreScrollPosition(scrollEl: HTMLElement, scrollTop: number): void {
		scrollEl.scrollTop = scrollTop;
		scrollEl.win.requestAnimationFrame(() => {
			if (scrollEl.isConnected) scrollEl.scrollTop = scrollTop;
		});
	}

	private createTabButton(parentEl: HTMLElement, tab: SettingsTabKey, label: string) {
		const buttonEl = parentEl.createDiv({
			cls: `basic-vault-settings-tab${this.plugin.settings.settingsTab === tab ? ' is-active' : ''}`,
			text: label,
		});

		buttonEl.addEventListener('click', () => {
			if (this.plugin.settings.settingsTab === tab) {
				return;
			}

			void this.switchTab(tab);
		});
	}

	private async switchTab(tab: SettingsTabKey) {
		this.plugin.settings.settingsTab = tab;
		await this.plugin.saveSettings();
		this.display();
	}

	private renderActiveTab(contentEl: HTMLElement) {
		switch (this.plugin.settings.settingsTab) {
			case 'general':
				this.renderGeneralTab(contentEl);
				return;
			case 'left-ribbon':
				this.renderButtonsTab(contentEl, 'left-ribbon');
				return;
			case 'page-header':
				this.renderButtonsTab(contentEl, 'page-header');
				return;
			case 'note-toolbar':
				this.renderButtonsTab(contentEl, 'note-toolbar');
				return;
			case 'selection-toolbar':
				this.renderButtonsTab(contentEl, 'selection-toolbar');
				return;
		}
	}

	private renderGeneralTab(contentEl: HTMLElement) {
		this.createGlobalSettings(contentEl);
	}

	private renderButtonsTab(contentEl: HTMLElement, area: ButtonArea) {
		if (this.commandNameById.size === 0) {
			this.commandNameById = new Map(
				getRegisteredCommands(this.app).map((command) => [command.id, command.name]),
			);
		}

		if (area === 'note-toolbar') this.renderNoteToolbarPosition(contentEl);
		if (area === 'selection-toolbar') this.renderSelectionToolbarOptions(contentEl);
		this.renderButtonsHeading(contentEl, area);

		const items = this.getItems(area);
		const itemsGroup = new SettingGroup(contentEl);
		const sortableItems: PointerSortItem[] = [];

		if (items.length === 0) {
			itemsGroup.addSetting((setting) => {
				const supportsDivider = area !== 'page-header';
				setting
					.setName(`还没有添加${this.getAreaLabel(area)}项目`)
					.setDesc(supportsDivider
						? `点击标题右侧图标创建按钮, 按钮组或分割线`
						: `点击标题右侧图标创建按钮或按钮组`);
			});
		} else {
			items.forEach((item, index) => {
				if (item.type === 'divider') {
					if (area === 'page-header') return;
					this.createDividerSetting(itemsGroup, index, area, sortableItems);
					return;
				}

				this.createButtonSetting(itemsGroup, item, index, area, sortableItems);
			});
		}

		const groupItemsEl = sortableItems[0]?.element.parentElement;
		if (sortableItems.length > 1 && groupItemsEl) {
			this.sortController = new PointerSortController({
				containerEl: groupItemsEl,
				items: sortableItems,
				scrollEl: contentEl.parentElement ?? contentEl,
				onReorder: (sourceIndex, targetIndex) =>
					this.reorderItems(area, sourceIndex, targetIndex),
				onSettled: () => {
					this.plugin.initVaultButtons();
					this.display();
				},
				onError: (error) => console.error('Failed to reorder settings items', error),
			});
		}
	}

	private renderButtonsHeading(contentEl: HTMLElement, area: ButtonArea): void {
		const heading = new Setting(contentEl)
			.setName('按钮')
			.setHeading();
		heading.addExtraButton((button) => button
			.setIcon('diamond-plus')
			.setTooltip('添加按钮')
			.onClick(() => {
				void this.addCustomButton(area);
			}));
		heading.addExtraButton((button) => button
			.setIcon('layers-plus')
			.setTooltip('添加按钮组')
			.onClick(() => {
				void this.addButtonGroup(area);
			}));
		if (area !== 'page-header') {
			heading.addExtraButton((button) => button
				.setIcon('minus')
				.setTooltip('添加分割线')
				.onClick(() => {
					void this.addDivider(area);
				}));
		}
	}

	private renderNoteToolbarPosition(contentEl: HTMLElement): void {
		const positionGroup = new SettingGroup(contentEl);
		positionGroup.addSetting((setting) => {
			setting
				.setName('工具栏位置')
				.setDesc('设置笔记工具栏在 Markdown 视图中的固定位置')
				.addDropdown((dropdown) => dropdown
					.addOption('top-fixed', '顶部')
					.addOption('bottom', '底部')
					.setValue(this.plugin.settings.noteToolbarPosition)
					.onChange(async (value) => {
						this.plugin.settings.noteToolbarPosition = value === 'bottom'
							? 'bottom'
							: 'top-fixed';
						await this.plugin.saveSettings();
						this.plugin.initVaultButtons();
					}));
		});
	}

	private renderSelectionToolbarOptions(contentEl: HTMLElement): void {
		const optionsGroup = new SettingGroup(contentEl);
		optionsGroup.addSetting((setting) => {
			setting
				.setName('键盘选区显示工具栏')
				.setDesc('开启后, 使用键盘创建或调整文本选区时也会显示工具栏')
				.addToggle((toggle) => toggle
					.setValue(this.plugin.settings.selectionToolbarOnKeyboard)
					.onChange(async (value) => {
						this.plugin.settings.selectionToolbarOnKeyboard = value;
						await this.plugin.saveSettings();
						this.plugin.initVaultButtons();
					}));
		});
	}

	private createGlobalSettings(containerEl: HTMLElement) {
		const settingsGroup = new SettingGroup(containerEl);

		settingsGroup.addSetting((setting) => {
			setting
				.setName('调整内置按钮到左侧功能区')
				.setDesc('开启后将 Obsidian 原生的库切换, 设置, 帮助等按钮布局调整到左侧功能区')
				.addToggle((toggle) => toggle
					.setValue(this.plugin.settings.hideBuiltInButtons)
					.onChange(async (value) => {
						this.plugin.settings.hideBuiltInButtons = value;
						await this.plugin.saveSettings();
						this.plugin.buttonManager.applyStyleSettings(value);
						this.plugin.initVaultButtons();
					}));
		});

		settingsGroup.addSetting((setting) => {
			setting
				.setName('隐藏默认功能区')
				.setDesc('开启后将隐藏 Obsidian 的默认功能区')
				.addToggle((toggle) => toggle
					.setValue(this.plugin.settings.hideDefaultActions)
					.onChange(async (value) => {
						this.plugin.settings.hideDefaultActions = value;
						await this.plugin.saveSettings();
						this.plugin.buttonManager.applyDefaultActionsStyle(value);
					}));
		});

		settingsGroup.addSetting((setting) => {
			setting
				.setName('按钮组展开方式')
				.setDesc('设置按钮组通过点击或悬停展开')
				.addDropdown((dropdown) => dropdown
					.addOption('click', '点击')
					.addOption('hover', '悬停')
					.setValue(this.plugin.settings.buttonGroupTrigger)
					.onChange(async (value) => {
						this.plugin.settings.buttonGroupTrigger = value === 'hover' ? 'hover' : 'click';
						await this.plugin.saveSettings();
						this.plugin.initVaultButtons();
					}));
		});

	}

	private addCustomButton(area: ButtonArea): void {
		this.openNewButtonStudio(area, createCustomButton());
	}

	private addButtonGroup(area: ButtonArea): void {
		this.openNewButtonStudio(area, createButtonGroup());
	}

	private async addDivider(area: Exclude<ButtonArea, 'page-header'>) {
		this.getItems(area).push(createDivider());
		await this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();
	}

	private async removeButtonItem(area: ButtonArea, index: number) {
		this.getItems(area).splice(index, 1);
		await this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();
	}

	private async confirmRemoveItem(area: ButtonArea, index: number) {
		const item = this.getItems(area)[index];
		if (!item) {
			return;
		}

		const isDivider = item.type === 'divider';
		const isButtonGroup = !isDivider && item.kind === 'group';
		const confirmed = await ConfirmModal.confirm(this.app, {
			title: isDivider ? '删除分割线' : isButtonGroup ? '删除按钮组' : '删除按钮',
			message: isDivider
				? '确定要删除这条分割线吗? 此操作会立即生效.'
				: `确定要删除 "${(item as CustomButton).tooltip.trim() || (isButtonGroup ? '未命名按钮组' : '未命名按钮')}" 吗? 此操作会立即生效.`,
			confirmText: '删除',
			cancelText: '取消',
			danger: true,
		});

		if (!confirmed) {
			return;
		}

		await this.removeButtonItem(area, index);
	}

	private createButtonSetting(
		actionsGroup: SettingGroup,
		button: CustomButton,
		index: number,
		area: ButtonArea,
		sortableItems: PointerSortItem[],
	): void {
		actionsGroup.addSetting((setting) => {
			setting.settingEl.addClass('basic-vault-button-setting');
			const isButtonGroup = button.kind === 'group';
			setting.setName(button.tooltip.trim() || (isButtonGroup ? '未命名按钮组' : '未命名按钮'));
			setting.setDesc(this.getButtonSummary(button));
			this.decorateButtonName(setting, button);

			setting
				.addExtraButton((extraButton) => extraButton
					.setIcon('pencil')
					.setTooltip(isButtonGroup ? '编辑按钮组' : '编辑按钮')
					.onClick(() => {
						this.openButtonStudio(area, index);
					}))
				.addExtraButton((extraButton) => extraButton
					.setIcon('trash')
					.setTooltip(isButtonGroup ? '删除按钮组' : '删除按钮')
					.onClick(() => {
						void this.confirmRemoveItem(area, index);
					}));

			const handle = this.addDragHandle(setting);
			sortableItems.push({ key: `${area}:${index}`, element: setting.settingEl, handle });
		});
	}

	private openButtonStudio(area: ButtonArea, index: number, refreshOnClose: boolean = true) {
		const item = this.getItems(area)[index];
		if (!item || item.type === 'divider') {
			return;
		}

		new ButtonStudioModal(this.app, item, {
			customIconsIntegration: this.plugin.customIconsIntegration,
			onChange: async (savedButton) => {
				if (!isButtonConfigurationComplete(savedButton)) return false;
				this.getItems(area)[index] = savedButton;
				await this.plugin.saveSettings();
				this.plugin.initVaultButtons();
				return true;
			},
			onClose: () => {
				if (refreshOnClose) {
					this.display();
				}
			}
		}).open();
	}

	private openNewButtonStudio(area: ButtonArea, draft: CustomButton): void {
		let savedIndex: number | null = null;
		new ButtonStudioModal(this.app, draft, {
			customIconsIntegration: this.plugin.customIconsIntegration,
			initiallyPersisted: false,
			onChange: async (savedButton) => {
				if (!isButtonConfigurationComplete(savedButton)) return false;
				const items = this.getItems(area);
				if (savedIndex === null) {
					savedIndex = items.length;
					items.push(savedButton);
				} else if (items[savedIndex]?.type !== 'divider') {
					items[savedIndex] = savedButton;
				} else {
					return false;
				}
				await this.plugin.saveSettings();
				this.plugin.initVaultButtons();
				return true;
			},
			onClose: () => this.display(),
		}).open();
	}

	private decorateButtonName(setting: Setting, button: CustomButton) {
		setting.nameEl.empty();

		const nameWrapEl = setting.nameEl.createSpan({ cls: 'basic-vault-button-name-wrap' });
		const primaryIconName = button.icon || 'help-circle';
		const toggleIconName = button.toggleIcon || primaryIconName;
		const shouldAnimateToggle =
			button.kind === 'button' && primaryIconName !== toggleIconName;
		const iconWrapEl = nameWrapEl.createSpan({ cls: 'basic-vault-button-name-icon' });
		const iconStackEl = iconWrapEl.createSpan({ cls: 'basic-vault-button-name-icon-stack' });
		const previewEl = iconStackEl.createSpan({ cls: 'basic-vault-button-name-icon-layer' });
		previewEl.dataset.primaryIcon = primaryIconName;
		previewEl.dataset.toggleIcon = toggleIconName;
		nameWrapEl.createSpan({
			cls: 'basic-vault-button-name-text',
			text: button.tooltip.trim() || '未命名按钮'
		});

		const tooltipText = shouldAnimateToggle
			? `主图标: ${primaryIconName}\n切换图标: ${toggleIconName}`
			: `图标: ${primaryIconName}`;
		setTooltip(iconWrapEl, tooltipText);

		this.renderNameIconPreview(previewEl, primaryIconName);
		if (shouldAnimateToggle) {
			const startCycle = () => this.startPreviewCycle(
				previewEl,
				primaryIconName,
				toggleIconName,
			);
			const stopCycle = () => this.stopPreviewCycle(previewEl, primaryIconName);
			setting.settingEl.addEventListener('mouseenter', startCycle);
			setting.settingEl.addEventListener('mouseleave', () => {
				if (!setting.settingEl.contains(setting.settingEl.ownerDocument.activeElement)) {
					stopCycle();
				}
			});
			setting.settingEl.addEventListener('focusin', startCycle);
			setting.settingEl.addEventListener('focusout', (event) => {
				if (
					!setting.settingEl.contains(event.relatedTarget as Node | null) &&
					!setting.settingEl.matches(':hover')
				) {
					stopCycle();
				}
			});
		}
	}

	private startPreviewCycle(
		previewEl: HTMLElement,
		primaryIcon: string,
		toggleIcon: string,
	): void {
		if (this.previewCycleTimers.has(previewEl)) return;
		const ownerWindow = previewEl.win;
		const timerId = ownerWindow.setInterval(() => {
			if (!previewEl.isConnected) {
				this.clearPreviewCycle(previewEl);
				return;
			}
			const targetIcon = previewEl.dataset.previewIcon === primaryIcon
				? toggleIcon
				: primaryIcon;
			this.transitionNameIcon(previewEl, targetIcon);
		}, ICON_PREVIEW_INTERVAL);
		this.previewCycleTimers.set(previewEl, { id: timerId, win: ownerWindow });
	}

	private stopPreviewCycle(previewEl: HTMLElement, primaryIcon: string): void {
		this.clearPreviewCycle(previewEl);
		this.transitionNameIcon(previewEl, primaryIcon);
	}

	private clearPreviewCycle(previewEl: HTMLElement): void {
		const timer = this.previewCycleTimers.get(previewEl);
		if (!timer) return;
		timer.win.clearInterval(timer.id);
		this.previewCycleTimers.delete(previewEl);
	}

	private clearPreviewCycles(): void {
		for (const timer of this.previewCycleTimers.values()) {
			timer.win.clearInterval(timer.id);
		}
		this.previewCycleTimers.clear();
	}

	private transitionNameIcon(previewEl: HTMLElement, targetIcon: string): void {
		const currentIcon = previewEl.dataset.previewIcon;
		if (!currentIcon || currentIcon === targetIcon) return;
		previewEl.dataset.previewIcon = targetIcon;
		if (!this.previewMorphManager.transition(previewEl, currentIcon, targetIcon)) {
			this.renderNameIconPreview(previewEl, targetIcon);
		}
	}

	private renderNameIconPreview(previewEl: HTMLElement, iconName: string): void {
		this.previewMorphManager.resetElement(previewEl);
		previewEl.empty();
		previewEl.dataset.previewIcon = iconName;

		if (this.plugin.customIconsIntegration.renderIcon(previewEl, iconName)) return;

		try {
			setIcon(previewEl, iconName || 'help-circle');
			if (!previewEl.querySelector('svg')) previewEl.setText('?');
		} catch {
			previewEl.setText('?');
		}
	}

	private getButtonSummary(button: CustomButton): string {
		if (button.kind === 'group') return `按钮组 - ${button.groupItems.length} 项`;
		const target = (() => {
			switch (button.type) {
				case 'command':
					return this.getCommandDisplayName(button.command);
				case 'file':
					return button.file || '未设置文件';
				case 'url':
					return button.url || '未设置网址';
			}
		})();

		return `${this.getButtonTypeLabel(button.type)} - ${target}`;
	}

	private getButtonTypeLabel(type: CustomButton['type']): string {
		switch (type) {
			case 'command':
				return '命令';
			case 'file':
				return '文件';
			case 'url':
				return '网址';
		}
	}

	private createDividerSetting(
		actionsGroup: SettingGroup,
		index: number,
		area: Exclude<ButtonArea, 'page-header'>,
		sortableItems: PointerSortItem[],
	): void {
		actionsGroup.addSetting((setting) => {
			setting.settingEl.addClass('basic-vault-button-setting');
			setting.setName('分割线');
			setting.setDesc('用于分隔自定义按钮');

			setting.addExtraButton((extraButton) => extraButton
				.setIcon('trash')
				.setTooltip('删除分割线')
				.onClick(() => {
					void this.confirmRemoveItem(area, index);
				}));

			const handle = this.addDragHandle(setting);
			sortableItems.push({ key: `${area}:${index}`, element: setting.settingEl, handle });
		});
	}

	private addDragHandle(setting: Setting): HTMLElement {
		const dragHandle = setting.controlEl.createDiv({
			cls: 'basic-vault-button-drag-handle',
			attr: { 'aria-label': '拖拽排序' }
		});
		setIcon(dragHandle, 'grip-vertical');
		return dragHandle;
	}

	private getCommandDisplayName(commandId: string): string {
		if (!commandId) {
			return '未设置命令';
		}

		return this.commandNameById.get(commandId) || commandId;
	}

	private getAreaLabel(area: ButtonArea): string {
		switch (area) {
			case 'left-ribbon':
				return '左侧边栏';
			case 'page-header':
				return '标题栏';
			case 'note-toolbar':
				return '笔记工具栏';
			case 'selection-toolbar':
				return '选中文本工具栏';
		}
	}

	private async reorderItems(area: ButtonArea, fromIndex: number, toIndex: number) {
		const items = this.getItems(area);
		const [movedItem] = items.splice(fromIndex, 1);
		if (!movedItem) return;
		items.splice(toIndex, 0, movedItem);
		await this.plugin.saveSettings();
	}

	private destroySortController(): void {
		this.sortController?.destroy();
		this.sortController = null;
	}

	private getItems(area: ButtonArea) {
		switch (area) {
			case 'left-ribbon':
				return this.plugin.settings.leftRibbonItems;
			case 'page-header':
				return this.plugin.settings.pageHeaderItems;
			case 'note-toolbar':
				return this.plugin.settings.noteToolbarItems;
			case 'selection-toolbar':
				return this.plugin.settings.selectionToolbarItems;
		}
	}
}
