import { App, TFile } from 'obsidian';
import { CustomButton, BuiltInButton, DragState } from '../types';

/**
 * 按钮管理器类
 * 负责管理所有按钮的创建、销毁和交互
 */
export class ButtonManager {
	private ribbonMap = new Map<string, HTMLElement>();
	private styleElements: Record<string, HTMLStyleElement> = {};
	private dragState: DragState = {
		isDragging: false,
		dragSource: null
	};

	constructor(
		private app: App,
		private onSettingsChange: () => void,
		private onReorderButtons: (sourceIndex: number, targetIndex: number) => void
	) {}

	/**
	 * 初始化所有按钮
	 */
	initVaultButtons(customButtons: CustomButton[]) {
		this.clearAllButtons();
		this.initCustomButtons(customButtons);
		this.initBuiltInButtons();
	}

	/**
	 * 清除所有按钮
	 */
	private clearAllButtons() {
		this.ribbonMap.forEach((value) => {
			if (value && value.parentElement) {
				value.remove();
			}
		});
		this.ribbonMap.clear();
	}

	/**
	 * 初始化自定义按钮
	 */
	private initCustomButtons(customButtons: CustomButton[]) {
		customButtons.forEach((button, index) => {
			this.createCustomButton(button, index);
		});
	}

	/**
	 * 初始化内置按钮
	 */
	private initBuiltInButtons() {
		const builtInButtons: BuiltInButton[] = [
			{
				id: 'theme',
				tooltip: '切换深色/浅色模式',
				icon: 'lucide-sun-moon',
				onClick: () => this.switchLightDark(),
				draggable: false
			},
			{
				id: 'vault',
				tooltip: '切换库',
				icon: 'vault',
				onClick: () => this.showVaultChooser(),
				draggable: false
			},
			{
				id: 'help',
				tooltip: '帮助',
				icon: 'help',
				onClick: () => this.showHelp(),
				draggable: false
			},
			{
				id: 'settings',
				tooltip: '设置',
				icon: 'lucide-settings',
				onClick: () => this.showSettings(),
				draggable: false
			}
		];

		builtInButtons.forEach((button) => {
			this.createRibbonButton(button.id, button.tooltip, button.icon, button.onClick, button.draggable);
		});
	}

	/**
	 * 创建自定义按钮
	 */
	createCustomButton(button: CustomButton, index: number) {
		const buttonId = `custom-${index}`;
		const onClick = () => {
			this.handleButtonClick(button);
		};

		return this.createRibbonButton(buttonId, button.tooltip, button.icon, onClick, true);
	}

	/**
	 * 处理按钮点击事件
	 */
	private handleButtonClick(button: CustomButton) {
		switch (button.type) {
			case 'command':
				if (button.command) {
					this.executeCommand(button.command);
				}
				break;
			case 'file':
				if (button.file) {
					this.openFile(button.file);
				}
				break;
			case 'url':
				if (button.url) {
					window.open(button.url, '_blank');
				}
				break;
		}
	}

	/**
	 * 打开文件
	 */
	private openFile(filePath: string) {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file && file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf('tab');
			leaf.openFile(file);
		}
	}

	/**
	 * 创建缎带按钮
	 */
	private createRibbonButton(
		id: string,
		tooltip: string,
		icon: string,
		onClick: () => void,
		draggable = false
	): HTMLElement {
		try {
			// @ts-ignore
			const leftRibbon = this.app.workspace.leftRibbon;
			// @ts-ignore
			const button = leftRibbon.makeRibbonItemButton(icon, tooltip, (e: MouseEvent) => {
				e.stopPropagation();
				onClick();
			});

			if (draggable) {
				this.makeButtonDraggable(button, id);
			}

			this.ribbonMap.set(id, button);
			// @ts-ignore
			leftRibbon.ribbonSettingEl.appendChild(button);
			return button;
		} catch (error) {
			console.warn('Failed to create ribbon button:', error);
			// 返回一个空的div作为fallback
			const fallbackButton = document.createElement('div');
			fallbackButton.style.display = 'none';
			return fallbackButton;
		}
	}

	/**
	 * 使按钮可拖拽
	 */
	private makeButtonDraggable(button: HTMLElement, buttonId: string) {
		button.setAttribute('draggable', 'true');
		button.classList.add('custom-ribbon-button');

		button.addEventListener('dragstart', (e) => {
			this.dragState.isDragging = true;
			this.dragState.dragSource = buttonId;
			button.classList.add('dragging');
			e.dataTransfer!.effectAllowed = 'move';
			e.dataTransfer!.setData('text/plain', buttonId);
		});

		button.addEventListener('dragend', (e) => {
			this.dragState.isDragging = false;
			this.dragState.dragSource = null;
			button.classList.remove('dragging');
			document.querySelectorAll('.custom-ribbon-button.drag-over').forEach(el => {
				(el as HTMLElement).classList.remove('drag-over');
			});
		});

		button.addEventListener('dragover', (e) => {
			if (this.dragState.isDragging && this.dragState.dragSource !== buttonId) {
				e.preventDefault();
				e.dataTransfer!.dropEffect = 'move';
				button.classList.add('drag-over');
			}
		});

		button.addEventListener('dragenter', (e) => {
			if (this.dragState.isDragging && this.dragState.dragSource !== buttonId) {
				e.preventDefault();
				button.classList.add('drag-over');
			}
		});

		button.addEventListener('dragleave', (e) => {
			button.classList.remove('drag-over');
		});

		button.addEventListener('drop', (e) => {
			e.preventDefault();
			button.classList.remove('drag-over');

			if (this.dragState.isDragging && this.dragState.dragSource && this.dragState.dragSource !== buttonId) {
				this.handleReorderButtons(this.dragState.dragSource, buttonId);
			}
		});
	}

	/**
	 * 处理按钮重新排序
	 */
	private handleReorderButtons(sourceId: string, targetId: string) {
		const sourceIndex = parseInt(sourceId.split('-')[1]);
		const targetIndex = parseInt(targetId.split('-')[1]);

		if (sourceIndex === targetIndex) return;

		// 调用外部回调来处理数组重新排序
		this.onReorderButtons(sourceIndex, targetIndex);
	}

	/**
	 * 执行命令
	 */
	private executeCommand(commandId: string) {
		// 尝试通过全局API执行命令
		try {
			// @ts-ignore
			this.app.commands.executeCommandById(commandId);
		} catch (error) {
			console.warn('Failed to execute command:', commandId, error);
		}
	}

	/**
	 * 显示库选择器
	 */
	private showVaultChooser() {
		// 尝试打开库选择器
		try {
			// @ts-ignore
			this.app.openVaultChooser();
		} catch (error) {
			console.warn('Failed to open vault chooser:', error);
		}
	}

	/**
	 * 显示帮助
	 */
	private showHelp() {
		// 尝试打开帮助
		try {
			// @ts-ignore
			this.app.openHelp();
		} catch (error) {
			console.warn('Failed to open help:', error);
		}
	}

	/**
	 * 显示设置
	 */
	private showSettings() {
		// 尝试打开设置
		try {
			// @ts-ignore
			this.app.setting.open();
		} catch (error) {
			console.warn('Failed to open settings:', error);
		}
	}

	/**
	 * 切换明暗主题
	 */
	private switchLightDark() {
		try {
			// @ts-ignore
			const isDarkMode = this.app.vault.getConfig('theme') === 'obsidian';
			if (isDarkMode) {
				// @ts-ignore
				this.app.setTheme('moonstone');
				// @ts-ignore
				this.app.vault.setConfig('theme', 'moonstone');
				this.app.workspace.trigger('css-change');
			} else {
				// @ts-ignore
				this.app.setTheme('obsidian');
				// @ts-ignore
				this.app.vault.setConfig('theme', 'obsidian');
				this.app.workspace.trigger('css-change');
			}
		} catch (error) {
			console.warn('Failed to switch theme:', error);
		}
	}

	/**
	 * 应用样式设置
	 */
	applyStyleSettings() {
		const styles = [
			{ id: 'vault-profile', css: `
				body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile {
					display: none;
				}
			` },
			{ id: 'vault-switcher', css: `
				body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile .workspace-drawer-vault-switcher {
					display: none;
				}
			` },
			{ id: 'vault-actions-help', css: `
				body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile .workspace-drawer-vault-actions .clickable-icon:has(svg.svg-icon.help) {
					display: none;
				}
			` },
			{ id: 'vault-actions-settings', css: `
				body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile .workspace-drawer-vault-actions .clickable-icon:has(svg.svg-icon.lucide-settings) {
					display: none;
				}
			` },
			{ id: 'vault-actions-theme', css: `
				body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile .workspace-drawer-vault-actions .clickable-icon:has(svg.svg-icon.lucide-sun-moon) {
					display: none;
				}
			` }
		];

		styles.forEach(({ id, css }) => {
			this.updateStyle(id, css);
		});
	}

	/**
	 * 更新样式
	 */
	private updateStyle(id: string, css: string) {
		let styleEl = this.styleElements[id];
		if (!styleEl) {
			styleEl = document.createElement('style');
			styleEl.id = id;
			document.head.appendChild(styleEl);
			this.styleElements[id] = styleEl;
		}
		styleEl.textContent = css;
	}

	/**
	 * 清理资源
	 */
	destroy() {
		this.clearAllButtons();
		for (const key in this.styleElements) {
			this.styleElements[key].remove();
		}
		this.styleElements = {};
	}
}