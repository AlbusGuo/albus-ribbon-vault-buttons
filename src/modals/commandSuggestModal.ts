import { App, FuzzySuggestModal, Command } from 'obsidian';

/**
 * 命令建议模态框
 */
export class CommandSuggestModal extends FuzzySuggestModal<Command> {
	private onChoose: (command: Command) => void;

	constructor(app: App, onChoose: (command: Command) => void) {
		super(app);
		this.onChoose = onChoose;
	}

	getItems(): Command[] {
		try {
			// @ts-ignore
			const commands = this.app.commands.commands;
			const matchedCommands: Command[] = [];

			for (const key in commands) {
				const element = commands[key];
				matchedCommands.push(element);
			}

			return matchedCommands;
		} catch (error) {
			console.warn('Failed to get commands:', error);
			return [];
		}
	}

	getItemText(command: Command): string {
		return command.name;
	}

	onChooseItem(command: Command, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(command);
	}
}