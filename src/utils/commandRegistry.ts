import { App, Command } from 'obsidian';

interface AppWithCommands extends App {
	commands?: {
		commands?: Record<string, Command> | Command[];
	};
}

export function getRegisteredCommands(app: App): Command[] {
	const commands = (app as AppWithCommands).commands?.commands;
	if (Array.isArray(commands)) {
		return commands;
	}

	return commands && typeof commands === 'object'
		? Object.values(commands)
		: [];
}
