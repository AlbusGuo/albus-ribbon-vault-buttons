import { App, PluginSettingTab, Setting, Plugin } from 'obsidian';
import { CustomButton } from '../types';
import { createCustomButton } from '../settings';
import { FileSuggestModal } from '../modals/fileSuggestModal';
import { CommandSuggestModal } from '../modals/commandSuggestModal';

// 前向声明主类
interface RibbonVaultButtonsPlugin extends Plugin {
	settings: { customButtons: CustomButton[] };
	saveSettings(): Promise<void>;
	initVaultButtons(): void;
}

/**
 * 自定义按钮设置选项卡
 */
export class CustomButtonsSettingTab extends PluginSettingTab {
	plugin: RibbonVaultButtonsPlugin;

	constructor(app: App, plugin: RibbonVaultButtonsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.createHeader(containerEl);
		this.createDescription(containerEl);

		if (this.plugin.settings.customButtons.length === 0) {
			this.createEmptyState(containerEl);
		} else {
			this.createButtonsList(containerEl);
		}

		this.createAddButton(containerEl);
	}

	/**
	 * 创建页面标题
	 */
	private createHeader(containerEl: HTMLElement) {
		containerEl.createEl('h2', { text: '自定义底部侧边栏按钮' });
	}

	/**
	 * 创建描述文本
	 */
	private createDescription(containerEl: HTMLElement) {
		const description = containerEl.createDiv('basic-vault-button-description');
		description.setText(
			'在此添加和管理您的底部侧边栏按钮. 您可以在侧边栏中直接拖拽自定义按钮来重新排序 (内置按钮不支持拖拽).'
		);
	}

	/**
	 * 创建空状态提示
	 */
	private createEmptyState(containerEl: HTMLElement) {
		const emptyState = containerEl.createDiv('basic-vault-button-empty');
		emptyState.createEl('p', { text: '还没有添加任何自定义按钮' });
		emptyState.createEl('p', {
			text: '点击下方的"添加新按钮"开始创建',
			cls: 'setting-item-description'
		});
	}

	/**
	 * 创建按钮列表
	 */
	private createButtonsList(containerEl: HTMLElement) {
		const listTitle = containerEl.createDiv('basic-vault-button-section-title');
		listTitle.setText('已配置的按钮');

		this.plugin.settings.customButtons.forEach((button, index) => {
			this.createButtonSetting(containerEl, button, index);
		});
	}

	/**
	 * 创建添加按钮
	 */
	private createAddButton(containerEl: HTMLElement) {
		const addButton = containerEl.createEl('button', {
			text: '添加新按钮',
			cls: 'basic-vault-button-add-btn'
		});
		addButton.addEventListener('click', () => {
			this.addCustomButton();
		});
	}

	/**
	 * 添加自定义按钮
	 */
	private addCustomButton() {
		const newButton = createCustomButton();
		this.plugin.settings.customButtons.unshift(newButton);
		this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();
	}

	/**
	 * 删除按钮
	 */
	private removeButton(index: number) {
		this.plugin.settings.customButtons.splice(index, 1);
		this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();
	}

	/**
	 * 创建单个按钮的设置项
	 */
	private createButtonSetting(containerEl: HTMLElement, button: CustomButton, index: number) {
		const settingItem = containerEl.createDiv('basic-vault-button-setting-item');

		this.createSettingHeader(settingItem, index);
		this.createSettingContent(settingItem, button, index);
	}

	/**
	 * 创建设置项头部
	 */
	private createSettingHeader(settingItem: HTMLElement, index: number) {
		const header = settingItem.createDiv('basic-vault-button-setting-header');
		header.createEl('span', {
			text: `按钮 ${index + 1}`,
			cls: 'basic-vault-button-setting-title'
		});

		const actions = header.createDiv('basic-vault-button-setting-actions');

		const deleteButton = actions.createEl('button', {
			text: '删除',
			cls: 'basic-vault-button-action-btn basic-vault-button-delete-btn'
		});
		deleteButton.addEventListener('click', () => this.removeButton(index));
	}

	/**
	 * 创建设置内容
	 */
	private createSettingContent(settingItem: HTMLElement, button: CustomButton, index: number) {
		const content = settingItem.createDiv('basic-vault-button-setting-content');

		this.createTooltipSetting(content, button);
		this.createIconSetting(content, button);
		this.createTypeSetting(content, button, index);
		this.createTypeSpecificSetting(content, button, index);
	}

	/**
	 * 创建提示文字设置
	 */
	private createTooltipSetting(content: HTMLElement, button: CustomButton) {
		new Setting(content)
			.setName('按钮名称')
			.setDesc('鼠标悬停时显示的提示文字')
			.addText(text => text
				.setValue(button.tooltip)
				.setPlaceholder('例如：打开日记')
				.onChange(async (value) => {
					button.tooltip = value;
					await this.plugin.saveSettings();
					this.plugin.initVaultButtons();
				}));
	}

	/**
	 * 创建图标设置
	 */
	private createIconSetting(content: HTMLElement, button: CustomButton) {
		new Setting(content)
			.setName('图标')
			.setDesc('输入 Lucide 图标名称')
			.addText(text => text
				.setValue(button.icon)
				.setPlaceholder('lucide-home')
				.onChange(async (value) => {
					button.icon = value;
					await this.plugin.saveSettings();
					this.plugin.initVaultButtons();
				}));
	}

	/**
	 * 创建按钮类型设置
	 */
	private createTypeSetting(content: HTMLElement, button: CustomButton, index: number) {
		new Setting(content)
			.setName('按钮类型')
			.setDesc('选择按钮点击时执行的操作')
			.addDropdown(dropdown => dropdown
				.addOption('command', '执行命令')
				.addOption('file', '打开文件')
				.addOption('url', '打开网址')
				.setValue(button.type)
				.onChange(async (value) => {
					button.type = value as 'command' | 'file' | 'url';
					await this.plugin.saveSettings();
					this.display();
				}));
	}

	/**
	 * 创建类型特定的设置
	 */
	private createTypeSpecificSetting(content: HTMLElement, button: CustomButton, index: number) {
		switch (button.type) {
			case 'command':
				this.createCommandSetting(content, button);
				break;
			case 'file':
				this.createFileSetting(content, button);
				break;
			case 'url':
				this.createUrlSetting(content, button);
				break;
		}
	}

	/**
	 * 创建命令设置
	 */
	private createCommandSetting(content: HTMLElement, button: CustomButton) {
		new Setting(content)
			.setName('目标命令')
			.setDesc('选择要执行的命令')
			.addSearch(search => {
				search.setValue(button.command);
				search.setPlaceholder('例如：file-explorer:new-file');

				const modal = new CommandSuggestModal(this.app, (command) => {
					button.command = command.id;
					search.setValue(command.id);
					this.plugin.saveSettings();
				});

				search.inputEl.addEventListener('click', () => {
					modal.open();
				});

				search.onChange(value => {
					button.command = value;
					this.plugin.saveSettings();
				});
			});
	}

	/**
	 * 创建文件设置
	 */
	private createFileSetting(content: HTMLElement, button: CustomButton) {
		new Setting(content)
			.setName('目标文件')
			.setDesc('选择要打开的文件')
			.addSearch(search => {
				search.setValue(button.file);
				search.setPlaceholder('例如：日记/2024.md');

				const modal = new FileSuggestModal(this.app, (file) => {
					button.file = file.path;
					search.setValue(file.path);
					this.plugin.saveSettings();
				});

				search.inputEl.addEventListener('click', () => {
					modal.open();
				});

				search.onChange(value => {
					button.file = value;
					this.plugin.saveSettings();
				});
			});
	}

	/**
	 * 创建URL设置
	 */
	private createUrlSetting(content: HTMLElement, button: CustomButton) {
		new Setting(content)
			.setName('网址链接')
			.setDesc('输入要打开的完整网址')
			.addText(text => text
				.setValue(button.url)
				.setPlaceholder('https://example.com')
				.onChange(async (value) => {
					button.url = value;
					await this.plugin.saveSettings();
				}));
	}
}