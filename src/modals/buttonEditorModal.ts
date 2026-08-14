import { App, setIcon, setTooltip } from 'obsidian';
import { CustomButton } from '../types';
import { CustomIconManager } from '../utils/customIconManager';
import { CommandSuggestModal } from './commandSuggestModal';
import { EditorModal } from './editorModal';
import { FileSuggestModal } from './fileSuggestModal';
import { IconSuggestModal } from './iconSuggestModal';

interface ButtonEditorModalOptions {
	iconFolder: string;
	iconMask: boolean;
	onChange: (button: CustomButton) => Promise<void>;
	onClose?: () => void;
}

export class ButtonEditorModal {
	private readonly app: App;
	private readonly customIconManager: CustomIconManager;
	private readonly options: ButtonEditorModalOptions;
	private readonly draft: CustomButton;
	private modal: EditorModal | null = null;
	private contentEl: HTMLDivElement | null = null;
	private nameInputEl: HTMLInputElement | null = null;
	private valueInputEl: HTMLInputElement | null = null;
	private typeSelectEl: HTMLSelectElement | null = null;
	private commandGroupContainerEl: HTMLElement | null = null;
	private primaryPreviewEl: HTMLElement | null = null;
	private togglePreviewEl: HTMLElement | null = null;
	private lastCommittedState: string;

	constructor(app: App, button: CustomButton, options: ButtonEditorModalOptions) {
		this.app = app;
		this.options = options;
		this.draft = structuredClone(button);
		this.lastCommittedState = JSON.stringify(this.draft);
		this.customIconManager = CustomIconManager.getInstance(app);
	}

	open = (): void => {
		if (this.modal) {
			return;
		}

		this.modal = new EditorModal(this.app, {
			modalClass: 'basic-vault-button-editor-modal-shell',
			contentClass: 'basic-vault-button-editor-modal',
			onOpen: (contentEl) => {
				this.contentEl = contentEl as HTMLDivElement;
				this.render();
				requestAnimationFrame(() => {
					this.nameInputEl?.focus();
					this.nameInputEl?.select();
				});
			},
			onClose: () => {
				void this.finalizeClose();
			},
		});

		this.modal.open();
	};

	private render = (): void => {
		if (!this.contentEl) {
			return;
		}

		this.contentEl.empty();

		const nameControlEl = this.createFormRow(this.contentEl, '名称');
		this.nameInputEl = nameControlEl.createEl('input', {
			cls: 'basic-vault-button-editor-input basic-vault-button-editor-name-input',
			attr: { type: 'text', placeholder: '按钮名称' },
		});
		this.nameInputEl.value = this.draft.tooltip;
		this.nameInputEl.addEventListener('input', () => {
			this.draft.tooltip = this.nameInputEl?.value ?? '';
			this.scheduleCommit();
		});

		const metaRowEl = this.contentEl.createDiv({ cls: 'basic-vault-button-editor-compact-row' });
		this.createIconField(metaRowEl, '主图标', this.draft.icon, false);
		this.createIconField(metaRowEl, '切换图标', this.draft.toggleIcon, true);
		this.createTypeField(metaRowEl);

		this.renderValueEditor();
	};

	private createFormRow(parentEl: HTMLElement, label: string): HTMLElement {
		const rowEl = parentEl.createDiv({ cls: 'basic-vault-button-editor-form-row' });
		rowEl.createDiv({ cls: 'basic-vault-button-editor-label', text: label });
		return rowEl.createDiv({ cls: 'basic-vault-button-editor-control' });
	}

	private createIconField(parentEl: HTMLElement, label: string, iconName: string, isToggleIcon: boolean): void {
		parentEl.createDiv({ cls: 'basic-vault-button-editor-label', text: label });
		const fieldEl = parentEl.createDiv({ cls: 'basic-vault-button-editor-icon-field' });
		const iconButton = fieldEl.createEl('button', {
			cls: 'icon-picker-button-compact',
			attr: { type: 'button', 'aria-label': label },
		});
		const previewEl = iconButton.createDiv({ cls: 'icon-picker-preview-compact' });

		if (isToggleIcon) {
			this.togglePreviewEl = previewEl;
		} else {
			this.primaryPreviewEl = previewEl;
		}

		void this.updateIconPreview(iconName, previewEl);
		setTooltip(iconButton, `${label}: ${this.customIconManager.getDisplayName(iconName || 'help-circle')}`);

		iconButton.addEventListener('click', () => {
			this.openIconPicker(isToggleIcon);
		});
	}

	private createTypeField(parentEl: HTMLElement): void {
		parentEl.createDiv({ cls: 'basic-vault-button-editor-label', text: '按钮类型' });
		this.typeSelectEl = parentEl.createEl('select', { cls: 'basic-vault-button-editor-select' });
		this.typeSelectEl.addClass('dropdown');
		this.typeSelectEl.addClass('basic-vault-button-editor-native-select');
		[
			['command', '命令'],
			['command-group', '命令组'],
			['file', '文件'],
			['url', '网址'],
		].forEach(([value, label]) => {
			this.typeSelectEl?.createEl('option', { value, text: label });
		});
		this.typeSelectEl.value = this.draft.type;
		this.typeSelectEl.addEventListener('change', () => {
			this.draft.type = this.typeSelectEl?.value as CustomButton['type'];
			this.normalizeTypeSpecificValues();
			this.render();
			void this.commitChanges();
		});
	}

	private renderValueEditor(): void {
		if (!this.contentEl) {
			return;
		}

		this.valueInputEl = null;
		this.commandGroupContainerEl = null;

		const valueControlEl = this.createFormRow(this.contentEl, this.getValueFieldName());

		if (this.draft.type === 'command-group') {
			this.commandGroupContainerEl = valueControlEl.createDiv({ cls: 'basic-vault-button-editor-command-group' });
			this.renderCommandGroupEditor();
			return;
		}

		this.valueInputEl = valueControlEl.createEl('input', {
			cls: 'basic-vault-button-editor-input basic-vault-button-editor-value-input',
			attr: { type: 'text', placeholder: this.getValuePlaceholder() },
		});
		this.valueInputEl.value = this.getCurrentValue();
		this.valueInputEl.classList.toggle('basic-vault-button-editor-picker-input', this.draft.type === 'command' || this.draft.type === 'file');
		this.valueInputEl.addEventListener('input', () => {
			this.setCurrentValue(this.valueInputEl?.value ?? '');
			this.scheduleCommit();
		});

		if (this.draft.type === 'command' || this.draft.type === 'file') {
			this.valueInputEl.addEventListener('click', () => {
				this.openValuePicker();
			});
		}
	}

	private renderCommandGroupEditor(): void {
		if (!this.commandGroupContainerEl) {
			return;
		}

		this.commandGroupContainerEl.empty();

		const listEl = this.commandGroupContainerEl.createDiv({ cls: 'basic-vault-button-command-list' });
		if (this.draft.commands.length === 0) {
			listEl.createDiv({ cls: 'basic-vault-button-command-empty', text: '还没有添加命令' });
		}

		this.draft.commands.forEach((commandId, index) => {
			const rowEl = listEl.createDiv({ cls: 'basic-vault-button-command-row' });
			rowEl.dataset.index = index.toString();
			rowEl.createDiv({ cls: 'basic-vault-button-command-index', text: `${index + 1}` });

			const inputEl = rowEl.createEl('input', {
				cls: 'basic-vault-button-editor-input basic-vault-button-command-input basic-vault-button-editor-picker-input',
				attr: { type: 'text', placeholder: '命令 ID' },
			});
			inputEl.value = commandId;
			inputEl.addEventListener('input', () => {
				this.draft.commands[index] = inputEl.value;
				this.scheduleCommit();
			});
			inputEl.addEventListener('click', () => {
				this.openCommandGroupPicker(index, inputEl);
			});

			this.createIconButton(rowEl, 'up-chevron-glyph', '上移', () => {
				if (index === 0) {
					return;
				}

				[this.draft.commands[index - 1], this.draft.commands[index]] = [this.draft.commands[index], this.draft.commands[index - 1]];
				this.renderCommandGroupEditor();
				void this.commitChanges();
			});

			this.createIconButton(rowEl, 'down-chevron-glyph', '下移', () => {
				if (index >= this.draft.commands.length - 1) {
					return;
				}

				[this.draft.commands[index + 1], this.draft.commands[index]] = [this.draft.commands[index], this.draft.commands[index + 1]];
				this.renderCommandGroupEditor();
				void this.commitChanges();
			});

			this.createIconButton(rowEl, 'trash', '删除命令', () => {
				this.draft.commands.splice(index, 1);
				this.renderCommandGroupEditor();
				void this.commitChanges();
			});
		});

		const addButton = this.commandGroupContainerEl.createEl('button', {
			cls: 'basic-vault-button-editor-text-button',
			text: '+ 添加命令',
			attr: { type: 'button' },
		});
		addButton.addEventListener('click', () => {
			this.draft.commands.push('');
			this.renderCommandGroupEditor();
			this.focusCommandInput(this.draft.commands.length - 1);
			void this.commitChanges();
		});
	}

	private focusCommandInput(index: number): void {
		window.requestAnimationFrame(() => {
			const inputEl = this.commandGroupContainerEl?.querySelector<HTMLInputElement>(`.basic-vault-button-command-row[data-index="${index}"] .basic-vault-button-command-input`);
			inputEl?.focus();
			inputEl?.select();
		});
	}

	private createIconButton(parentEl: HTMLElement, icon: string, label: string, onClick: () => void): void {
		const button = parentEl.createEl('button', {
			cls: 'basic-vault-button-editor-icon-button',
			attr: { type: 'button', 'aria-label': label, title: label },
		});
		setIcon(button, icon);
		button.addEventListener('click', onClick);
	}

	private async commitChanges(): Promise<void> {
		this.draft.tooltip = this.nameInputEl?.value ?? this.draft.tooltip;
		if (this.valueInputEl) {
			this.setCurrentValue(this.valueInputEl.value);
		}

		const nextButton = structuredClone(this.draft);
		nextButton.commands = nextButton.commands.map((commandId) => commandId.trim()).filter(Boolean);
		const nextState = JSON.stringify(nextButton);
		if (nextState === this.lastCommittedState) {
			return;
		}

		try {
			await this.options.onChange(nextButton);
			this.lastCommittedState = nextState;
		} catch (error) {
			console.error('Custom Buttons failed to save button changes:', error);
		}
	}

	private async finalizeClose(): Promise<void> {
		await this.commitChanges();
		this.contentEl = null;
		this.nameInputEl = null;
		this.valueInputEl = null;
		this.typeSelectEl = null;
		this.commandGroupContainerEl = null;
		this.primaryPreviewEl = null;
		this.togglePreviewEl = null;
		this.modal = null;
		this.options.onClose?.();
	}

	private scheduleCommit(): void {
		void this.commitChanges();
	}

	private normalizeTypeSpecificValues(): void {
		switch (this.draft.type) {
			case 'command':
				this.draft.file = '';
				this.draft.url = '';
				this.draft.commands = [];
				break;
			case 'command-group':
				this.draft.command = '';
				this.draft.file = '';
				this.draft.url = '';
				break;
			case 'file':
				this.draft.command = '';
				this.draft.url = '';
				this.draft.commands = [];
				break;
			case 'url':
				this.draft.command = '';
				this.draft.file = '';
				this.draft.commands = [];
				break;
		}
	}

	private getValueFieldName(): string {
		switch (this.draft.type) {
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

	private getValuePlaceholder(): string {
		switch (this.draft.type) {
			case 'command':
				return '命令 ID';
			case 'command-group':
				return '命令 ID';
			case 'file':
				return '文件路径';
			case 'url':
				return '网址';
		}
	}

	private getCurrentValue(): string {
		switch (this.draft.type) {
			case 'command':
				return this.draft.command;
			case 'command-group':
				return this.draft.commands.join(', ');
			case 'file':
				return this.draft.file;
			case 'url':
				return this.draft.url;
		}
	}

	private setCurrentValue(value: string): void {
		switch (this.draft.type) {
			case 'command':
				this.draft.command = value;
				break;
			case 'command-group':
				this.draft.commands = value.split(',').map((commandId) => commandId.trim()).filter(Boolean);
				break;
			case 'file':
				this.draft.file = value;
				break;
			case 'url':
				this.draft.url = value;
				break;
		}
	}

	private openValuePicker(): void {
		if (this.draft.type === 'command') {
			new CommandSuggestModal(this.app, (command) => {
				this.draft.command = command.id;
				if (this.valueInputEl) {
					this.valueInputEl.value = command.id;
				}
				void this.commitChanges();
			}).open();
			return;
		}

		if (this.draft.type === 'file') {
			new FileSuggestModal(this.app, (file) => {
				this.draft.file = file.path;
				if (this.valueInputEl) {
					this.valueInputEl.value = file.path;
				}
				void this.commitChanges();
			}).open();
		}
	}

	private openCommandGroupPicker(index: number, inputEl: HTMLInputElement): void {
		new CommandSuggestModal(this.app, (command) => {
			this.draft.commands[index] = command.id;
			inputEl.value = command.id;
			void this.commitChanges();
		}).open();
	}

	private openIconPicker(isToggleIcon: boolean): void {
		const modal = IconSuggestModal.create(
			this.app,
			this.options.iconFolder,
			this.options.iconMask,
			async (selectedIcon: string) => {
				if (isToggleIcon) {
					this.draft.toggleIcon = selectedIcon;
					if (this.togglePreviewEl) {
						await this.updateIconPreview(selectedIcon, this.togglePreviewEl);
					}
					await this.commitChanges();
					return;
				}

				this.draft.icon = selectedIcon;
				this.draft.toggleIcon = selectedIcon;
				if (this.primaryPreviewEl) {
					await this.updateIconPreview(selectedIcon, this.primaryPreviewEl);
				}
				if (this.togglePreviewEl) {
					await this.updateIconPreview(selectedIcon, this.togglePreviewEl);
				}
				await this.commitChanges();
			},
		);
		modal.open();
	}

	private async updateIconPreview(iconName: string, previewEl: HTMLElement): Promise<void> {
		previewEl.empty();
		if (this.customIconManager.isCustomIcon(iconName)) {
			const rendered = await this.customIconManager.renderIcon(iconName, previewEl, this.options.iconMask);
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
}
