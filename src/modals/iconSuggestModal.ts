import { App, SuggestModal, setIcon, getIconIds } from 'obsidian';

interface IconSuggestionItem {
	value: string;
	label: string;
	searchText: string;
}

/**
 * 图标选择器模态框
 */
export class IconSuggestModal extends SuggestModal<IconSuggestionItem> {
	private readonly icons: IconSuggestionItem[];
	private readonly onChoose: (iconName: string) => void;

	constructor(app: App, icons: string[], onChoose: (iconName: string) => void) {
		super(app);
		this.onChoose = onChoose;
		this.icons = icons.map((icon) => {
			return {
				value: icon,
				label: icon,
				searchText: icon.toLowerCase(),
			};
		});
		
		this.setPlaceholder('搜索图标名称...');
	}

	static create(app: App, onChoose: (iconName: string) => void): IconSuggestModal {
		return new IconSuggestModal(app, getIconIds(), onChoose);
	}

	getSuggestions(query: string): IconSuggestionItem[] {
		const lowerQuery = query.toLowerCase();

		if (!lowerQuery) {
			return this.icons;
		}

		const splitQueries = lowerQuery.trim().split(/\s+/).filter(Boolean);
		return this.icons.filter((icon) => splitQueries.every((keyword) => icon.searchText.includes(keyword)));
	}

	renderSuggestion(icon: IconSuggestionItem, el: HTMLElement): void {
		el.classList.add('mod-complex');
		el.createEl('div', { text: icon.label });

		const previewEl = el.createEl('div');
		try {
			setIcon(previewEl, icon.value);
			if (!previewEl.querySelector('svg')) setIcon(previewEl, 'help-circle');
		} catch {
			setIcon(previewEl, 'help-circle');
		}
	}

	onChooseSuggestion(icon: IconSuggestionItem, _event: MouseEvent | KeyboardEvent): void {
		this.onChoose(icon.value);
	}
}
