import { RibbonVaultButtonsSettings, CustomButton, DividerItem, ButtonItem } from './types';

/**
 * 默认设置
 */
const DEFAULT_SETTINGS: RibbonVaultButtonsSettings = {
	leftRibbonItems: [],
	pageHeaderItems: [],
	noteToolbarItems: [],
	selectionToolbarItems: [],
	selectionToolbarOnKeyboard: false,
	noteToolbarPosition: 'top-fixed',
	hideBuiltInButtons: true,
	hideDefaultActions: false,
	buttonGroupTrigger: 'click',
	settingsTab: 'general'
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeIconName(iconName: unknown): string {
	if (
		typeof iconName !== 'string' ||
		iconName.length === 0 ||
		iconName.includes(':')
	) {
		return 'help-circle';
	}

	return iconName;
}

/**
 * 创建新的自定义按钮
 */
export function createCustomButton(): CustomButton {
	return {
		icon: 'plus',
		toggleIcon: 'plus',
		tooltip: '新按钮',
		type: 'command',
		command: '',
		file: '',
		url: '',
		commands: [],
		groupItems: [],
	};
}

/**
 * 创建新的按钮组
 */
export function createButtonGroup(): CustomButton {
	return {
		...createCustomButton(),
		tooltip: '新按钮组',
		type: 'button-group',
	};
}

/**
 * 创建新的分割线
 */
export function createDivider(): DividerItem {
	return {
		type: 'divider',
		id: `divider-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
	};
}

/**
 * 验证和清理设置
 */
function validateAndCleanSettings(settings: RibbonVaultButtonsSettings): RibbonVaultButtonsSettings {
	const leftRibbonItems = Array.isArray(settings.leftRibbonItems)
		? settings.leftRibbonItems
		: [];

	const cleaned: RibbonVaultButtonsSettings = {
		leftRibbonItems,
		pageHeaderItems: Array.isArray(settings.pageHeaderItems) ? settings.pageHeaderItems : DEFAULT_SETTINGS.pageHeaderItems,
		noteToolbarItems: Array.isArray(settings.noteToolbarItems) ? settings.noteToolbarItems : DEFAULT_SETTINGS.noteToolbarItems,
		selectionToolbarItems: Array.isArray(settings.selectionToolbarItems) ? settings.selectionToolbarItems : DEFAULT_SETTINGS.selectionToolbarItems,
		selectionToolbarOnKeyboard: typeof settings.selectionToolbarOnKeyboard === 'boolean'
			? settings.selectionToolbarOnKeyboard
			: DEFAULT_SETTINGS.selectionToolbarOnKeyboard,
		noteToolbarPosition: settings.noteToolbarPosition === 'bottom' ? 'bottom' : DEFAULT_SETTINGS.noteToolbarPosition,
		hideBuiltInButtons: typeof settings.hideBuiltInButtons === 'boolean' ? settings.hideBuiltInButtons : DEFAULT_SETTINGS.hideBuiltInButtons,
		hideDefaultActions: typeof settings.hideDefaultActions === 'boolean' ? settings.hideDefaultActions : DEFAULT_SETTINGS.hideDefaultActions,
		buttonGroupTrigger: settings.buttonGroupTrigger === 'hover' ? 'hover' : DEFAULT_SETTINGS.buttonGroupTrigger,
		settingsTab:
			settings.settingsTab === 'left-ribbon' ||
			settings.settingsTab === 'page-header' ||
			settings.settingsTab === 'note-toolbar' ||
			settings.settingsTab === 'selection-toolbar' ||
			settings.settingsTab === 'general'
			? settings.settingsTab
			: DEFAULT_SETTINGS.settingsTab
	};

	const normalizeButton = (item: unknown, allowButtonGroup = true): CustomButton | null => {
		if (!item || typeof item !== 'object' || Array.isArray(item)) {
			return null;
		}

		const candidate = item as Partial<CustomButton>;
		if (
			candidate.type !== 'command' &&
			candidate.type !== 'command-group' &&
			candidate.type !== 'file' &&
			candidate.type !== 'url' &&
			(!allowButtonGroup || candidate.type !== 'button-group')
		) {
			return null;
		}

		const button: CustomButton = {
			icon: normalizeIconName(candidate.icon),
			toggleIcon: normalizeIconName(candidate.toggleIcon || candidate.icon),
			tooltip: typeof candidate.tooltip === 'string' ? candidate.tooltip : '未命名按钮',
			type: candidate.type,
			command: typeof candidate.command === 'string' ? candidate.command : '',
			file: typeof candidate.file === 'string' ? candidate.file : '',
			url: typeof candidate.url === 'string' ? candidate.url : '',
			commands: Array.isArray(candidate.commands)
				? candidate.commands.filter((commandId): commandId is string => typeof commandId === 'string')
				: [],
			groupItems: [],
		};
		const rawGroupItems = candidate.type === 'button-group' ? candidate.groupItems : [];
		if (Array.isArray(rawGroupItems)) {
			button.groupItems = rawGroupItems
				.map((groupItem) => normalizeButton(groupItem, false))
				.filter((groupItem): groupItem is CustomButton => groupItem !== null);
		}

		if (button.type === 'button-group') {
			button.toggleIcon = button.icon;
			button.command = '';
			button.file = '';
			button.url = '';
			button.commands = [];
		} else if (typeof candidate.iconState === 'boolean') {
			button.iconState = candidate.iconState;
		}

		return button;
	};

	const usedRibbonIds = new Set(['vault', 'help', 'settings']);
	const normalizeItems = (items: unknown[], usedIds: Set<string>): ButtonItem[] =>
		items.flatMap<ButtonItem>((item): ButtonItem[] => {
			if (isPlainObject(item) && item.type === 'divider') {
				const divider = item as Partial<DividerItem>;
				let dividerId = typeof divider.id === 'string' && divider.id.length > 0
					? divider.id
					: createDivider().id;
				while (usedIds.has(dividerId)) {
					dividerId = createDivider().id;
				}
				usedIds.add(dividerId);
				return [{
					type: 'divider' as const,
					id: dividerId,
				}];
			}

			const button = normalizeButton(item);
			return button ? [button] : [];
		});

	cleaned.leftRibbonItems = normalizeItems(cleaned.leftRibbonItems, usedRibbonIds);

	cleaned.pageHeaderItems = cleaned.pageHeaderItems
		.map((item) => normalizeButton(item))
		.filter((item): item is CustomButton => item !== null);
	cleaned.noteToolbarItems = normalizeItems(cleaned.noteToolbarItems, new Set());
	cleaned.selectionToolbarItems = normalizeItems(cleaned.selectionToolbarItems, new Set());

	return cleaned;
}

/**
 * 按白名单清理设置对象及兼容旧版按钮字段.
 */
export function sanitizeSettingsShape(raw: unknown): RibbonVaultButtonsSettings {
	const defaults = structuredClone(DEFAULT_SETTINGS);
	if (!isPlainObject(raw)) {
		return defaults;
	}

	const data = raw as Record<string, unknown>;
	return validateAndCleanSettings({
		leftRibbonItems: Array.isArray(data.leftRibbonItems)
			? data.leftRibbonItems as ButtonItem[]
			: Array.isArray(data.buttonItems)
				? data.buttonItems as ButtonItem[]
				: Array.isArray(data.customButtons)
					? data.customButtons as ButtonItem[]
					: defaults.leftRibbonItems,
		pageHeaderItems: Array.isArray(data.pageHeaderItems)
			? data.pageHeaderItems as CustomButton[]
			: defaults.pageHeaderItems,
		noteToolbarItems: Array.isArray(data.noteToolbarItems)
			? data.noteToolbarItems as ButtonItem[]
			: defaults.noteToolbarItems,
		selectionToolbarItems: Array.isArray(data.selectionToolbarItems)
			? data.selectionToolbarItems as ButtonItem[]
			: defaults.selectionToolbarItems,
		selectionToolbarOnKeyboard: typeof data.selectionToolbarOnKeyboard === 'boolean'
			? data.selectionToolbarOnKeyboard
			: defaults.selectionToolbarOnKeyboard,
		noteToolbarPosition: data.noteToolbarPosition === 'bottom'
			? 'bottom'
			: defaults.noteToolbarPosition,
		hideBuiltInButtons: typeof data.hideBuiltInButtons === 'boolean'
			? data.hideBuiltInButtons
			: defaults.hideBuiltInButtons,
		hideDefaultActions: typeof data.hideDefaultActions === 'boolean'
			? data.hideDefaultActions
			: defaults.hideDefaultActions,
		buttonGroupTrigger: data.buttonGroupTrigger === 'hover'
			? 'hover'
			: defaults.buttonGroupTrigger,
		settingsTab:
			data.settingsTab === 'general' ||
			data.settingsTab === 'left-ribbon' ||
			data.settingsTab === 'page-header' ||
			data.settingsTab === 'note-toolbar' ||
			data.settingsTab === 'selection-toolbar'
				? data.settingsTab
				: defaults.settingsTab,
	});
}
