import { Plugin } from 'obsidian';
import { RibbonVaultButtonsSettings } from './src/types';
import { DEFAULT_SETTINGS } from './src/settings';
import { ButtonManager } from './src/utils/buttonManager';
import { CustomButtonsSettingTab } from './src/settings/customButtonsSettingTab';
import './src/styles.css';

/**
 * Ribbon Vault Buttons 插件主类
 * 为 Obsidian 添加自定义底部侧边栏按钮功能
 */
export default class RibbonVaultButtonsPlugin extends Plugin {
	settings: RibbonVaultButtonsSettings;
	private buttonManager: ButtonManager;

	async onload() {
		await this.loadSettings();
		
		// 初始化按钮管理器
		this.buttonManager = new ButtonManager(
			this.app, 
			this.handleSettingsChange.bind(this),
			this.reorderButtons.bind(this)
		);
		
		// 应用样式和初始化按钮
		this.buttonManager.applyStyleSettings();
		this.initVaultButtons();
		
		// 添加设置选项卡
		this.addSettingTab(new CustomButtonsSettingTab(this.app, this));
	}

	onunload() {
		if (this.buttonManager) {
			this.buttonManager.destroy();
		}
	}

	/**
	 * 加载设置
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * 保存设置
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * 初始化所有按钮
	 */
	initVaultButtons() {
		if (this.buttonManager) {
			this.buttonManager.initVaultButtons(this.settings.customButtons);
		}
	}

	/**
	 * 处理设置变化
	 */
	private handleSettingsChange() {
		// 重新排序按钮的逻辑可以在这里实现
		// 目前先保存设置并重新初始化
		this.saveSettings();
		this.initVaultButtons();
	}

	/**
	 * 重新排序按钮
	 */
	reorderButtons(sourceIndex: number, targetIndex: number) {
		if (sourceIndex === targetIndex) return;
		
		// 重新排序数组
		const [movedButton] = this.settings.customButtons.splice(sourceIndex, 1);
		this.settings.customButtons.splice(targetIndex, 0, movedButton);
		
		// 保存设置并重新初始化按钮
		this.saveSettings();
		this.initVaultButtons();
	}
}
