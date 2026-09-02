# Custom Buttons

简体中文 | [English](README_EN.md)

Custom Buttons 是一个 [Obsidian](https://obsidian.md/) 桌面端插件, 用于在多个界面位置创建一致, 可排序的快捷按钮与按钮组.

*让常用操作始终触手可及.*

按钮可以执行 Obsidian 命令, 打开库内文件或访问网页. 插件同时提供左侧边栏, 标题栏, 笔记工具栏与选中文本工具栏, 并支持分割线, 按钮组, 图标切换和可选的 Custom Icons 集成.

## 功能

### 多位置按钮

- **左侧边栏**: 在 Ribbon 中添加按钮, 按钮组和分割线.
- **标题栏**: 在 Markdown 视图标题栏中添加快捷按钮与按钮组.
- **笔记工具栏**: 在 Markdown 视图顶部或底部显示工具栏.
- **选中文本工具栏**: 在编辑模式中选择文本后显示浮动工具栏.

当笔记工具栏或选中文本工具栏没有配置任何按钮时, 对应功能不会启用.

### 三种按钮动作

- **命令**: 通过输入联想选择并执行 Obsidian 已注册命令. 界面显示命令名称, 设置内部保存稳定的命令 ID.
- **文件**: 通过输入联想选择并打开库内文件.
- **网址**: 使用系统默认方式打开 `http`, `https`, `mailto` 或 `obsidian` 链接.

### 按钮组

按钮组拥有独立名称和父图标. 点击或悬停父按钮后, 可从菜单中执行组内按钮.

- 在通用设置中选择点击或悬停展开.
- 组内按钮支持命令, 文件和网址.
- 支持添加, 编辑, 删除和拖拽排序.
- 菜单样式会适配左侧边栏, 标题栏, 笔记工具栏和选中文本工具栏.

### 图标与图标变换

- 使用 Obsidian 内置 Lucide 图标选择器.
- 每个普通按钮可分别设置主图标和切换图标.
- 点击按钮后保存图标状态, 重新加载 Obsidian 后继续保持.
- 兼容图标之间使用 [Morphicons](https://github.com/thesephist/morphicons) 进行路径变换.
- 安装 [Custom Icons](https://github.com/AlbusGuo/albus-custom-icons) 后, 图标选择器会自动使用其公共 API. 未安装时自动回退到默认选择器.

### 排序与分隔线

- 设置页支持拖拽按钮, 按钮组和分隔线.
- 左侧边栏和笔记工具栏支持直接拖拽排序.
- 笔记工具栏分隔线拥有扩大的拖拽判定区域与 hover 反馈.
- 分隔线可用于左侧边栏, 笔记工具栏和选中文本工具栏.

### 原生功能区控制

- 可将库切换, 帮助和设置等内置按钮调整到左侧功能区.
- 可隐藏 Obsidian 默认功能区.

## 使用方式

1. 打开 **设置 -> Custom Buttons**.
2. 选择 **左侧边栏**, **标题栏**, **笔记工具栏** 或 **选中文本工具栏**.
3. 使用 **按钮** 标题右侧的图标添加按钮, 按钮组或分割线.
4. 在编辑面板中设置名称, 图标, 类型和执行目标.
5. 使用拖拽手柄调整顺序.

编辑面板使用即时保存, 不提供确认或取消按钮. 必填信息不完整时不会保存, 关闭面板时会通过 Obsidian Notice 提示.

## 工具栏设置

### 笔记工具栏

- **顶部**: 固定显示在 Markdown 视图顶部.
- **底部**: 作为浮动工具栏显示在编辑区域底部.

### 选中文本工具栏

- 仅在 Markdown 编辑模式中启用.
- 默认响应鼠标选区.
- 可选择是否响应键盘创建或调整的选区.
- 支持普通编辑器, Obsidian Modal 中的编辑器和独立窗口.
- 工具栏按钮不会显示 tooltip, 但保留屏幕阅读器可访问名称.

## 安装

### Obsidian 社区插件

1. 打开 **设置 -> 社区插件**.
2. 选择 **浏览**.
3. 搜索 `Custom Buttons`.
4. 安装并启用插件.

### BRAT

使用 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 添加:

```text
AlbusGuo/albus-custom-buttons
```

### 手动安装

1. 从 [GitHub Releases](https://github.com/AlbusGuo/albus-custom-buttons/releases) 下载 `main.js`, `manifest.json` 和 `styles.css`.
2. 将文件放入 `<Vault>/.obsidian/plugins/albus-custom-buttons/`.
3. 重新加载 Obsidian.
4. 在 **设置 -> 社区插件** 中启用 `Custom Buttons`.

## 系统要求

- Obsidian `1.12.0` 或更高版本.
- Windows, macOS 或 Linux 桌面端.
- 本插件不支持移动端.

## 隐私

Custom Buttons 在本地运行, 不收集遥测数据, 不上传库内容, 也不会下载或执行远程代码.

仅在用户主动打开网址按钮时访问对应链接.

## 已知限制

- 部分命令依赖当前活动编辑器或视图, 实际行为由命令提供方决定.
- 按钮组仅支持一层, 组内按钮不能继续嵌套按钮组.
- Custom Icons 是可选集成, 需要单独安装并启用.

## 致谢

- [Note Toolbar](https://github.com/chrisgurney/obsidian-note-toolbar) by [Chris Gurney](https://github.com/chrisgurney): 笔记工具栏与选中文本工具栏的功能构想和交互方式为本项目提供了重要参考.
- [Commander](https://github.com/phibr0/obsidian-commander) by [phibr0](https://github.com/phibr0): 在 Obsidian 多个界面位置组织和执行自定义操作的设计为本项目提供了重要启发.
- [Home Tab Plus](https://github.com/Moyf/home-tab-plus) by [Moyf](https://github.com/Moyf): README 的信息结构与项目说明方式为本次文档重写提供了参考.
- [Morphicons](https://github.com/thesephist/morphicons): 提供图标路径变换能力.
- [Custom Icons](https://github.com/AlbusGuo/albus-custom-icons): 提供可选的扩展图标库和公共图标选择 API.

感谢 Obsidian 开发者文档, 示例插件和社区中的所有插件开发者.

## 许可

本项目基于 [GNU Affero General Public License v3.0](LICENSE) 发布.
