import { BrowserWindow } from 'electron';
import type ElectronStore = require('electron-store');
import { authenticateLastFm } from './lastfm';

async function createAuthWindow(parentWindow: BrowserWindow): Promise<{apiKey: string, apiSecret: string}> {
    const authWindow = new BrowserWindow({
        width: 400,
        height: 600,
        parent: parentWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    const htmlContent = `<!DOCTYPE html>
        <html>
        <head>
            <title>Last.fm API Configuration</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    padding: 20px;
                    color: #333;
                }
                .container {
                    max-width: 350px;
                    margin: 0 auto;
                }
                h2 {
                    color: #333;
                    text-align: center;
                }
                .form-group {
                    margin-bottom: 15px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                button {
                    width: 100%;
                    padding: 10px;
                    background-color: #1db954;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    margin-top: 10px;
                }
                button:hover {
                    background-color: #1ed760;
                }
                .api-link {
                    text-align: center;
                    margin-top: 20px;
                }
                .api-link a {
                    color: #1db954;
                    text-decoration: none;
                }
                .api-link a:hover {
                    text-decoration: underline;
                }
                .error {
                    color: #d32f2f;
                    font-size: 14px;
                    margin-top: 5px;
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Last.fm API Configuration</h2>
                <form id="apiForm">
                    <div class="form-group">
                        <label for="apiKey">API Key:</label>
                        <input type="text" id="apiKey" placeholder="Enter your Last.fm API key">
                        <div id="apiKeyError" class="error">API key is required</div>
                    </div>
                    <div class="form-group">
                        <label for="apiSecret">API Secret:</label>
                        <input type="password" id="apiSecret" placeholder="Enter your Last.fm API secret">
                        <div id="apiSecretError" class="error">API secret is required</div>
                    </div>
                    <button type="submit">Save Configuration</button>
                </form>
                <div class="api-link">
                    <p>Don't have an API key?</p>
                    <a href="https://www.last.fm/api/account/create" id="createApiLink" target="_blank">Create one on Last.fm</a>
                    <p>Just fill in the form and click "Submit", you don't need to fill callback url or application homepage.</p>
                </div>
            </div>
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    const apiForm = document.getElementById('apiForm');
                    const apiKey = document.getElementById('apiKey');
                    const apiSecret = document.getElementById('apiSecret');

                    apiForm.addEventListener('submit', (event) => {
                        event.preventDefault();
                        
                        if (!apiKey.value || !apiSecret.value) {
                            alert("Both API Key and Secret are required");
                            return;
                        }

                        // Pass the credentials back to the main process via URL
                        const data = {
                            apiKey: apiKey.value,
                            apiSecret: apiSecret.value
                        };

                        window.location.href = 'about:blank#' + encodeURIComponent(JSON.stringify(data));
                    });
                });            
            </script>
        </body>
        </html>
    `;

    await authWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    return new Promise((resolve) => {
        authWindow.webContents.on('did-navigate', () => {
            try {
                const url = authWindow.webContents.getURL();
                if (url.includes('about:blank#')) {
                    const hash = decodeURIComponent(url.split('#')[1]);
                    const data = JSON.parse(hash);
                    resolve(data);
                    authWindow.close();
                }
            } catch (error) {
                console.error('Error parsing authentication data:', error);
            }
        });
        authWindow.on('close', () => {
            resolve(null);
        });
    });
}

async function setupLastFmConfig(mainWindow: BrowserWindow, store: ElectronStore) {
    const config = await createAuthWindow(mainWindow);
    if (config) {
        store.set('lastFmApiKey', config.apiKey);
        store.set('lastFmSecret', config.apiSecret);
        authenticateLastFm(mainWindow, store);
    } else {
        console.log('User cancelled Last.fm authentication');
    }
}

export { setupLastFmConfig };
