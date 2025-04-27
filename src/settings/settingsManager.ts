import { BrowserView, BrowserWindow } from 'electron';
import type ElectronStore = require('electron-store');

export class SettingsManager {
    private view: BrowserView;
    private isVisible = false;
    private parentWindow: BrowserWindow;
    private store: ElectronStore;

    constructor(parentWindow: BrowserWindow, store: ElectronStore) {
        this.parentWindow = parentWindow;
        this.store = store;
        this.view = new BrowserView({
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
        });

        // Add view immediately but keep it off-screen
        this.parentWindow.addBrowserView(this.view);
        this.view.setBounds({ x: 0, y: -10000, width: 0, height: 0 });

        // Add resize listener
        this.parentWindow.on('resize', () => {
            if (this.isVisible) {
                this.updateBounds();
            }
        });

        // Preload content
        this.view.webContents.loadURL(`data:text/html,${encodeURIComponent(this.getHtml())}`);
    }

    public toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    private updateBounds(): void {
        const bounds = this.parentWindow.getBounds();
        const width = Math.min(500, Math.floor(bounds.width * 0.4)); // 40% of window width, max 500px

        this.view.setBounds({
            x: bounds.width - width,
            y: 0,
            width,
            height: bounds.height
        });
    }

    private getHtml(): string {
        return `
        <style>
            @font-face {
                font-family: 'SC-Font';
                src: url('https://assets.web.soundcloud.cloud/_next/static/media/a34f9d1faa5f3315-s.p.woff2') format('woff2');
                font-weight: bold;
                font-style: normal;
                font-display: swap;
            }
            * {
                font-family: 'SC-Font', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            body {
                margin: 0;
                background-color: #1a1a1a;
                color: white;
                padding: 20px 24px;
                overflow-y: auto;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                letter-spacing: 0.01em;
            }
            .settings-panel {
                max-width: 100%;
                margin-bottom: 40px;
                padding-right: 14px; /* Additional padding for scrollbar */
            }
            .setting-group {
                margin-bottom: 20px;
                padding: 15px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
            }
            h2 {
                margin-top: 0;
                color: #ffffff;
                font-size: 1.2em;
            }
            .header-with-icon {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .header-with-icon svg {
                width: 24px;
                height: 24px;
                fill: #ffffff;
            }
            .setting-item {
                margin: 15px 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 15px;
            }
            .setting-item span {
                flex: 1;
                font-size: 0.9em;
                color: white; /* Make labels white */
            }
            .toggle {
                position: relative;
                display: inline-block;
                width: 50px;
                height: 26px;
                flex-shrink: 0;
            }
            .toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #333;
                transition: .4s;
                border-radius: 26px;
            }
            .slider:before {
                position: absolute;
                content: "";
                height: 20px;
                width: 20px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            input:checked + .slider {
                background-color: #ff5500;
            }
            input:checked + .slider:before {
                transform: translateX(24px);
            }
            @media (max-width: 300px) {
                .setting-item {
                    flex-direction: column;
                    align-items: flex-start;
                }
                .toggle {
                    margin-top: 5px;
                }
            }
            .settings-group hr {
                border: none;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                margin: 15px 0;
            }
            .button {
                background: white; /* Make buttons white */
                color: #1a1a1a; /* Button text color */
                border: none;
                padding: 8px 15px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9em;
                transition: background 0.2s;
            }
            .button:hover {
                background: #e0e0e0; /* Slightly darker hover effect */
            }
            .button.danger {
                background: #d32f2f;
                color: white;
            }
            .button.danger:hover {
                background: #f44336;
            }
            .setting-item.buttons {
                justify-content: flex-start;
                gap: 10px;
            }
            .description {
                font-size: 0.8em;
                color: rgba(255, 255, 255, 0.6);
                margin-top: 4px;
            }
            .textInput {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                background: rgba(0, 0, 0, 0.2);
                color: white;
                font-size: 14px;
                margin-top: 5px;
            }
            .textInput:focus {
                outline: none;
                border-color: #ff5500;
            }
            .link {
                color: #ff5500;
                text-decoration: none;
            }
            .link:hover {
                text-decoration: underline;
            }
        </style>
        <div class="settings-panel">
            <div class="setting-group">
                <h2>Adblocker</h2>
                <div class="setting-item">
                    <span>Enable AdBlocker</span>
                    <label class="toggle">
                        <input type="checkbox" id="adBlocker" ${this.store.get('adBlocker') ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="description">Changes require app restart</div>
            </div>

            <div class="setting-group">
                <h2>Proxy</h2>
                <div class="setting-item">
                    <span>Enable Proxy</span>
                    <label class="toggle">
                        <input type="checkbox" id="proxyEnabled" ${this.store.get('proxyEnabled') ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item" id="proxyFields" style="display: ${this.store.get('proxyEnabled') ? 'block' : 'none'}">
                    <input type="text" 
                        class="textInput" 
                        id="proxyHost" 
                        placeholder="Proxy Host"
                        value="${this.store.get('proxyHost') || ''}">
                    <input type="text" 
                        class="textInput" 
                        id="proxyPort" 
                        placeholder="Proxy Port"
                        value="${this.store.get('proxyPort') || ''}">
                </div>
            </div>

            <div class="setting-group">
                <h2 class="header-with-icon">
                    Last.fm
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M10.599 17.211l-.881-2.393s-1.433 1.596-3.579 1.596c-1.9 0-3.249-1.652-3.249-4.296 0-3.385 1.708-4.596 3.388-4.596 2.418 0 3.184 1.568 3.845 3.578l.871 2.751c.87 2.672 2.508 4.818 7.238 4.818 3.386 0 5.673-1.037 5.673-3.77 0-2.209-1.258-3.358-3.595-3.906l-1.738-.381c-1.193-.274-1.546-.763-1.546-1.59 0-.934.736-1.485 1.937-1.485 1.313 0 2.024.488 2.14 1.652l2.745-.33c-.225-2.511-1.937-3.541-4.745-3.541-2.479 0-4.897.934-4.897 3.947 0 1.877.902 3.063 3.172 3.608l1.871.439c1.402.332 1.866.916 1.866 1.713 0 1.021-.992 1.441-2.869 1.441-2.779 0-3.936-1.457-4.596-3.469l-.901-2.75c-1.156-3.574-3.004-4.896-6.669-4.896C2.147 5.297 0 7.802 0 12.244c0 4.325 2.208 6.638 6.169 6.638 3.193 0 4.43-1.671 4.43-1.671z"/>
                    </svg>
                </h2>
                <div class="setting-item">
                    <span>Enable Last.fm scrobbling</span>
                    <label class="toggle">
                        <input type="checkbox" id="lastFmEnabled" ${this.store.get('lastFmEnabled') ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item" id="lastFmFields" style="display: ${this.store.get('lastFmEnabled') ? 'block' : 'none'}">
                    <input type="text" 
                        class="textInput" 
                        id="lastFmApiKey" 
                        placeholder="Last.fm API Key"
                        value="${this.store.get('lastFmApiKey') || ''}">
                    <input type="password" 
                        class="textInput" 
                        id="lastFmSecret" 
                        placeholder="Last.fm API Secret"
                        value="${this.store.get('lastFmSecret') || ''}">
                </div>
                <div class="description">
                    <a href="#" id="createLastFmApiKey" class="link">Create API Key</a>
                    - No callback URL needed
                </div>
            </div>

            <div class="setting-group">
                <h2 class="header-with-icon">
                    Discord
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.707 18.707 0 0 0-5.487 0 12.505 12.505 0 0 0-.617-1.249.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.369a.07.07 0 0 0-.032.027C.533 9.045-.32 13.579.099 18.057a.082.082 0 0 0 .031.056 19.911 19.911 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.464-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.105 13.184 13.184 0 0 1-1.872-.9.077.077 0 0 1-.008-.128c.126-.094.252-.192.373-.291a.075.075 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.122.099.247.197.374.291a.077.077 0 0 1-.006.128 12.509 12.509 0 0 1-1.873.899.076.076 0 0 0-.04.106c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.028 19.876 19.876 0 0 0 6.002-3.03.077.077 0 0 0 .031-.056c.5-5.177-.838-9.665-3.546-13.661a.067.067 0 0 0-.033-.027zM8.02 15.331c-1.182 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.213 0 2.187 1.096 2.156 2.419 0 1.333-.955 2.418-2.156 2.418zm7.974 0c-1.182 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.213 0 2.187 1.096 2.156 2.419 0 1.333-.943 2.418-2.156 2.418z"/>
                    </svg>
                </h2>
                <div class="setting-item">
                    <span>Enable Discord Rich Presence</span>
                    <label class="toggle">
                        <input type="checkbox" id="discordRichPresence" ${this.store.get('discordRichPresence') ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <span>Show status when paused</span>
                    <label class="toggle">
                        <input type="checkbox" id="displayWhenIdling" ${this.store.get('displayWhenIdling') ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <span>Show SoundCloud icon</span>
                    <label class="toggle">
                        <input type="checkbox" id="displaySCSmallIcon" ${this.store.get('displaySCSmallIcon') ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
            <div class="setting-group">
                <button class="button" id="applyChanges" style="width: 100%;">Apply Changes</button>
            </div>
        </div>
        <script>
            const { ipcRenderer, shell } = require('electron');

            // Toggle visibility of Proxy fields
            document.getElementById('proxyEnabled').addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                document.getElementById('proxyFields').style.display = isEnabled ? 'block' : 'none';
                ipcRenderer.send('setting-changed', { key: 'proxyEnabled', value: isEnabled });
            });

            // Handle proxy host and port changes
            document.getElementById('proxyHost').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'proxyHost', value: e.target.value });
            });

            document.getElementById('proxyPort').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'proxyPort', value: e.target.value });
            });

            // Toggle visibility of Last.fm fields
            document.getElementById('lastFmEnabled').addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                document.getElementById('lastFmFields').style.display = isEnabled ? 'block' : 'none';
                ipcRenderer.send('setting-changed', { key: 'lastFmEnabled', value: isEnabled });
            });

            // Handle Last.fm API key and secret changes
            document.getElementById('lastFmApiKey').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'lastFmApiKey', value: e.target.value });
            });

            document.getElementById('lastFmSecret').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'lastFmSecret', value: e.target.value });
            });

            // Open Last.fm API key creation link in the user's default browser
            document.getElementById('createLastFmApiKey').addEventListener('click', (e) => {
                e.preventDefault();
                shell.openExternal('https://www.last.fm/api/account/create');
            });

            // Basic settings
            document.getElementById('displayWhenIdling').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'displayWhenIdling', value: e.target.checked });
            });

            document.getElementById('displaySCSmallIcon').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'displaySCSmallIcon', value: e.target.checked });
            });

            document.getElementById('adBlocker').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'adBlocker', value: e.target.checked });
            });

            // Discord settings
            document.getElementById('discordRichPresence').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'discordRichPresence', value: e.target.checked });
            });

            // Apply all changes
            document.getElementById('applyChanges').addEventListener('click', () => {
                ipcRenderer.send('apply-changes');
            });

            // Discord settings
            document.getElementById('reconnectDiscord').addEventListener('click', () => {
                ipcRenderer.send('reconnect-discord');
            });
        </script>`;
    }

    private show(): void {
        this.isVisible = true;
        this.updateBounds();
    }

    private hide(): void {
        this.isVisible = false;
        this.view.setBounds({ x: 0, y: -10000, width: 0, height: 0 });
    }
}
