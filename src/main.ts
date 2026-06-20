import { Plugin, TFile, TFolder, PluginSettingTab, App, Setting } from 'obsidian';

interface HighlightPluginSettings {
    folderColor: string;
    folderTone: number;
    linkColor: string;
    linkTone: number;
    folderStyle: 'straight' | 'blob' | 'strikethrough';
    colorIndentLines: boolean;
    traceFolderToRoot: boolean;
    traceLinkToRoot: boolean;
}

const DEFAULT_SETTINGS: HighlightPluginSettings = {
    folderColor: '#6e59d9',
    folderTone: 0.2,
    linkColor: '#6e59d9',
    linkTone: 0.08,
    folderStyle: 'straight',
    colorIndentLines: true,
    traceFolderToRoot: false,
    traceLinkToRoot: false,
};

function hexToRgb(hex: string): string {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r}, ${g}, ${b}`;
}

export default class HighlightPlugin extends Plugin {
    settings: HighlightPluginSettings;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new HighlightSettingTab(this.app, this));
        this.updateDOMStyles();

        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                this.updateHighlights(file);
            })
        );

        this.registerEvent(
            this.app.metadataCache.on('resolved', () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    this.updateHighlights(file);
                }
            })
        );

        this.app.workspace.onLayoutReady(() => {
            const file = this.app.workspace.getActiveFile();
            if (file) {
                this.updateHighlights(file);
            }
        });
    }

    onunload() {
        this.clearHighlights();
        const body = activeDocument.body;
        body.classList.remove(
            'obsidian-highlight-style-straight',
            'obsidian-highlight-style-blob',
            'obsidian-highlight-style-strikethrough',
            'obsidian-highlight-indent-lines'
        );
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    updateDOMStyles() {
        const body = activeDocument.body;
        body.style.setProperty('--obsidian-highlight-folder-rgb', hexToRgb(this.settings.folderColor));
        body.style.setProperty('--obsidian-highlight-folder-hex', this.settings.folderColor);
        body.style.setProperty('--obsidian-highlight-folder-tone', this.settings.folderTone.toString());

        body.style.setProperty('--obsidian-highlight-link-rgb', hexToRgb(this.settings.linkColor));
        body.style.setProperty('--obsidian-highlight-link-hex', this.settings.linkColor);
        body.style.setProperty('--obsidian-highlight-link-tone', this.settings.linkTone.toString());

        body.classList.remove(
            'obsidian-highlight-style-straight',
            'obsidian-highlight-style-blob',
            'obsidian-highlight-style-strikethrough',
            'obsidian-highlight-indent-lines'
        );
        body.classList.add(`obsidian-highlight-style-${this.settings.folderStyle}`);
        if (this.settings.colorIndentLines) {
            body.classList.add('obsidian-highlight-indent-lines');
        }
    }

    updateHighlights(activeFile: TFile | null) {
        this.clearHighlights();
        if (!activeFile) return;

        const linkedPaths = this.collectLinkedPaths(activeFile);
        const folderPaths = this.collectFolderHighlightPaths(activeFile);
        const linkFolderPaths = this.settings.traceLinkToRoot
            ? this.collectLinkFolderHighlightPaths(linkedPaths)
            : new Set<string>();

        this.forEachFileExplorerItem((path, el) => {
            const containerEl = el.parentElement;

            if (folderPaths.has(path)) {
                el.classList.add('plugin-active-folder');
                containerEl?.classList.add('plugin-active-folder-container');
            } else if (linkedPaths.has(path)) {
                el.classList.add('plugin-linked-file');
                containerEl?.classList.add('plugin-linked-file-container');
            } else if (linkFolderPaths.has(path)) {
                el.classList.add('plugin-linked-folder');
                containerEl?.classList.add('plugin-linked-folder-container');
            }
        });
    }

    clearHighlights() {
        this.forEachFileExplorerItem((_path, el) => {
            el.classList.remove('plugin-active-folder', 'plugin-linked-file', 'plugin-linked-folder');
            el.parentElement?.classList.remove(
                'plugin-active-folder-container',
                'plugin-linked-file-container',
                'plugin-linked-folder-container'
            );
        });
    }

    private collectFolderHighlightPaths(activeFile: TFile): Set<string> {
        const parent = activeFile.parent;
        if (!parent || parent.path === '/') {
            return new Set();
        }

        if (this.settings.traceFolderToRoot) {
            return this.collectAncestorFolderPaths(parent);
        }

        return new Set([parent.path]);
    }

    private collectLinkFolderHighlightPaths(linkedPaths: Set<string>): Set<string> {
        const paths = new Set<string>();

        for (const linkPath of linkedPaths) {
            const file = this.app.vault.getAbstractFileByPath(linkPath);
            if (file instanceof TFile && file.parent) {
                for (const folderPath of this.collectAncestorFolderPaths(file.parent)) {
                    paths.add(folderPath);
                }
            }
        }

        return paths;
    }

    private collectAncestorFolderPaths(folder: TFolder): Set<string> {
        const paths = new Set<string>();
        let current: TFolder | null = folder;

        while (current && current.path !== '/') {
            paths.add(current.path);
            current = current.parent;
        }

        return paths;
    }

    private collectLinkedPaths(activeFile: TFile): Set<string> {
        const linkedPaths = new Set<string>();
        const cache = this.app.metadataCache.getFileCache(activeFile);

        if (cache?.links) {
            for (const link of cache.links) {
                const destFile = this.app.metadataCache.getFirstLinkpathDest(link.link, activeFile.path);
                if (destFile) {
                    linkedPaths.add(destFile.path);
                }
            }
        }

        const { resolvedLinks } = this.app.metadataCache;
        for (const sourcePath in resolvedLinks) {
            if (resolvedLinks[sourcePath]?.[activeFile.path] !== undefined) {
                linkedPaths.add(sourcePath);
            }
        }

        return linkedPaths;
    }

    private forEachFileExplorerItem(callback: (path: string, el: HTMLElement) => void) {
        const fileExplorers = this.app.workspace.getLeavesOfType('file-explorer');
        for (const leaf of fileExplorers) {
            const items = leaf.view.containerEl.querySelectorAll<HTMLElement>('.tree-item-self[data-path]');
            items.forEach((el) => {
                const path = el.getAttribute('data-path');
                if (path) {
                    callback(path, el);
                }
            });
        }
    }
}

class HighlightSettingTab extends PluginSettingTab {
    plugin: HighlightPlugin;

    constructor(app: App, plugin: HighlightPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('File Explorer Highlight Settings')
            .setHeading();

        new Setting(containerEl)
            .setName('Folder Highlight Color')
            .setDesc('Color for the active file\'s parent folder.')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.folderColor)
                .onChange(async (value) => {
                    this.plugin.settings.folderColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateDOMStyles();
                }));

        new Setting(containerEl)
            .setName('Folder Highlight Tone (Opacity)')
            .setDesc('Opacity for the folder highlight background (0.0 to 1.0).')
            .addSlider(slider => slider
                .setLimits(0.0, 1.0, 0.05)
                .setValue(this.plugin.settings.folderTone)
                .onChange(async (value) => {
                    this.plugin.settings.folderTone = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateDOMStyles();
                }));

        new Setting(containerEl)
            .setName('Link Highlight Color')
            .setDesc('Color for the linked files.')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.linkColor)
                .onChange(async (value) => {
                    this.plugin.settings.linkColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateDOMStyles();
                }));

        new Setting(containerEl)
            .setName('Link Highlight Tone (Opacity)')
            .setDesc('Opacity for the linked files background (0.0 to 1.0).')
            .addSlider(slider => slider
                .setLimits(0.0, 1.0, 0.05)
                .setValue(this.plugin.settings.linkTone)
                .onChange(async (value) => {
                    this.plugin.settings.linkTone = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateDOMStyles();
                }));

        new Setting(containerEl)
            .setName('Highlight Style Shape')
            .setDesc('Choose the shape/style of the highlight.')
            .addDropdown(drop => drop
                .addOption('straight', 'Straight Lines (Default)')
                .addOption('blob', 'Blob Shape')
                .addOption('strikethrough', 'Strikethrough')
                .setValue(this.plugin.settings.folderStyle)
                .onChange(async (value: 'straight' | 'blob' | 'strikethrough') => {
                    this.plugin.settings.folderStyle = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateDOMStyles();
                }));

        new Setting(containerEl)
            .setName('Color Indent Lines')
            .setDesc('Add color to the folder indentation lines leading from the file to the folder/links.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.colorIndentLines)
                .onChange(async (value) => {
                    this.plugin.settings.colorIndentLines = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateDOMStyles();
                }));

        new Setting(containerEl)
            .setName('Path Tracing')
            .setHeading();

        new Setting(containerEl)
            .setName('Trace folder path to root')
            .setDesc('Highlight every ancestor folder from the active file back to the vault root.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.traceFolderToRoot)
                .onChange(async (value) => {
                    this.plugin.settings.traceFolderToRoot = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateHighlights(this.plugin.app.workspace.getActiveFile());
                }));

        new Setting(containerEl)
            .setName('Trace linked file paths to root')
            .setDesc('Also highlight ancestor folders for linked files, tracing each link back to the vault root.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.traceLinkToRoot)
                .onChange(async (value) => {
                    this.plugin.settings.traceLinkToRoot = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateHighlights(this.plugin.app.workspace.getActiveFile());
                }));
    }
}
