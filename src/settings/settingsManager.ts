import { BrowserView, BrowserWindow } from 'electron';
import type ElectronStore = require('electron-store');
import { TranslationService } from '../services/translationService';
import type { ThemeColors } from '../utils/colorExtractor';

export class SettingsManager {
    private view: BrowserView;
    private isVisible = false;
    private parentWindow: BrowserWindow;
    private store: ElectronStore;
    private translationService: TranslationService;

    constructor(parentWindow: BrowserWindow, store: ElectronStore, translationService: TranslationService) {
        this.parentWindow = parentWindow;
        this.store = store;
        this.view = new BrowserView({
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
        });
        this.translationService = translationService;

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

        // Listen for hide message from the panel
        this.view.webContents.on('console-message', (_, __, message) => {
            if (message === 'hidePanel') {
                this.isVisible = false;
                this.view.setBounds({ x: 0, y: -10000, width: 0, height: 0 });
            }
        });
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
        const HEADER_HEIGHT = 32; // Height of the window controls

        this.view.setBounds({
            x: bounds.width - width,
            y: HEADER_HEIGHT,
            width,
            height: bounds.height - HEADER_HEIGHT,
        });
    }

    private getHtml(): string {
        const theme = this.store.get('theme', 'dark');
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
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'SC-Font', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                -webkit-font-smoothing: antialiased;
            }
            body {
                background-color: rgba(var(--bg-primary-rgb), 0.1);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                color: var(--text-primary);
                padding: 20px;
                padding-right: 28px;
                overflow-y: scroll !important;
                letter-spacing: 0.01em;
                position: relative;
                opacity: 0;
                transform: translateX(20px);
                transition: 
                    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                    backdrop-filter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                will-change: transform, opacity;
            }
            body.visible {
                opacity: 1;
                transform: translateX(0);
            }
            body.is-scrollable {
                padding-right: 20px; /* Reduce padding when scroll is visible */
            }
            ::-webkit-scrollbar {
                -webkit-appearance: none;
                width: 8px;
                height: 8px;
                background-color: var(--scrollbar-bg);
                display: block !important;
                opacity: 1 !important;
                visibility: visible !important;
            }
            
            ::-webkit-scrollbar-track {
                background-color: transparent;
                opacity: 1 !important;
                visibility: visible !important;
            }
            
            ::-webkit-scrollbar-thumb {
                background-color: var(--scrollbar-thumb);
                border-radius: 4px;
                transition: background-color 0.3s;
                min-height: 40px;
                opacity: 1 !important;
                visibility: visible !important;
            }
            
            ::-webkit-scrollbar-thumb:hover {
                background-color: var(--scrollbar-thumb-hover);
            }
            
            ::-webkit-scrollbar-corner {
                background-color: transparent;
            }
            ::-webkit-scrollbar-button {
                display: none;
            }
            .close-btn {
                position: absolute;
                top: 5px;
                right: 28px; /* Default position when scroll is not visible */
                width: 32px;
                height: 32px;
                border-radius: 4px;
                border: none;
                background: transparent;
                color: var(--text-primary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.2s;
            }
            body.is-scrollable .close-btn {
                right: 20px; /* Adjust position when scroll is visible */
            }
            .close-btn:hover {
                background-color: var(--bg-hover);
            }
            .close-btn svg {
                width: 16px;
                height: 16px;
                fill: currentColor;
            }
            :root {
                --bg-primary: #303030;
                --bg-primary-rgb: 48, 48, 48;
                --bg-secondary: rgba(43, 43, 43, 0.7);
                --bg-hover: rgba(64, 64, 64, 0.8);
                --text-primary: #ffffff;
                --text-secondary: rgba(255, 255, 255, 0.7);
                --accent: rgba(255, 255, 255, 0.9);
                --accent-hover: #ffffff;
                --accent-muted: rgba(255, 255, 255, 0.6);
                --link-color: #5bb7ff;
                --link-hover: #7cc5ff;
                --border: rgba(255, 255, 255, 0.1);
                --scrollbar-bg: rgba(255, 255, 255, 0.05);
                --scrollbar-thumb: rgba(255, 255, 255, 0.2);
                --scrollbar-thumb-hover: rgba(255, 255, 255, 0.3);
            }
            html.theme-light {
                --bg-primary: #ffffff;
                --bg-primary-rgb: 255, 255, 255;
                --bg-secondary: rgba(245, 245, 245, 0.7);
                --bg-hover: rgba(234, 234, 234, 0.8);
                --text-primary: #333333;
                --text-secondary: rgba(0, 0, 0, 0.7);
                --accent: rgba(0, 0, 0, 0.9);
                --accent-hover: #000000;
                --accent-muted: rgba(0, 0, 0, 0.6);
                --link-color: #0088ff;
                --link-hover: #0066cc;
                --border: rgba(0, 0, 0, 0.1);
                --scrollbar-bg: rgba(0, 0, 0, 0.05);
                --scrollbar-thumb: rgba(0, 0, 0, 0.2);
                --scrollbar-thumb-hover: rgba(0, 0, 0, 0.3);
            }
            .settings-panel {
                padding-top: 32px;
                max-width: 100%;
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .setting-group {
                background: var(--bg-secondary);
                border-radius: 8px;
                padding: 15px;
                transition: background 0.2s;
            }
            .setting-group:hover {
                background: var(--bg-hover);
            }
            h2 {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            h2 svg {
                width: 18px;
                height: 18px;
                fill: var(--text-primary);
            }
            .setting-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 5px 0;
            }
            .setting-item span {
                color: var(--text-primary);
                font-size: 14px;
            }
            .description {
                font-size: 12px;
                color: var(--text-secondary);
                margin-top: 10px;
            }
            .input-group {
                display: flex;
                flex-direction: column;
                margin-top: 10px;
            }
            .input-group .textInput {
                margin-bottom: 10px;
            }
            .input-group .textInput:last-child {
                margin-bottom: 0;
            }
            .toggle {
                position: relative;
                width: 44px;
                height: 24px;
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
                inset: 0;
                background: var(--bg-primary);
                border: 1px solid var(--border);
                transition: .2s;
                border-radius: 24px;
            }
            .slider:before {
                content: "";
                position: absolute;
                height: 18px;
                width: 18px;
                left: 2px;
                bottom: 2px;
                background: var(--text-secondary);
                transition: .2s;
                border-radius: 50%;
            }
            input:checked + .slider {
                background: var(--accent);
                border-color: var(--accent);
            }
            input:checked + .slider:before {
                transform: translateX(20px);
                background: var(--bg-primary);
            }
            .input-with-unit {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .input-with-unit .textInput {
                width: 80px;
                margin: 0;
            }
            .unit-symbol {
                color: var(--text-secondary);
                font-size: 14px;
                font-weight: 500;
                flex-shrink: 0;
            }
            .textInput {
                width: 100%;
                padding: 10px 12px;
                background: var(--bg-primary);
                border: 1px solid var(--border);
                border-radius: 4px;
                color: var(--text-primary);
                font-size: 14px;
                transition: border-color 0.2s;
            }
            .textInput:focus {
                outline: none;
                border-color: var(--accent-muted);
            }
            .button {
                width: 100%;
                padding: 12px;
                background: var(--accent);
                color: var(--bg-primary);
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
            }
            .button:hover {
                background: var(--accent-hover);
            }
            .link {
                color: var(--accent-muted);
                text-decoration: none;
                font-size: 12px;
            }
            .link:hover {
                color: var(--accent);
                text-decoration: none;
            }
            #createLastFmApiKey {
                color: var(--link-color);
            }
            #createLastFmApiKey:hover {
                color: var(--link-hover);
            }
            /* Hide scrollbar for Chrome, Safari and Opera */
            body::-webkit-scrollbar {
                width: 8px;
            }
            
            /* Enable overlay scrollbar */
            @media screen and (min-width: 0\0) {
                body {
                    overflow-y: auto;
                }
            }

            /* Webhook example styles */
            .webhook-example-container {
                margin-top: 8px;
            }
            .example-toggle {
                display: flex;
                align-items: center;
                cursor: pointer;
                padding: 8px 0;
                font-size: 12px;
                color: var(--accent);
                user-select: none;
            }
            .example-toggle:hover {
                color: var(--accent-hover);
            }
            .example-toggle-text {
                margin-right: 6px;
            }
            .example-toggle-icon {
                width: 16px;
                height: 16px;
                fill: currentColor;
                transition: transform 0.2s ease;
                transform: rotate(-90deg);
            }
            .example-toggle.expanded .example-toggle-icon {
                transform: rotate(0deg);
            }
            .example-content {
                margin-top: 8px;
                padding: 12px;
                background: var(--bg-secondary);
                border-radius: 6px;
                border: 1px solid var(--border);
            }
            .example-json {
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 11px;
                color: var(--text-primary);
                margin: 0;
                white-space: pre-wrap;
                line-height: 1.4;
            }
            /* Custom Theme Styles */
            .theme-selector {
                min-width: 150px;
                padding: 8px 12px;
                background: var(--bg-primary);
                border: 1px solid var(--border);
                border-radius: 4px;
                color: var(--text-primary);
                font-size: 14px;
                cursor: pointer;
                transition: border-color 0.2s;
            }
            .theme-selector:focus {
                outline: none;
                border-color: var(--accent-muted);
            }
            .theme-controls {
                display: flex;
                gap: 8px;
                margin-top: 10px;
            }
            .theme-button {
                flex: 1;
                padding: 10px 12px;
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: 4px;
                color: var(--text-primary);
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .theme-button:hover {
                background: var(--bg-hover);
                border-color: var(--accent-muted);
            }

            .plugin-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-top: 10px;
            }
            .plugin-card {
                background: var(--bg-primary);
                border: 1px solid var(--border);
                border-radius: 6px;
                padding: 10px 12px;
                transition: border-color 0.2s;
            }
            .plugin-card:hover {
                border-color: var(--accent-muted);
            }
            .plugin-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .plugin-name {
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary);
            }
            .plugin-version {
                font-size: 11px;
                color: var(--text-secondary);
                margin-left: 6px;
            }
            .plugin-desc {
                font-size: 12px;
                color: var(--text-secondary);
                margin-top: 4px;
            }
            .plugin-author {
                font-size: 11px;
                color: var(--text-secondary);
                margin-top: 2px;
                font-style: italic;
            }
            .no-plugins {
                font-size: 13px;
                color: var(--text-secondary);
                text-align: center;
                padding: 12px 0;
            }

            /* Rich Presence Preview Styles */
            .preview-container {
                margin-top: 12px;
                animation: slideIn 0.3s ease;
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .preview-panel {
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .preview-header-inline {
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--border);
            }

            .preview-title-inline {
                font-size: 14px;
                font-weight: 600;
                color: var(--accent);
            }

            .discord-preview {
                font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                background: var(--bg-primary);
                border-radius: 8px;
                padding: 16px;
                border: 1px solid var(--border);
            }

            .user-info-preview {
                display: flex;
                align-items: center;
                margin-bottom: 12px;
            }

            .user-avatar-preview {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: var(--bg-secondary);
                margin-right: 12px;
                position: relative;
                background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="gray"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>');
                background-size: 20px;
                background-position: center;
                background-repeat: no-repeat;
            }

            .status-indicator-preview {
                position: absolute;
                bottom: -2px;
                right: -2px;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #43b581;
                border: 2px solid var(--bg-primary);
            }

            .user-details-preview {
                flex: 1;
            }

            .username-preview {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 2px;
            }

            .user-tag-preview {
                font-size: 14px;
                color: var(--text-secondary);
            }

            .activity-section-preview {
                margin-top: 8px;
            }

            .activity-header-preview {
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                color: var(--text-secondary);
                margin-bottom: 8px;
                letter-spacing: 0.025em;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .activity-content-preview {
                display: inline-block;
                width: 100%;
                animation: fadeInPreview 0.3s ease;
            }

            .activity-row-preview {
                display: flex;
                width: 100%;
                vertical-align: top;
            }

            .activity-image-preview {
                width: 60px;
                height: 60px;
                border-radius: 8px;
                background: var(--bg-secondary);
                position: relative;
                overflow: hidden;
                display: inline-block;
                vertical-align: top;
                margin-right: 12px;
            }

            .activity-image-preview img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 8px;
            }

            .small-icon-preview {
                position: absolute;
                bottom: -4px;
                right: -4px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: var(--bg-primary);
                border: 2px solid var(--bg-primary);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .soundcloud-icon-preview {
                width: 16px;
                height: 16px;
                fill: #ff5500;
            }

            .activity-details-preview {
                display: inline-block;
                vertical-align: top;
                width: calc(100% - 72px);
                min-width: 0;
            }

            @keyframes fadeInPreview {
                from {
                    opacity: 0;
                    transform: translateY(5px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .activity-name-preview {
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 2px;
                word-wrap: break-word;
            }

            .activity-details-text-preview {
                font-size: 14px;
                color: var(--text-primary);
                margin-bottom: 1px;
                word-wrap: break-word;
            }

            .activity-state-preview {
                font-size: 14px;
                color: var(--text-primary);
                margin-bottom: 4px;
                word-wrap: break-word;
            }

            .progress-bar-container-preview {
                margin: 8px 0;
            }

            .progress-bar-preview {
                width: 100%;
                height: 4px;
                background: var(--bg-secondary);
                border-radius: 2px;
                overflow: hidden;
                position: relative;
            }

            .progress-bar-fill-preview {
                height: 100%;
                background: #5865f2;
                border-radius: 2px;
                transition: width 0.3s ease;
                width: 0%;
            }

            .time-display-preview {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: var(--text-secondary);
                margin-top: 4px;
            }

            .activity-buttons-preview {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }

            .activity-button-preview {
                flex: 1;
                padding: 8px 16px;
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: 4px;
                color: var(--text-primary);
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
                text-decoration: none;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            }

            .activity-button-preview:hover {
                background: var(--bg-hover);
                border-color: var(--accent-muted);
            }

            .no-activity-preview {
                text-align: center;
                color: var(--text-secondary);
                font-size: 14px;
                padding: 24px 16px;
                font-style: italic;
            }
        </style>
        <button class="close-btn" id="close-settings" title="${this.translationService.translate('closeSettings')}" data-i18n-title="closeSettings">
            <svg viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
        </button>
        <div class="settings-panel">
            <div class="setting-group">
                <h2 data-i18n="client">${this.translationService.translate('client')}</h2>
                <div class="setting-item">
                    <span data-i18n="darkMode">${this.translationService.translate('darkMode')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="darkMode" ${theme !== 'light' ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <span data-i18n="minimizeToTray">${this.translationService.translate('minimizeToTray')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="minimizeToTray" ${this.store.get('minimizeToTray', true) ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <span data-i18n="enableNavigationControls">${this.translationService.translate('enableNavigationControls')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="navigationControlsEnabled" ${this.store.get('navigationControlsEnabled', false) ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <span data-i18n="enableAutoUpdater">${this.translationService.translate('enableAutoUpdater')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="autoUpdaterEnabled" ${this.store.get('autoUpdaterEnabled', true) ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <span data-i18n="enableTrackParser">${this.translationService.translate('enableTrackParser')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="trackParserEnabled" ${this.store.get('trackParserEnabled', true) ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="description" data-i18n="trackParserDescription">${this.translationService.translate('trackParserDescription')}</div>
            </div>

            <div class="setting-group">
                <h2 data-i18n="adBlocker">${this.translationService.translate('adBlocker')}</h2>
                <div class="setting-item">
                    <span data-i18n="enableAdBlocker">${this.translationService.translate('enableAdBlocker')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="adBlocker" ${this.store.get('adBlocker') ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="description" data-i18n="changesAppRestart">${this.translationService.translate('changesAppRestart')}</div>
            </div>

            <div class="setting-group">
                <h2 data-i18n="proxy">${this.translationService.translate('proxy')}</h2>
                <div class="setting-item">
                    <span data-i18n="enableProxy">${this.translationService.translate('enableProxy')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="proxyEnabled" ${this.store.get('proxyEnabled') ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="input-group" id="proxyFields" style="display: ${
                    this.store.get('proxyEnabled') ? 'block' : 'none'
                }">
                    <input type="text" class="textInput" id="proxyHost" placeholder="${this.translationService.translate('proxyHost')}" data-i18n-placeholder="proxyHost" value="${
                        this.store.get('proxyHost') || ''
                    }">
                    <input type="text" class="textInput" id="proxyPort" placeholder="${this.translationService.translate('proxyPort')}" data-i18n-placeholder="proxyPort" value="${
                        this.store.get('proxyPort') || ''
                    }">
                </div>
            </div>

            <div class="setting-group">
                <h2 data-i18n="lastfm">
                    ${this.translationService.translate('lastfm')}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M10.599 17.211l-.881-2.393s-1.433 1.596-3.579 1.596c-1.9 0-3.249-1.652-3.249-4.296 0-3.385 1.708-4.596 3.388-4.596 2.418 0 3.184 1.568 3.845 3.578l.871 2.751c.87 2.672 2.508 4.818 7.238 4.818 3.386 0 5.673-1.037 5.673-3.77 0-2.209-1.258-3.358-3.595-3.906l-1.738-.381c-1.193-.274-1.546-.763-1.546-1.59 0-.934.736-1.485 1.937-1.485 1.313 0 2.024.488 2.14 1.652l2.745-.33c-.225-2.511-1.937-3.541-4.745-3.541-2.479 0-4.897.934-4.897 3.947 0 1.877.902 3.063 3.172 3.608l1.871.439c1.402.332 1.866.916 1.866 1.713 0 1.021-.992 1.441-2.869 1.441-2.779 0-3.936-1.457-4.596-3.469l-.901-2.75c-1.156-3.574-3.004-4.896-6.669-4.896C2.147 5.297 0 7.802 0 12.244c0 4.325 2.208 6.638 6.169 6.638 3.193 0 4.43-1.671 4.43-1.671z"/>
                    </svg>
                </h2>
                <div class="setting-item">
                    <span data-i18n="enableLastFm">${this.translationService.translate('enableLastFm')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="lastFmEnabled" ${this.store.get('lastFmEnabled') ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="input-group" id="lastFmFields" style="display: ${
                    this.store.get('lastFmEnabled') ? 'block' : 'none'
                }">
                    <input type="text" class="textInput" id="lastFmApiKey" placeholder="${this.translationService.translate('lastFmApiKey')}" data-i18n-placeholder="lastFmApiKey" value="${
                        this.store.get('lastFmApiKey') || ''
                    }">
                    <input type="password" class="textInput" id="lastFmSecret" placeholder="${this.translationService.translate('lastFmApiSecret')}" data-i18n-placeholder="lastFmApiSecret" value="${
                        this.store.get('lastFmSecret') || ''
                    }">
                </div>
                <div class="description">
                    <a href="#" id="createLastFmApiKey" class="link" data-i18n="createApiKeyLastFm">${this.translationService.translate('createApiKeyLastFm')}</a>
                    - <span data-i18n="noCallbackUrl">${this.translationService.translate('noCallbackUrl')}</span>
                </div>
            </div>

            <div class="setting-group">
                <h2 data-i18n="webhooks">
                    ${this.translationService.translate('webhooks')}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M10.59 13.41c.41.39.41 1.03 0 1.42-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.982 2.982 0 0 0 0-4.24 2.982 2.982 0 0 0-4.24 0l-3.53 3.53a2.982 2.982 0 0 0 0 4.24zm2.82-4.24c.39-.39 1.03-.39 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.42l-.47.48a2.982 2.982 0 0 0 0 4.24 2.982 2.982 0 0 0 4.24 0l3.53-3.53a2.982 2.982 0 0 0 0-4.24z"/>
                    </svg>
                </h2>
                <div class="setting-item">
                    <span data-i18n="enableWebhooks">${this.translationService.translate('enableWebhooks')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="webhookEnabled" ${this.store.get('webhookEnabled') ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="input-group" id="webhookFields" style="display: ${
                    this.store.get('webhookEnabled') ? 'block' : 'none'
                }">
                    <input type="url" class="textInput" id="webhookUrl" placeholder="${this.translationService.translate('webhookUrl')}" data-i18n-placeholder="webhookUrl" value="${
                        this.store.get('webhookUrl') || ''
                    }">
                    <div class="setting-item">
                        <span data-i18n="webhookTrigger">${this.translationService.translate('webhookTrigger')}</span>
                        <div class="input-with-unit">
                            <input type="number" id="webhookTriggerPercentage" class="textInput" style="width: 80px;" min="0" max="100" step="1" value="${
                                this.store.get('webhookTriggerPercentage') || 50
                            }">
                            <span class="unit-symbol">%</span>
                        </div>
                    </div>
                </div>
                <div class="description" data-i18n="webhookDescription">
                    ${this.translationService.translate('webhookDescription')}
                </div>
                <div class="webhook-example-container" id="webhookFields2" style="display: ${
                    this.store.get('webhookEnabled') ? 'block' : 'none'
                }">
                    <div class="example-toggle" id="webhookExampleToggle">
                        <span class="example-toggle-text" data-i18n="showWebhookExample">${this.translationService.translate('showWebhookExample')}</span>
                        <svg class="example-toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                        </svg>
                    </div>
                    <div class="example-content" id="webhookExampleContent" style="display: none;">
                        <pre class="example-json">{
  "timestamp": "2025-08-12T14:30:45.123Z",
  "artist": "Artist Name",
  "track": "Track Title", 
  "duration": 240,
  "trackArt": "https://example.com/artwork.jpg",
  "originUrl": "https://soundcloud.com/track-url"
}</pre>
                    </div>
                </div>
            </div>

            <div class="setting-group">
                <h2 data-i18n="discord">
                    ${this.translationService.translate('discord')}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.707 18.707 0 0 0-5.487 0 12.505 12.505 0 0 0-.617-1.249.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.369a.07.07 0 0 0-.032.027C.533 9.045-.32 13.579.099 18.057a.082.082 0 0 0 .031.056 19.911 19.911 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.464-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.105 13.184 13.184 0 0 1-1.872-.9.077.077 0 0 1-.008-.128c.126-.094.252-.192.373-.291a.075.075 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.122.099.247.197.374.291a.077.077 0 0 1-.006.128 12.509 12.509 0 0 1-1.873.899.076.076 0 0 0-.04.106c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.028 19.876 19.876 0 0 0 6.002-3.03.077.077 0 0 0 .031-.056c.5-5.177-.838-9.665-3.546-13.661a.067.067 0 0 0-.033-.027zM8.02 15.331c-1.182 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.213 0 2.187 1.096 2.156 2.419 0 1.333-.955 2.418-2.156 2.418zm7.974 0c-1.182 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.213 0 2.187 1.096 2.156 2.419 0 1.333-.943 2.418-2.156 2.418z"/>
                    </svg>
                </h2>
                <div class="setting-item">
                    <span data-i18n="enableRichPresence">${this.translationService.translate('enableRichPresence')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="discordRichPresence" ${
                            this.store.get('discordRichPresence') ? 'checked' : ''
                        }>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <span data-i18n="displayWhenPaused">${this.translationService.translate('displayWhenPaused')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="displayWhenIdling" ${
                            this.store.get('displayWhenIdling') ? 'checked' : ''
                        }>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <span data-i18n="displaySmallIcon">${this.translationService.translate('displaySmallIcon')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="displaySCSmallIcon" ${
                            this.store.get('displaySCSmallIcon') ? 'checked' : ''
                        }>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <span data-i18n="displayButtons">${this.translationService.translate('displayButtons')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="displayButtons" ${this.store.get('displayButtons') ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <span data-i18n="useArtistInStatusLine">${this.translationService.translate('useArtistInStatusLine')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="useArtistInStatusLineToggle" ${
                            (this.store.get('statusDisplayType') as number) === 1 ? 'checked' : ''
                        }>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <span data-i18n="enableRichPresencePreview">${this.translationService.translate('enableRichPresencePreview')}</span>
                    <label class="toggle">
                        <input type="checkbox" id="richPresencePreviewEnabled" ${
                            this.store.get('richPresencePreviewEnabled', false) ? 'checked' : ''
                        }>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="description" data-i18n="richPresencePreviewDescription">${this.translationService.translate('richPresencePreviewDescription')}</div>
                
                <!-- Rich Presence Preview -->
                <div class="preview-container" id="presencePreviewContainer" style="display: ${
                    this.store.get('richPresencePreviewEnabled', false) ? 'block' : 'none'
                }">
                    <div class="preview-panel">
                        <div class="preview-header-inline">
                            <span class="preview-title-inline" data-i18n="richPresencePreviewTitle">${this.translationService.translate('richPresencePreviewTitle')}</span>
                        </div>
                        <div class="discord-preview">
                            <div class="activity-section-preview" id="activitySectionPreview">
                                <div class="no-activity-preview" id="noActivityPreview" data-i18n="noActivityToShow">
                                    ${this.translationService.translate('noActivityToShow')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="setting-group">
                <h2 data-i18n="customThemes">
                    ${this.translationService.translate('customThemes')}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/>
                        <path d="M12 7c-2.757 0-5 2.243-5 5s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z"/>
                    </svg>
                </h2>
                <div class="setting-item">
                    <span data-i18n="selectCustomTheme">${this.translationService.translate('selectCustomTheme')}</span>
                    <select id="customThemeSelector" class="theme-selector">
                        <option value="none" data-i18n="noTheme">${this.translationService.translate('noTheme')}</option>
                    </select>
                </div>
                <div class="theme-controls">
                    <button id="openThemesFolder" class="theme-button" data-i18n="openThemesFolder">${this.translationService.translate('openThemesFolder')}</button>
                    <button id="refreshThemes" class="theme-button" data-i18n="refreshThemes">${this.translationService.translate('refreshThemes')}</button>
                </div>
                <div class="description" data-i18n="customThemeDescription">${this.translationService.translate('customThemeDescription')}</div>
            </div>

            <div class="setting-group">
                <h2 data-i18n="plugins">
                    ${this.translationService.translate('plugins')}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/>
                    </svg>
                </h2>
                <div class="plugin-list" id="pluginList">
                    <div class="no-plugins" data-i18n="noPluginsFound">${this.translationService.translate('noPluginsFound')}</div>
                </div>
                <div class="theme-controls">
                    <button id="openPluginsFolder" class="theme-button" data-i18n="openPluginsFolder">${this.translationService.translate('openPluginsFolder')}</button>
                    <button id="refreshPlugins" class="theme-button" data-i18n="refreshPlugins">${this.translationService.translate('refreshPlugins')}</button>
                </div>
                <div class="description" data-i18n="pluginsDescription">${this.translationService.translate('pluginsDescription')}</div>
            </div>

            <div class="setting-group">
                <button class="button" id="applyChanges" data-i18n="applyChanges">${this.translationService.translate('applyChanges')}</button>
            </div>
        </div>
        <script>
            ${this.getJavaScript()}
        </script>
        <script>
            // Animation handling
            document.addEventListener('DOMContentLoaded', () => {
                // Ensure initial state is set
                document.body.classList.remove('visible');
            });

            // Handle close button animation
            document.getElementById('close-settings').addEventListener('click', (e) => {
                e.preventDefault();
                document.body.classList.remove('visible');
                setTimeout(() => {
                    ipcRenderer.send('toggle-settings');
                }, 300);
            });

            // Listen for messages
            window.addEventListener('message', (event) => {
                if (event.data === 'hidePanel') {
                    console.log('hidePanel');
                }
            });
        </script>`;
    }

    private getJavaScript(): string {
        return `
            const { ipcRenderer, shell } = require('electron');

            // Load custom themes on initialization
            async function loadCustomThemes() {
                try {
                    const themes = await ipcRenderer.invoke('get-custom-themes');
                    const currentTheme = await ipcRenderer.invoke('get-current-custom-theme');
                    const selector = document.getElementById('customThemeSelector');
                    
                    // Clear existing options except "No Theme"
                    while (selector.children.length > 1) {
                        selector.removeChild(selector.lastChild);
                    }
                    
                    // Add theme options
                    themes.forEach(theme => {
                        const option = document.createElement('option');
                        option.value = theme.name;
                        option.textContent = theme.name;
                        selector.appendChild(option);
                    });
                    
                    // Set current theme
                    selector.value = currentTheme || 'none';
                } catch (error) {
                    console.error('Failed to load custom themes:', error);
                }
            }

            // Initialize themes on page load
            document.addEventListener('DOMContentLoaded', loadCustomThemes);

            // Custom theme selector
            document.getElementById('customThemeSelector').addEventListener('change', async (e) => {
                const themeName = e.target.value;
                try {
                    await ipcRenderer.invoke('apply-custom-theme', themeName);
                    ipcRenderer.send('setting-changed', { key: 'customTheme', value: themeName });
                } catch (error) {
                    console.error('Failed to apply custom theme:', error);
                }
            });

            // Open themes folder
            document.getElementById('openThemesFolder').addEventListener('click', async () => {
                try {
                    const themesPath = await ipcRenderer.invoke('get-themes-folder-path');
                    shell.openPath(themesPath);
                } catch (error) {
                    console.error('Failed to open themes folder:', error);
                }
            });

            // Refresh themes
            document.getElementById('refreshThemes').addEventListener('click', async () => {
                try {
                    await ipcRenderer.invoke('refresh-custom-themes');
                    await loadCustomThemes();
                } catch (error) {
                    console.error('Failed to refresh themes:', error);
                }
            });

            async function loadPlugins() {
                try {
                    const plugins = await ipcRenderer.invoke('get-plugins');
                    const list = document.getElementById('pluginList');
                    list.innerHTML = '';

                    if (!plugins || plugins.length === 0) {
                        list.innerHTML = '<div class="no-plugins" data-i18n="noPluginsFound">No plugins found</div>';
                        return;
                    }

                    plugins.forEach(p => {
                        const card = document.createElement('div');
                        card.className = 'plugin-card';
                        card.innerHTML = \`
                            <div class="plugin-header">
                                <span>
                                    <span class="plugin-name">\${p.metadata.name || p.id}</span>
                                    <span class="plugin-version">v\${p.metadata.version || '?'}</span>
                                </span>
                                <label class="toggle">
                                    <input type="checkbox" data-plugin-id="\${p.id}" \${p.enabled ? 'checked' : ''}>
                                    <span class="slider"></span>
                                </label>
                            </div>
                            \${p.metadata.description ? '<div class="plugin-desc">' + p.metadata.description + '</div>' : ''}
                            \${p.metadata.author && p.metadata.author !== 'Unknown' ? '<div class="plugin-author">by ' + p.metadata.author + '</div>' : ''}
                        \`;

                        card.querySelector('input[type="checkbox"]').addEventListener('change', async (e) => {
                            const enabled = e.target.checked;
                            await ipcRenderer.invoke('set-plugin-enabled', p.id, enabled);
                        });

                        list.appendChild(card);
                    });
                } catch (error) {
                    console.error('Failed to load plugins:', error);
                }
            }

            document.addEventListener('DOMContentLoaded', loadPlugins);

            document.getElementById('openPluginsFolder').addEventListener('click', async () => {
                try {
                    const pluginsPath = await ipcRenderer.invoke('get-plugins-folder-path');
                    shell.openPath(pluginsPath);
                } catch (error) {
                    console.error('Failed to open plugins folder:', error);
                }
            });

            document.getElementById('refreshPlugins').addEventListener('click', async () => {
                try {
                    await ipcRenderer.invoke('refresh-plugins');
                    await loadPlugins();
                } catch (error) {
                    console.error('Failed to refresh plugins:', error);
                }
            });

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

            // Toggle visibility of webhook fields
            document.getElementById('webhookEnabled').addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                document.getElementById('webhookFields').style.display = isEnabled ? 'block' : 'none';
                document.getElementById('webhookFields2').style.display = isEnabled ? 'block' : 'none';
                ipcRenderer.send('setting-changed', { key: 'webhookEnabled', value: isEnabled });
            });

            // Handle webhook URL changes
            document.getElementById('webhookUrl').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'webhookUrl', value: e.target.value });
            });

            // Handle webhook trigger percentage changes
            document.getElementById('webhookTriggerPercentage').addEventListener('input', (e) => {
                let value = parseInt(e.target.value);
                // Clamp value between 0 and 100
                if (value < 0) value = 0;
                if (value > 100) value = 100;
                if (isNaN(value)) value = 50; // Default fallback
                
                e.target.value = value; // Update the input field
                ipcRenderer.send('setting-changed', { key: 'webhookTriggerPercentage', value: value });
            });

            // Handle webhook example toggle
            document.getElementById('webhookExampleToggle').addEventListener('click', (e) => {
                const toggle = e.currentTarget;
                const content = document.getElementById('webhookExampleContent');
                const isExpanded = content.style.display === 'block';
                
                if (isExpanded) {
                    content.style.display = 'none';
                    toggle.classList.remove('expanded');
                } else {
                    content.style.display = 'block';
                    toggle.classList.add('expanded');
                }
            });

            // Basic settings
            document.getElementById('darkMode').addEventListener('change', (e) => {
                const isDark = e.target.checked;
                ipcRenderer.send('setting-changed', { key: 'theme', value: isDark ? 'dark' : 'light' });
                document.documentElement.classList.toggle('theme-light', !isDark);
                document.documentElement.classList.toggle('theme-dark', isDark);
            });

            document.getElementById('minimizeToTray').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'minimizeToTray', value: e.target.checked });
            });

            document.getElementById('navigationControlsEnabled').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'navigationControlsEnabled', value: e.target.checked });
            });

            document.getElementById('trackParserEnabled').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'trackParserEnabled', value: e.target.checked });
            });

            document.getElementById('autoUpdaterEnabled').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'autoUpdaterEnabled', value: e.target.checked });
            });

            // Rich Presence Preview
            document.getElementById('richPresencePreviewEnabled').addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                const container = document.getElementById('presencePreviewContainer');
                if (container) {
                    container.style.display = isEnabled ? 'block' : 'none';
                }
                ipcRenderer.send('setting-changed', { key: 'richPresencePreviewEnabled', value: isEnabled });
            });

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

            document.getElementById('displayButtons').addEventListener('change', (e) => {
                ipcRenderer.send('setting-changed', { key: 'displayButtons', value: e.target.checked });
            });

            // Toggle status display type (STATE uses artist, NAME uses app name)
            document.getElementById('useArtistInStatusLineToggle').addEventListener('change', (e) => {
                const useState = e.target.checked; // true -> STATE (1), false -> NAME (0)
                ipcRenderer.send('setting-changed', { key: 'statusDisplayType', value: useState ? 1 : 0 });
            });

            // Rich Presence Preview toggle
            document.getElementById('richPresencePreviewEnabled').addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                document.getElementById('presencePreviewContainer').style.display = isEnabled ? 'block' : 'none';
                ipcRenderer.send('setting-changed', { key: 'richPresencePreviewEnabled', value: isEnabled });
            });

            // Rich Presence Preview
            document.getElementById('richPresencePreviewEnabled').addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                document.getElementById('presencePreviewContainer').style.display = isEnabled ? 'block' : 'none';
                ipcRenderer.send('setting-changed', { key: 'richPresencePreviewEnabled', value: isEnabled });
            });

            // Rich Presence Preview Update Functions
            let currentTrack = null;
            let progressInterval = null;

            function parseTimeToMs(time) {
                if (!time) return 0;
                const isNegative = time.trim().startsWith('-');
                const raw = isNegative ? time.trim().slice(1) : time.trim();
                const parts = raw.split(':').map(p => Number(p));
                let seconds = 0;
                for (const part of parts) {
                    seconds = seconds * 60 + (isNaN(part) ? 0 : part);
                }
                const ms = seconds * 1000;
                return isNegative ? -ms : ms;
            }

            function formatTime(ms) {
                const totalSeconds = Math.floor(ms / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                return \`\${minutes}:\${seconds.toString().padStart(2, '0')}\`;
            }

            function updatePreview(trackInfo) {
                currentTrack = trackInfo;
                const activitySection = document.getElementById('activitySectionPreview');
                const noActivity = document.getElementById('noActivityPreview');

                // Get current settings
                const displayWhenIdling = document.getElementById('displayWhenIdling').checked;
                const displaySCSmallIcon = document.getElementById('displaySCSmallIcon').checked;
                const displayButtons = document.getElementById('displayButtons').checked;

                if (!trackInfo || (!trackInfo.isPlaying && !displayWhenIdling)) {
                    noActivity.style.display = 'block';
                    const existingContent = activitySection.querySelector('.activity-content-preview');
                    if (existingContent) {
                        existingContent.remove();
                    }
                    clearInterval(progressInterval);
                    return;
                }

                noActivity.style.display = 'none';

                // Remove existing activity content
                const existingContent = activitySection.querySelector('.activity-content-preview');
                if (existingContent) {
                    existingContent.remove();
                }

                // Create activity content
                const activityContent = document.createElement('div');
                activityContent.className = 'activity-content-preview';

                if (trackInfo.isPlaying) {
                    activityContent.innerHTML = \`
                        <div class="activity-header-preview">
                            Listening to <strong>SoundCloud</strong>
                        </div>
                        <div class="activity-row-preview">
                            <div class="activity-image-preview">
                                <img src="\${trackInfo.artwork ? trackInfo.artwork.replace('50x50.', '300x300.') : ''}" alt="Track artwork" onerror="this.style.display='none'">
                                \${displaySCSmallIcon ? \`
                                    <div class="small-icon-preview">
                                        <img src="https://cdn.discordapp.com/app-assets/1090770350251458592/1090771481627197580.png?size=160" alt="SoundCloud" style="width: 16px; height: 16px; border-radius: 50%;">
                                    </div>
                                \` : ''}
                            </div>
                            <div class="activity-details-preview">
                                <div class="activity-name-preview">\${trackInfo.title || 'Unknown Track'}</div>
                                <div class="activity-details-text-preview">by \${trackInfo.author || 'Unknown Artist'}</div>
                                <div class="progress-bar-container-preview">
                                    <div class="progress-bar-preview">
                                        <div class="progress-bar-fill-preview" id="progressFillPreview"></div>
                                    </div>
                                    <div class="time-display-preview">
                                        <span id="currentTimePreview">\${trackInfo.elapsed || '0:00'}</span>
                                        <span id="totalTimePreview">\${trackInfo.duration || '0:00'}</span>
                                    </div>
                                </div>
                                \${displayButtons && trackInfo.url ? \`
                                    <div class="activity-buttons-preview">
                                        <button class="activity-button-preview" onclick="window.open('\${trackInfo.url}', '_blank')">
                                             Listen on SoundCloud
                                        </button>
                                    </div>
                                \` : ''}
                            </div>
                        </div>
                    \`;

                    // Start progress update
                    startProgressUpdate(trackInfo);
                } else if (displayWhenIdling) {
                    // Paused/idle state
                    activityContent.innerHTML = \`
                        <div class="activity-header-preview">
                            <svg class="soundcloud-icon-preview" viewBox="0 0 24 24">
                                <path d="M7.443 17.22c0 .333-.069.606-.207.816-.138.211-.33.316-.574.316-.245 0-.437-.105-.575-.316-.137-.21-.206-.483-.206-.816v-5.148c0-.02-.014-.035-.031-.048L3.72 10.63c-.138-.083-.277-.124-.417-.124-.14 0-.279.041-.417.124-.138.083-.207.207-.207.372v6.418c0 .373.1.684.3.933.201.248.487.372.86.372.372 0 .658-.124.859-.372.2-.249.301-.56.301-.933v-4.98l2.444-1.444zM12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8z"/>
                            </svg>
                            Using <strong>SoundCloud</strong>
                        </div>
                        <div class="activity-row-preview">
                            <div class="activity-image-preview">
                                <svg class="soundcloud-icon-preview" viewBox="0 0 24 24" style="width: 30px; height: 30px; margin: 15px;">
                                    <path d="M7.443 17.22c0 .333-.069.606-.207.816-.138.211-.33.316-.574.316-.245 0-.437-.105-.575-.316-.137-.21-.206-.483-.206-.816v-5.148c0-.02-.014-.035-.031-.048L3.72 10.63c-.138-.083-.277-.124-.417-.124-.14 0-.279.041-.417.124-.138.083-.207.207-.207.372v6.418c0 .373.1.684.3.933.201.248.487.372.86.372.372 0 .658-.124.859-.372.2-.249.301-.56.301-.933v-4.98l2.444-1.444zM12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8z"/>
                                </svg>
                            </div>
                            <div class="activity-details-preview">
                                <div class="activity-details-text-preview">Paused</div>
                            </div>
                        </div>
                    \`;
                }

                activitySection.appendChild(activityContent);
            }

            function startProgressUpdate(trackInfo) {
                clearInterval(progressInterval);
                
                if (!trackInfo.isPlaying || !trackInfo.elapsed || !trackInfo.duration) {
                    return;
                }

                const startTime = Date.now();
                const elapsedMs = parseTimeToMs(trackInfo.elapsed);
                const totalMs = parseTimeToMs(trackInfo.duration);

                function updateProgress() {
                    const now = Date.now();
                    const currentElapsed = elapsedMs + (now - startTime);
                    const progress = Math.min((currentElapsed / totalMs) * 100, 100);

                    const progressFill = document.getElementById('progressFillPreview');
                    const currentTimeEl = document.getElementById('currentTimePreview');

                    if (progressFill) {
                        progressFill.style.width = \`\${progress}%\`;
                    }
                    
                    if (currentTimeEl) {
                        currentTimeEl.textContent = formatTime(currentElapsed);
                    }

                    // Stop when track ends
                    if (progress >= 100) {
                        clearInterval(progressInterval);
                    }
                }

                // Update immediately
                updateProgress();
                
                // Update every second
                progressInterval = setInterval(updateProgress, 1000);
            }

            // Listen for track updates
            ipcRenderer.on('presence-preview-update', (_, trackInfo) => {
                updatePreview(trackInfo);
            });

            // Update preview when display settings change
            document.getElementById('displayWhenIdling').addEventListener('change', () => {
                if (currentTrack) {
                    setTimeout(() => updatePreview(currentTrack), 100);
                }
            });

            document.getElementById('displaySCSmallIcon').addEventListener('change', () => {
                if (currentTrack) {
                    setTimeout(() => updatePreview(currentTrack), 100);
                }
            });

            document.getElementById('displayButtons').addEventListener('change', () => {
                if (currentTrack) {
                    setTimeout(() => updatePreview(currentTrack), 100);
                }
            });

            // Initialize preview with current track if available
            let currentPreviewTrack = null;
            let previewProgressInterval = null;

            function updatePreviewTrackInfo(trackInfo) {
                currentPreviewTrack = trackInfo;
                const activitySection = document.getElementById('activitySectionPreview');
                const noActivity = document.getElementById('noActivityPreview');

                if (!trackInfo || (!trackInfo.isPlaying && !${this.store.get('displayWhenIdling', false)})) {
                    if (noActivity) noActivity.style.display = 'block';
                    const existingContent = activitySection?.querySelector('.activity-content-preview');
                    if (existingContent) existingContent.remove();
                    clearInterval(previewProgressInterval);
                    return;
                }

                if (noActivity) noActivity.style.display = 'none';

                // Remove existing activity content
                const existingContent = activitySection?.querySelector('.activity-content-preview');
                if (existingContent) {
                    existingContent.remove();
                }

                // Create activity content
                const activityContent = document.createElement('div');
                activityContent.className = 'activity-content-preview';

                if (trackInfo.isPlaying) {
                    activityContent.innerHTML = \`
                        <div class="activity-header-preview">
                            Listening to <strong>SoundCloud</strong>
                        </div>
                        <div style="display: flex; align-items: flex-start; gap: 12px;">
                            <div class="activity-image-preview">
                                <img src="\${trackInfo.artwork ? trackInfo.artwork.replace('50x50.', '300x300.') : ''}" alt="Track artwork" onerror="this.style.display='none'">
                                \${${this.store.get('displaySCSmallIcon', false)} ? \`
                                    <div class="small-icon-preview">
                                        <svg class="soundcloud-icon-preview" viewBox="0 0 24 24">
                                            <path d="M7.443 17.22c0 .333-.069.606-.207.816-.138.211-.33.316-.574.316-.245 0-.437-.105-.575-.316-.137-.21-.206-.483-.206-.816v-5.148c0-.02-.014-.035-.031-.048L3.72 10.63c-.138-.083-.277-.124-.417-.124-.14 0-.279.041-.417.124-.138.083-.207.207-.207.372v6.418c0 .373.1.684.3.933.201.248.487.372.86.372.372 0 .658-.124.859-.372.2-.249.301-.56.301-.933v-4.98l2.444-1.444zM12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8z"/>
                                        </svg>
                                    </div>
                                \` : ''}
                            </div>
                            <div class="activity-details-preview">
                                <div class="activity-name-preview">\${trackInfo.title || 'Unknown Track'}</div>
                                <div class="activity-details-text-preview">by \${trackInfo.author || 'Unknown Artist'}</div>
                                <div class="progress-bar-container-preview">
                                    <div class="progress-bar-preview">
                                        <div class="progress-bar-fill-preview" id="progressFillPreview"></div>
                                    </div>
                                    <div class="time-display-preview">
                                        <span id="currentTimePreview">\${trackInfo.elapsed || '0:00'}</span>
                                        <span id="totalTimePreview">\${trackInfo.duration || '0:00'}</span>
                                    </div>
                                </div>
                                \${${this.store.get('displayButtons', false)} && trackInfo.url ? \`
                                    <div class="activity-buttons-preview">
                                        <button class="activity-button-preview" onclick="require('electron').shell.openExternal('\${trackInfo.url}')">
                                             Listen on SoundCloud
                                        </button>
                                    </div>
                                \` : ''}
                            </div>
                        </div>
                    \`;

                    // Start progress update for preview
                    startPreviewProgressUpdate(trackInfo);
                } else {
                    // Paused/idle state
                    activityContent.innerHTML = \`
                        <div class="activity-header-preview">
                            <svg class="soundcloud-icon-preview" viewBox="0 0 24 24">
                                <path d="M7.443 17.22c0 .333-.069.606-.207.816-.138.211-.33.316-.574.316-.245 0-.437-.105-.575-.316-.137-.21-.206-.483-.206-.816v-5.148c0-.02-.014-.035-.031-.048L3.72 10.63c-.138-.083-.277-.124-.417-.124-.14 0-.279.041-.417.124-.138.083-.207.207-.207.372v6.418c0 .373.1.684.3.933.201.248.487.372.86.372.372 0 .658-.124.859-.372.2-.249.301-.56.301-.933v-4.98l2.444-1.444zM12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8z"/>
                            </svg>
                            Using <strong>SoundCloud</strong>
                        </div>
                        <div style="display: flex; align-items: flex-start; gap: 12px;">
                            <div class="activity-image-preview">
                                <svg class="soundcloud-icon-preview" viewBox="0 0 24 24" style="width: 30px; height: 30px; margin: 15px;">
                                    <path d="M7.443 17.22c0 .333-.069.606-.207.816-.138.211-.33.316-.574.316-.245 0-.437-.105-.575-.316-.137-.21-.206-.483-.206-.816v-5.148c0-.02-.014-.035-.031-.048L3.72 10.63c-.138-.083-.277-.124-.417-.124-.14 0-.279.041-.417.124-.138.083-.207.207-.207.372v6.418c0 .373.1.684.3.933.201.248.487.372.86.372.372 0 .658-.124.859-.372.2-.249.301-.56.301-.933v-4.98l2.444-1.444zM12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8z"/>
                                </svg>
                            </div>
                            <div class="activity-details-preview">
                                <div class="activity-details-text-preview">Paused</div>
                            </div>
                        </div>
                    \`;
                }

                if (activitySection) {
                    activitySection.appendChild(activityContent);
                }
            }

            function parseTimeToMsPreview(time) {
                if (!time) return 0;
                const isNegative = time.trim().startsWith('-');
                const raw = isNegative ? time.trim().slice(1) : time.trim();
                const parts = raw.split(':').map(p => Number(p));
                let seconds = 0;
                for (const part of parts) {
                    seconds = seconds * 60 + (isNaN(part) ? 0 : part);
                }
                const ms = seconds * 1000;
                return isNegative ? -ms : ms;
            }

            function formatTimePreview(ms) {
                const totalSeconds = Math.floor(ms / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                return \`\${minutes}:\${seconds.toString().padStart(2, '0')}\`;
            }

            function startPreviewProgressUpdate(trackInfo) {
                clearInterval(previewProgressInterval);
                
                if (!trackInfo.isPlaying || !trackInfo.elapsed || !trackInfo.duration) {
                    return;
                }

                const startTime = Date.now();
                const elapsedMs = parseTimeToMsPreview(trackInfo.elapsed);
                const totalMs = parseTimeToMsPreview(trackInfo.duration);

                function updatePreviewProgress() {
                    const now = Date.now();
                    const currentElapsed = elapsedMs + (now - startTime);
                    const progress = Math.min((currentElapsed / totalMs) * 100, 100);

                    const progressFill = document.getElementById('progressFillPreview');
                    const currentTimeEl = document.getElementById('currentTimePreview');

                    if (progressFill) {
                        progressFill.style.width = \`\${progress}%\`;
                    }
                    
                    if (currentTimeEl) {
                        currentTimeEl.textContent = formatTimePreview(currentElapsed);
                    }

                    // Stop when track ends
                    if (progress >= 100) {
                        clearInterval(previewProgressInterval);
                    }
                }

                // Update immediately
                updatePreviewProgress();
                
                // Update every second
                previewProgressInterval = setInterval(updatePreviewProgress, 1000);
            }

            // Listen for track updates from main process
            ipcRenderer.on('presence-preview-update', (_, trackInfo) => {
                updatePreviewTrackInfo(trackInfo);
            });

            // Apply all changes
            document.getElementById('applyChanges').addEventListener('click', () => {
                ipcRenderer.send('apply-changes');
            });

            // Listen for theme changes from main process
            ipcRenderer.on('theme-changed', (_, isDark) => {
                document.getElementById('darkMode').checked = isDark;
                document.documentElement.classList.toggle('theme-light', !isDark);
            });

            // Request translations from the main process
            ipcRenderer.on('update-translations', () => {
                ipcRenderer.invoke('get-translations').then((translations) => {
                    // Update all elements with data-i18n attributes
                    document.querySelectorAll('[data-i18n]').forEach(element => {
                        const key = element.getAttribute('data-i18n');
                        if (key && translations[key]) {
                            // Special handling for h2 elements that might contain SVG
                            if (element.tagName === 'H2' && element.querySelector('svg')) {
                                // Update only the text node, preserve SVG
                                const svg = element.querySelector('svg');
                                element.textContent = translations[key];
                                if (svg) element.appendChild(svg);
                            } else {
                                element.textContent = translations[key];
                            }
                        }
                    });

                    // Update placeholder attributes
                    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
                        const key = element.getAttribute('data-i18n-placeholder');
                        if (key && translations[key]) {
                            element.setAttribute('placeholder', translations[key]);
                        }
                    });

                    // Update title attributes (for tooltips)
                    document.querySelectorAll('[data-i18n-title]').forEach(element => {
                        const key = element.getAttribute('data-i18n-title');
                        if (key && translations[key]) {
                            element.setAttribute('title', translations[key]);
                        }
                    });
                });
            });
        `;
    }

    private show(): void {
        this.isVisible = true;
        this.updateBounds();
        this.view.webContents.executeJavaScript(`
            // Force a reflow to ensure animation works
            document.body.style.opacity;
            document.body.classList.add('visible');
        `);
        // Trigger translation updates when panel is shown
        this.getView().webContents.send('update-translations');
    }

    private hide(): void {
        this.view.webContents.executeJavaScript(`
            document.body.classList.remove('visible');
            setTimeout(() => {
                window.postMessage('hidePanel', '*');
            }, 300);
        `);
    }

    public setThemeColors(colors: ThemeColors | null): void {
        if (!colors) {
            // Reset to default theme colors
            this.view.webContents.executeJavaScript(`
                document.documentElement.style.removeProperty('--bg-primary');
                document.documentElement.style.removeProperty('--bg-secondary');
                document.documentElement.style.removeProperty('--text-primary');
                document.documentElement.style.removeProperty('--accent');
            `);
            return;
        }

        // Apply custom theme colors
        this.view.webContents
            .executeJavaScript(
                `
            document.documentElement.style.setProperty('--bg-primary', '${colors.surface || colors.background}');
            document.documentElement.style.setProperty('--bg-secondary', '${colors.background}');
            document.documentElement.style.setProperty('--text-primary', '${colors.text}');
            document.documentElement.style.setProperty('--accent', '${colors.accent || colors.primary}');
        `,
            )
            .catch(console.error);
    }

    public getView(): BrowserView {
        if (!this.view) {
            throw new Error('Settings view is not initialized');
        }
        return this.view;
    }

    public updateTranslations(translationService: TranslationService): void {
        this.translationService = translationService;
        this.getView().webContents.send('update-translations');
    }
}
