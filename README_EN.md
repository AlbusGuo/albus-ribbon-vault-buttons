# Custom Buttons

[简体中文](README.md) | English

Custom Buttons is a desktop plugin for [Obsidian](https://obsidian.md/) that provides consistent, sortable shortcuts across several areas of the interface.

*Keep your most-used actions within reach.*

Buttons can run Obsidian commands, open files in the vault, or visit web links. The plugin provides a ribbon area, page header buttons, a note toolbar, and a selection toolbar, with support for dividers, button groups, icon toggles, and optional Custom Icons integration.

## Features

### Buttons in multiple locations

- **Ribbon**: Add buttons, button groups, and dividers to the left ribbon.
- **Page header**: Add shortcuts and button groups to Markdown view headers.
- **Note toolbar**: Show a toolbar at the top or bottom of Markdown views.
- **Selection toolbar**: Show a floating toolbar when text is selected in editing mode.

The note toolbar and selection toolbar remain disabled when they contain no buttons.

### Three button actions

- **Command**: Find and run registered Obsidian commands with inline suggestions. The interface shows command names while settings store stable command IDs.
- **File**: Find and open files in the vault with inline suggestions.
- **URL**: Open `http`, `https`, `mailto`, or `obsidian` links with the system handler.

### Button groups

A button group has its own name and parent icon. Click or hover over the parent button to open a menu of child buttons.

- Choose click or hover behavior in General settings.
- Child buttons support commands, files, and URLs.
- Add, edit, delete, and reorder child buttons.
- Menus adapt to the ribbon, page header, note toolbar, and selection toolbar.

### Icons and icon morphing

- Pick from Obsidian's built-in Lucide icons.
- Assign separate primary and toggle icons to each regular button.
- Icon state is persisted across Obsidian reloads.
- Compatible icon paths morph with [Morphicons](https://github.com/thesephist/morphicons).
- When [Custom Icons](https://github.com/AlbusGuo/albus-custom-icons) is installed, the icon picker automatically uses its public API. Otherwise, it falls back to the default picker.

### Sorting and dividers

- Reorder buttons, button groups, and dividers in settings.
- Reorder items directly in the ribbon and note toolbar.
- Note toolbar dividers have an expanded drag target and hover feedback.
- Dividers are available in the ribbon, note toolbar, and selection toolbar.

### Native ribbon controls

- Move built-in controls such as vault switcher, Help, and Settings into the left ribbon.
- Optionally hide Obsidian's default ribbon actions.

## How to use

1. Open **Settings -> Custom Buttons**.
2. Choose **Ribbon**, **Page header**, **Note toolbar**, or **Selection toolbar**.
3. Use the icons to the right of the **Buttons** heading to add a button, button group, or divider.
4. Configure its name, icons, action type, and target in the editor.
5. Use the drag handle to reorder items.

Editors save changes immediately and do not use confirm or cancel buttons. Incomplete required fields are not saved, and Obsidian displays a Notice when an incomplete editor is closed.

## Toolbar settings

### Note toolbar

- **Top**: Keep the toolbar at the top of the Markdown view.
- **Bottom**: Show a floating toolbar near the bottom of the editor.

### Selection toolbar

- Available only in Markdown editing mode.
- Responds to mouse selections by default.
- Can optionally respond to keyboard-created or keyboard-adjusted selections.
- Supports regular editors, editors inside Obsidian modals, and pop-out windows.
- Toolbar buttons do not show tooltips, while accessible names remain available to screen readers.

## Installation

### Obsidian community plugins

1. Open **Settings -> Community plugins**.
2. Select **Browse**.
3. Search for `Custom Buttons`.
4. Install and enable the plugin.

### BRAT

Add the following repository with [BRAT](https://github.com/TfTHacker/obsidian42-brat):

```text
AlbusGuo/albus-custom-buttons
```

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from [GitHub Releases](https://github.com/AlbusGuo/albus-custom-buttons/releases).
2. Place them in `<Vault>/.obsidian/plugins/albus-custom-buttons/`.
3. Reload Obsidian.
4. Enable `Custom Buttons` in **Settings -> Community plugins**.

## Requirements

- Obsidian `1.12.0` or later.
- Windows, macOS, or Linux desktop.
- Mobile is not supported.

## Privacy

Custom Buttons runs locally. It does not collect telemetry, upload vault content, or download and execute remote code.

Network access occurs only when you explicitly open a URL button.

## Known limitations

- Some commands depend on the active editor or view. Their behavior is controlled by the command provider.
- Button groups support one level only. Child buttons cannot contain another button group.
- Custom Icons is an optional integration and must be installed and enabled separately.

## Acknowledgments

- [Note Toolbar](https://github.com/chrisgurney/obsidian-note-toolbar) by [Chris Gurney](https://github.com/chrisgurney): Its note and selection toolbar concepts and interactions were an important reference for this project.
- [Commander](https://github.com/phibr0/obsidian-commander) by [phibr0](https://github.com/phibr0): Its approach to organizing and running custom actions across Obsidian interface locations was an important inspiration.
- [Home Tab Plus](https://github.com/Moyf/home-tab-plus) by [Moyf](https://github.com/Moyf): Its README structure and project presentation inspired this documentation rewrite.
- [Morphicons](https://github.com/thesephist/morphicons): Provides icon path morphing.
- [Custom Icons](https://github.com/AlbusGuo/albus-custom-icons): Provides the optional extended icon library and public icon picker API.

Thanks to the Obsidian developer documentation, sample plugin, and the broader plugin development community.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
