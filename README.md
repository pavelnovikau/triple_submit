# Triple Submit - Chrome Extension

Triple Submit is a Chrome Extension designed to prevent accidental form submissions by requiring multiple Enter key presses before actually submitting forms. It also remaps Shift+Enter to act as a regular Enter key.

## Features

### Key Functionality
- **Multi-Press Enter**: Requires a configurable number of Enter key presses (default: 3) within a time window to trigger actual form submission
- **Key Remapping**: Shift+Enter acts as a regular Enter key
- **Domain-Based Activation**: Enable/disable functionality based on specific domains (whitelist or blacklist)
- **Visual Feedback**: Shows a visual indicator of progress toward the required number of presses
- **Dark/Light Themes**: Customize the extension's appearance
- **Multi-Language Support**: Available in English, Spanish, Chinese, Arabic, Portuguese, French, German, Japanese, Italian, and Russian
- **Browser Compatibility**: Works with Chrome, Edge, and Arc browsers
- **Enhanced Text Entry**: In alternative mode, single Enter inserts line breaks in text fields instead of submitting forms

### Operation Modes
- **Normal Mode**: Counts consecutive Enter key presses and only allows submission when the required number is reached. Best for most websites and compatible with standard forms.
- **Alternative Mode**: Uses a different technique to detect and prevent form submissions:
  - Multiple Enter key presses (reaching the required count) submit the form
  - Single Enter key press inserts a line break in text fields
  - Shift+Enter always acts as a single submission shortcut
  - Better for complex web applications and text-heavy interfaces

## Installation

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store (link TBD)
2. Click "Add to Chrome"
3. Confirm installation when prompted

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension is now installed and ready to use

## Usage

### Basic Usage
1. Once installed, the extension is active by default
2. Press Enter multiple times (default: 3) to submit a form
3. Use Shift+Enter as a regular Enter key (single press submission)
4. In Alternative mode, single Enter keypress inserts line breaks in text areas
5. Visual feedback will appear showing your progress toward the required number of presses

### Configuration
1. Click on the Triple Submit icon in your browser toolbar to access quick settings:
   - Enable/disable the extension globally
   - Enable/disable for the current site
   - Change operation mode
   - Adjust required press count
   - Toggle visual feedback
   - Choose your preferred language

2. For advanced settings, click "Advanced Options" in the popup or right-click the extension icon and select "Options":
   - Manage domain whitelist/blacklist
   - Customize time window for key press detection (default: 200ms)
   - Change theme
   - Configure other settings

### Domain Management
The extension provides two modes for domain management:
- **Whitelist Mode**: Extension is only active on the domains you add to the list
- **Blacklist Mode**: Extension is active everywhere except on the domains you add to the list

To add a domain:
1. Open the advanced options page
2. Select either Whitelist or Blacklist mode
3. Enter the domain name (e.g., example.com)
4. Click "Add"
5. Don't forget to click "Save Settings" to apply your changes

## Premium Features (Coming Soon)
- Unlimited domains in whitelist/blacklist (free version limited to 3)
- Cross-device synchronization
- Custom themes
- Advanced analytics
- Custom key bindings

## Localization
The extension automatically detects your browser's language and uses the appropriate translations. Currently supported languages:
- English (default)
- Spanish (Español)
- Chinese (中文)
- Arabic (العربية)
- Portuguese (Português)
- French (Français)
- German (Deutsch)
- Japanese (日本語)
- Italian (Italiano)
- Russian (Русский)

You can manually change the language in the popup settings.

## Development

### Project Structure
```
triple_submit/
├── manifest.json         # Extension manifest
├── icons/                # Extension icons
├── popup/                # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/              # Options page
│   ├── options.html
│   ├── options.css
│   └── options.js
├── background/           # Background scripts
│   └── background.js
├── content/              # Content scripts
│   ├── keyHandler.js     # Key press handling logic
│   ├── visualFeedback.js # Visual feedback components
│   └── lib/              # Utility libraries
│       └── storage.js    # Storage management
├── _locales/             # Localization files
│   ├── en/               # English
│   ├── es/               # Spanish
│   ├── zh/               # Chinese
│   └── ...               # Other languages
```

### Building and Testing
1. Make your changes to the source code
2. Load the extension in Chrome using Developer mode
3. For testing changes to content scripts, you may need to reload the extension and refresh the page

### Recent Updates
- **v1.5.0**: Enhanced Alternative mode to support line breaks with single Enter press and form submission with multiple presses
- **v1.4.0**: Improved Arc browser compatibility with optimized key handling and better retry logic
- **v1.3.0**: Added detailed mode descriptions, improved theme button UX, and added compatibility for Arc browser
- **v1.2.0**: Added multi-language support with 10 languages
- **v1.1.1**: Fixed issues with domain whitelist/blacklist management
- **v1.1.0**: Added dark/light theme support

### Contributing
Contributions are welcome! If you'd like to contribute, please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## Privacy Policy
Triple Submit does not collect or store any personal data. All settings are stored locally on your device. The extension does not track your browsing history or form submissions.

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Support
If you encounter any issues or have suggestions for improvements, please open an issue on the GitHub repository or contact support at support@example.com.

---

© 2023 Triple Submit | [Website](https://example.com/triple-submit) | [GitHub](https://github.com/example/triple-submit) 