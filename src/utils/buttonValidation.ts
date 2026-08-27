import { CustomButton } from '../types';

export function isButtonConfigurationComplete(button: CustomButton): boolean {
	if (!button.tooltip.trim()) return false;
	if (button.kind === 'group') {
		return button.groupItems.length > 0 &&
			button.groupItems.every((groupItem) =>
				groupItem.kind === 'button' && isButtonConfigurationComplete(groupItem));
	}

	switch (button.type) {
		case 'command': return Boolean(button.command.trim());
		case 'file': return Boolean(button.file.trim());
		case 'url': return Boolean(button.url.trim());
	}
}
