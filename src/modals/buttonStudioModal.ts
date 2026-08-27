import { App } from 'obsidian';
import { CustomIconsIntegration } from '../integrations/customIconsIntegration';
import { CustomButton } from '../types';
import { ButtonEditorPanel } from './buttonEditorPanel';
import { ButtonGroupPanel } from './buttonGroupPanel';
import { EditorModal } from './editorModal';
import { ButtonStudioIconService } from './buttonStudioIconService';

interface ButtonStudioModalOptions {
	customIconsIntegration: CustomIconsIntegration;
	onChange: (button: CustomButton) => Promise<void>;
	onClose?: () => void;
}

export class ButtonStudioModal {
	private readonly draft: CustomButton;
	private modal: EditorModal | null = null;
	private panel: ButtonEditorPanel | ButtonGroupPanel | null = null;
	private iconService: ButtonStudioIconService | null = null;
	private lastCommittedState: string;

	constructor(
		private readonly app: App,
		button: CustomButton,
		private readonly options: ButtonStudioModalOptions,
	) {
		this.draft = structuredClone(button);
		this.lastCommittedState = JSON.stringify(this.draft);
	}

	open = (): void => {
		if (this.modal) return;

		this.modal = new EditorModal(this.app, {
			modalClass: 'basic-vault-button-studio-modal-shell',
			contentClass: 'basic-vault-button-studio',
			onOpen: (contentEl) => {
				this.iconService = new ButtonStudioIconService(
					this.app,
					this.options.customIconsIntegration,
				);
				if (this.draft.kind === 'group') {
					this.panel = new ButtonGroupPanel(
						this.draft,
						this.iconService,
						{
							onChange: () => {
								void this.commitChanges();
							},
							onEditButton: (button, index) => {
								this.openGroupButtonEditor(button, index);
							},
						},
					);
				} else {
					this.panel = new ButtonEditorPanel(
						this.app,
						this.draft,
						this.iconService,
						{
							onChange: () => {
								void this.commitChanges();
							},
						},
					);
				}
				this.panel.render(contentEl);
				this.panel.focusNameInput();
			},
			onClose: () => {
				void this.finalizeClose();
			},
		});

		this.modal.open();
	};

	private async commitChanges(): Promise<void> {
		const nextButton = structuredClone(this.draft);
		nextButton.groupItems = nextButton.groupItems.map((groupItem) => ({
			...groupItem,
			kind: 'button' as const,
			groupItems: [],
		}));
		const nextState = JSON.stringify(nextButton);
		if (nextState === this.lastCommittedState) return;

		try {
			await this.options.onChange(nextButton);
			this.lastCommittedState = nextState;
		} catch (error) {
			console.error('Custom Buttons failed to save button changes:', error);
		}
	}

	private async finalizeClose(): Promise<void> {
		this.panel?.destroy();
		this.panel = null;
		this.iconService?.destroy();
		this.iconService = null;
		await this.commitChanges();
		this.modal = null;
		this.options.onClose?.();
	}

	private openGroupButtonEditor(button: CustomButton, index: number): void {
		new ButtonStudioModal(this.app, button, {
			customIconsIntegration: this.options.customIconsIntegration,
			onChange: async (savedButton) => {
				const currentIndex = this.draft.groupItems.indexOf(button);
				const targetIndex = currentIndex >= 0 ? currentIndex : index;
				if (!this.draft.groupItems[targetIndex]) return;
				this.draft.groupItems[targetIndex] = savedButton;
				await this.commitChanges();
			},
			onClose: () => {
				if (this.panel instanceof ButtonGroupPanel) {
					this.panel.refreshItems();
				}
			},
		}).open();
	}
}
