import { TFile } from 'obsidian';

/**
 * 自定义按钮类型
 */
export type ButtonType = 'command' | 'file' | 'url';

/**
 * 自定义按钮配置
 */
export interface CustomButton {
	/** 图标名称 */
	icon: string;
	/** 提示文字 */
	tooltip: string;
	/** 按钮类型 */
	type: ButtonType;
	/** 命令ID */
	command: string;
	/** 文件路径 */
	file: string;
	/** 网址 */
	url: string;
}

/**
 * 插件设置接口
 */
export interface RibbonVaultButtonsSettings {
	/** 自定义按钮列表 */
	customButtons: CustomButton[];
}

/**
 * 内置按钮配置
 */
export interface BuiltInButton {
	/** 按钮ID */
	id: string;
	/** 提示文字 */
	tooltip: string;
	/** 图标名称 */
	icon: string;
	/** 点击回调 */
	onClick: () => void;
	/** 是否支持拖拽 */
	draggable: boolean;
}

/**
 * 拖拽状态
 */
export interface DragState {
	/** 是否正在拖拽 */
	isDragging: boolean;
	/** 拖拽源按钮ID */
	dragSource: string | null;
}