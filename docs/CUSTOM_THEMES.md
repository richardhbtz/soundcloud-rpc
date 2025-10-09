# Custom Themes

soundcloud-rpc now supports custom themes, You can customize the appearance of the SoundCloud UI by creating and loading
CSS theme files.

## How to Use Custom Themes

1. **Open the Settings Panel**: Press `F1` or click the settings button in the application
2. **Navigate to Custom Themes**: Find the "Custom Themes" section in the settings
3. **Open Themes Folder**: Click the "Open Themes Folder" button to open your themes directory
4. **Add Theme Files**: Place your `.css` theme files in the opened folder
5. **Refresh Themes**: Click "Refresh Themes" in the settings to load new theme files
6. **Select Theme**: Choose your desired theme from the dropdown menu
7. **Apply Changes**: The theme will be applied immediately

## Creating Custom Themes

Custom themes are standard CSS files that can modify the appearance of SoundCloud. Here are some tips for creating your
own themes:

### Basic Structure

```css
/* Your Custom Theme Name */
/* Description of what your theme does */

/* Target SoundCloud elements */
body {
    background-color: #your-color !important;
}

.header {
    background: linear-gradient(135deg, #color1 0%, #color2 100%) !important;
}
```

### Important Notes

- Use `!important` declarations to ensure your styles override SoundCloud's default styles
- SoundCloud's class names may change, so themes might need updates occasionally
- Test your themes thoroughly to ensure they work across different pages

### Common Elements to Customize

- `body` - Main background
- `.header` - Top navigation bar
- `.sidebar` - Left sidebar
- `.soundList__item`, `.trackItem` - Track cards
- `.playButton`, `.sc-button-play` - Play buttons
- `.progressBar`, `.playbackTimeline` - Progress bars
- `::-webkit-scrollbar` - Scrollbars

## Theme Locations

Themes are stored in your user data directory:

- **Windows**: `%APPDATA%\soundcloud-rpc\themes\`
- **macOS**: `~/Library/Application Support/soundcloud-rpc/themes/`
- **Linux**: `~/.config/soundcloud-rpc/themes/`

## Troubleshooting

### Theme Not Loading

1. Ensure the file has a `.css` extension
2. Check that the CSS syntax is valid
3. Try refreshing themes in the settings
4. Restart the application if necessary

### Theme Not Working

1. Verify you're using `!important` declarations
2. Check browser developer tools for CSS conflicts
3. SoundCloud may have updated their class names

### Reverting to Default

Select "No Theme" from the dropdown to remove all custom styling.

## Advanced Features

### CSS Variables

Some themes may use CSS custom properties:

```css
:root {
    --primary-color: #ff6b35;
    --secondary-color: #ff4500;
}
```

### Animations

Add custom animations:

```css
@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

.my-element {
    animation: fadeIn 0.3s ease-in;
}
```

## Contributing Themes

Feel free to share themes you've created — if you'd like your theme included in the project, open a pull request adding
your `.css` file under the `themes/` folder (or send it in an issue/attachment). I'll review submissions and merge
themes that are well-made and follow the guidelines above.

Guidelines for contribution:

- Include a short header comment at the top of your `.css` with the theme name and a one-line description.
- Keep changes scoped to styling only (no scripts or binary files).
- Prefer reasonably named CSS selectors and document any assumptions in the comment block.

If your theme is accepted I'll add it to the repository so other users can enjoy it. Thanks for contributing!
