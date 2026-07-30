import { App, FuzzySuggestModal, TFile } from 'obsidian';

interface FileSuggestModalOptions {
	placeholder?: string;
	filter?: (file: TFile) => boolean;
}

/**
 * 文件建议模态框
 */
export class FileSuggestModal extends FuzzySuggestModal<TFile> {
	private readonly onChoose: (file: TFile) => void;
	private readonly filter?: (file: TFile) => boolean;

	constructor(app: App, onChoose: (file: TFile) => void, options?: FileSuggestModalOptions) {
		super(app);
		this.onChoose = onChoose;
		this.filter = options?.filter;
		if (options?.placeholder) {
			this.setPlaceholder(options.placeholder);
		}
	}

	getItems(): TFile[] {
		try {
			const files = this.app.vault.getFiles();
			return this.filter ? files.filter(this.filter) : files;
		} catch {
			return [];
		}
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile, _event: MouseEvent | KeyboardEvent): void {
		this.onChoose(file);
	}
}
