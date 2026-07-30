import { App, normalizePath } from 'obsidian';
import { LegacyCustomIcon } from '../types';
import { CustomIconManager } from './customIconManager';
import { sanitizeSvgContent } from './svgUtils';

interface MigrationResult {
	migratedData: unknown;
	didMigrateLegacyIcons: boolean;
}

export async function migrateLegacyCustomIcons(
	app: App,
	data: unknown,
	pluginDirectory: string,
	customIconManager: CustomIconManager,
): Promise<MigrationResult> {
	if (!isPlainObject(data)) {
		return { migratedData: data, didMigrateLegacyIcons: false };
	}

	if (
		!Object.prototype.hasOwnProperty.call(data, 'customIcons') ||
		!Array.isArray(data.customIcons)
	) {
		return { migratedData: data, didMigrateLegacyIcons: false };
	}

	const buttonCollections = [
		data.customButtons,
		data.buttonItems,
		data.leftRibbonItems,
		data.pageHeaderItems,
	].filter((items): items is unknown[] => Array.isArray(items));
	const referencedLegacyIconIds = new Set<string>();
	for (const items of buttonCollections) {
		for (const item of items) {
			if (!isPlainObject(item) || item.type === 'divider') {
				continue;
			}

			for (const iconName of [item.icon, item.toggleIcon]) {
				if (typeof iconName === 'string' && iconName.startsWith('custom:')) {
					referencedLegacyIconIds.add(iconName.slice(7));
				}
			}
		}
	}

	const legacyIcons = data.customIcons;
	if (legacyIcons.length === 0) {
		if (referencedLegacyIconIds.size > 0) {
			return { migratedData: data, didMigrateLegacyIcons: false };
		}

		delete data.customIcons;
		return { migratedData: data, didMigrateLegacyIcons: true };
	}

	const preparedIcons: Array<{ id: string; content: string; index: number }> = [];
	const legacyIconIds = new Set<string>();
	for (let index = 0; index < legacyIcons.length; index++) {
		const icon = legacyIcons[index];
		const sanitizedContent = isLegacyCustomIcon(icon)
			? sanitizeSvgContent(icon.content)
			: null;
		if (
			!isLegacyCustomIcon(icon) ||
			!sanitizedContent ||
			legacyIconIds.has(icon.id)
		) {
			return { migratedData: data, didMigrateLegacyIcons: false };
		}

		legacyIconIds.add(icon.id);
		preparedIcons.push({ id: icon.id, content: sanitizedContent, index });
	}

	for (const referencedId of referencedLegacyIconIds) {
		if (!legacyIconIds.has(referencedId)) {
			return { migratedData: data, didMigrateLegacyIcons: false };
		}
	}

	const customIconDirectory = normalizePath(`${pluginDirectory}/custom-icons`);
	await ensureDirectory(app, customIconDirectory);
	const migratedRefs = new Map<string, string>();
	const usedPaths = new Set<string>();

	for (const icon of preparedIcons) {
		const baseName = sanitizeFileName(icon.id) || `icon-${icon.index + 1}`;
		let filePath = `${customIconDirectory}/${baseName}.svg`;
		let suffix = 1;

		while (usedPaths.has(filePath) || await app.vault.adapter.exists(filePath)) {
			filePath = `${customIconDirectory}/${baseName}-${suffix}.svg`;
			suffix++;
		}

		usedPaths.add(filePath);
		await app.vault.adapter.write(filePath, icon.content);
		migratedRefs.set(icon.id, customIconManager.createIconReference(filePath));
	}

	for (const items of buttonCollections) {
		for (const item of items) {
			if (!isPlainObject(item) || item.type === 'divider') {
				continue;
			}

			item.icon = replaceLegacyIconReference(item.icon, migratedRefs);
			item.toggleIcon = replaceLegacyIconReference(item.toggleIcon, migratedRefs);
		}
	}

	delete data.customIcons;
	return { migratedData: data, didMigrateLegacyIcons: true };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Object.prototype.toString.call(value) === '[object Object]';
}

function isLegacyCustomIcon(value: unknown): value is LegacyCustomIcon {
	return isPlainObject(value) &&
		typeof value.id === 'string' &&
		value.id.length > 0 &&
		typeof value.content === 'string';
}

function replaceLegacyIconReference(iconName: unknown, migratedRefs: Map<string, string>): unknown {
	if (typeof iconName !== 'string' || !iconName.startsWith('custom:')) {
		return iconName;
	}

	return migratedRefs.get(iconName.slice(7)) || iconName;
}

function sanitizeFileName(name: string): string {
	return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').trim();
}

async function ensureDirectory(app: App, directoryPath: string): Promise<void> {
	try {
		if (!await app.vault.adapter.exists(directoryPath)) {
			await app.vault.adapter.mkdir(directoryPath);
		}
	} catch {
		// 后续文件写入会报告真实的目录错误.
	}
}
