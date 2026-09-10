// Electron's real UA with only the app-name and Electron/<ver> tokens removed.
// Platform and Chrome version stay genuine, so client hints agree with the UA.
export function deriveBrowserUserAgent(electronUserAgent: string, appName: string): string {
    const escaped = appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return electronUserAgent
        .replace(new RegExp(`\\s?${escaped}/\\S+`), '')
        .replace(/\s?Electron\/\S+/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}
