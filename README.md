# SoundCloud Rich Presence

This application uses the Discord Rich Presence API to display the currently playing track on SoundCloud as your Discord status. 

## Usage

1. Clone this repository to your local machine.
2. Run `npm install` to install the required dependencies.
3. Run `npm start` to launch the application.
4. Log in to your Discord account to start displaying the currently playing SoundCloud track as your status.

By default, the rich presence will only be displayed when music is playing on SoundCloud. However, if you set the `displayWhenIdling` variable to `true` in the `createWindow` function, the rich presence will also be displayed when you are not currently playing any music on SoundCloud.


## Credits

- The Discord Rich Presence integration is implemented using the [discord-rpc](https://www.npmjs.com/package/discord-rpc) package.
- The Electron window is created using the [Electron](https://www.electronjs.org/) framework.

## Contributing

Contributions to this project are welcome. If you find a bug or would like to suggest a new feature, please open an issue on this repository.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
