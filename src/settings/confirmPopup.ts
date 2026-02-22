import { BrowserView, BrowserWindow, ipcMain } from 'electron';

let confirmPopupView: BrowserView | null = null;
const devMode = process.argv.includes('--dev');

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateHomepageConfirmBounds(mainWindow: BrowserWindow): void {
    if (!mainWindow || !confirmPopupView) return;
    const { width, height } = mainWindow.getContentBounds();
    confirmPopupView.setBounds({ x: 0, y: 0, width, height });
}

export async function showHomepageConfirmDialog(mainWindow: BrowserWindow, url: string): Promise<boolean> {
    if (!mainWindow) return false;

    if (confirmPopupView) {
        mainWindow.removeBrowserView(confirmPopupView);
        (confirmPopupView as any).webContents.destroy();
        confirmPopupView = null;
    }

    const requestId = `homepage-confirm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const safeUrl = escapeHtml(url);

    confirmPopupView = new BrowserView({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false,
            spellcheck: false,
            devTools: devMode,
            affinity: 'ui',
        },
    });

    mainWindow.addBrowserView(confirmPopupView);
    updateHomepageConfirmBounds(mainWindow);
    confirmPopupView.setAutoResize({ width: true, height: true });

    const html = `
        <style>
            @font-face {
                font-family: 'SC-Font';
                src: url('https://assets.web.soundcloud.cloud/_next/static/media/a34f9d1faa5f3315-s.p.woff2') format('woff2');
                font-weight: bold;
                font-style: normal;
                font-display: swap;
            }
            * {
                box-sizing: border-box;
                font-family: 'SC-Font', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            body {
                margin: 0;
                width: 100vw;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.65);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                color: #ffffff;
                opacity: 0;
                transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
                user-select: none;
            }
            .dialog {
                width: min(520px, 90vw);
                background: #303030;
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
                transform: translateY(6px) scale(0.98);
                transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            body.visible {
                opacity: 1;
            }
            body.visible .dialog {
                transform: translateY(0) scale(1);
            }
            .title {
                font-size: 16px;
                font-weight: 700;
                margin-bottom: 8px;
            }
            .subtitle {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.78);
                margin-bottom: 12px;
            }
            .url {
                font-size: 12px;
                color: #7cc5ff;
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 6px;
                padding: 10px;
                word-break: break-all;
                margin-bottom: 16px;
            }
            .actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }
            button {
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                padding: 7px 14px;
                background: rgba(255, 255, 255, 0.08);
                color: #ffffff;
                font-size: 12px;
                cursor: pointer;
            }
            button:hover {
                background: rgba(255, 255, 255, 0.16);
            }
            .confirm {
                border-color: #ffffff;
                background: #ffffff;
                color: #1d1d1d;
            }
            .confirm:hover {
                background: #f3f3f3;
            }
        </style>
        <body>
            <div class="dialog" role="dialog" aria-modal="true" aria-label="Open Plugin Homepage">
                <div class="title">Open Plugin Homepage</div>
                <div class="subtitle">Are you sure you want to open this URL in your browser?</div>
                <div class="url">${safeUrl}</div>
                <div class="actions">
                    <button id="cancelBtn" type="button">Cancel</button>
                    <button id="confirmBtn" class="confirm" type="button">Open in Browser</button>
                </div>
            </div>
            <script>
                const { ipcRenderer } = require('electron');
                requestAnimationFrame(() => {
                    document.body.classList.add('visible');
                });

                function submit(result) {
                    ipcRenderer.send('homepage-confirm-result', { requestId: '${requestId}', result });
                }

                document.getElementById('cancelBtn').addEventListener('click', () => submit(false));
                document.getElementById('confirmBtn').addEventListener('click', () => submit(true));
                document.body.addEventListener('click', (event) => {
                    if (event.target === document.body) {
                        submit(false);
                    }
                });
                document.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape') {
                        submit(false);
                    }
                    if (event.key === 'Enter') {
                        submit(true);
                    }
                });
            </script>
        </body>
    `;

    await confirmPopupView.webContents.loadURL(`data:text/html,${encodeURIComponent(html)}`);
    confirmPopupView.webContents.focus();

    return new Promise((resolve) => {
        ipcMain.once('homepage-confirm-result', (_event, data: { requestId: string; result: boolean }) => {
            if (data?.requestId !== requestId) {
                resolve(false);
                return;
            }

            if (confirmPopupView && mainWindow) {
                mainWindow.removeBrowserView(confirmPopupView);
                (confirmPopupView as any).webContents.destroy();
                confirmPopupView = null;
            }
            resolve(!!data.result);
        });
    });
}

export function updateDialogBounds(mainWindow: BrowserWindow): void {
    updateHomepageConfirmBounds(mainWindow);
}
