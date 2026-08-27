import {
	AbstractInputSuggest,
	App,
	Command,
	prepareFuzzySearch,
	TFile,
} from 'obsidian';
import { getRegisteredCommands } from '../utils/commandRegistry';

export class CommandInputSuggest extends AbstractInputSuggest<Command> {
	constructor(
		app: App,
		inputEl: HTMLInputElement,
		onChoose: (command: Command) => void,
	) {
		super(app, inputEl);
		this.limit = 50;
		this.onSelect((command) => onChoose(command));
	}

	protected getSuggestions(query: string): Command[] {
		const commands = getRegisteredCommands(this.app);
		const normalizedQuery = query.trim();
		if (!normalizedQuery) return commands;
		const matches = prepareFuzzySearch(normalizedQuery);
		return commands.filter((command) => matches(`${command.name} ${command.id}`));
	}

	renderSuggestion(command: Command, el: HTMLElement): void {
		el.setText(command.name);
	}
}

export class FileInputSuggest extends AbstractInputSuggest<TFile> {
	constructor(
		app: App,
		inputEl: HTMLInputElement,
		onChoose: (file: TFile) => void,
	) {
		super(app, inputEl);
		this.limit = 50;
		this.onSelect((file) => onChoose(file));
	}

	protected getSuggestions(query: string): TFile[] {
		const files = this.app.vault.getFiles();
		const normalizedQuery = query.trim();
		if (!normalizedQuery) return files;
		const matches = prepareFuzzySearch(normalizedQuery);
		return files.filter((file) => matches(file.path));
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}
}
