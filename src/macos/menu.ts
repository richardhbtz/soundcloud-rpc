import { Menu } from 'electron';

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
        submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'togglefullscreen' }],
    },
    { role: 'window', submenu: [{ role: 'minimize' }, { role: 'quit' }] },
    {
        label: 'Help',
        submenu: [
            {
                label: 'Learn More',
                click() {
                    require('electron').shell.openExternal('https://github.com/richardhbtz/soundcloud-rpc');
                },
            },
        ],
    },
];

export function setupDarwinMenu(): void {
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
