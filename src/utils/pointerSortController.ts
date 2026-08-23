export interface PointerSortItem {
	key: string;
	element: HTMLElement;
	handle?: HTMLElement;
}

export interface PointerSortControllerOptions {
	containerEl: HTMLElement;
	items: PointerSortItem[];
	scrollEl?: HTMLElement;
	axis?: 'horizontal' | 'vertical';
	onReorder: (sourceIndex: number, targetIndex: number) => void | Promise<void>;
	onSettled?: () => void;
	onError?: (error: unknown) => void;
}

interface PointerSortState {
	pointerId: number;
	pointerType: string;
	sourceIndex: number;
	currentIndex: number;
	startClientX: number;
	startClientY: number;
	lastClientX: number;
	lastClientY: number;
	initialScrollLeft: number;
	initialScrollTop: number;
	items: PointerSortItem[];
	rects: DOMRect[];
	endAnchor: ChildNode | null;
	active: boolean;
}

const MOUSE_ACTIVATION_DISTANCE = 4;
const TOUCH_ACTIVATION_DISTANCE = 8;
const TOUCH_ACTIVATION_DELAY = 180;
const SETTLE_DURATION = 160;
const AUTO_SCROLL_EDGE = 32;
const AUTO_SCROLL_MAX_STEP = 12;
const CLICK_SUPPRESSION_DURATION = 300;

export class PointerSortController {
	private readonly lifetimeAbort = new AbortController();
	private pointerAbort: AbortController | null = null;
	private state: PointerSortState | null = null;
	private activationTimer: number | null = null;
	private settleTimer: number | null = null;
	private autoScrollFrame: number | null = null;
	private commitPending = false;
	private suppressedClick: { key: string; until: number } | null = null;

	constructor(private readonly options: PointerSortControllerOptions) {
		this.options.containerEl.addClass("custom-sort-container");

		for (const [index, item] of this.options.items.entries()) {
			item.element.addClass("custom-sort-item");
			const handle = item.handle ?? item.element;
			if (item.handle) handle.addClass("custom-sort-handle");
			handle.addEventListener(
				"pointerdown",
				(event) => this.handlePointerDown(event, index),
				{ signal: this.lifetimeAbort.signal },
			);
			item.element.addEventListener(
				"click",
				(event) => {
					if (!this.consumeSuppressedClick(item.key)) return;
					event.preventDefault();
					event.stopImmediatePropagation();
				},
				{ capture: true, signal: this.lifetimeAbort.signal },
			);
		}
	}

	consumeSuppressedClick(key: string): boolean {
		const suppressedClick = this.suppressedClick;
		if (!suppressedClick || suppressedClick.key !== key) return false;
		if (performance.now() > suppressedClick.until) {
			this.suppressedClick = null;
			return false;
		}

		this.suppressedClick = null;
		return true;
	}

	destroy(): void {
		this.lifetimeAbort.abort();
		this.stopPointerTracking();
		this.clearActivationTimer();
		this.clearSettleTimer();
		this.stopAutoScroll();
		this.clearVisualState(this.options.items);
		this.options.containerEl.removeClass("custom-sort-container", "is-pointer-sorting");
		this.state = null;
		this.commitPending = false;
		this.suppressedClick = null;
	}

	private handlePointerDown(event: PointerEvent, sourceIndex: number): void {
		if (
			this.state ||
			this.settleTimer !== null ||
			this.commitPending ||
			!event.isPrimary ||
			event.button !== 0
		) {
			return;
		}

		const items = this.options.items.filter(
			(item) => item.element.parentElement === this.options.containerEl,
		);
		const sourceItem = this.options.items[sourceIndex];
		const actualSourceIndex = items.indexOf(sourceItem);
		if (!sourceItem || actualSourceIndex < 0 || items.length < 2) return;

		const lastItem = items[items.length - 1];
		this.state = {
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			sourceIndex: actualSourceIndex,
			currentIndex: actualSourceIndex,
			startClientX: event.clientX,
			startClientY: event.clientY,
			lastClientX: event.clientX,
			lastClientY: event.clientY,
			initialScrollLeft: this.scrollEl.scrollLeft,
			initialScrollTop: this.scrollEl.scrollTop,
			items,
			rects: items.map((item) => item.element.getBoundingClientRect()),
			endAnchor: lastItem?.element.nextSibling ?? null,
			active: false,
		};

		this.pointerAbort = new AbortController();
		const signal = this.pointerAbort.signal;
		const ownerDocument = this.options.containerEl.ownerDocument;
		ownerDocument.addEventListener("pointermove", this.handlePointerMove, {
			signal,
			passive: false,
		});
		ownerDocument.addEventListener("pointerup", this.handlePointerUp, {
			capture: true,
			signal,
		});
		ownerDocument.addEventListener("pointercancel", this.handlePointerCancel, {
			signal,
		});
		ownerDocument.addEventListener("keydown", this.handleKeyDown, { signal });

		if (event.pointerType === "touch") {
			this.activationTimer = this.win.setTimeout(() => {
				this.activationTimer = null;
				this.activateDrag();
			}, TOUCH_ACTIVATION_DELAY);
		}
	}

	private readonly handlePointerMove = (event: PointerEvent): void => {
		const state = this.state;
		if (!state || event.pointerId !== state.pointerId) return;

		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
		const distance = Math.hypot(
			event.clientX - state.startClientX,
			event.clientY - state.startClientY,
		);

		if (!state.active) {
			if (state.pointerType === "touch") {
				if (distance > TOUCH_ACTIVATION_DISTANCE) {
					this.cancelPendingDrag();
				}
				return;
			}

			if (distance < MOUSE_ACTIVATION_DISTANCE) return;
			this.activateDrag();
		}

		if (!this.state?.active) return;
		event.preventDefault();
		this.updateVisualOrder();
	};

	private readonly handlePointerUp = (event: PointerEvent): void => {
		const state = this.state;
		if (!state || event.pointerId !== state.pointerId) return;
		if (!state.active) {
			this.cancelPendingDrag();
			return;
		}

		event.preventDefault();
		this.finishDrag();
	};

	private readonly handlePointerCancel = (event: PointerEvent): void => {
		if (!this.state || event.pointerId !== this.state.pointerId) return;
		this.cancelDrag();
	};

	private readonly handleKeyDown = (event: KeyboardEvent): void => {
		if (event.key !== "Escape" || !this.state) return;
		event.preventDefault();
		this.cancelDrag();
	};

	private activateDrag(): void {
		const state = this.state;
		if (!state || state.active) return;

		this.clearActivationTimer();
		state.active = true;
		const sourceEl = state.items[state.sourceIndex]?.element;
		if (!sourceEl) {
			this.cancelPendingDrag();
			return;
		}

		this.options.containerEl.addClass("is-pointer-sorting");
		sourceEl.addClass("is-pointer-dragging");
		sourceEl.setAttribute("aria-grabbed", "true");
		this.startAutoScroll();
		this.updateVisualOrder();
	}

	private updateVisualOrder(): void {
		const state = this.state;
		if (!state?.active) return;

		const horizontal = this.axis === 'horizontal';
		const scrollDelta = horizontal
			? this.scrollEl.scrollLeft - state.initialScrollLeft
			: this.scrollEl.scrollTop - state.initialScrollTop;
		const pointerDelta = horizontal
			? state.lastClientX - state.startClientX
			: state.lastClientY - state.startClientY;
		const sourceRect = state.rects[state.sourceIndex];
		if (!sourceRect) return;

		const sourceStart = horizontal ? sourceRect.left : sourceRect.top;
		const sourceSize = horizontal ? sourceRect.width : sourceRect.height;
		const sourceCenter = sourceStart + sourceSize / 2 + pointerDelta;
		let targetIndex = state.sourceIndex;
		if (pointerDelta > 0) {
			for (let index = state.sourceIndex + 1; index < state.rects.length; index++) {
				const targetRect = state.rects[index];
				if (!targetRect) continue;
				const targetStart = horizontal ? targetRect.left : targetRect.top;
				const targetSize = horizontal ? targetRect.width : targetRect.height;
				if (sourceCenter <= targetStart + targetSize / 2 - scrollDelta) break;
				targetIndex = index;
			}
		} else if (pointerDelta < 0) {
			for (let index = state.sourceIndex - 1; index >= 0; index--) {
				const targetRect = state.rects[index];
				if (!targetRect) continue;
				const targetStart = horizontal ? targetRect.left : targetRect.top;
				const targetSize = horizontal ? targetRect.width : targetRect.height;
				if (sourceCenter >= targetStart + targetSize / 2 - scrollDelta) break;
				targetIndex = index;
			}
		}
		state.currentIndex = targetIndex;

		const virtualOrder = [...state.items];
		const [sourceItem] = virtualOrder.splice(state.sourceIndex, 1);
		if (!sourceItem) return;
		virtualOrder.splice(targetIndex, 0, sourceItem);

		for (const [originalIndex, item] of state.items.entries()) {
			if (originalIndex === state.sourceIndex) {
				item.element.style.translate = this.getTranslate(pointerDelta + scrollDelta);
				continue;
			}

			const virtualIndex = virtualOrder.indexOf(item);
			const originalRect = state.rects[originalIndex];
			const targetRect = state.rects[virtualIndex];
			if (!originalRect || !targetRect) continue;
			const offset = horizontal
				? targetRect.left - originalRect.left
				: targetRect.top - originalRect.top;
			item.element.style.translate = this.getTranslate(offset);
		}
	}

	private finishDrag(): void {
		const state = this.state;
		if (!state?.active) return;

		this.stopPointerTracking();
		this.stopAutoScroll();
		this.clearActivationTimer();
		this.suppressedClick = {
			key: state.items[state.sourceIndex]?.key ?? "",
			until: performance.now() + CLICK_SUPPRESSION_DURATION,
		};

		const sourceItem = state.items[state.sourceIndex];
		if (!sourceItem) {
			this.clearVisualState(state.items);
			this.state = null;
			return;
		}

		sourceItem.element.addClass("is-pointer-settling");
		const sourceRect = state.rects[state.sourceIndex];
		const targetRect = state.rects[state.currentIndex];
		if (sourceRect && targetRect) {
			const offset = this.axis === 'horizontal'
				? targetRect.left - sourceRect.left
				: targetRect.top - sourceRect.top;
			sourceItem.element.style.translate = this.getTranslate(offset);
		}

		const reorderedItems = [...state.items];
		const [movedItem] = reorderedItems.splice(state.sourceIndex, 1);
		if (movedItem) reorderedItems.splice(state.currentIndex, 0, movedItem);

		const didReorder = state.sourceIndex !== state.currentIndex;
		this.commitPending = didReorder;
		const commit = didReorder
			? this.commitReorder(state.sourceIndex, state.currentIndex)
			: Promise.resolve();

		this.settleTimer = this.win.setTimeout(() => {
			this.settleTimer = null;
			if (didReorder) this.reorderElements(reorderedItems, state.endAnchor);
			this.clearVisualState(state.items);
			this.state = null;

			if (didReorder) {
				void commit.then(() => {
					this.commitPending = false;
					this.options.onSettled?.();
				});
			}
		}, SETTLE_DURATION);
	}

	private cancelDrag(): void {
		const state = this.state;
		if (!state) return;
		if (!state.active) {
			this.cancelPendingDrag();
			return;
		}

		this.stopPointerTracking();
		this.stopAutoScroll();
		this.clearActivationTimer();
		for (const item of state.items) {
			item.element.addClass("is-pointer-settling");
			item.element.style.translate = "0 0";
		}

		this.settleTimer = this.win.setTimeout(() => {
			this.settleTimer = null;
			this.clearVisualState(state.items);
			this.state = null;
		}, SETTLE_DURATION);
	}

	private cancelPendingDrag(): void {
		this.stopPointerTracking();
		this.clearActivationTimer();
		this.state = null;
	}

	private async commitReorder(sourceIndex: number, targetIndex: number): Promise<void> {
		try {
			await this.options.onReorder(sourceIndex, targetIndex);
		} catch (error) {
			this.options.onError?.(error);
		}
	}

	private reorderElements(items: PointerSortItem[], endAnchor: ChildNode | null): void {
		const containerEl = this.options.containerEl;
		const validAnchor = endAnchor?.parentNode === containerEl ? endAnchor : null;
		for (const item of items) {
			containerEl.insertBefore(item.element, validAnchor);
		}
	}

	private startAutoScroll(): void {
		if (this.autoScrollFrame !== null) return;

		const tick = () => {
			this.autoScrollFrame = null;
			const state = this.state;
			if (!state?.active) return;

			const scrollRect = this.scrollEl.getBoundingClientRect();
			const horizontal = this.axis === 'horizontal';
			const pointerPosition = horizontal ? state.lastClientX : state.lastClientY;
			const startEdge = horizontal ? scrollRect.left : scrollRect.top;
			const endEdge = horizontal ? scrollRect.right : scrollRect.bottom;
			let scrollStep = 0;
			if (pointerPosition < startEdge + AUTO_SCROLL_EDGE) {
				const ratio = (startEdge + AUTO_SCROLL_EDGE - pointerPosition) / AUTO_SCROLL_EDGE;
				scrollStep = -AUTO_SCROLL_MAX_STEP * Math.min(1, ratio);
			} else if (pointerPosition > endEdge - AUTO_SCROLL_EDGE) {
				const ratio = (pointerPosition - (endEdge - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE;
				scrollStep = AUTO_SCROLL_MAX_STEP * Math.min(1, ratio);
			}

			if (scrollStep !== 0) {
				const previousScrollPosition = horizontal
					? this.scrollEl.scrollLeft
					: this.scrollEl.scrollTop;
				if (horizontal) {
					this.scrollEl.scrollLeft += scrollStep;
				} else {
					this.scrollEl.scrollTop += scrollStep;
				}
				const nextScrollPosition = horizontal
					? this.scrollEl.scrollLeft
					: this.scrollEl.scrollTop;
				if (nextScrollPosition !== previousScrollPosition) this.updateVisualOrder();
			}

			this.autoScrollFrame = this.win.requestAnimationFrame(tick);
		};

		this.autoScrollFrame = this.win.requestAnimationFrame(tick);
	}

	private stopAutoScroll(): void {
		if (this.autoScrollFrame === null) return;
		this.win.cancelAnimationFrame(this.autoScrollFrame);
		this.autoScrollFrame = null;
	}

	private stopPointerTracking(): void {
		this.pointerAbort?.abort();
		this.pointerAbort = null;
	}

	private clearActivationTimer(): void {
		if (this.activationTimer === null) return;
		this.win.clearTimeout(this.activationTimer);
		this.activationTimer = null;
	}

	private clearSettleTimer(): void {
		if (this.settleTimer === null) return;
		this.win.clearTimeout(this.settleTimer);
		this.settleTimer = null;
	}

	private clearVisualState(items: PointerSortItem[]): void {
		this.options.containerEl.removeClass("is-pointer-sorting");
		for (const item of items) {
			item.element.removeClass("is-pointer-dragging", "is-pointer-settling");
			item.element.removeAttribute("aria-grabbed");
			item.element.style.translate = "";
		}
	}

	private getTranslate(offset: number): string {
		return this.axis === 'horizontal' ? `${offset}px 0` : `0 ${offset}px`;
	}

	private get axis(): 'horizontal' | 'vertical' {
		return this.options.axis ?? 'vertical';
	}

	private get scrollEl(): HTMLElement {
		return this.options.scrollEl ?? this.options.containerEl;
	}

	private get win(): Window {
		return this.options.containerEl.ownerDocument.defaultView ?? window;
	}
}
