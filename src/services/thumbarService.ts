import { BrowserView, BrowserWindow, nativeImage } from 'electron';
import * as path from 'path';
import { TranslationService } from './translationService';
import { RESOURCES_PATH } from '../main';
export class ThumbarService {
    private translationService: TranslationService;

    constructor(translationService: TranslationService) {
        this.translationService = translationService;
    }

    public updateThumbarButtons(win: BrowserWindow | null, isPlaying: boolean, mainWindow: BrowserView | null): void {
        if (!win || !mainWindow) return;
        const backwardIcon = nativeImage.createFromPath(path.join(RESOURCES_PATH, '/icons/backward.ico'));
        const playIcon = nativeImage.createFromPath(path.join(RESOURCES_PATH, '/icons/play.ico'));
        const pauseIcon = nativeImage.createFromPath(path.join(RESOURCES_PATH, '/icons/pause.ico'));
        const forwardIcon = nativeImage.createFromPath(path.join(RESOURCES_PATH, '/icons/forward.ico'));
        const buttons = [
            {
                tooltip: this.translationService.translate('previous'),
                icon: backwardIcon,
                click: () => {
                    mainWindow.webContents.executeJavaScript(`
                        document.querySelector('.skipControl__previous')?.click();
                    `);
                },
            },
            {
                tooltip: isPlaying
                    ? this.translationService.translate('pause')
                    : this.translationService.translate('play'),
                icon: isPlaying ? pauseIcon : playIcon,
                click: () => {
                    isPlaying = !isPlaying;
                    mainWindow.webContents.executeJavaScript(`
                        document.querySelector('.playControl')?.click();
                    `);
                    buttons[1].tooltip = isPlaying
                        ? this.translationService.translate('pause')
                        : this.translationService.translate('play');
                },
            },
            {
                tooltip: this.translationService.translate('next'),
                icon: forwardIcon,
                click: () => {
                    mainWindow.webContents.executeJavaScript(`
                        document.querySelector('.skipControl__next')?.click();
                    `);
                },
            },
        ];
        win.setThumbarButtons(buttons);
    }
}
