import { App, MarkdownView } from 'obsidian';
import { CustomButton, NoteToolbarPosition } from '../types';

type NoteToolbarButtonRenderer = (
	parentEl: HTMLElement,
	button: CustomButton,
	index: number,
	loadUncachedIcon: boolean,
) => HTMLElement;

export class NoteToolbarManager {
	private readonly containers = new Set<HTMLElement>();
	private readonly toolbarByView = new WeakMap<MarkdownView, HTMLElement>();
	private readonly alignmentFrames = new Map<number, Window>();

	constructor(
		private readonly app: App,
		private readonly renderButton: NoteToolbarButtonRenderer,
	) {}

	renderAll(
		items: CustomButton[],
		position: NoteToolbarPosition,
		loadUncachedIcons = true,
	): void {
		this.clear();
		if (items.length === 0) return;
		this.sync(items, position, loadUncachedIcons);
	}

	sync(
		items: CustomButton[],
		position: NoteToolbarPosition,
		loadUncachedIcons = true,
	): void {
		for (const containerEl of this.containers) {
			if (!containerEl.isConnected) this.containers.delete(containerEl);
		}
		if (items.length === 0) {
			this.clear();
			return;
		}

		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof MarkdownView)) return;
			this.addToView(leaf.view, items, position, loadUncachedIcons);
		});
	}

	destroy(): void {
		this.clear();
	}

	private addToView(
		view: MarkdownView,
		items: CustomButton[],
		position: NoteToolbarPosition,
		loadUncachedIcons: boolean,
	): void {
		const existing = this.toolbarByView.get(view);
		if (existing?.isConnected && existing.dataset.position === position) return;
		if (existing) {
			existing.remove();
			this.containers.delete(existing);
		}

		const toolbarEl = view.containerEl.createDiv({
			cls: `basic-vault-note-toolbar is-${position}`,
			attr: { role: 'toolbar', 'aria-label': '笔记工具栏' },
		});
		toolbarEl.dataset.position = position;
		const actionsEl = toolbarEl.createDiv({ cls: 'basic-vault-content-toolbar-actions' });
		items.forEach((button, index) => {
			this.renderButton(actionsEl, button, index, loadUncachedIcons);
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

	private clear(): void {
		for (const [frameId, ownerWindow] of this.alignmentFrames) {
			ownerWindow.cancelAnimationFrame(frameId);
		}
		this.alignmentFrames.clear();
		for (const containerEl of this.containers) containerEl.remove();
		this.containers.clear();
	}
}
