import { BrowserView, BrowserWindow } from 'electron';
import type ElectronStore = require('electron-store');
import { TranslationService, type TranslationKeys } from '../services/translationService';
import type { ThemeColors } from '../utils/colorExtractor';
import { applyNavigationPolicy } from '../utils/navigationPolicy';
import { appUrl, cspMetaTag, provideDocument } from '../utils/appProtocol';
import { markTrustedSender } from '../utils/ipcGuard';
import { escapeHtml } from '../utils/escapeHtml';
import { readSecret } from '../utils/secretStore';
import { DEFAULT_TEMPLATE } from '../utils/ytdlp';
import { downloadFolder } from '../downloads/downloadManager';
import { join } from 'path';

const isMac = process.platform === 'darwin';
const HEADER_HEIGHT = 32;
// the slide-out transition in settingsPanel.css
const HIDE_MS = 150;
const OFF_SCREEN = { x: 0, y: -10000, width: 0, height: 0 };

export class SettingsManager {
    private view: BrowserView | null = null;
    private isVisible = false;
    private parentWindow: BrowserWindow;
    private store: ElectronStore;
    private translationService: TranslationService;
    private devMode = process.argv.includes('--dev');
    // key returned by insertCSS for the current theme-colour stylesheet
    private themeColorCssKey: string | null = null;

    constructor(parentWindow: BrowserWindow, store: ElectronStore, translationService: TranslationService) {
        this.parentWindow = parentWindow;
        this.store = store;
        this.translationService = translationService;

        // the view itself is only built on first open
        this.parentWindow.on('resize', () => {
            if (this.isVisible) this.updateBounds();
        });
    }

    public toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    private createView(): BrowserView {
        if (this.view) return this.view;

        this.view = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true,
                allowRunningInsecureContent: false,
                nodeIntegrationInSubFrames: false,
                nodeIntegrationInWorker: false,
                preload: join(__dirname, 'settingsPreload.js'),
                devTools: this.devMode,
                ...(isMac ? { spellcheck: false } : {}),
            },
        });

        applyNavigationPolicy(this.view.webContents);
        markTrustedSender(this.view.webContents);

        // add view immediately but keep off-screen until shown
        this.parentWindow.addBrowserView(this.view);
        this.view.setBounds(OFF_SCREEN);

        provideDocument('settings', () => this.getHtml());
        this.view.webContents.loadURL(appUrl('settings'));

        return this.view;
    }

    private teardownView(): void {
        if (!this.view) return;
        try {
            this.parentWindow.removeBrowserView(this.view);
        } catch {}
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.view.webContents as any).destroy();
        } catch {}
        this.view = null;
    }

    // A sidebar on the right: about 38% of the window, held between 360 and 460px, and the whole
    // window once it is too narrow to share.
    private updateBounds(): void {
        if (!this.view) return;
        const { width, height } = this.parentWindow.getContentBounds();
        const panelWidth = Math.min(width, Math.max(360, Math.min(460, Math.round(width * 0.38))));

        this.view.setBounds({
            x: width - panelWidth,
            y: HEADER_HEIGHT,
            width: panelWidth,
            height: height - HEADER_HEIGHT,
        });
    }

    private getHtml(): string {
        const { store } = this;
        const t = (key: TranslationKeys) => this.translationService.translate(key);
        // settingsPanel.js re-translates anything carrying data-i18n when the language changes
        const text = (key: TranslationKeys, tag = 'span', className = '') =>
            `<${tag}${className ? ` class="${className}"` : ''} data-i18n="${key}">${t(key)}</${tag}>`;
        const hint = (key: TranslationKeys) => text(key, 'p', 'hint');
        const section = (key: TranslationKeys, body: string) => `<section>${text(key, 'h2')}${body}</section>`;
        const toggle = (id: string, key: TranslationKeys, checked: unknown) => `
            <label class="row">
                ${text(key)}
                <span class="toggle">
                    <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
                    <span class="slider"></span>
                </span>
            </label>`;
        const input = (id: string, key: TranslationKeys, value: unknown, type = 'text') =>
            `<input type="${type}" class="textInput" id="${id}" spellcheck="false" placeholder="${t(key)}"
                data-i18n-placeholder="${key}" value="${escapeHtml(value)}">`;
        const button = (id: string, key: TranslationKeys) =>
            `<button type="button" class="btn" id="${id}" data-i18n="${key}">${t(key)}</button>`;
        const shownIf = (on: unknown) => `style="display: ${on ? 'block' : 'none'}"`;

        const general = `
            ${toggle('minimizeToTray', 'minimizeToTray', store.get('minimizeToTray', true))}
            ${toggle('navigationControlsEnabled', 'enableNavigationControls', store.get('navigationControlsEnabled', false))}
            ${toggle('autoUpdaterEnabled', 'enableAutoUpdater', store.get('autoUpdaterEnabled', true))}
            ${toggle('trackParserEnabled', 'enableTrackParser', store.get('trackParserEnabled', true))}
            ${hint('trackParserDescription')}`;

        const appearance = `
            ${toggle('darkMode', 'darkMode', store.get('theme', 'dark') !== 'light')}
            ${toggle('hidePromotions', 'hidePromotions', store.get('hidePromotions', true))}
            ${toggle('hideEventsNearYou', 'hideEventsNearYou', store.get('hideEventsNearYou', true))}
            ${toggle('hideArtistUpsells', 'hideArtistUpsells', store.get('hideArtistUpsells', true))}
            <div class="row">
                ${text('selectCustomTheme')}
                <select id="customThemeSelector">
                    <option value="none" data-i18n="noTheme">${t('noTheme')}</option>
                </select>
            </div>
            <div class="buttons">
                ${button('openThemesFolder', 'openThemesFolder')}
                ${button('refreshThemes', 'refreshThemes')}
            </div>
            ${hint('customThemeDescription')}`;

        const downloads = `
            ${toggle('downloadButtonEnabled', 'showDownloadButton', store.get('downloadButtonEnabled', true))}
            ${toggle('downloadUseAccount', 'downloadUseAccount', store.get('downloadUseAccount', true))}
            <label class="field">
                ${text('downloadTemplate')}
                <input type="text" class="textInput" id="downloadTemplate" spellcheck="false" value="${escapeHtml(
                    store.get('downloadTemplate', DEFAULT_TEMPLATE),
                )}">
            </label>
            <div class="row">
                ${text('downloadFolder')}
                <div class="buttons">
                    ${button('chooseDownloadFolder', 'chooseFolder')}
                    ${button('openDownloadFolder', 'openFolder')}
                </div>
            </div>
            <p class="hint path" id="downloadFolderPath">${escapeHtml(downloadFolder(store))}</p>
            <div class="field">${input('ytDlpPath', 'ytDlpPath', store.get('ytDlpPath', ''))}</div>
            ${hint('downloadsDescription')}`;

        const accounts = `
            <div class="row">
                <span>Switch account</span>
                <div class="buttons">
                    <select id="accountSelector"></select>
                    <button type="button" class="btn" id="addAccountBtn" title="Add account">+</button>
                </div>
            </div>
            <div class="buttons">
                <button type="button" class="btn danger" id="logoutBtn">Log out of current account</button>
            </div>
            <p class="hint">The app restarts to load the other session.</p>`;

        const discord = `
            ${toggle('discordRichPresence', 'enableRichPresence', store.get('discordRichPresence'))}
            ${toggle('displayWhenIdling', 'displayWhenPaused', store.get('displayWhenIdling'))}
            ${toggle('displaySCSmallIcon', 'displaySmallIcon', store.get('displaySCSmallIcon'))}
            ${toggle('displayButtons', 'displayButtons', store.get('displayButtons'))}
            ${toggle('useArtistInStatusLineToggle', 'useArtistInStatusLine', store.get('statusDisplayType') === 1)}
            ${toggle('richPresencePreviewEnabled', 'enableRichPresencePreview', store.get('richPresencePreviewEnabled', false))}
            ${hint('richPresencePreviewDescription')}
            <div class="discord-preview" id="presencePreviewContainer" ${shownIf(store.get('richPresencePreviewEnabled', false))}>
                <div id="activitySectionPreview">
                    <div class="no-activity-preview" id="noActivityPreview" data-i18n="noActivityToShow">
                        ${t('noActivityToShow')}
                    </div>
                </div>
            </div>`;

        const lastFm = `
            ${toggle('lastFmEnabled', 'enableLastFm', store.get('lastFmEnabled'))}
            <div class="subfields" id="lastFmFields" ${shownIf(store.get('lastFmEnabled'))}>
                ${input('lastFmApiKey', 'lastFmApiKey', readSecret(store, 'lastFmApiKey', ''))}
                ${input('lastFmSecret', 'lastFmApiSecret', readSecret(store, 'lastFmSecret', ''), 'password')}
            </div>
            <p class="hint">
                <a href="#" id="createLastFmApiKey" class="link" data-i18n="createApiKeyLastFm">${t('createApiKeyLastFm')}</a>
                - ${text('noCallbackUrl')}
            </p>`;

        const webhooks = `
            ${toggle('webhookEnabled', 'enableWebhooks', store.get('webhookEnabled'))}
            <div class="subfields" id="webhookFields" ${shownIf(store.get('webhookEnabled'))}>
                ${input('webhookUrl', 'webhookUrl', store.get('webhookUrl') || '', 'url')}
                <label class="row">
                    ${text('webhookTrigger')}
                    <span class="with-unit">
                        <input type="number" class="textInput" id="webhookTriggerPercentage" min="0" max="100" step="1"
                            value="${escapeHtml(store.get('webhookTriggerPercentage') || 50)}">
                        %
                    </span>
                </label>
            </div>
            ${hint('webhookDescription')}
            <details id="webhookFields2" ${shownIf(store.get('webhookEnabled'))}>
                ${text('showWebhookExample', 'summary')}
                <pre>{
  "timestamp": "2025-08-12T14:30:45.123Z",
  "artist": "Artist Name",
  "track": "Track Title",
  "duration": 240,
  "trackArt": "https://example.com/artwork.jpg",
  "originUrl": "https://soundcloud.com/track-url"
}</pre>
            </details>`;

        const network = `
            ${toggle('adBlocker', 'enableAdBlocker', store.get('adBlocker'))}
            ${hint('changesAppRestart')}
            ${toggle('proxyEnabled', 'enableProxy', store.get('proxyEnabled'))}
            <div class="subfields" id="proxyFields" ${shownIf(store.get('proxyEnabled'))}>
                ${input('proxyHost', 'proxyHost', store.get('proxyHost') || '')}
                ${input('proxyPort', 'proxyPort', store.get('proxyPort') || '')}
            </div>`;

        const plugins = `
            <div class="plugin-list" id="pluginList">
                ${text('noPluginsFound', 'div', 'no-plugins')}
            </div>
            <div class="buttons">
                ${button('openPluginsFolder', 'openPluginsFolder')}
                ${button('refreshPlugins', 'refreshPlugins')}
            </div>
            ${hint('pluginsDescription')}`;

        return `<!doctype html>
        ${cspMetaTag()}
        <link rel="stylesheet" href="/settingsPanel.css">
        <header class="panel-header">
            ${text('settings', 'h1')}
            <button type="button" class="close-btn" id="close-settings" title="${t('closeSettings')}" data-i18n-title="closeSettings">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M12 4L4 12m8 0L4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                </svg>
            </button>
        </header>
        <main>
            ${section('general', general)}
            ${section('appearance', appearance)}
            ${section('downloads', downloads)}
            ${section('accounts', accounts)}
            ${section('discord', discord)}
            ${section('lastfm', lastFm)}
            ${section('webhooks', webhooks)}
            ${section('network', network)}
            ${section('plugins', plugins)}
        </main>
        <footer>
            <button type="button" class="btn primary" id="applyChanges" data-i18n="applyChanges">${t('applyChanges')}</button>
        </footer>
        <script src="/settingsPanel.js"></script>`;
    }

    private show(): void {
        const wasCreated = this.view === null;
        const view = this.createView();
        this.isVisible = true;
        this.updateBounds();
        const applyShowState = () => {
            view.webContents.executeJavaScript(`
                // force reflow to ensure animation works
                document.body.style.opacity;
                document.body.classList.add('visible');
            `);
            // trigger translation updates when panel is shown
            view.webContents.send('update-translations');
            const isDark = this.store.get('theme', 'dark') === 'dark';
            view.webContents.send('theme-changed', isDark);
        };

        if (wasCreated) {
            view.webContents.once('did-finish-load', applyShowState);
        } else {
            applyShowState();
        }
    }

    private hide(): void {
        const view = this.view;
        if (!view) return;
        this.isVisible = false;
        view.webContents.executeJavaScript(`document.body.classList.remove('visible')`).catch(() => {});

        // once the slide-out has played, unless the panel was reopened in the meantime
        setTimeout(() => {
            if (this.isVisible || this.view !== view) return;
            // macOS gives the renderer back; elsewhere the view is kept and parked
            if (isMac) this.teardownView();
            else view.setBounds(OFF_SCREEN);
        }, HIDE_MS);
    }

    public async setThemeColors(colors: ThemeColors | null): Promise<void> {
        if (!this.view || this.view.webContents.isDestroyed()) return;
        const webContents = this.view.webContents;

        // colors originate from user-supplied theme files. they are applied as a
        // stylesheet rather than interpolated into a script, so a crafted value can at
        // worst produce an invalid CSS declaration -- never executable JavaScript.
        const previousKey = this.themeColorCssKey;
        if (previousKey) {
            this.themeColorCssKey = null;
            try {
                await webContents.removeInsertedCSS(previousKey);
            } catch {
                // view navigated since insertion; the old stylesheet is already gone
            }
        }

        if (!colors) return;

        const css = `:root {
            --bg-primary: ${colors.surface || colors.background};
            --bg-secondary: ${colors.background};
            --text-primary: ${colors.text};
            --accent: ${colors.accent || colors.primary};
        }`;

        try {
            this.themeColorCssKey = await webContents.insertCSS(css);
        } catch (error) {
            console.error('Failed to apply theme colors to settings view:', error);
        }
    }

    public getView(): BrowserView | null {
        return this.view;
    }

    /** True only when the panel is built and actually on screen. */
    public isPanelVisible(): boolean {
        return this.isVisible && this.view !== null && !this.view.webContents.isDestroyed();
    }

    public updateTranslations(translationService: TranslationService): void {
        this.translationService = translationService;
        if (!this.view) return;
        this.view.webContents.send('update-translations');
    }
}
