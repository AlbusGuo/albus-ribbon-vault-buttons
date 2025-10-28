import { RibbonVaultButtonsSettings, CustomButton } from './types';

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: RibbonVaultButtonsSettings = {
	customButtons: []
};

/**
 * 创建新的自定义按钮
 */
export function createCustomButton(): CustomButton {
	return {
		icon: 'lucide-plus',
		tooltip: '新按钮',
		type: 'command',
		command: '',
		file: '',
		url: ''
	};
}

/**
 * 验证自定义按钮配置
 */
export function validateCustomButton(button: CustomButton): boolean {
	if (!button.icon || !button.tooltip) {
		return false;
	}
	
	switch (button.type) {
		case 'command':
			return !!button.command;
		case 'file':
			return !!button.file;
		case 'url':
			return !!button.url && isValidUrl(button.url);
		default:
			return false;
	}
}

/**
 * 验证URL格式
 */
function isValidUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}