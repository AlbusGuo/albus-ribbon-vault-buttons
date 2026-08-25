export type PublicIconType = 'lucide' | 'svg';

export interface PublicIconSelection {
	icon: string;
	type: PublicIconType;
}

export interface OpenIconPickerOptions {
	sourceEl?: HTMLElement;
	initialSelection?: PublicIconSelection;
	initialIcon?: string;
	initialType?: PublicIconType;
}

export interface PublicIconMetadata {
	id: string;
	name: string;
	source: 'user' | 'pack';
	packId?: string;
	packName?: string;
	enabled: boolean;
}

export interface GetPublicIconOptions {
	includeDisabledPacks?: boolean;
}

export interface RequireIconsResult {
	ready: string[];
	missing: string[];
}

export type PublicIconSourceConfig =
	| { type: 'iconify'; prefix: string }
	| {
		type: 'npm-svg';
		package: string;
		version: string;
		glob: string;
	};

export interface PublicIconPackManifest {
	id: string;
	name: string;
	version?: string;
	license?: string;
	iconCount: number;
	enabled: boolean;
	installedAt: number;
	source: PublicIconSourceConfig;
}

export interface AlbusCustomIconsApi {
	readonly apiVersion: string;
	readonly isReady: boolean;

	whenReady(): Promise<void>;
	getIconIds(options?: GetPublicIconOptions): string[];
	getUserIconIds(): string[];
	getPackIconIds(packId: string): string[];
	getInstalledPacks(): PublicIconPackManifest[];
	getIconMetadata(iconId: string): PublicIconMetadata | null;
	getIconSvg(iconId: string): string | null;
	hasIcon(iconId: string, type?: PublicIconType): boolean;
	renderIcon(element: HTMLElement, iconId: string, type?: PublicIconType): boolean;
	requireIcons(
		consumerId: string,
		iconIds: string[],
	): Promise<RequireIconsResult>;
	getConsumerIconIds(consumerId: string): string[];
	forgetConsumer(consumerId: string): Promise<void>;
	openIconPicker(
		consumerId: string,
		options?: OpenIconPickerOptions,
	): Promise<PublicIconSelection | null>;
	onIconsChanged(callback: () => void): () => void;
}

export interface AlbusCustomIconsPluginInstance {
	readonly api: AlbusCustomIconsApi;
}
