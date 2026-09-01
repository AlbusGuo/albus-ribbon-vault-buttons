import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { App, Plugin } from 'obsidian';
import { ButtonItem, CustomButton } from '../types';

interface SelectionRect {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

interface TrackedDocument {
	abortController: AbortController;
	editorCount: number;
	persistent: boolean;
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
	private positionFrameWindow: Window | null = null;
	private showOnKeyboard = false;
	private readonly trackedDocuments = new Map<Document, TrackedDocument>();
	private accessibleLabelSequence = 0;

	constructor(
		private readonly app: App,
		private readonly renderButton: SelectionToolbarButtonRenderer,
	) {}

	register(plugin: Plugin): void {
		const ownerDocument = plugin.app.workspace.containerEl.ownerDocument;
		this.trackDocument(ownerDocument, true);
		plugin.register(() => this.clearTrackedDocuments());
		plugin.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			this.selectionFromKeyboard = true;
			this.hide();
		}));
	}

	createEditorExtension() {
		const editorCreated = (view: EditorView) => this.editorCreated(view);
		const editorUpdated = (view: EditorView) => this.updateEditorSelection(view);
		const editorDestroyed = (view: EditorView) => this.editorDestroyed(view);
		return ViewPlugin.fromClass(class {
			constructor(private readonly view: EditorView) {
				editorCreated(view);
				editorUpdated(view);
			}

			update(update: ViewUpdate): void {
				if (update.selectionSet || update.docChanged || update.focusChanged) {
					editorUpdated(this.view);
				}
			}

			destroy(): void {
				editorDestroyed(this.view);
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
		const previousOwnerEditorView = this.ownerEditorView;
		this.cancelPositionFrame();
		this.owner = null;
		this.ownerEditorView = null;
		this.toolbarEl?.removeClass('is-visible');
		this.restoreToolbarToDefaultHost(previousOwnerEditorView);
	}

	destroy(): void {
		this.cancelPositionFrame();
		this.removeToolbar();
		this.items = [];
		this.enabled = false;
		this.owner = null;
		this.ownerEditorView = null;
		this.pendingEditorView = null;
		this.clearTrackedDocuments();
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
		this.releaseDocument(view.dom.ownerDocument);
	}

	private scheduleShow(rect: SelectionRect): void {
		this.cancelPositionFrame();
		const frameWindow = this.getEditorWindow(this.ownerEditorView);
		this.positionFrameWindow = frameWindow;
		this.positionFrame = frameWindow.requestAnimationFrame(() => {
			this.positionFrame = null;
			this.positionFrameWindow = null;
			this.show(rect);
		});
	}

	private show(selectionRect: SelectionRect): void {
		const ownerEditorView = this.ownerEditorView;
		if (!ownerEditorView?.dom.isConnected || !this.owner) {
			this.hide();
			return;
		}
		const toolbarEl = this.ensureToolbar(ownerEditorView);
		if (!toolbarEl) return;

		toolbarEl.removeClass('is-visible');
		const toolbarRect = toolbarEl.getBoundingClientRect();
		const ownerWindow = this.getEditorWindow(ownerEditorView);
		const viewportPadding = 8;
		const gap = 8;
		const centeredLeft = selectionRect.left + (selectionRect.right - selectionRect.left) / 2 - toolbarRect.width / 2;
		const left = Math.min(
			Math.max(viewportPadding, centeredLeft),
			Math.max(viewportPadding, ownerWindow.innerWidth - toolbarRect.width - viewportPadding),
		);
		const aboveTop = selectionRect.top - toolbarRect.height - gap;
		const top = aboveTop >= viewportPadding
			? aboveTop
			: Math.min(
				selectionRect.bottom + gap,
				ownerWindow.innerHeight - toolbarRect.height - viewportPadding,
			);

		toolbarEl.setCssProps({
			'--basic-vault-selection-toolbar-left': `${left}px`,
			'--basic-vault-selection-toolbar-top': `${Math.max(viewportPadding, top)}px`,
		});
		toolbarEl.addClass('is-visible');
	}

	private ensureToolbar(ownerEditorView: EditorView): HTMLElement | null {
		if (this.items.length === 0) return null;
		const hostEl = this.resolveToolbarHost(ownerEditorView);
		if (this.toolbarEl) {
			this.moveToolbarToHost(hostEl);
			return this.toolbarEl;
		}

		const labelId = `basic-vault-selection-toolbar-label-${++this.accessibleLabelSequence}`;
		const toolbarEl = hostEl.createDiv({
			cls: 'basic-vault-selection-toolbar',
			attr: { role: 'toolbar', 'aria-labelledby': labelId },
		});
		toolbarEl.createSpan({
			cls: 'basic-vault-toolbar-accessible-label',
			text: '选中文本工具栏',
			attr: { id: labelId },
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
		this.positionFrameWindow?.cancelAnimationFrame(this.positionFrame);
		this.positionFrame = null;
		this.positionFrameWindow = null;
	}

	private editorCreated(view: EditorView): void {
		this.trackDocument(view.dom.ownerDocument);
	}

	private trackDocument(ownerDocument: Document, persistent = false): void {
		const trackedDocument = this.trackedDocuments.get(ownerDocument);
		if (trackedDocument) {
			trackedDocument.persistent ||= persistent;
			if (!persistent && !trackedDocument.persistent) {
				trackedDocument.editorCount += 1;
			}
			return;
		}

		const AbortControllerConstructor = ownerDocument.defaultView?.AbortController ?? AbortController;
		const abortController = new AbortControllerConstructor();
		const options = { signal: abortController.signal };
		ownerDocument.addEventListener('pointerdown', this.handlePointerDown, options);
		ownerDocument.addEventListener('pointerup', this.handlePointerUp, options);
		ownerDocument.addEventListener('pointercancel', this.handlePointerCancel, options);
		ownerDocument.addEventListener('keydown', this.handleKeyDown, options);
		ownerDocument.addEventListener('scroll', this.handleViewportChange, {
			capture: true,
			signal: abortController.signal,
		});
		ownerDocument.defaultView?.addEventListener('resize', this.handleViewportChange, options);
		this.trackedDocuments.set(ownerDocument, {
			abortController,
			editorCount: persistent ? 0 : 1,
			persistent,
		});
	}

	private releaseDocument(ownerDocument: Document): void {
		const trackedDocument = this.trackedDocuments.get(ownerDocument);
		if (!trackedDocument || trackedDocument.persistent) return;
		trackedDocument.editorCount = Math.max(0, trackedDocument.editorCount - 1);
		if (trackedDocument.editorCount > 0) return;
		trackedDocument.abortController.abort();
		this.trackedDocuments.delete(ownerDocument);
		if (this.toolbarEl?.ownerDocument === ownerDocument) {
			this.moveToolbarToHost(this.getMainDocument().body);
		}
	}

	private clearTrackedDocuments(): void {
		for (const trackedDocument of this.trackedDocuments.values()) {
			trackedDocument.abortController.abort();
		}
		this.trackedDocuments.clear();
	}

	private resolveToolbarHost(ownerEditorView: EditorView): HTMLElement {
		const ownerDocument = ownerEditorView.dom.ownerDocument;
		const modalContainerEl = ownerEditorView.dom.closest<HTMLElement>('.modal-container');
		if (modalContainerEl?.isConnected) return modalContainerEl;
		return ownerDocument.body;
	}

	private restoreToolbarToDefaultHost(ownerEditorView: EditorView | null): void {
		if (!this.toolbarEl) return;
		this.moveToolbarToHost(this.getDefaultHost(ownerEditorView));
	}

	private getDefaultHost(ownerEditorView: EditorView | null): HTMLElement {
		const ownerDocument = ownerEditorView?.dom.ownerDocument;
		const ownerWindow = ownerDocument?.defaultView;
		if (
			ownerDocument?.body.isConnected &&
			(!ownerWindow || !ownerWindow.closed)
		) {
			return ownerDocument.body;
		}
		return this.getMainDocument().body;
	}

	private moveToolbarToHost(hostEl: HTMLElement): void {
		if (!this.toolbarEl) return;
		const safeHostEl = hostEl.isConnected ? hostEl : this.getMainDocument().body;
		if (this.toolbarEl.parentElement === safeHostEl) return;
		safeHostEl.appendChild(this.toolbarEl);
	}

	private getEditorWindow(ownerEditorView: EditorView | null): Window {
		return ownerEditorView?.dom.ownerDocument.defaultView ??
			this.getMainDocument().defaultView ?? window;
	}

	private getMainDocument(): Document {
		return this.app.workspace.containerEl.ownerDocument;
	}
}
