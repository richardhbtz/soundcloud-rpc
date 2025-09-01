import { app, ipcMain } from 'electron';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';
import type ElectronStore from 'electron-store';

export interface CustomTheme {
    name: string;
    filePath: string;
    css: string;
}

export class ThemeService {
    private store: ElectronStore;
    private customThemes: Map<string, CustomTheme> = new Map();
    private currentCustomTheme: string | null = null;
    private themesPath: string;

    constructor(store: ElectronStore) {
        this.store = store;
        this.themesPath = join(app.getPath('userData'), 'themes');
        this.ensureThemesDirectory();
        this.loadCustomThemes();
        this.setupIpcHandlers();
        
        const savedTheme = this.store.get('customTheme') as string;
        if (savedTheme && this.customThemes.has(savedTheme)) {
            this.currentCustomTheme = savedTheme;
        }
    }

    private ensureThemesDirectory(): void {
        try {
            if (!existsSync(this.themesPath)) {
                require('fs').mkdirSync(this.themesPath, { recursive: true });
                console.log(`Created themes directory at: ${this.themesPath}`);
            }
        } catch (error) {
            console.error('Failed to create themes directory:', error);
        }
    }

    private loadCustomThemes(): void {
        try {
            if (!existsSync(this.themesPath)) {
                return;
            }

            const files = readdirSync(this.themesPath);
            
            for (const file of files) {
                const filePath = join(this.themesPath, file);
                const stat = statSync(filePath);
                
                if (stat.isFile() && extname(file).toLowerCase() === '.css') {
                    try {
                        const css = readFileSync(filePath, 'utf-8');
                        const themeName = basename(file, '.css');
                        
                        this.customThemes.set(themeName, {
                            name: themeName,
                            filePath,
                            css
                        });
                        
                        console.log(`Loaded custom theme: ${themeName}`);
                    } catch (error) {
                        console.error(`Failed to load theme ${file}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load custom themes:', error);
        }
    }

    private setupIpcHandlers(): void {
        ipcMain.handle('get-custom-themes', () => {
            return Array.from(this.customThemes.values()).map(theme => ({
                name: theme.name,
                filePath: theme.filePath
            }));
        });

        ipcMain.handle('get-current-custom-theme', () => {
            return this.currentCustomTheme;
        });

        ipcMain.handle('apply-custom-theme', (_, themeName: string) => {
            return this.applyCustomTheme(themeName);
        });

        ipcMain.handle('remove-custom-theme', () => {
            return this.removeCustomTheme();
        });

        ipcMain.handle('get-themes-folder-path', () => {
            return this.themesPath;
        });

        ipcMain.handle('refresh-custom-themes', () => {
            this.customThemes.clear();
            this.loadCustomThemes();
            return Array.from(this.customThemes.values()).map(theme => ({
                name: theme.name,
                filePath: theme.filePath
            }));
        });
    }

    public applyCustomTheme(themeName: string): boolean {
        try {
            if (themeName === 'none') {
                return this.removeCustomTheme();
            }

            const theme = this.customThemes.get(themeName);
            if (!theme) {
                console.error(`Theme ${themeName} not found`);
                return false;
            }

            this.currentCustomTheme = themeName;
            this.store.set('customTheme', themeName);
            
            console.log(`Applied custom theme: ${themeName}`);
            return true;
        } catch (error) {
            console.error('Failed to apply custom theme:', error);
            return false;
        }
    }

    public removeCustomTheme(): boolean {
        try {
            this.currentCustomTheme = null;
            this.store.delete('customTheme');
            
            console.log('Removed custom theme');
            return true;
        } catch (error) {
            console.error('Failed to remove custom theme:', error);
            return false;
        }
    }

    public getCurrentCustomThemeCSS(): string | null {
        if (!this.currentCustomTheme) {
            return null;
        }

        const theme = this.customThemes.get(this.currentCustomTheme);
        return theme ? theme.css : null;
    }

    public getThemesPath(): string {
        return this.themesPath;
    }

    public getAvailableThemes(): CustomTheme[] {
        return Array.from(this.customThemes.values());
    }

    public refreshThemes(): void {
        this.customThemes.clear();
        this.loadCustomThemes();
    }
}
