import { getIcon, Menu } from 'obsidian';
import { ButtonGroupTrigger, CustomButton } from '../types';

export type ButtonGroupArea = 'ribbon' | 'header' | 'note' | 'selection';

const HOVER_OPEN_DELAY = 140;

export class ButtonGroupMenuManager {
	private activeMenu: Menu | null = null;
	private activeSourceEl: HTMLElement | null = null;
	private readonly hoverTimers = new Map<HTMLElement, { id: number; win: Window }>();

	constructor(
		private readonly getTrigger: () => ButtonGroupTrigger,
		private readonly executeButton: (button: CustomButton) => void | Promise<void>,
	) {}

	bind(sourceEl: HTMLElement, button: CustomButton, area: ButtonGroupArea): void {
		if (button.kind !== 'group') return;
		sourceEl.addClass('basic-vault-has-button-group', `is-${area}`);
		sourceEl.setAttribute('aria-haspopup', 'menu');
		sourceEl.setAttribute('aria-expanded', 'false');
		sourceEl.addEventListener('pointerdown', () => {
			this.clearHoverTimer(sourceEl);
			if (this.activeSourceEl === sourceEl) this.activeMenu?.hide();
		});

		if (this.getTrigger() !== 'hover') return;
		sourceEl.addEventListener('mouseenter', () => {
			if (this.activeSourceEl === sourceEl || this.hoverTimers.has(sourceEl)) return;
			const ownerWindow = sourceEl.win;
			const timerId = ownerWindow.setTimeout(() => {
				this.hoverTimers.delete(sourceEl);
				if (sourceEl.isConnected) this.show(sourceEl, button.groupItems, area, false);
			}, HOVER_OPEN_DELAY);
			this.hoverTimers.set(sourceEl, { id: timerId, win: ownerWindow });
		});
		sourceEl.addEventListener('mouseleave', () => this.clearHoverTimer(sourceEl));
	}

	openIfPresent(sourceEl: HTMLElement, button: CustomButton, area: ButtonGroupArea): boolean {
		if (button.kind !== 'group') return false;
		if (button.groupItems.length === 0) return true;
		this.clearHoverTimer(sourceEl);
		this.show(sourceEl, button.groupItems, area, true);
		return true;
	}

	clear(): void {
		for (const timer of this.hoverTimers.values()) timer.win.clearTimeout(timer.id);
		this.hoverTimers.clear();
		this.activeMenu?.hide();
		this.activeMenu = null;
		this.activeSourceEl?.setAttribute('aria-expanded', 'false');
		this.activeSourceEl = null;
	}

	destroy(): void {
		this.clear();
	}

	private show(
		sourceEl: HTMLElement,
		groupItems: CustomButton[],
		area: ButtonGroupArea,
		toggle: boolean,
	): void {
		if (this.activeSourceEl === sourceEl && this.activeMenu) {
			if (toggle) this.activeMenu.hide();
			return;
		}

		this.activeMenu?.hide();
		const menu = new Menu().setUseNativeMenu(false);
		const section = `basic-vault-button-group-${area}`;
		for (const groupItem of groupItems) {
			menu.addItem((item) => {
				item
					.setTitle(groupItem.tooltip.trim() || '未命名按钮')
					.setSection(section)
					.onClick(() => {
						void Promise.resolve(this.executeButton(groupItem)).catch((error) => {
							console.error('Custom Buttons button group action failed:', error);
						});
					});
				if (getIcon(groupItem.icon)) item.setIcon(groupItem.icon);
			});
		}

		this.activeMenu = menu;
		this.activeSourceEl = sourceEl;
		sourceEl.setAttribute('aria-expanded', 'true');
		menu.onHide(() => {
			if (this.activeMenu !== menu) return;
			sourceEl.setAttribute('aria-expanded', 'false');
			this.activeMenu = null;
			this.activeSourceEl = null;
		});
		menu.showAtPosition(this.getMenuPosition(sourceEl, area), sourceEl.ownerDocument);
	}

	private getMenuPosition(sourceEl: HTMLElement, area: ButtonGroupArea) {
		const rect = sourceEl.getBoundingClientRect();
		if (area === 'ribbon') {
			return {
				x: rect.right + 4,
				y: rect.top,
				width: rect.width,
				overlap: true,
				left: false,
			};
		}
		return {
			x: rect.left,
			y: rect.bottom + 4,
			width: rect.width,
			overlap: true,
			left: false,
		};
	}

	private clearHoverTimer(sourceEl: HTMLElement): void {
		const timer = this.hoverTimers.get(sourceEl);
		if (!timer) return;
		timer.win.clearTimeout(timer.id);
		this.hoverTimers.delete(sourceEl);
	}
}
