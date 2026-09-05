import { Plugin } from 'obsidian';
import { RibbonVaultButtonsSettings, ButtonItem } from './src/types';
import { sanitizeSettingsShape } from './src/settings';
import { ButtonManager } from './src/utils/buttonManager';
import { CustomButtonsSettingTab } from './src/settings/customButtonsSettingTab';
import { SettingsWriteQueue } from './src/utils/settingsWriteQueue';
import { NoteToolbarManager } from './src/utils/noteToolbarManager';
import { SelectionToolbarManager } from './src/utils/selectionToolbarManager';
import { CustomIconsIntegration } from './src/integrations/customIconsIntegration';

/**
 * Custom Buttons 插件主类
 * 为 Obsidian 的侧边栏, 标题栏和 Markdown 视图提供自定义按钮
 */
export default class RibbonVaultButtonsPlugin extends Plugin {
	settings: RibbonVaultButtonsSettings;
	buttonManager: ButtonManager;
	customIconsIntegration: CustomIconsIntegration;
	private noteToolbarManager: NoteToolbarManager;
	private selectionToolbarManager: SelectionToolbarManager;
	private settingTab: CustomButtonsSettingTab;
	private settingsWriteQueue: SettingsWriteQueue<RibbonVaultButtonsSettings>;
	private buttonRefreshFrame: number | null = null;
	private isUnloading = false;

	async onload() {
		this.isUnloading = false;
		this.settingsWriteQueue = new SettingsWriteQueue(
			(data) => this.saveData(data),
		);

		await this.loadSettings();
		this.customIconsIntegration = new CustomIconsIntegration(
			this.app,
			this.manifest.id,
			() => {
				if (!this.isUnloading && this.buttonManager) {
					this.buttonManager.refreshButtonIcons();
					this.settingTab?.refreshIntegratedIconPreviews();
				}
			},
		);

		this.buttonManager = new ButtonManager(
			this.app,
			this.handleButtonIconStateChange.bind(this),
			this.reorderButtons.bind(this),
			this.initVaultButtons.bind(this),
			this.waitForSettingsWrites.bind(this),
			() => this.settings.buttonGroupTrigger,
			(element, iconName) => this.customIconsIntegration.renderIcon(element, iconName)
		);
		this.noteToolbarManager = new NoteToolbarManager(
			this.app,
			(parentEl, button, index) =>
				this.buttonManager.createContentToolbarButton(
					parentEl,
					button,
					index,
					'note',
				),
			this.reorderNoteToolbarItems.bind(this),
			this.initVaultButtons.bind(this),
		);
		this.selectionToolbarManager = new SelectionToolbarManager(
			this.app,
			(parentEl, button, index) =>
				this.buttonManager.createContentToolbarButton(
					parentEl,
					button,
					index,
					'selection',
				),
		);
		this.selectionToolbarManager.register(this);
		this.registerEditorExtension(this.selectionToolbarManager.getEditorExtension());

		this.buttonManager.applyStyleSettings(this.settings.hideBuiltInButtons);
		this.buttonManager.applyDefaultActionsStyle(this.settings.hideDefaultActions);
		this.refreshVaultButtonsNow();
		this.syncCustomIcons();

		this.settingTab = new CustomButtonsSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);

		this.registerEvent(this.app.workspace.on('layout-change', () => {
			this.syncCustomIcons();
			this.buttonManager.syncWorkspaceLayout(
				this.settings.leftRibbonItems,
				this.settings.pageHeaderItems,
				this.settings.hideBuiltInButtons,
			);
			this.noteToolbarManager.sync(
				this.settings.noteToolbarItems,
				this.settings.noteToolbarPosition,
			);
		}));

		this.app.workspace.onLayoutReady(() => {
			if (this.isUnloading) {
				return;
			}

			this.buttonManager.syncWorkspaceLayout(
				this.settings.leftRibbonItems,
				this.settings.pageHeaderItems,
				this.settings.hideBuiltInButtons,
			);
			this.noteToolbarManager.sync(
				this.settings.noteToolbarItems,
				this.settings.noteToolbarPosition,
			);
			this.syncCustomIcons();
		});
	}

	onunload() {
		this.isUnloading = true;
		if (this.buttonRefreshFrame !== null) {
			window.cancelAnimationFrame(this.buttonRefreshFrame);
			this.buttonRefreshFrame = null;
		}
		if (this.buttonManager) {
			this.selectionToolbarManager?.destroy();
			this.noteToolbarManager?.destroy();
			this.buttonManager.destroy();
		}
		this.customIconsIntegration?.destroy();
	}

	// =========================================================================
	// 数据持久化
	// =========================================================================

	/**
	 * 加载设置
	 */
	async loadSettings() {
		const rawData = await this.loadData();
		this.settings = sanitizeSettingsShape(rawData);
	}

	/**
	 * 保存设置
	 *
	 * 保存前始终通过 sanitizeSettingsShape 清理数据形状,
	 * 快速连续的请求会合并, 并严格串行调用 Obsidian saveData.
	 */
	async saveSettings() {
		this.settings = sanitizeSettingsShape(this.settings);
		await this.settingsWriteQueue.save(this.settings);
		this.syncCustomIcons();
	}

	private syncCustomIcons(): void {
		if (!this.customIconsIntegration) return;
		void this.customIconsIntegration
			.syncRequiredIcons(this.collectRequiredIconIds())
			.catch((error) => {
				console.error('Custom Buttons failed to sync Custom Icons requirements:', error);
			});
	}

	private collectRequiredIconIds(): string[] {
		const iconIds = new Set<string>();
		const collect = (iconName: string): void => {
			const normalizedIconName = iconName.trim();
			if (normalizedIconName) iconIds.add(normalizedIconName);
		};
		const collectButton = (button: Exclude<ButtonItem, { type: 'divider' }>): void => {
			collect(button.icon);
			collect(button.toggleIcon || button.icon);
			if (button.kind === 'group') {
				for (const groupItem of button.groupItems) {
					collect(groupItem.icon);
					collect(groupItem.toggleIcon || groupItem.icon);
				}
			}
		};
		const collectItems = (items: ButtonItem[]): void => {
			for (const item of items) {
				if (item.type === 'divider') continue;
				collectButton(item);
			}
		};

		collectItems(this.settings.leftRibbonItems);
		collectItems(this.settings.pageHeaderItems);
		collectItems(this.settings.noteToolbarItems);
		collectItems(this.settings.selectionToolbarItems);
		return Array.from(iconIds).sort();
	}

	/**
	 * 初始化所有按钮
	 */
	initVaultButtons() {
		if (!this.buttonManager || this.buttonRefreshFrame !== null) {
			return;
		}

		this.buttonRefreshFrame = window.requestAnimationFrame(() => {
			this.buttonRefreshFrame = null;
			this.refreshVaultButtonsNow();
		});
	}

	private refreshVaultButtonsNow(): void {
		if (!this.buttonManager) {
			return;
		}

		this.buttonManager.initVaultButtons(
			this.settings.leftRibbonItems,
			this.settings.pageHeaderItems,
			this.settings.noteToolbarItems,
			this.settings.selectionToolbarItems,
			this.settings.hideBuiltInButtons,
		);
		this.noteToolbarManager.renderAll(
			this.settings.noteToolbarItems,
			this.settings.noteToolbarPosition,
		);
		this.selectionToolbarManager.setItems(
			this.settings.selectionToolbarItems,
			this.settings.selectionToolbarOnKeyboard,
		);
	}

	private async handleButtonIconStateChange(buttonId: string, iconState: boolean) {
		const [area, rawIndex] = buttonId.split('-');
		const index = Number.parseInt(rawIndex, 10);
		if (!Number.isInteger(index) || index < 0) {
			return;
		}

		const item = (() => {
			switch (area) {
				case 'left':
					return this.settings.leftRibbonItems[index];
				case 'page':
					return this.settings.pageHeaderItems[index];
				case 'note':
					return this.settings.noteToolbarItems[index];
				case 'selection':
					return this.settings.selectionToolbarItems[index];
				default:
					return null;
			}
		})();

		if (!item || item.type === 'divider') {
			return;
		}

		item.iconState = iconState;
		await this.saveSettings();
	}

	private waitForSettingsWrites(): Promise<void> {
		return this.settingsWriteQueue.whenIdle();
	}

	/**
	 * 重新排序按钮项
	 */
	async reorderButtons(sourceIndex: number, targetIndex: number) {
		if (sourceIndex === targetIndex) return;
		
		const [movedItem] = this.settings.leftRibbonItems.splice(sourceIndex, 1);
		if (!movedItem) return;
		this.settings.leftRibbonItems.splice(targetIndex, 0, movedItem);
		
		await this.saveSettings();
	}

	private async reorderNoteToolbarItems(sourceIndex: number, targetIndex: number): Promise<void> {
		if (sourceIndex === targetIndex) return;

		const [movedItem] = this.settings.noteToolbarItems.splice(sourceIndex, 1);
		if (!movedItem) return;
		this.settings.noteToolbarItems.splice(targetIndex, 0, movedItem);

		await this.saveSettings();
	}
}
