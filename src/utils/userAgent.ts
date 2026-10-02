// Electron's real UA with the app-name and Electron/<ver> tokens removed, and the Chrome version
// reduced to MAJOR.0.0.0 the way Chrome itself sends it. Platform and major version stay genuine,
// so client hints agree with the UA.
export function deriveBrowserUserAgent(electronUserAgent: string, appName: string): string {
    const escaped = appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return electronUserAgent
        .replace(new RegExp(`\\s?${escaped}/\\S+`), '')
        .replace(/\s?Electron\/\S+/, '')
        .replace(/(Chrome\/\d+)\.\S+/, '$1.0.0.0')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

export interface UaBrand {
    brand: string;
    version: string;
}

// The client-hint brand list a Google Chrome build of this Chromium version reports. Same algorithm
// as Chromium's GenerateBrandVersionList (grease string, grease version and ordering are all seeded
// by the major version); Electron runs it without the "Google Chrome" entry.
export function chromeBrandList(chromiumVersion: string, full: boolean): UaBrand[] {
    const major = parseInt(chromiumVersion, 10);
    const chars = [' ', '(', ':', '-', '.', '/', ')', ';', '=', '?', '_'];
    const version = full ? chromiumVersion : String(major);
    const grease = {
        brand: `Not${chars[major % 11]}A${chars[(major + 1) % 11]}Brand`,
        version: ['8', '99', '24'][major % 3] + (full ? '.0.0.0' : ''),
    };

    const order = [
        [0, 1, 2],
        [0, 2, 1],
        [1, 0, 2],
        [1, 2, 0],
        [2, 0, 1],
        [2, 1, 0],
    ][major % 6];
    const list: UaBrand[] = [];
    list[order[0]] = grease;
    list[order[1]] = { brand: 'Chromium', version };
    list[order[2]] = { brand: 'Google Chrome', version };
    return list;
}
