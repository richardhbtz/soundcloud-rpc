function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Electron's default user agent is a genuine Chrome user agent with two extra product
// tokens bolted onto it. Dropping only those tokens leaves a string that still agrees
// with the Chromium version, client hints, platform and TLS fingerprint the engine
// really presents. A hand-written user agent agrees with none of them, and bot
// detection reads headers claiming one browser on top of an engine behaving like
// another as automation.
export function stripAppTokensFromUserAgent(userAgent: string, appName: string): string {
    return userAgent
        .replace(new RegExp(`\\s*\\b${escapeRegExp(appName)}/\\S+`, 'i'), '')
        .replace(/\s*\bElectron\/\S+/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}
