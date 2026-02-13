/**
 * @name shuffle-fix
 * @author iamnotbobby
 * @version 1.0.0
 * @description Fixes SoundCloud's shuffle limitation where it only shuffles currently loaded tracks instead of the entire playlist/collection. Configurable via editing plugin file. Be aware this is experimental!
 * @license MIT
 * @homepage https://gist.github.com/iamnotbobby/604828ac84d9d1ec54eabb8d99d56c7b
 */

// View the homepage for important information and known issues!

const MAX_LIMIT = 250; // Maximum tracks to request per API call
const BATCH_SIZE = 50; // Number of tracks to load per batch

module.exports = {
    onEnable() {
        console.log('shuffle-fix enabled');
    },

    onDisable() {
        console.log('shuffle-fix disabled');
    },

    contentScript() {
        return `
(function() {
    if (window.__shuffleFixLoaded) return;
    window.__shuffleFixLoaded = true;

    const MAX_LIMIT = ${MAX_LIMIT};
    const BATCH_SIZE = ${BATCH_SIZE};

    function findWebpackRequire() {
        if (typeof window.webpackJsonp !== 'undefined') {
            let requireFunc = null;
            // Do not remove module or exports even if unused, will break!
            window.webpackJsonp.push([[], {'_': function(module, exports, __webpack_require__) { requireFunc = __webpack_require__; }}, [['_']]]);
            return requireFunc;
        }
        for (const key in window) {
            if (key.startsWith('webpackChunk')) {
                const chunk = window[key];
                if (Array.isArray(chunk)) {
                    let requireFunc = null;
                    // Do not remove module or exports even if unused, will break!
                    chunk.push([['_'], {'_': function(module, exports, __webpack_require__) { requireFunc = __webpack_require__; }}, [['_']]]);
                    if (requireFunc) return requireFunc;
                }
            }
        }
        return null;
    }

    function patchModules(webpackRequire) {
        const cache = webpackRequire.c || {};
        for (const moduleId in cache) {
            try {
                const moduleExports = cache[moduleId]?.exports;
                
                if (moduleExports?.prototype) {
                    const proto = moduleExports.prototype;
                    if (proto.defaults?.limit !== undefined) {
                        proto.defaults.limit = MAX_LIMIT;
                        proto.defaults.maxPageSize = MAX_LIMIT;
                    }
                    if (typeof proto.setLimit === 'function' && !proto.setLimit._patched) {
                        const originalSetLimit = proto.setLimit;
                        proto.setLimit = function(limit) {
                            return originalSetLimit.call(this, Math.max(limit, MAX_LIMIT));
                        };
                        proto.setLimit._patched = true;
                    }
                }
                
                if (moduleExports?.states?.shuffle?.setup) {
                    const originalSetup = moduleExports.states.shuffle.setup;
                    moduleExports.states.shuffle.setup = function() {
                        const queue = moduleExports.getQueue?.();
                        if (queue?.next_href && queue.next_href !== false) {
                            console.warn('Queue has more pages -', queue.length, 'tracks loaded');
                        }
                        return originalSetup.apply(this, arguments);
                    };
                }
                
                if (moduleExports?.toggleShuffle && moduleExports?.getQueue && !moduleExports.toggleShuffle._patched) {
                    const originalToggleShuffle = moduleExports.toggleShuffle;
                    let isLoading = false;
                    let loadingTimeout = null;
                    
                    moduleExports.toggleShuffle = async function() {
                        const shuffleButtonElement = document.querySelector('.shuffleControl');
                        const isShuffleActive = shuffleButtonElement?.classList.contains('m-shuffling');
                        
                        if (isShuffleActive) {
                            console.log('Disabling shuffle');
                            return originalToggleShuffle.apply(this, arguments);
                        }
                        
                        if (isLoading) {
                            console.log('Already loading tracks!');
                            return;
                        }
                        
                        if (shuffleButtonElement) {
                            shuffleButtonElement.style.pointerEvents = 'none';
                            shuffleButtonElement.style.opacity = '0.5';
                        }
                        
                        const queue = moduleExports.getQueue();
                        if (queue) {
                            const initialLength = queue.length;
                            const hasMore = moduleExports.hasMoreAhead && moduleExports.hasMoreAhead();
                            
                            if (!hasMore) {
                                console.log('All', initialLength, 'tracks already loaded in queue');
                                if (shuffleButtonElement) {
                                    shuffleButtonElement.style.pointerEvents = '';
                                    shuffleButtonElement.style.opacity = '';
                                }
                                originalToggleShuffle.call(this);
                                return;
                            }
                            
                            if (hasMore) {
                                isLoading = true;
                                
                                loadingTimeout = setTimeout(() => {
                                    isLoading = false;
                                    console.warn('Loading timeout reached (60s), releasing lock and restoring button');
                                    if (shuffleButtonElement) {
                                        shuffleButtonElement.style.pointerEvents = '';
                                        shuffleButtonElement.style.opacity = '';
                                    }
                                }, 60000);
                                
                                try {
                                    console.log('Enabling shuffle - loading all tracks...');
                                    console.log('Current queue length:', initialLength);
                                    console.log('Loading with MAX_LIMIT:', MAX_LIMIT, 'BATCH_SIZE:', BATCH_SIZE);
                                    
                                    let stalledCycles = 0;
                                    let lastLength = initialLength;
                                    
                                    while (stalledCycles <= 33) {
                                        const hasMoreTracks = moduleExports.hasMoreAhead && moduleExports.hasMoreAhead();
                                        
                                        if (!hasMoreTracks) {
                                            console.log('Stream ended - all tracks loaded');
                                            break;
                                        }
                                        
                                        if (moduleExports.pullNext) {
                                            try {
                                                moduleExports.pullNext(BATCH_SIZE);
                                            } catch (e) {
                                                console.error('Error calling pullNext:', e);
                                                break;
                                            }
                                        }
                                        
                                        await new Promise(resolve => setTimeout(resolve, 150));
                                        
                                        if (queue.length > lastLength) {
                                            const loaded = queue.length - lastLength;
                                            lastLength = queue.length;
                                            stalledCycles = 0;
                                            console.log('Queue now has', lastLength, 'tracks (+' + loaded + ')');
                                        } else {
                                            stalledCycles++;
                                        }
                                    }
                                    
                                    if (stalledCycles > 33) {
                                        console.warn('Stream stalled');
                                    }
                                    
                                    console.log('Finished - queue loaded with', queue.length, 'tracks (was', initialLength, ')');
                                    
                                    originalToggleShuffle.call(this);
                                } catch (error) {
                                    console.error('Error during track loading:', error);
                                } finally {
                                    isLoading = false;
                                    if (loadingTimeout) {
                                        clearTimeout(loadingTimeout);
                                        loadingTimeout = null;
                                    }
                                    if (shuffleButtonElement) {
                                        shuffleButtonElement.style.pointerEvents = '';
                                        shuffleButtonElement.style.opacity = '';
                                    }
                                }
                            }
                        }
                    };
                    moduleExports.toggleShuffle._patched = true;
                }
            } catch (e) {}
        }
    }

    function patchXHR() {
        const OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            const xhr = new OriginalXHR();
            const originalOpen = xhr.open;
            xhr.open = function(method, url, ...args) {
                if (typeof url === 'string' && url.includes('api')) {
                    try {
                        const urlObj = new URL(url, window.location.origin);
                        if (url.match(/\\/(likes|tracks|playlists|favorites|stream)/)) {
                            const currentLimit = urlObj.searchParams.get('limit');
                            if (currentLimit && parseInt(currentLimit) < MAX_LIMIT) {
                                urlObj.searchParams.set('limit', MAX_LIMIT.toString());
                                url = urlObj.toString();
                            }
                        }
                    } catch (e) {}
                }
                return originalOpen.call(this, method, url, ...args);
            };
            return xhr;
        };
        Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
        window.XMLHttpRequest.prototype = OriginalXHR.prototype;
    }

    const webpackRequire = findWebpackRequire();
    if (webpackRequire) {
        patchModules(webpackRequire);
        console.log('Successfully patched webpack modules');
    } else {
        console.warn('Could not find webpack require function');
    }
    patchXHR();
    console.log('Initialized with MAX_LIMIT:', MAX_LIMIT);

    window.__scrpc_cleanup_shuffle_fix = function() {
        delete window.__shuffleFixLoaded;
    };
})();
        `;
    },
};
