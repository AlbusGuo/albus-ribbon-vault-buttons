/**
 * 自定义按钮类型
 */
export type ButtonType = 'command' | 'file' | 'url';
export type ButtonKind = 'button' | 'group';
export type ButtonGroupTrigger = 'click' | 'hover';

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
	/** 项目形态: 普通按钮或按钮组 */
	kind: ButtonKind;
	/** 图标名称 */
	icon: string;
	/** 切换后的图标名称 */
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
	/** 图标显示状态: true 表示显示切换图标, false 或 undefined 表示显示主图标 */
	iconState?: boolean;
	/** 按钮组成员, 仅支持一层 */
	groupItems: CustomButton[];
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
	noteToolbarItems: ButtonItem[];
	/** 选中文本工具栏按钮列表 */
	selectionToolbarItems: ButtonItem[];
	/** 是否允许键盘选区触发选中文本工具栏 */
	selectionToolbarOnKeyboard: boolean;
	/** 笔记工具栏位置 */
	noteToolbarPosition: NoteToolbarPosition;
	/** 是否隐藏内置按钮 */
	hideBuiltInButtons: boolean;
	/** 是否隐藏默认功能区 */
	hideDefaultActions: boolean;
	/** 按钮组展开方式 */
	buttonGroupTrigger: ButtonGroupTrigger;
	/** 设置页当前标签 */
	settingsTab: 'general' | 'left-ribbon' | 'page-header' | 'note-toolbar' | 'selection-toolbar';
}
