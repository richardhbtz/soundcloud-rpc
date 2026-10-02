import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// preload.ts registers its wheel listener at import time, so grab it through stubs
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('electron', () => ({ contextBridge: { exposeInMainWorld: vi.fn() }, ipcRenderer: { send } }));

class FakeScroller {
    constructor(
        public scrollLeft = 0,
        public scrollWidth = 0,
        public clientWidth = 0,
        public overflowX = 'auto',
    ) {}
}

// <html> doubles as the viewport, which scrolls through it
const html = new FakeScroller();
const body = new FakeScroller();
const composedPath = vi.fn();
let onWheel: (e: object) => void;
let onCopy: (e: object) => void;
let selection = '';
let now = 0;
const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform') as PropertyDescriptor;

/** Ten wheel events, 16ms apart like a 60Hz trackpad, that add up to dx / dy. */
function swipe(dx: number, opts: { dy?: number; path?: object[]; ctrlKey?: boolean; shiftKey?: boolean } = {}) {
    composedPath.mockReturnValue(opts.path ?? []);
    for (let i = 0; i < 10; i++) {
        now += 16;
        onWheel({
            deltaX: dx / 10,
            deltaY: (opts.dy ?? 0) / 10,
            timeStamp: now,
            ctrlKey: opts.ctrlKey ?? false,
            shiftKey: opts.shiftKey ?? false,
            composedPath,
        });
    }
}

// longer than the gap that ends a gesture
const pause = () => {
    now += 500;
};

beforeAll(async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    vi.stubGlobal('Element', FakeScroller);
    vi.stubGlobal('document', {
        documentElement: html,
        body,
        addEventListener: (_type: string, listener: (e: object) => void) => {
            onCopy = listener;
        },
    });
    vi.stubGlobal('getSelection', () => selection);
    vi.stubGlobal('getComputedStyle', (el: FakeScroller) => ({ overflowX: el.overflowX }));
    vi.stubGlobal('window', {
        addEventListener: (_type: string, listener: (e: object) => void) => {
            onWheel = listener;
        },
    });
    await import('./preload.js');
});

afterAll(() => {
    Object.defineProperty(process, 'platform', realPlatform);
    vi.unstubAllGlobals();
});

beforeEach(() => {
    send.mockClear();
    composedPath.mockClear();
    Object.assign(html, { scrollLeft: 0, scrollWidth: 0, clientWidth: 0, overflowX: 'visible' });
    Object.assign(body, { scrollLeft: 0, scrollWidth: 0, clientWidth: 0, overflowX: 'visible' });
    pause();
});

describe('two-finger swipe navigation', () => {
    it('goes back once for a rightward swipe and ignores its momentum tail', () => {
        swipe(-200);
        swipe(-100);
        expect(send.mock.calls).toEqual([['navigate-back']]);
    });

    it('goes forward for a leftward swipe', () => {
        swipe(200);
        expect(send.mock.calls).toEqual([['navigate-forward']]);
    });

    it('navigates again for a new gesture after a pause', () => {
        swipe(-200);
        pause();
        swipe(-200);
        expect(send).toHaveBeenCalledTimes(2);
    });

    it('ignores short swipes, sideways drift while scrolling down, pinch-zoom and shift-scroll', () => {
        swipe(-100);
        pause();
        swipe(-300, { dy: 400 });
        pause();
        swipe(-300, { ctrlKey: true });
        pause();
        swipe(-300, { shiftKey: true });
        expect(send).not.toHaveBeenCalled();
    });

    it('lets a scroller with room left own the whole gesture, even after it hits its edge', () => {
        const carousel = new FakeScroller(100, 1000, 500);
        swipe(-100, { path: [carousel] });
        carousel.scrollLeft = 0;
        swipe(-400, { path: [carousel] });
        expect(send).not.toHaveBeenCalled();

        pause();
        swipe(-200, { path: [carousel] }); // already at its edge, so the swipe is ours
        expect(send.mock.calls).toEqual([['navigate-back']]);
    });

    it('checks scrollers once per gesture, not on every wheel event', () => {
        swipe(-100, { path: [new FakeScroller(0, 1000, 500)] });
        expect(composedPath).toHaveBeenCalledTimes(1);
    });

    it('pans a sideways-overflowing page first, then navigates at its edge (soundcloud.com shape)', () => {
        // <html> stays visible, so <body>'s overflow-x goes to the viewport; body.scrollLeft never moves
        // even though its metrics show the overflow (measured on the live page: 960 / 792)
        Object.assign(body, { overflowX: 'auto', scrollWidth: 960, clientWidth: 792 });
        Object.assign(html, { scrollWidth: 960, clientWidth: 792 });
        const path = [body, html];

        swipe(200, { path }); // forward, but the page can still pan right
        expect(send).not.toHaveBeenCalled();

        pause();
        swipe(-200, { path }); // back, already at the left edge
        expect(send.mock.calls).toEqual([['navigate-back']]);

        send.mockClear();
        pause();
        html.scrollLeft = 167.5; // panned all the way right; fractional at some zoom levels
        swipe(-200, { path }); // back would pan the page left first
        expect(send).not.toHaveBeenCalled();

        pause();
        swipe(200, { path }); // forward at the right edge
        expect(send.mock.calls).toEqual([['navigate-forward']]);
    });

    it.each([
        ['html', 'hidden', html],
        ['body', 'hidden', body],
        ['body', 'clip', body],
    ])('does not treat a page with <%s> overflow-x: %s as scrollable', (_tag, value, el) => {
        el.overflowX = value; // scrollWidth still reports the overflow
        Object.assign(html, { scrollWidth: 960, clientWidth: 792 });
        swipe(200, { path: [body, html] });
        expect(send.mock.calls).toEqual([['navigate-forward']]);
    });
});

describe('copying links', () => {
    function copy(text: string) {
        selection = text;
        const event = { clipboardData: { setData: vi.fn() }, preventDefault: vi.fn() };
        onCopy(event);
        return event;
    }

    it('drops the share id and utm parameters from a SoundCloud link', () => {
        const event = copy(
            'https://soundcloud.com/a/sets/b?si=c8637d5b&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
        );
        expect(event.clipboardData.setData).toHaveBeenCalledWith('text/plain', 'https://soundcloud.com/a/sets/b');
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('keeps other parameters and the timestamp', () => {
        const event = copy('https://soundcloud.com/a/b?in=a/sets/c&si=1#t=0:30');
        expect(event.clipboardData.setData).toHaveBeenCalledWith(
            'text/plain',
            'https://soundcloud.com/a/b?in=a/sets/c#t=0:30',
        );
    });

    it('leaves everything else to the default copy', () => {
        for (const text of ['just some text', 'https://example.com/?utm_source=x', 'https://soundcloud.com/a/b']) {
            expect(copy(text).preventDefault).not.toHaveBeenCalled();
        }
    });
});
