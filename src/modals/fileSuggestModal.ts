import { App, FuzzySuggestModal, TFile } from 'obsidian';

/**
 * 文件建议模态框
 */
export class FileSuggestModal extends FuzzySuggestModal<TFile> {
	private onChoose: (file: TFile) => void;

	constructor(app: App, onChoose: (file: TFile) => void) {
		super(app);
		this.onChoose = onChoose;
	}

	getItems(): TFile[] {
		try {
			return this.app.vault.getFiles();
		} catch (error) {
			console.warn('Failed to get files:', error);
			return [];
		}
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(file);
	}
}