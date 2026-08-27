import { App, setIcon, setTooltip } from 'obsidian';
import { CustomButton } from '../types';
import { getRegisteredCommands } from '../utils/commandRegistry';
import { PointerSortController, PointerSortItem } from '../utils/pointerSortController';
import { ButtonStudioIconService } from './buttonStudioIconService';

interface ButtonGroupPanelOptions {
	onChange: () => void;
	onEditButton: (button: CustomButton, index: number) => void;
	onAddButton: () => void;
}

export class ButtonGroupPanel {
	private contentEl: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private nameInputEl: HTMLInputElement | null = null;
	private sortController: PointerSortController | null = null;

	constructor(
		private readonly app: App,
		private readonly group: CustomButton,
		private readonly iconService: ButtonStudioIconService,
		private readonly options: ButtonGroupPanelOptions,
	) {}

	render(contentEl: HTMLElement): void {
		this.contentEl = contentEl;
		this.iconService.clear();
		this.sortController?.destroy();
		this.sortController = null;
		contentEl.empty();

		const formEl = contentEl.createDiv({ cls: 'basic-vault-button-group-form' });
		const nameControlEl = this.createFormRow(
			formEl,
			'名称',
			'设置按钮组在工具栏中显示的名称',
		);
		this.nameInputEl = nameControlEl.createEl('input', {
			attr: { type: 'text', placeholder: '按钮组名称' },
		});
		this.nameInputEl.value = this.group.tooltip;
		this.nameInputEl.addEventListener('input', () => {
			this.group.tooltip = this.nameInputEl?.value ?? '';
			this.options.onChange();
		});

		const iconControlEl = this.createFormRow(
			formEl,
			'图标',
			'设置用于展开按钮组的父图标',
		);
		this.createIconPicker(iconControlEl);

		const listControlEl = this.createFormRow(
			formEl,
			'按钮组',
			'设置菜单中显示的按钮',
			true,
		);
		this.listEl = listControlEl.createDiv({ cls: 'basic-vault-button-group-list' });
		this.renderItems();
	}

	refreshItems(): void {
		this.renderItems();
	}

	focusNameInput(): void {
		this.nameInputEl?.win.requestAnimationFrame(() => {
			this.nameInputEl?.focus();
			this.nameInputEl?.select();
		});
	}

	destroy(): void {
		this.sortController?.destroy();
		this.sortController = null;
		this.contentEl = null;
		this.listEl = null;
		this.nameInputEl = null;
	}

	private createFormRow(
		parentEl: HTMLElement,
		name: string,
		description: string,
		alignStart = false,
	): HTMLElement {
		const rowEl = parentEl.createDiv({
			cls: [
				'basic-vault-button-group-form-row',
				alignStart ? 'is-list' : '',
			],
		});
		const infoEl = rowEl.createDiv({ cls: 'basic-vault-button-group-form-info' });
		infoEl.createDiv({ cls: 'basic-vault-button-group-form-name', text: name });
		infoEl.createDiv({
			cls: 'basic-vault-button-group-form-description',
			text: description,
		});
		return rowEl.createDiv({ cls: 'basic-vault-button-group-form-control' });
	}

	private renderItems(): void {
		if (!this.listEl) return;
		const scrollTop = this.contentEl?.scrollTop ?? 0;
		this.sortController?.destroy();
		this.sortController = null;
		this.listEl.empty();

		const itemsEl = this.listEl.createDiv({ cls: 'basic-vault-button-group-items' });
		const sortableItems: PointerSortItem[] = [];
		if (this.group.groupItems.length === 0) {
			itemsEl.createDiv({
				cls: 'basic-vault-button-group-empty',
				text: '还没有添加按钮',
			});
		} else {
			this.group.groupItems.forEach((button, index) => {
				const rowEl = itemsEl.createDiv({ cls: 'basic-vault-button-group-item' });
				const iconEl = rowEl.createSpan({ cls: 'basic-vault-button-group-item-icon' });
				this.iconService.render(iconEl, button.icon);
				const infoEl = rowEl.createDiv({ cls: 'basic-vault-button-group-item-info' });
				infoEl.createDiv({
					cls: 'basic-vault-button-group-item-name',
					text: button.tooltip.trim() || '未命名按钮',
				});
				infoEl.createDiv({
					cls: 'basic-vault-button-group-item-description',
					text: this.getButtonSummary(button),
				});
				const actionsEl = rowEl.createDiv({ cls: 'basic-vault-button-group-item-actions' });
				this.createIconButton(actionsEl, 'pencil', '编辑按钮', () => {
					this.options.onEditButton(button, index);
				});
				this.createIconButton(actionsEl, 'trash', '删除按钮', () => {
					this.group.groupItems.splice(index, 1);
					this.renderItems();
					this.options.onChange();
				});
				const handleEl = this.createIconButton(
					actionsEl,
					'grip-vertical',
					'拖拽排序',
					() => undefined,
				);
				handleEl.addClass('basic-vault-button-group-drag-handle');
				sortableItems.push({
					key: index.toString(),
					element: rowEl,
					handle: handleEl,
				});
			});
		}

		const addButtonEl = this.listEl.createEl('button', {
			cls: ['clickable-icon', 'basic-vault-button-group-add'],
			attr: { type: 'button' },
		});
		setIcon(addButtonEl, 'plus');
		addButtonEl.createSpan({ text: '添加按钮' });
		addButtonEl.addEventListener('click', this.options.onAddButton);

		if (sortableItems.length > 1) {
			this.sortController = new PointerSortController({
				containerEl: itemsEl,
				items: sortableItems,
				scrollEl: this.contentEl ?? undefined,
				onReorder: (sourceIndex, targetIndex) => {
					const [moved] = this.group.groupItems.splice(sourceIndex, 1);
					if (!moved) return;
					this.group.groupItems.splice(targetIndex, 0, moved);
					this.options.onChange();
				},
				onSettled: () => this.renderItems(),
				onError: (error) => console.error('Custom Buttons failed to reorder group buttons:', error),
			});
		}
		if (this.contentEl) this.contentEl.scrollTop = scrollTop;
	}

	private createIconPicker(parentEl: HTMLElement): void {
		const buttonEl = parentEl.createEl('button', {
			cls: ['clickable-icon', 'basic-vault-button-studio-icon-picker'],
			attr: { type: 'button', 'aria-label': '图标' },
		});
		const previewEl = buttonEl.createSpan({ cls: 'basic-vault-button-studio-icon-preview' });
		this.iconService.render(previewEl, this.group.icon);
		setTooltip(buttonEl, '图标');
		buttonEl.addEventListener('click', () => {
			void this.iconService.pick(buttonEl, this.group.icon, (selectedIcon) => {
				const previousIcon = this.group.icon;
				this.group.icon = selectedIcon;
				this.group.toggleIcon = selectedIcon;
				this.iconService.update(previewEl, selectedIcon, previousIcon);
				this.options.onChange();
			});
		});
	}

	private createIconButton(
		parentEl: HTMLElement,
		icon: string,
		label: string,
		onClick: () => void,
	): HTMLButtonElement {
		const buttonEl = parentEl.createEl('button', {
			cls: 'clickable-icon',
			attr: { type: 'button', 'aria-label': label },
		});
		setIcon(buttonEl, icon);
		setTooltip(buttonEl, label);
		buttonEl.addEventListener('click', onClick);
		return buttonEl;
	}

	private getButtonSummary(button: CustomButton): string {
		switch (button.type) {
			case 'command': return `命令 - ${this.getCommandDisplayName(button.command)}`;
			case 'file': return `文件 - ${button.file || '未设置文件'}`;
			case 'url': return `网址 - ${button.url || '未设置网址'}`;
		}
	}

	private getCommandDisplayName(commandId: string): string {
		if (!commandId) return '未设置命令';
		return getRegisteredCommands(this.app)
			.find((command) => command.id === commandId)
			?.name ?? '未找到命令';
	}
}
