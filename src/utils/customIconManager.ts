import { App, normalizePath, TFile, TFolder } from 'obsidian';
import { sanitizeSvgContent } from './svgUtils';

interface CachedIcon {
	content: string;
	maskImage?: string;
	svgTemplate?: SVGElement;
}

/**
 * 自定义图标管理器
 * 负责注册, 获取和渲染自定义SVG图标
 */
export class CustomIconManager {
	static readonly FILE_PREFIX = 'custom-file:';
	private static readonly MAX_CACHED_ICONS = 256;
	private static readonly MAX_CACHED_CONTENT_LENGTH = 8_000_000;
	private static instance: CustomIconManager;
	private app: App | null = null;
	private legacyIconDirectory: string | null = null;
	private iconContentCache = new Map<string, CachedIcon>();
	private cachedContentLength = 0;
	private pendingLoads = new Map<string, Promise<string | null>>();
	private loadVersions = new Map<string, number>();
	private activeLoadCounts = new Map<string, number>();

	private constructor() {}

	/**
	 * 获取单例实例
	 */
	static getInstance(app?: App): CustomIconManager {
		if (!CustomIconManager.instance) {
			CustomIconManager.instance = new CustomIconManager();
		}

		if (app) {
			CustomIconManager.instance.app = app;
		}

		return CustomIconManager.instance;
	}

	/**
	 * 是否为文件自定义图标引用
	 */
	isCustomIcon(iconName: string): boolean {
		return typeof iconName === 'string' && iconName.startsWith(CustomIconManager.FILE_PREFIX);
	}

	/**
	 * 创建文件自定义图标引用
	 */
	createIconReference(filePath: string): string {
		return `${CustomIconManager.FILE_PREFIX}${normalizePath(filePath)}`;
	}

	setLegacyIconDirectory(directoryPath: string): void {
		this.legacyIconDirectory = normalizePath(directoryPath).replace(/\/$/, '');
	}

	invalidateIcon(iconName: string): void {
		if (!this.isCustomIcon(iconName)) {
			return;
		}

		this.deleteCachedIcon(iconName);
		this.pendingLoads.delete(iconName);
		if ((this.activeLoadCounts.get(iconName) ?? 0) > 0) {
			this.loadVersions.set(iconName, (this.loadVersions.get(iconName) ?? 0) + 1);
		} else {
			this.loadVersions.delete(iconName);
		}
	}

	hasCachedOrPendingIcon(iconName: string): boolean {
		return this.iconContentCache.has(iconName) || this.pendingLoads.has(iconName);
	}

	/**
	 * 从图标引用中提取文件路径
	 */
	getFilePath(iconName: string): string | null {
		if (!this.isCustomIcon(iconName)) {
			return null;
		}

		const rawPath = iconName.slice(CustomIconManager.FILE_PREFIX.length);
		const filePath = normalizePath(rawPath);
		const pathSegments = filePath.split('/');
		if (
			!filePath ||
			filePath.startsWith('/') ||
			pathSegments.some((segment) => segment === '' || segment === '.' || segment === '..')
		) {
			return null;
		}

		return filePath;
	}

	/**
	 * 获取图标显示名称
	 */
	getDisplayName(iconName: string): string {
		const filePath = this.getFilePath(iconName);
		if (!filePath) {
			return iconName;
		}

		const segments = filePath.split('/');
		return segments[segments.length - 1] || filePath;
	}

	/**
	 * 获取指定图标文件夹内的 SVG 图标引用
	 */
	async getIconsFromFolder(folderPath: string): Promise<string[]> {
		if (!folderPath || !this.app) {
			return [];
		}

		const normalizedFolderPath = normalizePath(folderPath).replace(/\/$/, '');
		try {
			const folder = this.app.vault.getAbstractFileByPath(normalizedFolderPath);
			if (!(folder instanceof TFolder)) {
				return [];
			}

			const files: TFile[] = [];
			const pendingFolders = [folder];
			while (pendingFolders.length > 0) {
				const currentFolder = pendingFolders.pop();
				if (!currentFolder) {
					continue;
				}

				for (const child of currentFolder.children) {
					if (child instanceof TFolder) {
						pendingFolders.push(child);
					} else if (child instanceof TFile && child.extension.toLowerCase() === 'svg') {
						files.push(child);
					}
				}
			}

			return files
				.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
				.map((file) => this.createIconReference(file.path));
		} catch {
			return [];
		}
	}

	async preloadIcons(iconNames: string[]): Promise<void> {
		const uniqueIcons = Array.from(new Set(iconNames.filter((iconName) => this.isCustomIcon(iconName))));
		let nextIconIndex = 0;
		const workerCount = Math.min(8, uniqueIcons.length);
		await Promise.all(Array.from({ length: workerCount }, async () => {
			while (nextIconIndex < uniqueIcons.length) {
				const iconName = uniqueIcons[nextIconIndex++];
				await this.ensureIconContent(iconName);
			}
		}));
	}

	/**
	 * 从文件读取 SVG 内容
	 */
	private async readIconContent(iconName: string): Promise<string | null> {
		const filePath = this.getFilePath(iconName);
		if (!filePath || !this.app) {
			return null;
		}

		try {
			const vaultFile = this.app.vault.getAbstractFileByPath(filePath);
			if (vaultFile instanceof TFile) {
				return sanitizeSvgContent(await this.app.vault.cachedRead(vaultFile));
			}

			if (
				!this.legacyIconDirectory ||
				!filePath.startsWith(`${this.legacyIconDirectory}/`)
			) {
				return null;
			}

			const content = await this.app.vault.adapter.read(filePath);
			return sanitizeSvgContent(content);
		} catch {
			return null;
		}
	}

	private async ensureIconContent(iconName: string): Promise<string | null> {
		const cachedIcon = this.iconContentCache.get(iconName);
		if (cachedIcon !== undefined) {
			this.touchCachedIcon(iconName, cachedIcon);
			return cachedIcon.content;
		}

		const pending = this.pendingLoads.get(iconName);
		if (pending) {
			return pending;
		}

		const loadVersion = this.loadVersions.get(iconName) ?? 0;
		this.activeLoadCounts.set(iconName, (this.activeLoadCounts.get(iconName) ?? 0) + 1);
		let loadPromise: Promise<string | null>;
		loadPromise = this.readIconContent(iconName)
			.then((content) => {
				const isCurrentLoad = (this.loadVersions.get(iconName) ?? 0) === loadVersion;
				if (isCurrentLoad && content !== null) {
					this.cacheIconContent(iconName, content);
				} else if (isCurrentLoad) {
					this.deleteCachedIcon(iconName);
				}
				return isCurrentLoad ? content : null;
			})
			.catch(() => {
				if ((this.loadVersions.get(iconName) ?? 0) === loadVersion) {
					this.deleteCachedIcon(iconName);
				}
				return null;
			})
			.finally(() => {
				if (this.pendingLoads.get(iconName) === loadPromise) {
					this.pendingLoads.delete(iconName);
				}
				const activeLoadCount = (this.activeLoadCounts.get(iconName) ?? 1) - 1;
				if (activeLoadCount <= 0) {
					this.activeLoadCounts.delete(iconName);
					this.loadVersions.delete(iconName);
				} else {
					this.activeLoadCounts.set(iconName, activeLoadCount);
				}
			});

		this.pendingLoads.set(iconName, loadPromise);
		return loadPromise;
	}

	private cacheIconContent(iconName: string, content: string): void {
		const existing = this.iconContentCache.get(iconName);
		if (existing?.content === content) {
			this.touchCachedIcon(iconName, existing);
			return;
		}

		this.deleteCachedIcon(iconName);
		const cachedIcon: CachedIcon = { content };
		this.cachedContentLength += content.length;
		this.touchCachedIcon(iconName, cachedIcon);
	}

	private touchCachedIcon(iconName: string, cachedIcon: CachedIcon): void {
		this.iconContentCache.delete(iconName);
		this.iconContentCache.set(iconName, cachedIcon);

		while (
			this.iconContentCache.size > CustomIconManager.MAX_CACHED_ICONS ||
			this.cachedContentLength > CustomIconManager.MAX_CACHED_CONTENT_LENGTH
		) {
			const oldestIcon = this.iconContentCache.keys().next().value as string | undefined;
			if (oldestIcon === undefined) {
				break;
			}
			this.deleteCachedIcon(oldestIcon);
		}
	}

	private deleteCachedIcon(iconName: string): void {
		const cachedIcon = this.iconContentCache.get(iconName);
		if (cachedIcon) {
			this.cachedContentLength -= cachedIcon.content.length;
			this.iconContentCache.delete(iconName);
		}
	}

	private renderMaskedSvgContent(cachedIcon: CachedIcon, containerEl: HTMLElement): boolean {
		try {
			containerEl.empty();
			const maskEl = containerEl.createDiv({ cls: 'custom-icon-mask custom-icon-svg' });
			cachedIcon.maskImage ??= `url("data:image/svg+xml;utf8,${encodeURIComponent(cachedIcon.content)}")`;
			maskEl.style.setProperty('--custom-icon-image', cachedIcon.maskImage);
			return true;
		} catch {
			return false;
		}
	}

	renderIconFromCache(iconName: string, containerEl: HTMLElement, masked = false): boolean {
		const cachedIcon = this.iconContentCache.get(iconName);
		if (!cachedIcon) {
			return false;
		}
		this.touchCachedIcon(iconName, cachedIcon);

		return masked
			? this.renderMaskedSvgContent(cachedIcon, containerEl)
			: this.renderSvgContent(cachedIcon, containerEl);
	}

	/**
	 * 渲染 SVG 内容到 DOM 元素
	 */
	private renderSvgContent(cachedIcon: CachedIcon, containerEl: HTMLElement): boolean {
		try {
			containerEl.empty();

			if (!cachedIcon.svgTemplate) {
				const parser = new DOMParser();
				const doc = parser.parseFromString(cachedIcon.content, 'image/svg+xml');
				const svgEl = doc.querySelector('svg');
				if (!svgEl) {
					return false;
				}

				const template = document.importNode(svgEl, true) as SVGElement;
				template.classList.add('custom-icon-svg');
				if (!template.hasAttribute('viewBox')) {
					const width = template.getAttribute('width');
					const height = template.getAttribute('height');
					template.setAttribute('viewBox', width && height ? `0 0 ${width} ${height}` : '0 0 24 24');
				}
				cachedIcon.svgTemplate = template;
			}

			containerEl.appendChild(cachedIcon.svgTemplate.cloneNode(true));
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * 渲染自定义图标到DOM元素
	 */
	async renderIcon(iconName: string, containerEl: HTMLElement, masked = false): Promise<boolean> {
		if (this.renderIconFromCache(iconName, containerEl, masked)) {
			return true;
		}

		const content = await this.ensureIconContent(iconName);
		if (!content) {
			return false;
		}

		return this.renderIconFromCache(iconName, containerEl, masked);
	}
}
