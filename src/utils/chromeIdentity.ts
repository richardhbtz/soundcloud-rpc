import { app, type WebContents } from 'electron';
import { chromeBrandList } from './userAgent';

/**
 * Electron reports its client hints as bare "Chromium" while the UA we send says Chrome, a mismatch
 * bot detection can see. Add the "Google Chrome" brand the way a real Chrome build lists it, in both
 * the Sec-CH-UA headers and navigator.userAgentData. Electron has no API for this; the devtools
 * protocol is the only route that keeps headers and JS consistent.
 *
 * `secureView` is any loaded view on a secure context (the header). It supplies the genuine platform
 * and architecture hints, so none of them are invented here.
 *
 * Leaves `content` on about:blank: the override needs a live frame and has to be in place before the
 * first real request.
 */
export async function presentAsChrome(content: WebContents, secureView: WebContents, userAgent: string): Promise<void> {
    const real = await secureView.executeJavaScript(
        `navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'formFactors', 'model', 'platformVersion', 'uaFullVersion', 'wow64'])`,
    );
    const override = {
        userAgent,
        userAgentMetadata: {
            brands: chromeBrandList(real.uaFullVersion, false),
            fullVersionList: chromeBrandList(real.uaFullVersion, true),
            fullVersion: real.uaFullVersion,
            platform: real.platform,
            platformVersion: real.platformVersion,
            architecture: real.architecture,
            model: real.model,
            mobile: real.mobile,
            bitness: real.bitness,
            wow64: real.wow64,
            formFactors: real.formFactors,
        },
    };
    const autoAttach = { autoAttach: true, waitForDebuggerOnStart: true, flatten: true };

    await content.loadURL('about:blank');
    const dbg = content.debugger;
    dbg.attach('1.3');
    await dbg.sendCommand('Emulation.setUserAgentOverride', override);

    // Cross-site iframes and workers are separate targets that do not inherit the override. They
    // start paused so it lands before their first request; not every target type has every domain,
    // and a target can be gone by the time we answer, so each step is best-effort.
    // ponytail: service workers are not children of the page and keep the Chromium-only brand;
    // rewrite Sec-CH-UA in session.webRequest.onBeforeSendHeaders if that turns out to matter.
    const quiet = (method: string, params: object, sessionId: string) =>
        dbg.sendCommand(method, params, sessionId).catch(() => {});
    dbg.on('message', async (_event, method, params) => {
        if (method !== 'Target.attachedToTarget') return;
        await quiet('Emulation.setUserAgentOverride', override, params.sessionId);
        await quiet('Target.setAutoAttach', autoAttach, params.sessionId);
        await quiet('Runtime.runIfWaitingForDebugger', {}, params.sessionId);
    });
    await dbg.sendCommand('Target.setAutoAttach', autoAttach);

    // A debugger still attached at shutdown crashes Electron while it disposes the V8 isolate
    // (SIGTRAP, with a crash report on every quit), so let go of it first.
    const detach = () => {
        if (!content.isDestroyed() && dbg.isAttached()) dbg.detach();
    };
    app.once('before-quit', detach);
    content.once('destroyed', () => app.off('before-quit', detach));
}
