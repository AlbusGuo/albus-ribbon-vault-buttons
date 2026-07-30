const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MAX_SVG_LENGTH = 1_000_000;
const BLOCKED_ELEMENTS = new Set([
	'audio',
	'canvas',
	'embed',
	'foreignobject',
	'iframe',
	'object',
	'script',
	'style',
	'video',
]);

function containsExternalUrl(value: string): boolean {
	const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
	let match: RegExpExecArray | null;

	while ((match = urlPattern.exec(value)) !== null) {
		if (!match[2].trim().startsWith('#')) {
			return true;
		}
	}

	return false;
}

/**
 * 将 SVG 清理为只包含本地图形内容的安全文档.
 */
export function sanitizeSvgContent(content: string): string | null {
	if (typeof content !== 'string' || content.length < 10 || content.length > MAX_SVG_LENGTH) {
		return null;
	}

	try {
		const parser = new DOMParser();
		const documentNode = parser.parseFromString(content, 'image/svg+xml');
		if (documentNode.querySelector('parsererror')) {
			return null;
		}

		const root = documentNode.documentElement;
		if (
			root.localName.toLowerCase() !== 'svg' ||
			(root.namespaceURI !== null && root.namespaceURI !== SVG_NAMESPACE)
		) {
			return null;
		}

		for (const element of Array.from(root.querySelectorAll('*'))) {
			const elementName = element.localName.toLowerCase();
			if (
				BLOCKED_ELEMENTS.has(elementName) ||
				(element.namespaceURI !== null && element.namespaceURI !== SVG_NAMESPACE)
			) {
				element.remove();
				continue;
			}

			for (const attribute of Array.from(element.attributes)) {
				const attributeName = attribute.name.toLowerCase();
				const value = attribute.value.trim();

				if (attributeName.startsWith('on')) {
					element.removeAttribute(attribute.name);
					continue;
				}

				if (
					attributeName === 'href' ||
					attributeName === 'xlink:href' ||
					attributeName === 'src'
				) {
					if (!value.startsWith('#')) {
						element.removeAttribute(attribute.name);
					}
					continue;
				}

				if (
					containsExternalUrl(value) ||
					/expression\s*\(|@import/i.test(value)
				) {
					element.removeAttribute(attribute.name);
				}
			}
		}

		for (const attribute of Array.from(root.attributes)) {
			const attributeName = attribute.name.toLowerCase();
			const value = attribute.value.trim();
			if (
				attributeName.startsWith('on') ||
				containsExternalUrl(value) ||
				/expression\s*\(|@import/i.test(value)
			) {
				root.removeAttribute(attribute.name);
			}
		}

		return new XMLSerializer().serializeToString(root);
	} catch {
		return null;
	}
}
