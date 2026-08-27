import { App, setIcon } from 'obsidian';
import { CustomIconsIntegration } from '../integrations/customIconsIntegration';
import { MorphIconManager } from '../utils/morphIconManager';
import { IconSuggestModal } from './iconSuggestModal';

export class ButtonStudioIconService {
	private readonly morphIconManager: MorphIconManager;

	constructor(
		private readonly app: App,
		private readonly customIconsIntegration: CustomIconsIntegration,
	) {
		this.morphIconManager = new MorphIconManager(
			(element, iconName) => this.customIconsIntegration.renderIcon(element, iconName),
		);
	}

	clear(): void {
		this.morphIconManager.clearElements();
	}

	destroy(): void {
		this.morphIconManager.destroy();
	}

	render(element: HTMLElement, iconName: string): void {
		this.morphIconManager.resetElement(element);
		element.empty();
		if (this.customIconsIntegration.renderIcon(element, iconName)) return;
		try {
			setIcon(element, iconName || 'help-circle');
			if (!element.querySelector('svg')) element.setText('?');
		} catch {
			element.setText('?');
		}
	}

	update(element: HTMLElement, iconName: string, previousIcon: string): void {
		if (
			previousIcon !== iconName &&
			this.morphIconManager.transition(element, previousIcon, iconName)
		) {
			return;
		}
		this.render(element, iconName);
	}

	async pick(
		sourceEl: HTMLElement,
		initialIcon: string,
		onSelect: (iconName: string) => void,
	): Promise<void> {
		try {
			const result = await this.customIconsIntegration.openIconPicker(
				sourceEl,
				initialIcon,
			);
			if (result.handled) {
				if (result.icon) onSelect(result.icon);
				return;
			}
		} catch (error) {
			console.error('Custom Buttons failed to open the Custom Icons picker:', error);
		}

		IconSuggestModal.create(this.app, onSelect).open();
	}
}
