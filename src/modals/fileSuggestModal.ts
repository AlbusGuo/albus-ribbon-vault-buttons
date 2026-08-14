import { App, FuzzySuggestModal, TFile } from 'obsidian';

/**
 * 文件建议模态框
 */
export class FileSuggestModal extends FuzzySuggestModal<TFile> {
	private readonly onChoose: (file: TFile) => void;

	constructor(app: App, onChoose: (file: TFile) => void) {
		super(app);
		this.onChoose = onChoose;
	}

	getItems(): TFile[] {
		return this.app.vault.getFiles();
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile, _event: MouseEvent | KeyboardEvent): void {
		this.onChoose(file);
	}
}
