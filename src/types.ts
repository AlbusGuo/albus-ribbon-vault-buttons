/**
 * 自定义按钮类型
 */
export type ButtonType = 'command' | 'file' | 'url' | 'command-group';

/**
 * 分割线配置
 */
export interface DividerItem {
	/** 类型标识 */
	type: 'divider';
	/** 分割线 ID */
	id: string;
}

/**
 * 自定义按钮配置
 */
export interface CustomButton {
	/** 图标名称, 支持 Obsidian 内置图标或 custom-file: 前缀的 SVG 文件路径 */
	icon: string;
	/** 切换后的图标名称, 支持 Obsidian 内置图标或 custom-file: 前缀的 SVG 文件路径 */
	toggleIcon: string;
	/** 提示文字 */
	tooltip: string;
	/** 按钮类型 */
	type: ButtonType;
	/** 命令 ID */
	command: string;
	/** 文件路径 */
	file: string;
	/** 网址 */
	url: string;
	/** 命令组, 按顺序依次执行 */
	commands: string[];
	/** 图标显示状态: true 表示显示切换图标, false 或 undefined 表示显示主图标 */
	iconState?: boolean;
}

/**
 * 按钮项类型 (按钮或分割线)
 */
export type ButtonItem = CustomButton | DividerItem;

export type NoteToolbarPosition = 'top-fixed' | 'bottom';

/**
 * 插件设置接口
 */
export interface RibbonVaultButtonsSettings {
	/** 左侧边栏按钮项列表 (包含按钮和分割线) */
	leftRibbonItems: ButtonItem[];
	/** 标题栏按钮项列表 (仅按钮) */
	pageHeaderItems: CustomButton[];
	/** 笔记工具栏按钮列表 */
	noteToolbarItems: CustomButton[];
	/** 选中文本工具栏按钮列表 */
	selectionToolbarItems: CustomButton[];
	/** 是否允许键盘选区触发选中文本工具栏 */
	selectionToolbarOnKeyboard: boolean;
	/** 笔记工具栏位置 */
	noteToolbarPosition: NoteToolbarPosition;
	/** SVG 图标文件夹, 用于过滤自定义图标 */
	iconFolder: string;
	/** 是否将自定义 SVG 图标强制渲染为 var(--icon-color) */
	iconMask: boolean;
	/** 是否隐藏内置按钮 */
	hideBuiltInButtons: boolean;
	/** 是否隐藏默认功能区 */
	hideDefaultActions: boolean;
	/** 设置页当前标签 */
	settingsTab: 'general' | 'left-ribbon' | 'page-header' | 'note-toolbar' | 'selection-toolbar';
}
