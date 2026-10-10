export interface DesktopEntryOptions {
    execPath: string;
    iconName: string;
    wmClass: string;
}

// Inside a quoted Exec value the desktop entry spec reserves the backslash, double
// quote, backtick and dollar sign, so a path holding any of them has to escape them.
function escapeExecArgument(value: string): string {
    return value.replace(/(["$`\\])/g, '\\$1');
}

// An AppImage installs nothing, so no desktop entry maps the running window back to an
// icon and launchers fall back to a generic placeholder. Writing one into the user's
// data dir on first run gets the real icon and a launcher entry.
export function buildDesktopEntry({ execPath, iconName, wmClass }: DesktopEntryOptions): string {
    return [
        '[Desktop Entry]',
        'Name=SoundCloud',
        'Comment=SoundCloud client with Discord Rich Presence',
        `Exec="${escapeExecArgument(execPath)}" %U`,
        `Icon=${iconName}`,
        'Type=Application',
        'Categories=AudioVideo;Audio;Music;',
        `StartupWMClass=${wmClass}`,
        'Terminal=false',
        '',
    ].join('\n');
}
