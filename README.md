# RedCrumbs

RedCrumbs is an Obsidian plugin that highlights the active file's parent folder and any linked files directly in your File Explorer sidebar. Never lose track of where your current note lives or how it connects to the rest of your vault!

## Features

- **Active Folder Highlighting:** Automatically highlights the folder containing your currently open note.
- **Linked Files Highlighting:** Highlights any notes in the File Explorer that are linked to (outlinks) or linked from (backlinks) your active note.
- **Customizable Styles:** Choose from three distinct visual styles:
  - **Straight Lines:** A clean, modern look with a solid left border and sharp corners.
  - **Blob Shape:** An organic, varied shape with a solid border for the folder and a dashed border for links.
  - **Strikethrough:** A minimalist style that strikes a line through the text of the folder and linked files.
- **Color & Tone Control:** Fully customize the color and opacity (tone) for both the active folder and linked files via the settings menu.
- **Indent Line Coloring:** Optionally color the indentation guide lines leading down from the highlighted folder to the file.

## Installation

### Manual Installation
1. Download the latest release from the [Releases](https://github.com/neonoodles-ctrl/redcrumbs/releases) page.
2. Extract the `redcrumbs` folder.
3. Place the folder inside your vault's `.obsidian/plugins/` directory.
4. Reload Obsidian.
5. Go to **Settings** > **Community Plugins** and enable **RedCrumbs**.

*(Note: Official Community Plugin installation coming soon!)*

## Usage

Once enabled, simply click on any note in your vault. If the note is inside a folder, that folder will highlight. If the note has links to other notes (or is linked by other notes), those notes will also highlight in the File Explorer sidebar.

You can configure all visual settings in **Settings** > **RedCrumbs**.

## Building from Source

```bash
npm install
npm run build
```

## License

MIT
