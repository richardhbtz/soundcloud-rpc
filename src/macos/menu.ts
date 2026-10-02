import { Menu, shell } from 'electron';

let reloadContent: () => void = () => {};

const template: Electron.MenuItemConstructorOptions[] = [
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'selectAll' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'delete' },
        ],
    },
    {
        label: 'View',
        submenu: [
            { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => reloadContent() },
            { type: 'separator' },
            { role: 'togglefullscreen' },
        ],
    },
    { role: 'window', submenu: [{ role: 'minimize' }, { role: 'quit' }] },
    {
        label: 'Help',
        submenu: [
            {
                label: 'Learn More',
                click: () => void shell.openExternal('https://github.com/elricfd/sc-desktop'),
            },
        ],
    },
];

export function setupDarwinMenu(onReload: () => void): void {
    reloadContent = onReload;
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
