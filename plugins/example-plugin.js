/**
 * @name example-plugin
 * @author your-name
 * @version 1.0.0
 * @description Plugin description
 * @license MIT
 * @homepage https://github.com/yourname/example-plugin
 */

module.exports = {
    onEnable() {
        console.log('Plugin enabled');
    },

    onDisable() {
        console.log('Plugin disabled');
    },

    onTrackChange(track) {
        if (track.isPlaying) {
            console.log(`Now playing: ${track.title} by ${track.author}`);
        }
    },

    onThemeChange(isDark) {
        console.log(`Theme changed to ${isDark ? 'dark' : 'light'}`);
    },

    /**
     * Return a string of JavaScript that will be injected into the SoundCloud page.
     * This runs in the actual page context with full DOM access, just like a userscript.
     * The code is re-injected on every page load/navigation.
     *
     * To support cleanup when the plugin is disabled, assign a function to:
     *   window.__scrpc_cleanup_<plugin_id>
     * where <plugin_id> matches the filename without .js (e.g. "example-plugin").
     */
    contentScript() {
        return `
            (function() {
                if (window.__examplePluginLoaded) return;
                window.__examplePluginLoaded = true;

                console.log('[example-plugin] Content script running on SoundCloud page');

                // watch for SPA navigation changes
                var observer = new MutationObserver(function() {
                    // react to DOM changes here
                });
                observer.observe(document.body, { childList: true, subtree: true });

                // cleanup handler, called when plugin is disabled
                window.__scrpc_cleanup_example_plugin = function() {
                    observer.disconnect();
                    delete window.__examplePluginLoaded;
                    console.log('[example-plugin] Cleaned up');
                };
            })();
        `;
    },
};
