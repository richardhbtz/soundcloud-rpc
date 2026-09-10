import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Script, createContext } from 'vm';
import { describe, expect, it, vi } from 'vitest';
import { parseMetadata } from '../utils/metadataParser';

interface PlaybackSpeedPlugin {
    onEnable?: () => void;
    onDisable?: () => void;
    contentScript?: () => string;
}

function loadPlugin(): { source: string; plugin: PlaybackSpeedPlugin } {
    const source = readFileSync(resolve(process.cwd(), 'plugins/playback-speed.js'), 'utf8');
    const module = { exports: {} as PlaybackSpeedPlugin };
    const context = createContext({
        module,
        exports: module.exports,
        console: {
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    });

    new Script(source, { filename: 'playback-speed.js' }).runInContext(context);
    return { source, plugin: module.exports };
}

describe('Playback Speed plugin', () => {
    it('has valid metadata and lifecycle hooks', () => {
        const { source, plugin } = loadPlugin();
        const metadata = parseMetadata(source, 'js');

        expect(metadata.name).toBe('Playback Speed');
        expect(metadata.version).toBe('1.4.0');
        expect(metadata.license).toBe('MIT');
        expect(plugin.onEnable).toBeTypeOf('function');
        expect(plugin.onDisable).toBeTypeOf('function');
        expect(plugin.contentScript).toBeTypeOf('function');
    });

    it('produces syntactically valid page code with the expected controls', () => {
        const { plugin } = loadPlugin();
        const contentScript = plugin.contentScript?.();

        expect(contentScript).toContain('MIN_RATE = 0.5');
        expect(contentScript).toContain('MAX_RATE = 2');
        expect(contentScript).toContain('RATE_STEP = 0.05');
        expect(contentScript).toContain('__scrpc_cleanup_playback_speed');
        expect(contentScript).toContain('preservesPitch');
        expect(contentScript).toContain('new Proxy(originalAudioConstructor');
        expect(contentScript).toContain("patchMediaMethod(prototype, 'play')");
        expect(contentScript).toContain('installCurrentTimeHook(prototype)');
        expect(contentScript).toContain('getTrackedMediaCount');
        expect(contentScript).toContain('scrpc-playback-speed-panel-host');
        expect(contentScript).toContain("document.createElement('div')");
        expect(contentScript).toContain('all:initial!important');
        expect(contentScript).toContain(':host([data-open="false"]) .panel');
        expect(contentScript).toContain('step-down');
        expect(contentScript).toContain('step-up');
        expect(contentScript).toContain('BlinkMacSystemFont');
        expect(contentScript).not.toContain('sendTrackUpdate');
        expect(contentScript).not.toContain('setInterval');
        expect(contentScript).not.toContain('RPC_SYNC');
        expect(contentScript).not.toContain('scrpcPlaybackRate');
        expect(contentScript?.match(/<button class="toggle"/g)).toHaveLength(1);
        expect(() => new Script(contentScript ?? '')).not.toThrow();
    });
});
