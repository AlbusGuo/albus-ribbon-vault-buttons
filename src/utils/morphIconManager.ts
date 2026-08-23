import { getIcon } from 'obsidian';
import { svgToIcon } from 'morphicons/adapters';
import { createMorph } from 'morphicons/dom';
import type { Morph } from 'morphicons/dom';
import type { IconInput } from 'morphicons';

interface MorphElementState {
	morph: Morph;
	pathEl: SVGPathElement;
	currentIcon: string;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const UNSUPPORTED_SVG_CONTENT = /<(?:defs|mask|clipPath|symbol|use|image|text|foreignObject|filter|linearGradient|radialGradient)\b/i;
const TRANSFORM_ATTRIBUTE = /\btransform\s*=/i;

export class MorphIconManager {
	private readonly iconSources = new Map<string, IconInput | null>();
	private readonly incompatiblePairs = new Set<string>();
	private readonly elementStates = new Map<HTMLElement, MorphElementState>();

	constructor(
		private readonly renderIntegratedIcon: (
			element: HTMLElement,
			iconName: string,
		) => boolean,
	) {}

	transition(element: HTMLElement, fromIcon: string, toIcon: string): boolean {
		if (!fromIcon || !toIcon || fromIcon === toIcon) return false;
		const pairKey = `${fromIcon}\0${toIcon}`;
		if (this.incompatiblePairs.has(pairKey)) return false;
		const fromSource = this.getIconSource(fromIcon, element.ownerDocument);
		const toSource = this.getIconSource(toIcon, element.ownerDocument);
		if (!fromSource || !toSource) return false;

		try {
			let state = this.elementStates.get(element);
			if (
				!state ||
				state.currentIcon !== fromIcon ||
				!element.contains(state.pathEl)
			) {
				this.resetElement(element);
				const pathEl = this.createMorphSvg(element);
				const morph = createMorph(pathEl, fromSource, {
					reducedMotion: 'user',
				});
				state = { morph, pathEl, currentIcon: fromIcon };
				this.elementStates.set(element, state);
			}

			state.currentIcon = toIcon;
			state.morph.morphTo(toSource, 'snappy');
			return true;
		} catch {
			this.resetElement(element);
			this.incompatiblePairs.add(pairKey);
			this.incompatiblePairs.add(`${toIcon}\0${fromIcon}`);
			return false;
		}
	}

	resetElement(element: HTMLElement): void {
		const state = this.elementStates.get(element);
		if (!state) return;
		state.morph.destroy();
		this.elementStates.delete(element);
	}

	clearElements(): void {
		for (const state of this.elementStates.values()) state.morph.destroy();
		this.elementStates.clear();
	}

	invalidate(): void {
		this.clearElements();
		this.iconSources.clear();
		this.incompatiblePairs.clear();
	}

	destroy(): void {
		this.invalidate();
	}

	private getIconSource(iconName: string, ownerDocument: Document): IconInput | null {
		if (this.iconSources.has(iconName)) return this.iconSources.get(iconName) ?? null;

		const renderedSvgEl = this.renderIconToSvg(iconName, ownerDocument);
		if (!renderedSvgEl) return null;
		const svgEl = this.resolveGeometrySvg(renderedSvgEl);
		if (!svgEl) {
			this.iconSources.set(iconName, null);
			return null;
		}

		try {
			const markup = svgEl.outerHTML;
			if (
				UNSUPPORTED_SVG_CONTENT.test(markup) ||
				TRANSFORM_ATTRIBUTE.test(markup)
			) {
				this.iconSources.set(iconName, null);
				return null;
			}

			const source = svgToIcon(markup);
			this.iconSources.set(iconName, source);
			return source;
		} catch {
			this.iconSources.set(iconName, null);
			return null;
		}
	}

	private renderIconToSvg(iconName: string, ownerDocument: Document): SVGSVGElement | null {
		const containerEl = ownerDocument.createElement('div');
		if (this.renderIntegratedIcon(containerEl, iconName)) {
			return containerEl.querySelector<SVGSVGElement>('svg');
		}

		const iconEl = getIcon(iconName);
		return iconEl
			? ownerDocument.importNode(iconEl, true) as SVGSVGElement
			: null;
	}

	private resolveGeometrySvg(renderedSvgEl: SVGSVGElement): SVGSVGElement | null {
		let sourceSvgEl = renderedSvgEl;
		while (true) {
			const nestedSvgEls = Array.from(sourceSvgEl.children).filter(
				(child): child is SVGSVGElement => child.localName.toLowerCase() === 'svg',
			);
			if (nestedSvgEls.length === 0) break;
			if (nestedSvgEls.length !== 1) return null;
			const nestedSvgEl = nestedSvgEls[0];
			if (!nestedSvgEl.getAttribute('viewBox')?.trim()) return null;
			sourceSvgEl = nestedSvgEl;
		}

		return sourceSvgEl.cloneNode(true) as SVGSVGElement;
	}

	private createMorphSvg(containerEl: HTMLElement): SVGPathElement {
		const ownerDocument = containerEl.ownerDocument;
		const svgEl = ownerDocument.createElementNS(SVG_NAMESPACE, 'svg');
		const pathEl = ownerDocument.createElementNS(SVG_NAMESPACE, 'path');
		svgEl.setAttribute('viewBox', '0 0 24 24');
		svgEl.setAttribute('width', '24');
		svgEl.setAttribute('height', '24');
		svgEl.setAttribute('fill', 'none');
		svgEl.setAttribute('stroke', 'currentColor');
		svgEl.setAttribute('stroke-width', '2');
		svgEl.setAttribute('stroke-linecap', 'round');
		svgEl.setAttribute('stroke-linejoin', 'round');
		svgEl.setAttribute('aria-hidden', 'true');
		svgEl.setAttribute('focusable', 'false');
		svgEl.addClass('svg-icon', 'basic-vault-morph-icon');
		svgEl.appendChild(pathEl);
		containerEl.replaceChildren(svgEl);
		return pathEl;
	}
}
