import { BrowserWindow, BrowserView, ipcMain } from 'electron';
import * as path from 'path';

export class headerManager {
    private readonly HEADER_HEIGHT = 32;
    private mainWindow: BrowserWindow;
    private headerView: BrowserView;
    private contentView: BrowserView;

    constructor(mainWindow: BrowserWindow, contentView: BrowserView) {
        this.mainWindow = mainWindow;
        this.contentView = contentView;
        
        // Create header view
        this.headerView = new BrowserView({
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
        });

        this.setupViews();
        this.setupEventHandlers();
    }

    private setupViews() {
        // Add and configure header view
        this.mainWindow.addBrowserView(this.headerView);
        this.headerView.setBounds({ 
            x: 0, 
            y: 0, 
            width: this.mainWindow.getBounds().width, 
            height: this.HEADER_HEIGHT 
        });
        this.headerView.setAutoResize({ width: true, height: false });
        this.headerView.webContents.loadFile(path.join(__dirname, 'header.html'));

        // Configure content view bounds
        this.contentView.setBounds({
            x: 0,
            y: this.HEADER_HEIGHT,
            width: this.mainWindow.getBounds().width,
            height: this.mainWindow.getBounds().height - this.HEADER_HEIGHT,
        });
        this.contentView.setAutoResize({ width: true, height: true });
    }

    private setupEventHandlers() {
        // Window control handlers
        ipcMain.on('minimize-window', () => this.mainWindow.minimize());
        ipcMain.on('maximize-window', () => {
            if (this.mainWindow.isMaximized()) {
                this.mainWindow.unmaximize();
            } else {
                this.mainWindow.maximize();
            }
        });
        ipcMain.on('close-window', () => this.mainWindow.close());
        ipcMain.on('title-bar-double-click', () => {
            if (this.mainWindow.isMaximized()) {
                this.mainWindow.unmaximize();
            } else {
                this.mainWindow.maximize();
            }
        });

        // Window state change handlers
        this.mainWindow.on('maximize', () => {
            this.headerView.webContents.send('window-state-changed', 'maximized');
            this.adjustContentViews();
        });

        this.mainWindow.on('unmaximize', () => {
            this.headerView.webContents.send('window-state-changed', 'normal');
            this.adjustContentViews();
        });

        this.mainWindow.on('resize', () => this.adjustContentViews());

        // Initial state handler
        ipcMain.on('get-initial-state', () => {
            this.headerView.webContents.send(
                'window-state-changed', 
                this.mainWindow.isMaximized() ? 'maximized' : 'normal'
            );
        });
    }

    private adjustContentViews() {
        const { width, height } = this.mainWindow.getContentBounds();

        this.headerView.setBounds({
            x: 0,
            y: 0,
            width,
            height: this.HEADER_HEIGHT,
        });

        this.contentView.setBounds({
            x: 0,
            y: this.HEADER_HEIGHT,
            width,
            height: height - this.HEADER_HEIGHT,
        });
    }
} 