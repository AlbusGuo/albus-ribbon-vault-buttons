import { App, Notice } from 'obsidian';
import { CustomIconsIntegration } from '../integrations/customIconsIntegration';
import { createCustomButton } from '../settings';
import { CustomButton } from '../types';
import { isButtonConfigurationComplete } from '../utils/buttonValidation';
import { ButtonEditorPanel } from './buttonEditorPanel';
import { ButtonGroupPanel } from './buttonGroupPanel';
import { EditorModal } from './editorModal';
import { ButtonStudioIconService } from './buttonStudioIconService';

interface ButtonStudioModalOptions {
	customIconsIntegration: CustomIconsIntegration;
	onChange: (button: CustomButton) => Promise<boolean>;
	onClose?: () => void;
	initiallyPersisted?: boolean;
}

export class ButtonStudioModal {
	private readonly draft: CustomButton;
	private modal: EditorModal | null = null;
	private panel: ButtonEditorPanel | ButtonGroupPanel | null = null;
	private iconService: ButtonStudioIconService | null = null;
	private lastCommittedState: string;
	private hasPersistedState: boolean;

	constructor(
		private readonly app: App,
		button: CustomButton,
		private readonly options: ButtonStudioModalOptions,
	) {
		this.draft = structuredClone(button);
		this.lastCommittedState = JSON.stringify(this.draft);
		this.hasPersistedState = this.options.initiallyPersisted !== false;
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
						this.app,
						this.draft,
						this.iconService,
						{
							onChange: () => {
								void this.commitChanges();
							},
							onEditButton: (button, index) => {
								this.openGroupButtonEditor(button, index);
							},
							onAddButton: () => this.openNewGroupButtonEditor(),
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

	private async commitChanges(): Promise<boolean> {
		const nextButton = structuredClone(this.draft);
		nextButton.groupItems = nextButton.groupItems.map((groupItem) => ({
			...groupItem,
			kind: 'button' as const,
			groupItems: [],
		}));
		const nextState = JSON.stringify(nextButton);
		if (nextState === this.lastCommittedState) return this.hasPersistedState;

		try {
			const persisted = await this.options.onChange(nextButton);
			if (persisted) {
				this.lastCommittedState = nextState;
				this.hasPersistedState = true;
			}
			return persisted;
		} catch (error) {
			console.error('Custom Buttons failed to save button changes:', error);
			return false;
		}
	}

	private async finalizeClose(): Promise<void> {
		this.panel?.destroy();
		this.panel = null;
		this.iconService?.destroy();
		this.iconService = null;
		const persisted = await this.commitChanges();
		if (!persisted) {
			const itemName = this.draft.kind === 'group' ? '按钮组' : '按钮';
			new Notice(this.hasPersistedState
				? `${itemName}必填信息不完整, 本次修改未保存`
				: `${itemName}必填信息不完整, 未创建${itemName}`);
		}
		this.modal = null;
		this.options.onClose?.();
	}

	private openGroupButtonEditor(button: CustomButton, index: number): void {
		new ButtonStudioModal(this.app, button, {
			customIconsIntegration: this.options.customIconsIntegration,
			onChange: async (savedButton) => {
				if (!isButtonConfigurationComplete(savedButton)) return false;
				const currentIndex = this.draft.groupItems.indexOf(button);
				const targetIndex = currentIndex >= 0 ? currentIndex : index;
				if (!this.draft.groupItems[targetIndex]) return false;
				this.draft.groupItems[targetIndex] = savedButton;
				return this.commitChanges();
			},
			onClose: () => {
				if (this.panel instanceof ButtonGroupPanel) {
					this.panel.refreshItems();
				}
			},
		}).open();
	}

	private openNewGroupButtonEditor(): void {
		const draft = createCustomButton();
		let savedIndex: number | null = null;
		new ButtonStudioModal(this.app, draft, {
			customIconsIntegration: this.options.customIconsIntegration,
			initiallyPersisted: false,
			onChange: async (savedButton) => {
				if (!isButtonConfigurationComplete(savedButton)) return false;
				if (savedIndex === null) {
					savedIndex = this.draft.groupItems.length;
					this.draft.groupItems.push(savedButton);
				} else if (this.draft.groupItems[savedIndex]) {
					this.draft.groupItems[savedIndex] = savedButton;
				} else {
					return false;
				}
				return this.commitChanges();
			},
			onClose: () => {
				if (this.panel instanceof ButtonGroupPanel) {
					this.panel.refreshItems();
				}
			},
		}).open();
	}
}
