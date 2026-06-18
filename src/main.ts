import { Plugin, TFile, WorkspaceLeaf, PluginSettingTab, App, Setting } from 'obsidian';

interface HighlightPluginSettings {
    folderColor: string;
    folderTone: number; // 0.0 to 1.0
    linkColor: string;
    linkTone: number; // 0.0 to 1.0
    folderStyle: 'straight' | 'blob' | 'strikethrough';
    colorIndentLines: boolean;
}

const DEFAULT_SETTINGS: HighlightPluginSettings = {
    folderColor: '#6e59d9',
    folderTone: 0.2,
    linkColor: '#6e59d9',
    linkTone: 0.08,
    folderStyle: 'straight',
    colorIndentLines: true
}

function hexToRgb(hex: string) {
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
        console.log('loading HighlightPlugin');

        await this.loadSettings();
        this.addSettingTab(new HighlightSettingTab(this.app, this));
        this.updateDOMStyles();

        // Register an event listener for file-open
        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                this.updateHighlights(file);
            })
        );
        
        // Listen to metadata cache changes (e.g. links updated)
        this.registerEvent(
            this.app.metadataCache.on('resolved', () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    this.updateHighlights(file);
                }
            })
        );
        
        // Wait until layout is ready before highlighting
        this.app.workspace.onLayoutReady(() => {
            const file = this.app.workspace.getActiveFile();
            if (file) {
                this.updateHighlights(file);
            }
        });
    }

    onunload() {
        console.log('unloading HighlightPlugin');
        this.clearHighlights();
        
        // Clean up body classes
        const body = document.body;
        body.classList.remove('obsidian-highlight-style-straight', 'obsidian-highlight-style-blob', 'obsidian-highlight-style-strikethrough', 'obsidian-highlight-indent-lines');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    updateDOMStyles() {
        const body = document.body;
        body.style.setProperty('--obsidian-highlight-folder-rgb', hexToRgb(this.settings.folderColor));
        body.style.setProperty('--obsidian-highlight-folder-hex', this.settings.folderColor);
        body.style.setProperty('--obsidian-highlight-folder-tone', this.settings.folderTone.toString());

        body.style.setProperty('--obsidian-highlight-link-rgb', hexToRgb(this.settings.linkColor));
        body.style.setProperty('--obsidian-highlight-link-hex', this.settings.linkColor);
        body.style.setProperty('--obsidian-highlight-link-tone', this.settings.linkTone.toString());

        body.classList.remove('obsidian-highlight-style-straight', 'obsidian-highlight-style-blob', 'obsidian-highlight-style-strikethrough', 'obsidian-highlight-indent-lines');
        body.classList.add(`obsidian-highlight-style-${this.settings.folderStyle}`);
        if (this.settings.colorIndentLines) {
            body.classList.add('obsidian-highlight-indent-lines');
        }
    }

    updateHighlights(activeFile: TFile | null) {
        this.clearHighlights();
        if (!activeFile) return;

        const fileExplorers = this.app.workspace.getLeavesOfType("file-explorer");
        if (fileExplorers.length === 0) return;

        // Find linked files (outlinks and backlinks)
        const linkedPaths = new Set<string>();
        
        // Outlinks (forward links)
        const cache = this.app.metadataCache.getFileCache(activeFile);
        if (cache && cache.links) {
            cache.links.forEach(link => {
                const destFile = this.app.metadataCache.getFirstLinkpathDest(link.link, activeFile.path);
                if (destFile) {
                    linkedPaths.add(destFile.path);
                }
            });
        }
        
        // Backlinks (incoming links)
        // @ts-ignore
        const resolvedLinks = this.app.metadataCache.resolvedLinks;
        for (const sourcePath in resolvedLinks) {
            const destLinks = resolvedLinks[sourcePath];
            if (destLinks && destLinks[activeFile.path] !== undefined) {
                linkedPaths.add(sourcePath);
            }
        }

        const parentFolder = activeFile.parent;
        const parentPath = parentFolder ? parentFolder.path : null;

        // Update DOM for each file explorer instance
        fileExplorers.forEach((leaf: WorkspaceLeaf) => {
            // @ts-ignore
            const fileItems = leaf.view.fileItems;
            if (!fileItems) return;

            Object.entries(fileItems).forEach(([path, fileItem]) => {
                // @ts-ignore
                const el = fileItem.selfEl as HTMLElement;
                if (!el) return;

                const containerEl = el.parentElement; // The .tree-item wrapper

                if (parentPath && path === parentPath && path !== '/') {
                    el.classList.add('plugin-active-folder');
                    if (containerEl) containerEl.classList.add('plugin-active-folder-container');
                } else if (linkedPaths.has(path)) {
                    el.classList.add('plugin-linked-file');
                    if (containerEl) containerEl.classList.add('plugin-linked-file-container');
                }
            });
        });
    }

    clearHighlights() {
        const fileExplorers = this.app.workspace.getLeavesOfType("file-explorer");
        fileExplorers.forEach((leaf: WorkspaceLeaf) => {
            // @ts-ignore
            const fileItems = leaf.view.fileItems;
            if (!fileItems) return;
            
            Object.values(fileItems).forEach((fileItem: any) => {
                const el = fileItem.selfEl as HTMLElement;
                if (el) {
                    el.classList.remove('plugin-active-folder', 'plugin-linked-file');
                    const containerEl = el.parentElement;
                    if (containerEl) {
                        containerEl.classList.remove('plugin-active-folder-container', 'plugin-linked-file-container');
                    }
                }
            });
        });
    }
}

class HighlightSettingTab extends PluginSettingTab {
    plugin: HighlightPlugin;

    constructor(app: App, plugin: HighlightPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl('h2', {text: 'File Explorer Highlight Settings'});

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
                .setDynamicTooltip()
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
                .setDynamicTooltip()
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
    }
}
