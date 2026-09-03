<div align="center">

<picture>
      <img src="assets/icons/soundcloud.png" width="200" />
</picture>

# soundcloud-rpc

A **SoundCloud** Client with **Discord Rich Presence**, **Dark Mode**, **Last.fm** and **AdBlock** support

Works on **Linux** (AppImage/deb), **Windows** and **macOS**

</div>

## ⚡️ Quick start

For the latest version of soundcloud-rpc, download the installer or executable file from the
[latest release](https://github.com/richardhbtz/soundcloud-rpc/releases) page.

> [!NOTE]
>
> ### macOS Users
>
> If you encounter a "Damaged App" popup after installation, run the following command in the terminal to resolve the
> issue:
>
> ```
> xattr -dr com.apple.quarantine /Applications/soundcloud.app
> ```
>
> After running this command, the app should launch without any problem.

## 🐧 Linux

Grab the AppImage or deb from the [releases](https://github.com/richardhbtz/soundcloud-rpc/releases) page.

```
chmod +x soundcloud-*-linux.AppImage
./soundcloud-*-linux.AppImage
```

The AppImage writes its own .desktop file + icon on first run, so the proper icon shows up in the taskbar/launcher from
the second launch on (wayland compositors can't know the icon before that). Widevine (GO+ playback) works. Auto updates
only work with the AppImage. Tray works out of the box on kde, gnome needs a systray extension.

Or build it yourself:

```
npm install
npm run build-linux-appimage   # or build-linux-deb
```

## ⚙️‍ Building

Before installing and running this app, you must have [Node.js](https://nodejs.org/) installed on your machine.

1. Clone this repository to your local machine
2. Run `npm install` to install the required dependencies.
3. Run `npm run build` to build the application.

### SoundCloud Go / Go+ playback (macOS and Windows)

Go and Go+ tracks are DRM-protected and play through Widevine. On macOS and
Windows, Widevine only works in a build that has been **VMP-signed** by castlabs.

A build made without signing credentials is not signed, and the failure is quiet:
the app starts, free tracks play normally, and Go/Go+ tracks simply stall or skip
with no error shown. If you have a Go subscription and paid tracks will not play,
an unsigned build is the first thing to check.

Signing is free. Create a castlabs EVS account once, then build with credentials
in the environment:

```bash
pip install --upgrade castlabs-evs
python -m castlabs_evs.account signup       # once

EVS_USERNAME=you EVS_PASSWORD=secret npm run build-mac
```

Set `STRICT_VMP_SIGNING=true` to make the build fail instead of warning when
signing does not succeed.

Linux does not require VMP signing -- Widevine works on the AppImage without it.

The official releases on the Releases page are signed, so Go/Go+ works there.

## 📖 Usage

Press `F1` to open the application menu, which provides access to various settings and features.

### Keyboard Shortcuts

**Quick Reference:**

- **F1** - Open Settings
- **Ctrl/Cmd + R** - Refresh the current page
- **Ctrl/Cmd + B** - Go back to the previous page
- **Ctrl/Cmd + F** - Go forward to the next page
- **Ctrl/Cmd + =** - Zoom in
- **Ctrl/Cmd + -** - Zoom out
- **Ctrl/Cmd + 0** - Reset zoom

## 🖼️ Preview

<div align="center">
<picture>
      <img src="assets/preview/soundcloud-preview-dark.png" />
</picture>

<picture>
      <img src="assets/preview/soundcloud-preview-light.png" />
</picture>
</div>

## 🛠️ Built With

- [@xhayper/discord-rpc](https://www.npmjs.com/package/@xhayper/discord-rpc) - Discord Rich Presence integration
- [Electron](https://www.electronjs.org/) - Framework for building cross-platform desktop applications
- [electron-builder](https://www.electron.build/) - Tool for packaging and distributing Electron applications
- [@ghostery/adblocker-electron](https://www.npmjs.com/package/@ghostery/adblocker-electron) - Ad blocking functionality
- [electron-store](https://www.npmjs.com/package/electron-store) - Data persistence
- [electron-updater](https://www.npmjs.com/package/electron-updater) - Auto-update functionality

## 🤝 Contributing

Contributions to this project are welcome. If you find a bug or would like to suggest a new feature, please open an
issue on this repository.

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

[repo_logo_img]: https://github.com/create-go-app/cli/assets/11155743/95024afc-5e3b-4d6f-8c9c-5daaa51d080d
[repo_url]: https://github.com/richardhbtz/soundcloud-rpc
