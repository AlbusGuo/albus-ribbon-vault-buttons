import { App, FuzzySuggestModal, Command } from 'obsidian';
import { getRegisteredCommands } from '../utils/commandRegistry';

/**
 * 命令建议模态框
 */
export class CommandSuggestModal extends FuzzySuggestModal<Command> {
	private readonly onChoose: (command: Command) => void;

	constructor(app: App, onChoose: (command: Command) => void) {
		super(app);
		this.onChoose = onChoose;
	}

	getItems(): Command[] {
		return getRegisteredCommands(this.app);
	}

	getItemText(command: Command): string {
		return command.name;
	}

	onChooseItem(command: Command, _event: MouseEvent | KeyboardEvent): void {
		this.onChoose(command);
	}
}
