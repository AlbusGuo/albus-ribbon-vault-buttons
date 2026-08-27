import { App, Setting, setTooltip } from 'obsidian';
import { CustomButton } from '../types';
import { getRegisteredCommands } from '../utils/commandRegistry';
import { ButtonStudioIconService } from './buttonStudioIconService';
import { CommandInputSuggest, FileInputSuggest } from './buttonTargetSuggest';

interface ButtonEditorPanelOptions {
	onChange: () => void;
}

export class ButtonEditorPanel {
	private contentEl: HTMLElement | null = null;
	private nameInputEl: HTMLInputElement | null = null;
	private togglePreviewEl: HTMLElement | null = null;
	private targetSuggest: CommandInputSuggest | FileInputSuggest | null = null;

	constructor(
		private readonly app: App,
		private readonly button: CustomButton,
		private readonly iconService: ButtonStudioIconService,
		private readonly options: ButtonEditorPanelOptions,
	) {}

	render(contentEl: HTMLElement): void {
		this.contentEl = contentEl;
		this.iconService.clear();
		this.targetSuggest?.close();
		this.targetSuggest = null;
		contentEl.empty();
		this.nameInputEl = null;
		this.togglePreviewEl = null;

		new Setting(contentEl)
			.setName('名称')
			.setDesc('设置按钮在工具栏中显示的名称')
			.addText((text) => {
				this.nameInputEl = text.inputEl;
				text
					.setPlaceholder('按钮名称')
					.setValue(this.button.tooltip)
					.onChange((value) => {
						this.button.tooltip = value;
						this.options.onChange();
					});
			});

		const primarySetting = new Setting(contentEl)
			.setName('图标')
			.setDesc('设置按钮默认显示的图标');
		this.createIconPicker(primarySetting.controlEl, false, '图标');

		const toggleSetting = new Setting(contentEl)
			.setName('切换图标')
			.setDesc('按钮执行后切换显示的图标');
		this.togglePreviewEl = this.createIconPicker(
			toggleSetting.controlEl,
			true,
			'切换图标',
		);

		new Setting(contentEl)
			.setName('类型')
			.setDesc('设置按钮执行的操作类型')
			.addDropdown((dropdown) => dropdown
				.addOption('command', '命令')
				.addOption('file', '文件')
				.addOption('url', '网址')
				.setValue(this.button.type)
				.onChange((value) => {
					this.button.type = value === 'file'
						? 'file'
						: value === 'url' ? 'url' : 'command';
					this.renderCurrentPanel();
					this.options.onChange();
				}));

		this.renderTargetSetting(contentEl);
	}

	focusNameInput(): void {
		this.nameInputEl?.win.requestAnimationFrame(() => {
			this.nameInputEl?.focus();
			this.nameInputEl?.select();
		});
	}

	destroy(): void {
		this.targetSuggest?.close();
		this.targetSuggest = null;
		this.contentEl = null;
		this.nameInputEl = null;
		this.togglePreviewEl = null;
	}

	private renderTargetSetting(contentEl: HTMLElement): void {
		const config = (() => {
			switch (this.button.type) {
				case 'command':
					return {
						name: '命令',
						description: '选择按钮执行的 Obsidian 命令',
						placeholder: '输入命令名称',
						value: this.getCommandDisplayName(this.button.command),
					};
				case 'file':
					return {
						name: '文件',
						description: '选择按钮打开的库内文件',
						placeholder: '选择或输入文件路径',
						value: this.button.file,
					};
				case 'url':
					return {
						name: '链接',
						description: '设置按钮打开的网址',
						placeholder: '输入网址',
						value: this.button.url,
					};
			}
		})();

		new Setting(contentEl)
			.setName(config.name)
			.setDesc(config.description)
			.addText((text) => {
				text
					.setPlaceholder(config.placeholder)
					.setValue(config.value);
				if (this.button.type === 'command') {
					text.onChange((value) => {
						if (value !== this.getCommandDisplayName(this.button.command)) {
							this.button.command = '';
						}
						this.options.onChange();
					});
					this.targetSuggest = new CommandInputSuggest(
						this.app,
						text.inputEl,
						(command) => {
							this.button.command = command.id;
							text.setValue(command.name);
							this.options.onChange();
						},
					);
				} else if (this.button.type === 'file') {
					text.onChange((value) => {
						this.button.file = value;
						this.options.onChange();
					});
					this.targetSuggest = new FileInputSuggest(
						this.app,
						text.inputEl,
						(file) => {
							this.button.file = file.path;
							text.setValue(file.path);
							this.options.onChange();
						},
					);
				} else {
					text.onChange((value) => {
						this.button.url = value;
						this.options.onChange();
					});
				}
			});
	}

	private createIconPicker(
		parentEl: HTMLElement,
		isToggleIcon: boolean,
		label: string,
	): HTMLElement {
		const buttonEl = parentEl.createEl('button', {
			cls: ['clickable-icon', 'basic-vault-button-studio-icon-picker'],
			attr: { type: 'button', 'aria-label': label },
		});
		const previewEl = buttonEl.createSpan({ cls: 'basic-vault-button-studio-icon-preview' });
		setTooltip(buttonEl, label);
		this.iconService.render(
			previewEl,
			isToggleIcon ? this.button.toggleIcon : this.button.icon,
		);
		buttonEl.addEventListener('click', () => {
			const initialIcon = isToggleIcon ? this.button.toggleIcon : this.button.icon;
			void this.iconService.pick(buttonEl, initialIcon, (selectedIcon) => {
				if (isToggleIcon) {
					const previousIcon = this.button.toggleIcon || this.button.icon;
					this.button.toggleIcon = selectedIcon;
					this.iconService.update(previewEl, selectedIcon, previousIcon);
					this.options.onChange();
					return;
				}

				const previousPrimaryIcon = this.button.icon;
				const previousToggleIcon = this.button.toggleIcon || previousPrimaryIcon;
				this.button.icon = selectedIcon;
				this.button.toggleIcon = selectedIcon;
				this.iconService.update(previewEl, selectedIcon, previousPrimaryIcon);
				if (this.togglePreviewEl) {
					this.iconService.update(
						this.togglePreviewEl,
						selectedIcon,
						previousToggleIcon,
					);
				}
				this.options.onChange();
			});
		});
		return previewEl;
	}

	private getCommandDisplayName(commandId: string): string {
		if (!commandId) return '';
		return getRegisteredCommands(this.app)
			.find((command) => command.id === commandId)
			?.name ?? '';
	}

	private renderCurrentPanel(): void {
		if (this.contentEl) this.render(this.contentEl);
	}
}
