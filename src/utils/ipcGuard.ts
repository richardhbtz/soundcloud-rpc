import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';

/**
 * ipcMain is one bus shared by every renderer, including the tabs showing soundcloud.com and
 * its ad frames. Privileged handlers (opening paths, enabling plugins, writing settings,
 * switching accounts) only act on messages from views the app built itself, which register
 * here as they are created. Tabs never do.
 */
const trustedSenderIds = new Set<number>();

export function markTrustedSender(webContents: WebContents): void {
    trustedSenderIds.add(webContents.id);

    // ids are recycled, so a stale entry would silently grant trust to a later view
    webContents.once('destroyed', () => {
        trustedSenderIds.delete(webContents.id);
    });
}

export function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
    return trustedSenderIds.has(event.sender.id);
}

/** Wrap an `ipcMain.on` listener so it drops messages from untrusted renderers. */
export function trustedOn<T extends unknown[]>(
    handler: (event: IpcMainEvent, ...args: T) => void,
    channel = 'ipc',
): (event: IpcMainEvent, ...args: T) => void {
    return (event, ...args) => {
        if (!isTrustedSender(event)) {
            console.warn(`Ignored "${channel}" from an untrusted renderer`);
            return;
        }
        handler(event, ...args);
    };
}

/** Wrap an `ipcMain.handle` handler so untrusted renderers get a rejection, not a result. */
export function trustedHandle<T extends unknown[], R>(
    handler: (event: IpcMainInvokeEvent, ...args: T) => R,
    channel = 'ipc',
): (event: IpcMainInvokeEvent, ...args: T) => R | Promise<never> {
    return (event, ...args) => {
        if (!isTrustedSender(event)) {
            console.warn(`Rejected "${channel}" from an untrusted renderer`);
            return Promise.reject(new Error(`Blocked ${channel}`));
        }
        return handler(event, ...args);
    };
}
