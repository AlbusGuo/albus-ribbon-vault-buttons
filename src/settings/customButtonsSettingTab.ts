import { App, Plugin, PluginSettingTab, Setting, SettingGroup, setIcon, setTooltip } from 'obsidian';
import { CustomButton, RibbonVaultButtonsSettings } from '../types';
import { createCustomButton, createDivider } from '../settings';
import { ButtonEditorModal } from '../modals/buttonEditorModal';
import { ConfirmModal } from '../modals/confirmModal';
import { getRegisteredCommands } from '../utils/commandRegistry';
import { CustomIconManager } from '../utils/customIconManager';
import { FolderSuggester } from '../utils/folderSuggester';
import { PointerSortController, PointerSortItem } from '../utils/pointerSortController';

type SettingsTabKey = RibbonVaultButtonsSettings['settingsTab'];
type ButtonArea = Exclude<SettingsTabKey, 'general'>;

interface RibbonVaultButtonsPlugin extends Plugin {
	settings: RibbonVaultButtonsSettings;
	saveSettings(): Promise<void>;
	initVaultButtons(): void;
	buttonManager: {
		applyStyleSettings(hideBuiltInButtons?: boolean): void;
		applyDefaultActionsStyle(hideDefaultActions?: boolean): void;
		refreshButtonIcons(iconName?: string, loadUncachedIcons?: boolean): void;
	};
	customIconManager: CustomIconManager;
}

export class CustomButtonsSettingTab extends PluginSettingTab {
	plugin: RibbonVaultButtonsPlugin;
	private sortController: PointerSortController | null = null;
	private commandNameById = new Map<string, string>();

	icon: string = 'panel-left';

	constructor(app: App, plugin: RibbonVaultButtonsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		this.destroySortController();
		containerEl.empty();
		containerEl.addClass('basic-vault-settings-root');
		this.commandNameById.clear();

		// 固定顶部标签栏
		const tabsEl = containerEl.createEl('div', { cls: 'basic-vault-settings-tabs' });

		this.createTabButton(tabsEl, 'general', '通用');
		this.createTabButton(tabsEl, 'left-ribbon', '左侧边栏');
		this.createTabButton(tabsEl, 'page-header', '页首');

		// 可滚动内容区域
		const scrollEl = containerEl.createDiv({ cls: 'basic-vault-settings-scroll' });
		const contentEl = scrollEl.createDiv({ cls: 'basic-vault-settings-content' });

		this.renderActiveTab(contentEl);
	}

	hide(): void {
		this.destroySortController();
		super.hide();
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

		const items = this.getItems(area);
		const itemsGroup = new SettingGroup(contentEl);
		const sortableItems: PointerSortItem[] = [];

		if (items.length === 0) {
			itemsGroup.addSetting((setting) => {
				setting
					.setName(area === 'left-ribbon' ? '还没有添加左侧边栏按钮' : '还没有添加页首按钮')
					.setDesc(area === 'left-ribbon' ? '点击下方按钮开始创建左侧边栏按钮或分割线' : '点击下方按钮开始创建页首按钮');
			});
		} else {
			items.forEach((item, index) => {
				if (item.type === 'divider') {
					this.createDividerSetting(itemsGroup, index, 'left-ribbon', sortableItems);
					return;
				}

				this.createButtonSetting(itemsGroup, item, index, area, sortableItems);
			});
		}

		itemsGroup.addSetting((addSetting) => {
			addSetting.settingEl.addClass('basic-vault-item-add-setting');
			addSetting.controlEl.addClass('basic-vault-item-add-container');

			addSetting.addButton((button) => {
				button
					.setButtonText('添加新按钮')
					.setClass('basic-vault-item-add-btn')
					.onClick(() => {
						void this.addCustomButton(area);
					});
			});

			if (area === 'left-ribbon') {
				addSetting.addButton((button) => {
					button
						.setButtonText('添加分割线')
						.setClass('basic-vault-item-add-btn')
						.onClick(() => {
							void this.addDivider();
						});
				});
			}
		});

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
				.setName('自定义图标文件夹')
				.setDesc('自定义图标目录')
				.addText((text) => {
					text
						.setPlaceholder('例如: Assets/Icons')
						.setValue(this.plugin.settings.iconFolder)
						.onChange(async (value) => {
							this.plugin.settings.iconFolder = value.trim();
							await this.plugin.saveSettings();
						});

					new FolderSuggester(this.app, text.inputEl);
				});
		});

		settingsGroup.addSetting((setting) => {
			setting
				.setName('图标遮罩')
				.setDesc('开启后将自定义 SVG 图标强制渲染为 Obsidian 默认图标颜色, 关闭后保留原始颜色')
				.addToggle((toggle) => toggle
					.setValue(this.plugin.settings.iconMask)
					.onChange(async (value) => {
						this.plugin.settings.iconMask = value;
						await this.plugin.saveSettings();
						this.plugin.buttonManager.refreshButtonIcons();
						this.display();
					}));
		});
	}

	private async addCustomButton(area: ButtonArea) {
		const newButton = createCustomButton();
		this.getItems(area).push(newButton);
		await this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();

		const index = this.getItems(area).length - 1;
		this.openButtonEditor(area, index, true);
	}

	private async addDivider() {
		this.plugin.settings.leftRibbonItems.push(createDivider());
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
		const confirmed = await ConfirmModal.confirm(this.app, {
			title: isDivider ? '删除分割线' : '删除按钮',
			message: isDivider
				? '确定要删除这条分割线吗? 此操作会立即生效.'
				: `确定要删除 "${(item as CustomButton).tooltip.trim() || '未命名按钮'}" 吗? 此操作会立即生效.`,
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
			setting.settingEl.dataset.index = index.toString();
			setting.settingEl.dataset.area = area;
			setting.setName(button.tooltip.trim() || '未命名按钮');
			setting.setDesc(this.getButtonSummary(button));
			this.decorateButtonName(setting, button);

			setting
				.addExtraButton((extraButton) => extraButton
					.setIcon('pencil')
					.setTooltip('编辑按钮')
					.onClick(() => {
						this.openButtonEditor(area, index);
					}))
				.addExtraButton((extraButton) => extraButton
					.setIcon('trash')
					.setTooltip('删除按钮')
					.onClick(() => {
						void this.confirmRemoveItem(area, index);
					}));

			const handle = this.addDragHandle(setting);
			sortableItems.push({ key: `${area}:${index}`, element: setting.settingEl, handle });
		});
	}

	private openButtonEditor(area: ButtonArea, index: number, refreshOnClose: boolean = true) {
		const item = this.getItems(area)[index];
		if (!item || item.type === 'divider') {
			return;
		}

		new ButtonEditorModal(this.app, item, {
			iconFolder: this.plugin.settings.iconFolder,
			iconMask: this.plugin.settings.iconMask,
			onChange: async (savedButton) => {
				this.getItems(area)[index] = savedButton;
				await this.plugin.saveSettings();
				this.plugin.initVaultButtons();
			},
			onClose: () => {
				if (refreshOnClose) {
					this.display();
				}
			}
		}).open();
	}

	private decorateButtonName(setting: Setting, button: CustomButton) {
		setting.nameEl.empty();

		const nameWrapEl = setting.nameEl.createSpan({ cls: 'basic-vault-button-name-wrap' });
		const primaryIconName = button.icon || 'help-circle';
		const toggleIconName = button.toggleIcon || primaryIconName;
		const shouldAnimateToggle = primaryIconName !== toggleIconName;
		const iconWrapEl = nameWrapEl.createSpan({
			cls: `basic-vault-button-name-icon${shouldAnimateToggle ? ' is-animated' : ''}`,
		});
		const iconStackEl = iconWrapEl.createSpan({ cls: 'basic-vault-button-name-icon-stack' });
		const primaryPreviewEl = iconStackEl.createSpan({ cls: 'basic-vault-button-name-icon-layer is-primary' });
		const togglePreviewEl = shouldAnimateToggle
			? iconStackEl.createSpan({ cls: 'basic-vault-button-name-icon-layer is-toggle' })
			: null;
		nameWrapEl.createSpan({
			cls: 'basic-vault-button-name-text',
			text: button.tooltip.trim() || '未命名按钮'
		});

		const tooltipText = shouldAnimateToggle
			? `主图标: ${this.plugin.customIconManager.getDisplayName(primaryIconName)}\n切换图标: ${this.plugin.customIconManager.getDisplayName(toggleIconName)}`
			: `图标: ${this.plugin.customIconManager.getDisplayName(primaryIconName)}`;
		setTooltip(iconWrapEl, tooltipText);

		void this.renderNameIconPreview(primaryPreviewEl, primaryIconName);
		if (togglePreviewEl) {
			void this.renderNameIconPreview(togglePreviewEl, toggleIconName);
		}
	}

	private async renderNameIconPreview(previewEl: HTMLElement, iconName: string) {
		previewEl.empty();

		if (this.plugin.customIconManager.isCustomIcon(iconName)) {
			const rendered = await this.plugin.customIconManager.renderIcon(iconName, previewEl, this.plugin.settings.iconMask);
			if (!rendered) {
				previewEl.setText('?');
			}
			return;
		}

		try {
			setIcon(previewEl, iconName || 'help-circle');
		} catch {
			previewEl.setText('?');
		}
	}

	private getButtonSummary(button: CustomButton): string {
		const target = (() => {
			switch (button.type) {
				case 'command':
					return this.getCommandDisplayName(button.command);
				case 'command-group':
					return this.getCommandGroupSummary(button.commands);
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
			case 'command-group':
				return '命令组';
			case 'file':
				return '文件';
			case 'url':
				return '网址';
		}
	}

	private createDividerSetting(
		actionsGroup: SettingGroup,
		index: number,
		area: Extract<ButtonArea, 'left-ribbon'>,
		sortableItems: PointerSortItem[],
	): void {
		actionsGroup.addSetting((setting) => {
			setting.settingEl.addClass('basic-vault-button-setting');
			setting.settingEl.dataset.index = index.toString();
			setting.settingEl.dataset.area = area;
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

	private getCommandGroupSummary(commandIds: string[]): string {
		const names = commandIds
			.map((commandId) => this.getCommandDisplayName(commandId))
			.filter((name) => name !== '未设置命令');

		if (names.length === 0) {
			return '未设置命令组';
		}

		return names.join(',');
	}

	private getCommandDisplayName(commandId: string): string {
		if (!commandId) {
			return '未设置命令';
		}

		return this.commandNameById.get(commandId) || commandId;
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
		return area === 'left-ribbon'
			? this.plugin.settings.leftRibbonItems
			: this.plugin.settings.pageHeaderItems;
	}
}
