import { AbstractInputSuggest, App } from 'obsidian';

export class FolderSuggester extends AbstractInputSuggest<string> {
	private readonly inputEl: HTMLInputElement;
	private readonly folders: string[];
	private readonly folderSearchTexts: string[];

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.folders = this.app.vault
			.getAllFolders(false)
			.map((folder) => folder.path);
		this.folderSearchTexts = this.folders.map((folder) => folder.toLowerCase());
	}

	getSuggestions(inputStr: string): string[] {
		const lowerInput = inputStr.toLowerCase();
		const suggestions: string[] = [];
		for (let index = 0; index < this.folders.length; index++) {
			if (this.folderSearchTexts[index].includes(lowerInput)) {
				suggestions.push(this.folders[index]);
			}
		}
		return suggestions;
	}

	renderSuggestion(folder: string, el: HTMLElement): void {
		el.setText(folder);
	}

	selectSuggestion(folder: string): void {
		this.inputEl.value = folder;
		this.inputEl.trigger('input');
		this.inputEl.blur();
		this.close();
	}
}
