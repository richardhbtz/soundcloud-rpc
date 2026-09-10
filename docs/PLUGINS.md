# Plugins

Plugins are JavaScript files dropped into the plugins folder. You can open it from **Settings → Plugins → Open folder**.

## Security model — read this before installing a plugin

**A plugin is fully trusted code. Installing one is equivalent to installing a native application.**

Plugin files run in the Electron **main process** with the complete Node.js API available to them. A plugin can read and
write any file your user account can, spawn processes, open network connections, and read anything the app has stored —
including your Last.fm session key and proxy credentials.

The loader wraps plugin source in a `vm` context to give it a CommonJS-like `module` / `exports` shape. **That is a
convenience, not a sandbox.** Node's `vm` module is explicitly not a security boundary, and a plugin can step outside
the supplied globals in a single expression. Do not rely on it to contain anything.

Only install plugins whose source you have read, or whose author you trust the way you would trust the author of any
program you install.

## Approval is tied to file contents

When you enable a plugin, the app records a SHA-256 hash of the exact source it ran.

If the file's contents later change — an edit, an update, or a different file dropped in under the same name — the
plugin is **not** silently re-enabled. It reverts to disabled and you have to enable it again, so replacing a file
cannot cause code to run without your say-so.

You will see a warning in the log when this happens:

```
Plugin "example-plugin" changed on disk since it was enabled; it stays disabled until re-enabled.
```

This is expected after you edit a plugin. Re-enable it in Settings to approve the new version.

## Writing a plugin

Metadata goes in a comment block at the top of the file:

```js
/**
 * @name Example Plugin
 * @description Does something useful
 * @version 1.0.0
 * @author you
 */
```

Export any of the following hooks:

| Hook            | Signature                   | Called when                                  |
| --------------- | --------------------------- | -------------------------------------------- |
| `onEnable`      | `() => void`                | The plugin is activated                      |
| `onDisable`     | `() => void`                | The plugin is deactivated                    |
| `onTrackChange` | `(track) => void`           | A new track starts                           |
| `onThemeChange` | `(isDark: boolean) => void` | The theme is switched                        |
| `contentScript` | `() => string`              | Returns JS to run inside the SoundCloud page |

```js
module.exports = {
    onEnable() {
        console.log('enabled');
    },
    onTrackChange(track) {
        console.log(track.title, 'by', track.author);
    },
};
```

### Content scripts

`contentScript()` returns source that runs in the SoundCloud page's renderer, not in the main process. Assign a cleanup
function to `window.__scrpc_cleanup_<id>` and it will be called when the plugin is disabled — `<id>` is your filename
with any character outside `a-z A-Z 0-9 _` replaced by an underscore.

```js
module.exports = {
    contentScript() {
        return `
            const handler = () => console.log('clicked');
            document.addEventListener('click', handler);
            window.__scrpc_cleanup_my_plugin = () => {
                document.removeEventListener('click', handler);
            };
        `;
    },
};
```

### Timers

`setTimeout`, `clearTimeout`, `setInterval`, and `clearInterval` are available. Clear your own timers in `onDisable` —
the loader does not track them for you, so an interval left running keeps running after the plugin is disabled.
