import { Plugin } from 'obsidian';
import { RibbonVaultButtonsSettings } from './src/types';
import { DEFAULT_SETTINGS } from './src/settings';
import { ButtonManager } from './src/utils/buttonManager';
import { CustomButtonsSettingTab } from './src/settings/customButtonsSettingTab';

/**
 * Ribbon Vault Buttons 插件主类
 * 为 Obsidian 添加自定义底部侧边栏按钮功能
 */
export default class RibbonVaultButtonsPlugin extends Plugin {
	settings: RibbonVaultButtonsSettings;
	private buttonManager: ButtonManager;
	private styleEl: HTMLStyleElement | null = null;

	async onload() {
		await this.loadSettings();
		
		// 注入CSS样式
		this.injectStyles();
		
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
		// 移除CSS样式
		if (this.styleEl) {
			this.styleEl.remove();
			this.styleEl = null;
		}
		
		if (this.buttonManager) {
			this.buttonManager.destroy();
		}
	}

	/**
	 * 注入CSS样式
	 */
	private injectStyles() {
		// 读取CSS文件内容
		const cssContent = `
/* 主容器样式 */
.basic-vault-button-header {
  margin-bottom: 16px;
}

.basic-vault-button-header h2 {
  margin: 0;
  color: var(--text-normal);
  font-size: 18px;
  font-weight: 600;
}

/* 描述文本样式 */
.basic-vault-button-description {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--background-primary);
  border-radius: 6px;
  border-left: 2px solid var(--interactive-accent);
}

/* 添加按钮样式 */
.basic-vault-button-add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s ease;
  margin: 16px 0;
}

.basic-vault-button-add-btn:hover {
  background: var(--interactive-accent-hover);
}

/* 分割线 */
.basic-vault-button-divider {
  height: 1px;
  background: var(--background-modifier-border);
  margin: 16px 0;
}

/* 部分标题 */
.basic-vault-button-section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-normal);
  margin-bottom: 12px;
}

/* 空状态样式 */
.basic-vault-button-empty {
  text-align: center;
  padding: 32px 20px;
  color: var(--text-muted);
  background: var(--background-secondary);
  border-radius: 8px;
  border: 1px solid var(--background-modifier-border);
  margin: 16px 0;
}

.basic-vault-button-empty p {
  margin: 8px 0;
  font-size: 14px;
}

.basic-vault-button-empty .setting-item-description {
  font-size: 12px;
  opacity: 0.7;
}

/* 设置项卡片样式 - 紧凑版本 */
.basic-vault-button-setting-item {
  background: var(--background-secondary);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--background-modifier-border);
  transition: all 0.2s ease;
}

.basic-vault-button-setting-item:hover {
  border-color: var(--interactive-accent);
}

/* 设置项头部 */
.basic-vault-button-setting-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.basic-vault-button-setting-title {
  font-weight: 600;
  color: var(--text-normal);
  font-size: 14px;
}

/* 操作按钮组 */
.basic-vault-button-setting-actions {
  display: flex;
  gap: 4px;
}

.basic-vault-button-action-btn {
  padding: 4px 8px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--background-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 11px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.basic-vault-button-action-btn:hover:not(:disabled) {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.basic-vault-button-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.basic-vault-button-delete-btn {
  background: var(--color-red);
  border-color: var(--color-red);
  color: white;
  font-size: 11px;
}

.basic-vault-button-delete-btn:hover {
  background: var(--color-red-dark);
}

/* 设置内容区域 */
.basic-vault-button-setting-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 设置项样式优化 */
.basic-vault-button-setting-item .setting-item {
  border-top: none;
  padding-top: 0;
  padding-bottom: 0;
  background: transparent;
}

.basic-vault-button-setting-item .setting-item-info {
  margin-bottom: 4px;
}

.basic-vault-button-setting-item .setting-item-name {
  font-weight: 600;
  color: var(--text-normal);
  font-size: 13px;
  margin-bottom: 2px;
}

.basic-vault-button-setting-item .setting-item-description {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.3;
}

.basic-vault-button-setting-item .setting-item-control {
  margin-top: 4px;
}

/* 输入框和下拉菜单样式优化 */
.basic-vault-button-setting-item input[type="text"],
.basic-vault-button-setting-item .dropdown {
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 13px;
  transition: all 0.2s ease;
  min-height: 28px;
}

.basic-vault-button-setting-item input[type="text"]:focus,
.basic-vault-button-setting-item .dropdown:focus {
  border-color: var(--interactive-accent);
  box-shadow: 0 0 0 1px rgba(var(--interactive-accent-rgb), 0.1);
  outline: none;
}

/* 命令搜索样式 */
.command-search-container {
  position: relative;
  width: 100%;
}

.command-search-button {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 11px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.command-search-button:hover {
  background: var(--interactive-accent-hover);
}

.command-search-input {
  padding-right: 70px !important;
  width: 100%;
}

/* 拖拽排序样式 */
.custom-ribbon-button {
  transition: all 0.2s ease;
  position: relative;
}

.custom-ribbon-button:hover {
  background-color: var(--background-modifier-hover);
}

.custom-ribbon-button.dragging {
  opacity: 0.5;
}

.custom-ribbon-button.drag-over {
  border: 2px dashed var(--interactive-accent);
  background-color: var(--background-modifier-hover);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .basic-vault-button-setting-header {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .basic-vault-button-setting-actions {
    align-self: flex-end;
  }
  
  .basic-vault-button-add-btn {
    width: 100%;
    justify-content: center;
  }
  
  .basic-vault-button-setting-item {
    padding: 12px;
    margin-bottom: 8px;
  }
  
  .basic-vault-button-empty {
    padding: 24px 16px;
    margin: 12px 0;
  }
}

/* 暗色模式优化 */
.theme-dark .basic-vault-button-setting-item {
  background: var(--background-secondary);
}

.theme-dark .basic-vault-button-description {
  background: var(--background-secondary);
}
		`;

		// 创建style元素
		this.styleEl = document.createElement('style');
		this.styleEl.textContent = cssContent;
		document.head.appendChild(this.styleEl);
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
