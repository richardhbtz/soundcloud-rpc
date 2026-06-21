// doesnt work!!!!!!
/**
 * @name cobalt-downloader
 * @author elric
 * @version 1.0.0
 * @description **WIP** adds direct mp3 download button using official cobalt api
 * @license MIT
 */

// target official api endpoint exclusively
const cobaltEndpoint = 'https://api.cobalt.tools';

module.exports = {
    onEnable() {
        console.log('Cobalt downloader enabled');
    },

    onDisable() {
        console.log('Cobalt downloader disabled');
    },

    contentScript() {
        return `
            (function() {
                if (window.__cobaltPluginLoaded) return;
                window.__cobaltPluginLoaded = true;

                console.log('[cobalt-downloader] injected official api target');

                async function ripCobaltAudio(trackUrl, btn) {
                    // setup hidden iframe clean room &&& steal unpatched fetch engine
                    const frame = document.createElement('iframe');
                    frame.style.display = 'none';
                    document.body.appendChild(frame);
                    const cleanFetch = frame.contentWindow.fetch;

                    // hard 10 second socket killswitch
                    const controller = new AbortController();
                    const killTimer = setTimeout(() => controller.abort(), 10000);

                    try {
                        console.log('[cobalt-downloader] hitting official endpoint:', cobaltEndpoint);
                        
                        // dispatch v11 payload
                        const res = await cleanFetch(cobaltEndpoint + '/', {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                url: trackUrl,
                                downloadMode: 'audio',
                                audioFormat: 'mp3'
                            }),
                            signal: controller.signal
                        });

                        clearTimeout(killTimer);
                        const data = await res.json();

                        if (res.ok && data.url) {
                            console.log('[cobalt-downloader] payload resolved officially');
                            
                            // force browser download execution
                            const a = document.createElement('a');
                            a.href = data.url;
                            a.download = '';
                            a.target = '_blank';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();

                            btn.innerText = 'Downloaded!';
                            setTimeout(() => btn.innerText = 'Download', 2000);
                        } else {
                            // parse rejection text from server
                            const errorText = data.error?.code || data.text || JSON.stringify(data);
                            console.warn('[cobalt-downloader] official api rejected payload:', errorText);
                            btn.innerText = 'Error';
                            setTimeout(() => btn.innerText = 'Download', 2000);
                        }
                    } catch (err) {
                        clearTimeout(killTimer);
                        console.error('[cobalt-downloader] execution failure:', err.message);
                        btn.innerText = 'Failed';
                        setTimeout(() => btn.innerText = 'Download', 2000);
                    } finally {
                        // destroy iframe clean room unconditionally
                        frame.remove();
                    }
                }

                // observe dom mutations &&& inject custom download button
                var observer = new MutationObserver(function() {
                    const actionGroups = document.querySelectorAll('.soundActions:not(.cobalt-processed)');
                    
                    actionGroups.forEach(group => {
                        group.classList.add('cobalt-processed');
                        
                        const btn = document.createElement('button');
                        btn.className = 'sc-button sc-button-small sc-cobalt-btn';
                        btn.innerText = 'Download';
                        btn.style.marginLeft = '5px';
                        btn.title = 'download via official cobalt api';
                        
                        btn.onclick = (e) => {
                            e.preventDefault();
                            const soundItem = btn.closest('.soundList__item, .trackItem');
                            let trackUrl = window.location.href;
                            
                            // extract precise track link if clicked inside feed
                            if (soundItem) {
                                const link = soundItem.querySelector('.soundTitle__title');
                                if (link) trackUrl = link.href;
                            }
                            
                            btn.innerText = 'Fetching...';
                            ripCobaltAudio(trackUrl, btn);
                        };
                        
                        group.appendChild(btn);
                    });
                });
                
                observer.observe(document.body, { childList: true, subtree: true });

                // strip buttons &&& purge memory when plugin disabled
                window.__scrpc_cleanup_cobalt_downloader = function() {
                    observer.disconnect();
                    document.querySelectorAll('.sc-cobalt-btn').forEach(btn => btn.remove());
                    document.querySelectorAll('.cobalt-processed').forEach(el => el.classList.remove('cobalt-processed'));
                    delete window.__cobaltPluginLoaded;
                    console.log('[cobalt-downloader] completely purged');
                };
            })();
        `;
    },
};
