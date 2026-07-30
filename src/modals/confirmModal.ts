import { App, Modal, Setting } from 'obsidian';

interface ConfirmModalOptions {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	danger?: boolean;
}

export class ConfirmModal extends Modal {
	private readonly options: ConfirmModalOptions;
	private resolved = false;
	private readonly resolver: (value: boolean) => void;

	constructor(app: App, options: ConfirmModalOptions, resolver: (value: boolean) => void) {
		super(app);
		this.options = options;
		this.resolver = resolver;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('basic-vault-confirm-modal');

		new Setting(contentEl)
			.setName(this.options.title)
			.setHeading();
		contentEl.createEl('p', {
			cls: 'basic-vault-confirm-modal-message',
			text: this.options.message,
		});

		const actionsEl = contentEl.createDiv({ cls: 'basic-vault-confirm-modal-actions' });

		const cancelButton = actionsEl.createEl('button', {
			text: this.options.cancelText ?? '取消',
			cls: 'mod-cta',
		});
		cancelButton.addEventListener('click', () => {
			this.finish(false);
		});

		const confirmButton = actionsEl.createEl('button', {
			text: this.options.confirmText ?? '确认',
		});
		if (this.options.danger) {
			confirmButton.addClass('mod-warning');
		} else {
			confirmButton.addClass('mod-cta');
		}
		confirmButton.addEventListener('click', () => {
			this.finish(true);
		});
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) {
			this.resolver(false);
			this.resolved = true;
		}
	}

	private finish(value: boolean): void {
		if (!this.resolved) {
			this.resolver(value);
			this.resolved = true;
		}
		this.close();
	}

	static confirm(app: App, options: ConfirmModalOptions): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmModal(app, options, resolve);
			modal.open();
		});
	}
}
