import { BrowserView, BrowserWindow, ipcMain } from 'electron';
import type { ThemeColors } from '../utils/colorExtractor';

export class NotificationManager {
    private view: BrowserView;
    private queue: string[] = [];
    private isDisplaying = false;
    private parentWindow: BrowserWindow;
    private themeColors: ThemeColors | null = null;

    constructor(parentWindow: BrowserWindow) {
        this.parentWindow = parentWindow;
        this.view = new BrowserView({
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                transparent: true,
            },
        });
    }

    public setThemeColors(colors: ThemeColors | null): void {
        this.themeColors = colors;
    }

    public show(message: string): void {
        this.queue.push(message);
        if (!this.isDisplaying) {
            this.displayNext();
        }
    }

    private displayNext(): void {
        if (this.queue.length === 0) {
            this.isDisplaying = false;
            this.parentWindow.removeBrowserView(this.view);
            return;
        }

        this.isDisplaying = true;
        const message = this.queue.shift();
        const bounds = this.parentWindow.getBounds();
        const width = 400; // increased from 300
        const height = 70; // increased from 50

        this.parentWindow.addBrowserView(this.view);
        this.view.setBounds({
            x: Math.floor((bounds.width - width) / 2),
            y: bounds.height - height - 100, // increased from 20 to move it up
            width,
            height,
        });

        // Use theme colors if available
        const backgroundColor = this.themeColors?.surface || '#303030';
        const textColor = this.themeColors?.text || '#ffffff';

        const html = `
        <style>
            body {
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: transparent;
                color: ${textColor};
                height: 100vh;
                opacity: 0;
                transition: opacity 0.3s ease-in-out;
                overflow: hidden;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
            .notification {
                padding: 15px 25px;
                border-radius: 12px;
                font-size: 18px;
                font-weight: 600;
                text-align: center;
                transform: translateY(0);
                transition: transform 0.3s ease-in-out;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 90%;
                user-select: none;
                -webkit-user-select: none;
                background: ${backgroundColor};
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            body.fade-out .notification {
                transform: translateY(10px);
            }
        </style>
        <body>
            <div class="notification">${message}</div>
            <script>
                setTimeout(() => document.body.style.opacity = '1', 100);
                setTimeout(() => {
                    document.body.classList.add('fade-out');
                    document.body.style.opacity = '0';
                    setTimeout(() => {
                        const { ipcRenderer } = require('electron');
                        ipcRenderer.send('notification-done');
                    }, 300);
                }, 4500);
            </script>
        </body>`;

        // Set up one-time IPC listener for this notification
        ipcMain.once('notification-done', () => {
            setTimeout(() => this.displayNext(), 100);
        });

        this.view.webContents.loadURL(`data:text/html,${encodeURIComponent(html)}`);
    }
}
