var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => BasicVaultButtonPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

var BasicVaultButtonPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.ribbonMap = /* @__PURE__ */ new Map();
    this.styleElements = {};
    this.customButtons = [];
  }

  async onload() {
    await this.loadSettings();
    this.applyCustomStyles();
    this.initVaultButtons();
    this.applyStyleSettings();
    this.addSettingTab(new CustomButtonsSettingTab(this.app, this));
  }

  onunload() {
    this.ribbonMap.forEach((value, key) => {
      value.detach();
    });
    this.ribbonMap.clear();
    Object.values(this.styleElements).forEach((el) => el.remove());
  }

  async loadSettings() {
    const data = await this.loadData();
    this.customButtons = data?.customButtons || [];
  }

  async saveSettings() {
    await this.saveData({ customButtons: this.customButtons });
  }

  initVaultButtons() {
    this.ribbonMap.forEach((value, key) => {
      value.detach();
    });
    this.ribbonMap.clear();

    this.initCustomButtons();

    this.createRibbonButton("theme", "切换主题", "lucide-sun-moon", () => this.switchLightDark());
    this.createRibbonButton("vault", "切换库", "vault", () => this.app.openVaultChooser());
    this.createRibbonButton("help", "帮助", "help", () => this.app.openHelp());
    this.createRibbonButton("settings", "设置", "lucide-settings", () => this.app.setting.open());
  }

  initCustomButtons() {
    this.customButtons.forEach((button, index) => {
      this.createCustomButton(button, index);
    });
  }

  createCustomButton(button, index) {
    const buttonId = `custom-${index}`;
    const onClick = () => {
      if (button.type === "command" && button.command) {
        this.app.commands.executeCommandById(button.command);
      } else if (button.type === "file" && button.file) {
        const file = this.app.vault.getAbstractFileByPath(button.file);
        if (file && file instanceof import_obsidian.TFile) {
          const leaf = this.app.workspace.getLeaf('tab');
          leaf.openFile(file);
        }
      } else if (button.type === "url" && button.url) {
        window.open(button.url, '_blank');
      }
    };

    const ribbonButton = this.createRibbonButton(buttonId, button.tooltip, button.icon, onClick);
    return ribbonButton;
  }

  createRibbonButton(id, tooltip, icon, onClick) {
    const leftRibbon = this.app.workspace.leftRibbon;
    const button = leftRibbon.makeRibbonItemButton(icon, tooltip, (e) => {
      e.stopPropagation();
      onClick();
    });
    this.ribbonMap.set(id, button);
    leftRibbon.ribbonSettingEl.appendChild(button);
    return button;
  }

  switchLightDark() {
    const isDarkMode = this.app.vault.getConfig("theme") === "obsidian";
    if (isDarkMode) {
      this.app.setTheme("moonstone");
      this.app.vault.setConfig("theme", "moonstone");
      this.app.workspace.trigger("css-change");
    } else {
      this.app.setTheme("obsidian");
      this.app.vault.setConfig("theme", "obsidian");
      this.app.workspace.trigger("css-change");
    }
  }

  applyStyleSettings() {
    this.updateStyle("vault-profile", `
			body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile {
				display: none;
			}
		`);
    this.updateStyle("vault-switcher", `
			body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile .workspace-drawer-vault-switcher {
				display: none;
			}
		`);
    this.updateStyle("vault-actions-help", `
			body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile .workspace-drawer-vault-actions .clickable-icon:has(svg.svg-icon.help) {
				display: none;
			}
		`);
    this.updateStyle("vault-actions-settings", `
			body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile .workspace-drawer-vault-actions .clickable-icon:has(svg.svg-icon.lucide-settings) {
				display: none;
			}
		`);
    this.updateStyle("vault-actions-theme", `
			body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile .workspace-drawer-vault-actions .clickable-icon:has(svg.svg-icon.lucide-sun-moon) {
				display: none;
			}
		`);
  }

  applyCustomStyles() {
    const customStyles = `
      .basic-vault-button-setting-item {
        background: var(--background-secondary);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        border: 1px solid var(--background-modifier-border);
        transition: all 0.2s ease;
      }
      
      .basic-vault-button-setting-item:hover {
        border-color: var(--interactive-accent);
      }
      
      .basic-vault-button-setting-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      
      .basic-vault-button-setting-title {
        font-weight: 600;
        color: var(--text-normal);
        font-size: 14px;
      }
      
      .basic-vault-button-setting-actions {
        display: flex;
        gap: 4px;
      }
      
      .basic-vault-button-action-btn {
        padding: 4px 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 12px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
      }
      
      .basic-vault-button-action-btn:hover:not(:disabled) {
        background: var(--background-modifier-hover);
        color: var(--text-normal);
      }
      
      .basic-vault-button-action-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      
      .basic-vault-button-delete-btn {
        background: var(--color-red);
        border-color: var(--color-red);
        color: white;
      }
      
      .basic-vault-button-delete-btn:hover {
        background: var(--color-red-dark);
      }
      
      .basic-vault-button-setting-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .basic-vault-button-setting-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        align-items: start;
      }
      
      .basic-vault-button-link-config {
        grid-column: 1 / -1;
      }
      
      .basic-vault-button-add-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s ease;
        margin-bottom: 16px;
      }
      
      .basic-vault-button-add-btn:hover {
        background: var(--interactive-accent-hover);
      }
      
      .basic-vault-button-empty {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-muted);
        background: var(--background-secondary);
        border-radius: 8px;
        border: 1px solid var(--background-modifier-border);
        margin-bottom: 16px;
      }
      
      .basic-vault-button-empty p {
        margin: 8px 0;
        font-size: 14px;
      }
      
      .basic-vault-button-divider {
        height: 1px;
        background: var(--background-modifier-border);
        margin: 16px 0;
      }
      
      .basic-vault-button-section-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-normal);
        margin-bottom: 12px;
      }
      
      .basic-vault-button-description {
        color: var(--text-muted);
        font-size: 13px;
        line-height: 1.4;
        margin-bottom: 16px;
      }
      
      .basic-vault-button-setting-item .setting-item {
        border-top: none;
        padding-top: 0;
        padding-bottom: 0;
      }
      
      .basic-vault-button-setting-item .setting-item-info {
        margin-bottom: 4px;
      }
      
      .basic-vault-button-setting-item .setting-item-name {
        font-weight: 600;
        color: var(--text-normal);
        font-size: 13px;
      }
      
      .basic-vault-button-setting-item .setting-item-description {
        color: var(--text-muted);
        font-size: 11px;
        line-height: 1.3;
      }
      
      @media (max-width: 768px) {
        .basic-vault-button-setting-row {
          grid-template-columns: 1fr;
          gap: 8px;
        }
        
        .basic-vault-button-setting-header {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
        }
        
        .basic-vault-button-setting-actions {
          align-self: flex-end;
        }
      }
    `;
    
    this.updateStyle("custom-buttons-styles", customStyles);
  }

  updateStyle(id, css) {
    let styleEl = this.styleElements[id];
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = id;
      document.head.appendChild(styleEl);
      this.styleElements[id] = styleEl;
    }
    styleEl.textContent = css;
  }
};

var FileSuggestModal = class extends import_obsidian.FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
  }

  getItems() {
    return this.app.vault.getFiles();
  }

  getItemText(file) {
    return file.path;
  }

  onChooseItem(file, evt) {
    this.onChoose(file);
  }
};

var CustomButtonsSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: '自定义底部侧边栏按钮' });
    
    const description = containerEl.createDiv('basic-vault-button-description');
    description.setText('在此添加和管理您的底部侧边栏按钮。新按钮将从下到上添加到侧边栏中，位于内置按钮下方。');

    if (this.plugin.customButtons.length === 0) {
      const emptyState = containerEl.createDiv('basic-vault-button-empty');
      emptyState.createEl('p', { text: '还没有添加任何自定义按钮' });
      emptyState.createEl('p', { 
        text: '点击下方的"添加新按钮"开始创建',
        cls: 'setting-item-description'
      });
    }

    if (this.plugin.customButtons.length > 0) {

      containerEl.createDiv('basic-vault-button-divider');

      const listTitle = containerEl.createDiv('basic-vault-button-section-title');
      listTitle.setText('已配置的按钮');

      const reversedButtons = [...this.plugin.customButtons].reverse();
      reversedButtons.forEach((button, reversedIndex) => {

        const originalIndex = this.plugin.customButtons.length - 1 - reversedIndex;
        this.createButtonSetting(containerEl, button, originalIndex);
      });
    }

    const addButton = containerEl.createEl('button', {
      text: '添加新按钮',
      cls: 'basic-vault-button-add-btn'
    });
    addButton.addEventListener('click', () => {
      this.addCustomButton();
    });
  }

  addCustomButton() {
    const newButton = {
      icon: 'lucide-plus',
      tooltip: '新按钮',
      type: 'command',
      command: '',
      file: '',
      url: ''
    };
    this.plugin.customButtons.unshift(newButton);
    this.plugin.saveSettings();
    this.plugin.initVaultButtons();
    this.display();
  }

  removeButton(index) {

    const buttonId = `custom-${index}`;
    if (this.plugin.ribbonMap.has(buttonId)) {
      this.plugin.ribbonMap.get(buttonId).detach();
      this.plugin.ribbonMap.delete(buttonId);
    }
    
    this.plugin.customButtons.splice(index, 1);
    this.plugin.saveSettings();
    this.plugin.initVaultButtons();
    this.display();
  }

  moveButton(index, direction) {
    if (direction === 'up' && index > 0) {
      [this.plugin.customButtons[index - 1], this.plugin.customButtons[index]] = 
      [this.plugin.customButtons[index], this.plugin.customButtons[index - 1]];
    } else if (direction === 'down' && index < this.plugin.customButtons.length - 1) {
      [this.plugin.customButtons[index + 1], this.plugin.customButtons[index]] = 
      [this.plugin.customButtons[index], this.plugin.customButtons[index + 1]];
    }
    this.plugin.saveSettings();
    this.plugin.initVaultButtons();
    this.display();
  }

  createButtonSetting(containerEl, button, index) {
    const settingItem = containerEl.createDiv('basic-vault-button-setting-item');

    const header = settingItem.createDiv('basic-vault-button-setting-header');
    header.createEl('span', {
      text: `按钮 ${index + 1}`,
      cls: 'basic-vault-button-setting-title'
    });

    const actions = header.createDiv('basic-vault-button-setting-actions');
    
    const upButton = actions.createEl('button', {
      text: '↑',
      cls: 'basic-vault-button-action-btn'
    });
    upButton.title = '上移';
    upButton.disabled = index === 0;
    upButton.addEventListener('click', () => this.moveButton(index, 'up'));

    const downButton = actions.createEl('button', {
      text: '↓',
      cls: 'basic-vault-button-action-btn'
    });
    downButton.title = '下移';
    downButton.disabled = index === this.plugin.customButtons.length - 1;
    downButton.addEventListener('click', () => this.moveButton(index, 'down'));

    const deleteButton = actions.createEl('button', {
      text: '删除',
      cls: 'basic-vault-button-action-btn basic-vault-button-delete-btn'
    });
    deleteButton.addEventListener('click', () => this.removeButton(index));

    const content = settingItem.createDiv('basic-vault-button-setting-content');

    new import_obsidian.Setting(content)
      .setName('按钮名称')
      .setDesc('鼠标悬停时显示的提示文字')
      .addText(text => text
        .setValue(button.tooltip)
        .setPlaceholder('例如：打开日记')
        .onChange(async (value) => {
          button.tooltip = value;
          await this.plugin.saveSettings();
          this.plugin.initVaultButtons();
        }));

    new import_obsidian.Setting(content)
      .setName('图标')
      .setDesc('输入 Lucide 图标名称（如：lucide-home）')
      .addText(text => text
        .setValue(button.icon)
        .setPlaceholder('lucide-home')
        .onChange(async (value) => {
          button.icon = value;
          await this.plugin.saveSettings();
          this.plugin.initVaultButtons();
        }));

    new import_obsidian.Setting(content)
      .setName('按钮类型')
      .setDesc('选择按钮点击时执行的操作')
      .addDropdown(dropdown => dropdown
        .addOption('command', '执行命令')
        .addOption('file', '打开文件')
        .addOption('url', '打开网址')
        .setValue(button.type)
        .onChange(async (value) => {
          button.type = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (button.type === 'command') {
      new import_obsidian.Setting(content)
        .setName('命令ID')
        .setDesc('输入要执行的命令ID（可在"命令面板"中查看命令ID）')
        .addText(text => text
          .setValue(button.command)
          .setPlaceholder('file-explorer:new-file')
          .onChange(async (value) => {
            button.command = value;
            await this.plugin.saveSettings();
          }));
    } else if (button.type === 'file') {
      new import_obsidian.Setting(content)
        .setName('目标文件')
        .setDesc('选择要打开的文件')
        .addSearch(search => {
          search.setValue(button.file);
          search.setPlaceholder('例如：日记/2024.md');
          
          const modal = new FileSuggestModal(this.app, (file) => {
            button.file = file.path;
            search.setValue(file.path);
            this.plugin.saveSettings();
          });
          
          search.inputEl.addEventListener('click', () => {
            modal.open();
          });
          
          search.onChange(value => {
            button.file = value;
            this.plugin.saveSettings();
          });
        });
    } else if (button.type === 'url') {
      new import_obsidian.Setting(content)
        .setName('网址链接')
        .setDesc('输入要打开的完整网址')
        .addText(text => text
          .setValue(button.url)
          .setPlaceholder('https://example.com')
          .onChange(async (value) => {
            button.url = value;
            await this.plugin.saveSettings();
          }));
    }
  }
};

