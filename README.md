# Ribbon Vault Buttons - Obsidian 插件

![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-blue?logo=obsidian)
![Version](https://img.shields.io/badge/Version-0.4-green)
![GitHub all releases](https://img.shields.io/github/downloads/AlbusGuo/albus-ribbon-vault-buttons/total)
![GitHub release (latest by date)](https://img.shields.io/github/downloads/AlbusGuo/albus-ribbon-vault-buttons/latest/total?style=for-the-badge)


一个重新设计 Obsidian 底部侧边栏按钮布局的插件，支持添加自定义功能按钮，让您的侧边栏更加个性化和实用。

## ✨ 特性功能

### 🔄 重新设计的按钮布局
- 将内置按钮重新排列到侧边栏底部
- 包含：切换主题、切换库、帮助、设置按钮
- 简洁统一的视觉设计

### 🎨 自定义按钮系统
- **多种按钮类型**：
  - 📝 执行命令 - 运行任何 Obsidian 命令
  - 📄 打开文件 - 快速访问常用文件
  - 🌐 打开网址 - 一键跳转到外部链接
  
- **灵活的配置**：
  - 自定义图标（支持 Lucide 图标）
  - 个性化提示文字
  - 自由排序和位置调整

### 🛠️ 用户友好的设置界面
- 直观的卡片式设置项
- 拖拽式排序功能
- 实时预览更改
- 响应式设计，支持移动端

## 📥 安装方法


1. 从 Releases 页面下载最新版本
2. 将文件下载到您的 vault 插件文件夹：`<vault>/.obsidian/plugins/albus-ribbon-vault-buttons/`
3. 重新加载 Obsidian
4. 在社区插件中启用插件

## 🚀 使用方法

### 基本配置
1. 打开 Obsidian 设置
2. 找到「Ribbon Vault Buttons」设置选项
3. 点击「添加新按钮」开始配置

### 添加自定义按钮
1. **设置基本信息**：
   - 按钮名称：鼠标悬停时显示的提示文字
   - 图标：输入 Lucide 图标名称（如：`lucide-home`）

2. **选择按钮类型**：
   - **执行命令**：输入命令 ID（可在命令面板中查看）
   - **打开文件**：选择库中的文件
   - **打开网址**：输入完整的 URL 地址

3. **调整按钮顺序**：
   - 使用「↑」「↓」按钮调整位置
   - 新按钮默认添加到底部

### 图标参考
插件支持所有 Lucide 图标，常用图标示例：
- `lucide-home` - 主页
- `lucide-calendar` - 日历
- `lucide-book` - 书籍
- `lucide-settings` - 设置
- `lucide-external-link` - 外部链接

## ⚙️ 配置示例

### 快速日记按钮
```yaml
图标: lucide-calendar
名称: 新建日记
类型: 命令
命令: daily-notes:open-today-note
```

### 项目看板按钮
```yaml
图标: lucide-trello
名称: 项目看板
类型: 文件
文件: Projects/Kanban.md
```

### 外部工具按钮
```yaml
图标: lucide-external-link
名称: 项目文档
类型: 网址
网址: https://your-project-docs.com
```

## 🔧 高级功能

### 按钮排序策略
- 自定义按钮从下到上排列
- 内置按钮从上到下排列
- 支持拖拽调整顺序

### 样式定制
插件提供完整的 CSS 样式支持，您可以通过 CSS 代码片段进一步自定义：
- 按钮大小和间距
- 图标颜色和动画
- 悬停效果

## 🐛 故障排除

### 常见问题
1. **按钮不显示**：检查图标名称是否正确
2. **命令不执行**：确认命令 ID 准确无误
3. **文件打不开**：验证文件路径是否存在

### 获取帮助
- 查看控制台错误信息（Ctrl+Shift+I）
- 检查插件设置是否正确保存
- 重启 Obsidian 应用


## 🤝 贡献与反馈

欢迎提交 Issue 和 Pull Request！
