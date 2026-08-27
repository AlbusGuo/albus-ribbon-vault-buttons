import { App, Setting, setTooltip } from 'obsidian';
import { CustomButton } from '../types';
import { CommandSuggestModal } from './commandSuggestModal';
import { FileSuggestModal } from './fileSuggestModal';
import { ButtonStudioIconService } from './buttonStudioIconService';

interface ButtonEditorPanelOptions {
	onChange: () => void;
}

export class ButtonEditorPanel {
	private contentEl: HTMLElement | null = null;
	private nameInputEl: HTMLInputElement | null = null;
	private togglePreviewEl: HTMLElement | null = null;

	constructor(
		private readonly app: App,
		private readonly button: CustomButton,
		private readonly iconService: ButtonStudioIconService,
		private readonly options: ButtonEditorPanelOptions,
	) {}

	render(contentEl: HTMLElement): void {
		this.contentEl = contentEl;
		this.iconService.clear();
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
						placeholder: '选择或输入命令 ID',
						value: this.button.command,
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
					.setValue(config.value)
					.onChange((value) => {
						this.setTargetValue(value);
						this.options.onChange();
					});
				if (this.button.type === 'command') {
					text.inputEl.addClass('basic-vault-button-studio-picker-input');
					text.inputEl.addEventListener('click', () => {
						new CommandSuggestModal(this.app, (command) => {
							this.button.command = command.id;
							text.setValue(command.id);
							this.options.onChange();
						}).open();
					});
			} else if (this.button.type === 'file') {
					text.inputEl.addClass('basic-vault-button-studio-picker-input');
					text.inputEl.addEventListener('click', () => {
						new FileSuggestModal(this.app, (file) => {
							this.button.file = file.path;
							text.setValue(file.path);
							this.options.onChange();
						}).open();
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

	private setTargetValue(value: string): void {
		switch (this.button.type) {
			case 'command': this.button.command = value; break;
			case 'file': this.button.file = value; break;
			case 'url': this.button.url = value; break;
		}
	}

	private renderCurrentPanel(): void {
		if (this.contentEl) this.render(this.contentEl);
	}
}
