import { describe, it, expect } from 'vitest';
import { buildDesktopEntry } from './desktopEntry';

const options = {
    execPath: '/home/user/Apps/SoundCloud.AppImage',
    iconName: 'soundcloud-rpc',
    wmClass: 'soundcloud-rpc',
};

describe('buildDesktopEntry', () => {
    it('writes a launchable desktop entry', () => {
        const entry = buildDesktopEntry(options);

        expect(entry.startsWith('[Desktop Entry]\n')).toBe(true);
        expect(entry).toContain('Type=Application');
        expect(entry).toContain('Exec="/home/user/Apps/SoundCloud.AppImage" %U');
        expect(entry).toContain('Icon=soundcloud-rpc');
        expect(entry).toContain('StartupWMClass=soundcloud-rpc');
    });

    it('ends with a newline so the file is a well formed entry', () => {
        expect(buildDesktopEntry(options).endsWith('\n')).toBe(true);
    });

    it('escapes characters the spec reserves inside a quoted Exec value', () => {
        const entry = buildDesktopEntry({
            ...options,
            execPath: '/home/user/My "Apps"/$HOME/`x`/back\\slash.AppImage',
        });

        expect(entry).toContain('Exec="/home/user/My \\"Apps\\"/\\$HOME/\\`x\\`/back\\\\slash.AppImage" %U');
    });

    it('keeps the icon and window class configurable', () => {
        const entry = buildDesktopEntry({ ...options, iconName: 'custom-icon', wmClass: 'custom-class' });

        expect(entry).toContain('Icon=custom-icon');
        expect(entry).toContain('StartupWMClass=custom-class');
    });
});
