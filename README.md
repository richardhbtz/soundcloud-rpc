# soundcloud-rpc - A Soundcloud client with Discord Rich Presence support

## Preview

![Preview Image](./images/preview.png)

## Installation

Before installing and running this app, you must have Node.js installed on your machine. If you don't have Node.js installed, you can download it from the official website: [Node.js Official Website](https://nodejs.org/)

1. Clone this repository to your local machine.
2. Run `npm install` to install the required dependencies.
3. Run `npm start` to launch the application.

## Configuration

By default, the rich presence will only be displayed when music is playing on SoundCloud. However, if you set the `displayWhenIdling` variable to `true` in the `createWindow` function, the rich presence will also be displayed when you are not currently playing any music on SoundCloud.

```javascript
let displayWhenIdling = true; // change to true to display a message when idling
```

## Usage

Dark mode can be activated by pressing F1.

## Credits

- The Discord Rich Presence integration is implemented using the [discord-rpc](https://www.npmjs.com/package/discord-rpc) package.
- The Electron window is created using the [Electron](https://www.electronjs.org/) framework.
- The executable is packed using [electron-builder](https://www.electron.build/).

## Contributing

Contributions to this project are welcome. If you find a bug or would like to suggest a new feature, please open an issue on this repository.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
