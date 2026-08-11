import { normalizePath, Plugin, TFile, TFolder } from 'obsidian';
import { RibbonVaultButtonsSettings, ButtonItem } from './src/types';
import { sanitizeSettingsShape } from './src/settings';
import { ButtonManager } from './src/utils/buttonManager';
import { CustomButtonsSettingTab } from './src/settings/customButtonsSettingTab';
import { CustomIconManager } from './src/utils/customIconManager';
import { migrateLegacyCustomIcons } from './src/utils/legacyIconMigration';
import { SettingsWriteQueue } from './src/utils/settingsWriteQueue';

/**
 * Ribbon Vault Buttons 插件主类
 * 为 Obsidian 添加自定义底部侧边栏按钮功能
 */
export default class RibbonVaultButtonsPlugin extends Plugin {
	settings: RibbonVaultButtonsSettings;
	buttonManager: ButtonManager;
	customIconManager: CustomIconManager;
	private settingsWriteQueue: SettingsWriteQueue<RibbonVaultButtonsSettings>;
	private buttonRefreshFrame: number | null = null;
	private isUnloading = false;

	async onload() {
		this.isUnloading = false;
		this.customIconManager = CustomIconManager.getInstance(this.app);
		this.customIconManager.setLegacyIconDirectory(normalizePath(`${this.pluginDirectory}/custom-icons`));
		this.settingsWriteQueue = new SettingsWriteQueue(
			(data) => this.saveData(data),
		);

		await this.loadSettings();

		this.buttonManager = new ButtonManager(
			this.app,
			this.handleButtonIconStateChange.bind(this),
			this.reorderButtons.bind(this),
			this.initVaultButtons.bind(this),
			this.waitForSettingsWrites.bind(this),
			() => this.settings.iconMask
		);

		this.buttonManager.applyStyleSettings(this.settings.hideBuiltInButtons);
		this.buttonManager.applyDefaultActionsStyle(this.settings.hideDefaultActions);
		this.refreshVaultButtonsNow(false);

		this.addSettingTab(new CustomButtonsSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on('layout-change', () => {
			this.buttonManager.syncWorkspaceLayout(
				this.settings.leftRibbonItems,
				this.settings.pageHeaderItems,
				this.settings.hideBuiltInButtons,
			);
		}));

		this.registerEvent(this.app.vault.on('modify', (file) => {
			if (file instanceof TFile && file.extension.toLowerCase() === 'svg') {
				void this.refreshCustomIcon(file.path).catch((error) => {
					console.error('Custom Buttons failed to refresh a modified icon:', error);
				});
			}
		}));
		this.registerEvent(this.app.vault.on('delete', (file) => {
			if (file instanceof TFile && file.extension.toLowerCase() === 'svg') {
				this.invalidateCustomIcon(file.path);
			}
		}));
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			const isIconFile = file instanceof TFile &&
				(file.extension.toLowerCase() === 'svg' || oldPath.toLowerCase().endsWith('.svg'));
			if (isIconFile || file instanceof TFolder) {
				void this.handleCustomIconRename(oldPath, file.path, file instanceof TFolder).catch((error) => {
					console.error('Custom Buttons failed to save a renamed icon reference:', error);
				});
			}
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
			void this.customIconManager
				.preloadIcons(this.collectReferencedCustomIcons())
				.then(() => {
					if (!this.isUnloading) {
						this.buttonManager.refreshButtonIcons();
					}
				})
				.catch((error) => {
					console.error('Custom Buttons failed to preload icons after layout became ready:', error);
					if (!this.isUnloading) {
						this.buttonManager.refreshButtonIcons();
					}
				});
		});
	}

	onunload() {
		this.isUnloading = true;
		if (this.buttonRefreshFrame !== null) {
			window.cancelAnimationFrame(this.buttonRefreshFrame);
			this.buttonRefreshFrame = null;
		}
		if (this.buttonManager) {
			this.buttonManager.destroy();
		}
	}

	// =========================================================================
	// 数据持久化 (参考 custom-about-blank 的白名单策略)
	// =========================================================================

	/**
	 * 加载设置
	 */
	async loadSettings() {
		const rawData = await this.loadData();
		if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
			const { migratedData, didMigrateLegacyIcons } = await migrateLegacyCustomIcons(
				this.app,
				rawData,
				this.pluginDirectory,
				this.customIconManager,
			);
			this.settings = sanitizeSettingsShape(migratedData);
			if (didMigrateLegacyIcons) {
				await this.saveSettings();
			}
			return;
		}

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
	}

	private get pluginDirectory(): string {
		return this.manifest.dir ??
			normalizePath(`${this.app.vault.configDir}/plugins/${this.manifest.id}`);
	}

	private collectReferencedCustomIcons(): string[] {
		const iconNames = new Set<string>();
		const collect = (iconName: string): void => {
			if (this.customIconManager.isCustomIcon(iconName)) {
				iconNames.add(iconName);
			}
		};

		for (const item of this.settings.leftRibbonItems) {
			if (item.type === 'divider') {
				continue;
			}

			collect(item.icon);
			collect(item.toggleIcon || item.icon);
		}

		for (const item of this.settings.pageHeaderItems) {
			collect(item.icon);
			collect(item.toggleIcon || item.icon);
		}

		return Array.from(iconNames);
	}

	private isCustomIconReferenced(iconReference: string): boolean {
		for (const item of this.settings.leftRibbonItems) {
			if (
				item.type !== 'divider' &&
				(item.icon === iconReference || item.toggleIcon === iconReference)
			) {
				return true;
			}
		}

		return this.settings.pageHeaderItems.some(
			(item) => item.icon === iconReference || item.toggleIcon === iconReference,
		);
	}

	private async refreshCustomIcon(filePath: string): Promise<void> {
		const iconReference = this.customIconManager.createIconReference(filePath);
		const isReferenced = this.isCustomIconReferenced(iconReference);
		if (!isReferenced && !this.customIconManager.hasCachedOrPendingIcon(iconReference)) {
			return;
		}

		this.customIconManager.invalidateIcon(iconReference);
		if (!isReferenced) {
			return;
		}

		await this.customIconManager.preloadIcons([iconReference]);
		this.buttonManager.refreshButtonIcons(iconReference);
	}

	private invalidateCustomIcon(filePath: string): void {
		const iconReference = this.customIconManager.createIconReference(filePath);
		const isReferenced = this.isCustomIconReferenced(iconReference);
		if (!isReferenced && !this.customIconManager.hasCachedOrPendingIcon(iconReference)) {
			return;
		}

		this.customIconManager.invalidateIcon(iconReference);
		if (isReferenced) {
			this.buttonManager.refreshButtonIcons(iconReference);
		}
	}

	private async handleCustomIconRename(oldPath: string, newPath: string, isFolder: boolean): Promise<void> {
		const normalizedOldPath = normalizePath(oldPath);
		const normalizedNewPath = normalizePath(newPath);
		const replacedReferences = new Map<string, string>();
		let didChange = false;

		const updateReferences = (items: ButtonItem[]): void => {
			for (const item of items) {
				if (item.type === 'divider') {
					continue;
				}

				for (const property of ['icon', 'toggleIcon'] as const) {
					const iconReference = item[property];
					const filePath = this.customIconManager.getFilePath(iconReference);
					const isRenamedPath = filePath === normalizedOldPath ||
						(isFolder && filePath?.startsWith(`${normalizedOldPath}/`));
					if (!filePath || !isRenamedPath) {
						continue;
					}

					const renamedPath = `${normalizedNewPath}${filePath.slice(normalizedOldPath.length)}`;
					const newReference = this.customIconManager.createIconReference(renamedPath);
					item[property] = newReference;
					replacedReferences.set(iconReference, newReference);
					didChange = true;
				}
			}
		};

		updateReferences(this.settings.leftRibbonItems);
		updateReferences(this.settings.pageHeaderItems);

		for (const [oldReference, newReference] of replacedReferences) {
			this.customIconManager.invalidateIcon(oldReference);
			if (this.customIconManager.hasCachedOrPendingIcon(newReference)) {
				this.customIconManager.invalidateIcon(newReference);
			}
		}
		if (!didChange) {
			return;
		}

		await this.customIconManager.preloadIcons(Array.from(replacedReferences.values()));
		await this.saveSettings();
		this.initVaultButtons();
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

	private refreshVaultButtonsNow(loadUncachedIcons = true): void {
		if (!this.buttonManager) {
			return;
		}

		this.buttonManager.initVaultButtons(
			this.settings.leftRibbonItems,
			this.settings.pageHeaderItems,
			this.settings.hideBuiltInButtons,
			loadUncachedIcons,
		);
	}

	private async handleButtonIconStateChange(buttonId: string, iconState: boolean) {
		const [area, rawIndex] = buttonId.split('-');
		const index = Number.parseInt(rawIndex, 10);
		if (!Number.isInteger(index) || index < 0) {
			return;
		}

		const item = area === 'left'
			? this.settings.leftRibbonItems[index]
			: area === 'page'
				? this.settings.pageHeaderItems[index]
				: null;

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
}
