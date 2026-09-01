import { App, MarkdownView } from 'obsidian';
import { ButtonItem, CustomButton, NoteToolbarPosition } from '../types';
import { PointerSortController, PointerSortItem } from './pointerSortController';

type NoteToolbarButtonRenderer = (
	parentEl: HTMLElement,
	button: CustomButton,
	index: number,
) => HTMLElement;

type NoteToolbarReorderHandler = (
	sourceIndex: number,
	targetIndex: number,
) => void | Promise<void>;

export class NoteToolbarManager {
	private readonly containers = new Set<HTMLElement>();
	private readonly toolbarByView = new WeakMap<MarkdownView, HTMLElement>();
	private readonly alignmentFrames = new Map<number, Window>();
	private readonly sortControllers = new Map<HTMLElement, PointerSortController>();
	private accessibleLabelSequence = 0;

	constructor(
		private readonly app: App,
		private readonly renderButton: NoteToolbarButtonRenderer,
		private readonly onReorder: NoteToolbarReorderHandler,
		private readonly onReorderSettled: () => void,
	) {}

	renderAll(
		items: ButtonItem[],
		position: NoteToolbarPosition,
	): void {
		this.clear();
		if (!this.hasButtons(items)) return;
		this.sync(items, position);
	}

	sync(
		items: ButtonItem[],
		position: NoteToolbarPosition,
	): void {
		for (const containerEl of this.containers) {
			if (!containerEl.isConnected) {
				this.destroySortController(containerEl);
				this.containers.delete(containerEl);
			}
		}
		if (!this.hasButtons(items)) {
			this.clear();
			return;
		}

		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof MarkdownView)) return;
			this.addToView(leaf.view, items, position);
		});
	}

	destroy(): void {
		this.clear();
	}

	private addToView(
		view: MarkdownView,
		items: ButtonItem[],
		position: NoteToolbarPosition,
	): void {
		const existing = this.toolbarByView.get(view);
		if (existing?.isConnected && existing.dataset.position === position) return;
		if (existing) {
			this.destroySortController(existing);
			existing.remove();
			this.containers.delete(existing);
		}

		const labelId = `basic-vault-note-toolbar-label-${++this.accessibleLabelSequence}`;
		const toolbarEl = view.containerEl.createDiv({
			cls: `basic-vault-note-toolbar is-${position}`,
			attr: { role: 'toolbar', 'aria-labelledby': labelId },
		});
		toolbarEl.createSpan({
			cls: 'basic-vault-toolbar-accessible-label',
			text: '笔记工具栏',
			attr: { id: labelId },
		});
		toolbarEl.dataset.position = position;
		const actionsEl = toolbarEl.createDiv({ cls: 'basic-vault-content-toolbar-actions' });
		const sortableItems: PointerSortItem[] = [];
		items.forEach((item, index) => {
			if (item.type === 'divider') {
				const dividerEl = actionsEl.createDiv({
					cls: [
						'basic-vault-content-toolbar-divider',
						'basic-vault-note-toolbar-divider',
					],
					attr: { role: 'separator' },
				});
				sortableItems.push({ key: item.id, element: dividerEl });
				return;
			}
			const buttonEl = this.renderButton(actionsEl, item, index);
			sortableItems.push({ key: `note:${index}`, element: buttonEl });
		});
		toolbarEl.addEventListener('pointerdown', () => {
			this.app.workspace.setActiveLeaf(view.leaf, { focus: true });
		});

		if (position === 'top-fixed') {
			const viewHeaderEl = view.containerEl.querySelector<HTMLElement>('.view-header');
			if (viewHeaderEl) {
				viewHeaderEl.insertAdjacentElement('afterend', toolbarEl);
			} else {
				view.containerEl.insertAdjacentElement('afterbegin', toolbarEl);
			}
		} else {
			view.containerEl.insertAdjacentElement('afterbegin', toolbarEl);
			this.scheduleBottomAlignment(toolbarEl);
		}

		this.toolbarByView.set(view, toolbarEl);
		this.containers.add(toolbarEl);
		if (sortableItems.length > 1) {
			this.sortControllers.set(toolbarEl, new PointerSortController({
				containerEl: actionsEl,
				items: sortableItems,
				scrollEl: toolbarEl,
				axis: 'horizontal',
				onReorder: this.onReorder,
				onSettled: this.onReorderSettled,
				onError: (error) => {
					console.error('Custom Buttons failed to save note toolbar order:', error);
				},
			}));
		}
	}

	private scheduleBottomAlignment(toolbarEl: HTMLElement): void {
		const ownerWindow = toolbarEl.win;
		const frameId = ownerWindow.requestAnimationFrame(() => {
			this.alignmentFrames.delete(frameId);
			if (!toolbarEl.isConnected) return;
			toolbarEl.setCssProps({
				'--basic-vault-note-toolbar-width': `${toolbarEl.offsetWidth}px`,
			});
			toolbarEl.addClass('is-aligned');
		});
		this.alignmentFrames.set(frameId, ownerWindow);
	}

	private hasButtons(items: ButtonItem[]): boolean {
		return items.some((item) => item.type !== 'divider');
	}

	private destroySortController(toolbarEl: HTMLElement): void {
		this.sortControllers.get(toolbarEl)?.destroy();
		this.sortControllers.delete(toolbarEl);
	}

	private clear(): void {
		for (const [frameId, ownerWindow] of this.alignmentFrames) {
			ownerWindow.cancelAnimationFrame(frameId);
		}
		this.alignmentFrames.clear();
		for (const controller of this.sortControllers.values()) controller.destroy();
		this.sortControllers.clear();
		for (const containerEl of this.containers) containerEl.remove();
		this.containers.clear();
	}
}
