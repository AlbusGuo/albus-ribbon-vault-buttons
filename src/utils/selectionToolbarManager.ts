import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { App, Plugin } from 'obsidian';
import { ButtonItem, CustomButton } from '../types';

interface SelectionRect {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

type SelectionToolbarButtonRenderer = (
	parentEl: HTMLElement,
	button: CustomButton,
	index: number,
) => HTMLElement;

export class SelectionToolbarManager {
	private items: ButtonItem[] = [];
	private enabled = false;
	private toolbarEl: HTMLElement | null = null;
	private owner: 'editor' | null = null;
	private ownerEditorView: EditorView | null = null;
	private pendingEditorView: EditorView | null = null;
	private pointerDown = false;
	private selectionFromKeyboard = true;
	private positionFrame: number | null = null;
	private showOnKeyboard = false;

	constructor(
		private readonly app: App,
		private readonly renderButton: SelectionToolbarButtonRenderer,
	) {}

	register(plugin: Plugin): void {
		const ownerDocument = plugin.app.workspace.containerEl.ownerDocument;
		plugin.registerDomEvent(ownerDocument, 'pointerdown', this.handlePointerDown);
		plugin.registerDomEvent(ownerDocument, 'pointerup', this.handlePointerUp);
		plugin.registerDomEvent(ownerDocument, 'pointercancel', this.handlePointerCancel);
		plugin.registerDomEvent(ownerDocument, 'keydown', this.handleKeyDown);
		plugin.registerDomEvent(ownerDocument, 'scroll', this.handleViewportChange, true);
		plugin.registerDomEvent(ownerDocument.defaultView ?? window, 'resize', this.handleViewportChange);
		plugin.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			this.selectionFromKeyboard = true;
			this.hide();
		}));
	}

	createEditorExtension() {
		const manager = this;
		return ViewPlugin.fromClass(class {
			constructor(private readonly view: EditorView) {
				manager.updateEditorSelection(view);
			}

			update(update: ViewUpdate): void {
				if (update.selectionSet || update.docChanged || update.focusChanged) {
					manager.updateEditorSelection(this.view);
				}
			}

			destroy(): void {
				manager.editorDestroyed(this.view);
			}
		});
	}

	setItems(
		items: ButtonItem[],
		showOnKeyboard: boolean,
	): void {
		this.items = items;
		this.enabled = items.some((item) => item.type !== 'divider');
		this.showOnKeyboard = showOnKeyboard;
		this.pointerDown = false;
		this.pendingEditorView = null;
		this.selectionFromKeyboard = true;
		this.hide();
		this.removeToolbar();
	}

	hide(): void {
		this.cancelPositionFrame();
		this.owner = null;
		this.ownerEditorView = null;
		this.toolbarEl?.removeClass('is-visible');
	}

	destroy(): void {
		this.cancelPositionFrame();
		this.removeToolbar();
		this.items = [];
		this.enabled = false;
		this.owner = null;
		this.ownerEditorView = null;
		this.pendingEditorView = null;
	}

	private readonly handlePointerDown = (event: PointerEvent): void => {
		if (!this.enabled) return;
		if (this.toolbarEl?.contains(event.target as Node)) return;
		this.pointerDown = true;
		this.selectionFromKeyboard = false;
		this.pendingEditorView = null;
		this.hide();
	};

	private readonly handlePointerUp = (): void => {
		if (!this.enabled) return;
		this.pointerDown = false;
		const pendingEditorView = this.pendingEditorView;
		this.pendingEditorView = null;
		if (pendingEditorView) {
			this.updateEditorSelection(pendingEditorView);
		}
	};

	private readonly handlePointerCancel = (): void => {
		if (!this.enabled) return;
		this.pointerDown = false;
		this.selectionFromKeyboard = true;
		this.pendingEditorView = null;
	};

	private readonly handleKeyDown = (event: KeyboardEvent): void => {
		if (!this.enabled) return;
		if (event.key === 'Escape') {
			this.hide();
			return;
		}
		if (!this.toolbarEl?.contains(event.target as Node)) {
			this.selectionFromKeyboard = true;
		}
	};

	private readonly handleViewportChange = (): void => {
		if (!this.enabled) return;
		this.hide();
	};

	private updateEditorSelection(view: EditorView): void {
		if (!this.enabled) return;
		if (this.pointerDown) {
			this.pendingEditorView = view;
			return;
		}
		if (!this.showOnKeyboard && this.selectionFromKeyboard) {
			if (this.ownerEditorView === view) this.hide();
			return;
		}

		const selection = view.state.selection.main;
		if (
			selection.empty ||
			!view.hasFocus ||
			!view.dom.closest('.workspace-leaf-content[data-type="markdown"]')
		) {
			if (this.owner === 'editor' && this.ownerEditorView === view) this.hide();
			return;
		}

		view.requestMeasure<SelectionRect | null>({
			key: this,
			read: (measuredView) => {
				const currentSelection = measuredView.state.selection.main;
				if (
					currentSelection.empty ||
					!measuredView.hasFocus ||
					!measuredView.dom.closest('.workspace-leaf-content[data-type="markdown"]')
				) {
					return null;
				}

				const startRect = measuredView.coordsAtPos(currentSelection.from);
				const endRect = measuredView.coordsAtPos(currentSelection.to);
				if (!startRect || !endRect) return null;
				return {
					left: Math.min(startRect.left, endRect.left),
					right: Math.max(startRect.right, endRect.right),
					top: Math.min(startRect.top, endRect.top),
					bottom: Math.max(startRect.bottom, endRect.bottom),
				};
			},
			write: (rect, measuredView) => {
				if (!rect) {
					if (this.owner === 'editor' && this.ownerEditorView === measuredView) this.hide();
					return;
				}
				if (this.pointerDown) {
					this.pendingEditorView = measuredView;
					return;
				}
				this.owner = 'editor';
				this.ownerEditorView = measuredView;
				this.scheduleShow(rect);
			},
		});
	}

	private editorDestroyed(view: EditorView): void {
		if (this.ownerEditorView === view) this.hide();
		if (this.pendingEditorView === view) this.pendingEditorView = null;
	}

	private scheduleShow(rect: SelectionRect): void {
		this.cancelPositionFrame();
		this.positionFrame = this.win.requestAnimationFrame(() => {
			this.positionFrame = null;
			this.show(rect);
		});
	}

	private show(selectionRect: SelectionRect): void {
		const toolbarEl = this.ensureToolbar();
		if (!toolbarEl || !this.owner) return;

		toolbarEl.removeClass('is-visible');
		const toolbarRect = toolbarEl.getBoundingClientRect();
		const viewportPadding = 8;
		const gap = 8;
		const centeredLeft = selectionRect.left + (selectionRect.right - selectionRect.left) / 2 - toolbarRect.width / 2;
		const left = Math.min(
			Math.max(viewportPadding, centeredLeft),
			Math.max(viewportPadding, this.win.innerWidth - toolbarRect.width - viewportPadding),
		);
		const aboveTop = selectionRect.top - toolbarRect.height - gap;
		const top = aboveTop >= viewportPadding
			? aboveTop
			: Math.min(
				selectionRect.bottom + gap,
				this.win.innerHeight - toolbarRect.height - viewportPadding,
			);

		toolbarEl.setCssProps({
			'--basic-vault-selection-toolbar-left': `${left}px`,
			'--basic-vault-selection-toolbar-top': `${Math.max(viewportPadding, top)}px`,
		});
		toolbarEl.addClass('is-visible');
	}

	private ensureToolbar(): HTMLElement | null {
		if (this.items.length === 0) return null;
		if (this.toolbarEl?.isConnected) return this.toolbarEl;

		const ownerDocument = this.app.workspace.containerEl.ownerDocument;
		const toolbarEl = ownerDocument.body.createDiv({
			cls: 'basic-vault-selection-toolbar',
			attr: { role: 'toolbar', 'aria-label': '选中文本工具栏' },
		});
		const actionsEl = toolbarEl.createDiv({ cls: 'basic-vault-content-toolbar-actions' });
		this.items.forEach((item, index) => {
			if (item.type === 'divider') {
				actionsEl.createDiv({
					cls: 'basic-vault-content-toolbar-divider',
					attr: { role: 'separator' },
				});
				return;
			}
			this.renderButton(actionsEl, item, index);
		});
		this.toolbarEl = toolbarEl;
		return toolbarEl;
	}

	private removeToolbar(): void {
		this.cancelPositionFrame();
		this.toolbarEl?.remove();
		this.toolbarEl = null;
	}

	private cancelPositionFrame(): void {
		if (this.positionFrame === null) return;
		this.win.cancelAnimationFrame(this.positionFrame);
		this.positionFrame = null;
	}

	private get win(): Window {
		return this.app.workspace.containerEl.ownerDocument.defaultView ?? window;
	}
}
