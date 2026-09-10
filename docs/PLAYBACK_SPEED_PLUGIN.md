# Playback Speed plugin

`plugins/playback-speed.js` ports the playback-rate controls from
[SoundCloud Desktop](https://github.com/zxcloli666/SoundCloud-Desktop) to soundcloud-rpc's content-script plugin API.

## Features

- Playback rate from `0.50×` to `2.00×` in `0.05` steps.
- Click the displayed value to reset to `1×`.
- Click the player-bar rate button to open a slider, preset buttons, and slower/faster step controls.
- Change the rate with the mouse wheel over the button or slider.
- Optional pitch preservation. By default, pitch follows playback speed to match SoundCloud Desktop's coupled
  tempo/pitch behavior.
- The selected rate and pitch mode persist across tracks and app restarts.
- The plugin does not poll or patch Discord Rich Presence; RPC keeps the application's native, stable timer behavior.
- Captures SoundCloud's detached `Audio` player even though it is not present in the page DOM, and reapplies the rate
  when the player is replaced.
- Russian and English labels, selected from the SoundCloud page language.

## Installation

1. Open soundcloud-rpc and press `F1`.
2. In **Plugins**, click **Open plugins folder**.
3. Copy `playback-speed.js` into that folder.
4. Click **Refresh plugins**, then enable **Playback Speed**.

The `1×` button appears in the SoundCloud playback controls. If the current SoundCloud layout has no compatible controls
container, the plugin shows a floating button above the player instead.

Disabling the plugin restores active audio elements to `1×`. The saved setting is retained and will be restored if the
plugin is enabled again.
