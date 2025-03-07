# Safe Enter AI-helper Chrome Extension

A browser extension that enhances online form safety with AI-powered protection against accidental submissions by requiring multiple Enter key presses.

## Overview

Safe Enter AI-helper is a Chrome extension designed to safeguard against accidental form submissions by intercepting Enter key presses and requiring multiple presses before allowing form submission.

## Key Features

- **Multiple Enter Requirement**: Forms are only submitted after pressing Enter multiple times (default: 3)
- **Per-Site Control**: Enable or disable the extension for specific websites
- **Visual Feedback**: Simple visual indicator showing progress toward form submission
- **Configurable Delay**: Adjust the maximum time between Enter presses (200-2000ms)
- **Multilingual Support**: Available in 10 languages: English, Spanish, Russian, Chinese, Arabic, Portuguese, French, German, Japanese, and Italian
- **Premium Functionality**: 20 free submissions, then $2.99/month subscription
- **Universal Compatibility**: Works consistently across all websites

## Installation

1. Download the extension from the Chrome Web Store
2. Click "Add to Chrome" and confirm the installation
3. The extension icon will appear in your browser toolbar
4. Click the icon to configure settings for the current website

## Usage

### Basic Operation

1. Browse to any website with a form
2. Enable the extension for that site in the popup
3. Every time you press Enter, the extension shows your progress
4. After the required number of Enter presses, the form is submitted

### Configuration Options

- **Enable Safe Enter AI-helper**: Master switch to enable/disable the extension
- **Enable for this site**: Control whether the extension works on the current website
- **Enter presses**: Set how many Enter presses are required (2-5)
- **Delay**: Adjust the maximum time between presses (200-2000ms)
- **Visual feedback**: Enable/disable on-screen indicators showing submit progress
- **Language**: Choose from 10 available languages

## Premium Features

After 20 free submissions, you'll need to upgrade to Premium to continue using the extension:

- **Unlimited submissions**: No more usage restrictions
- **Priority support**: Get faster responses to your questions
- **Early access**: Be the first to try new features
- **Cost**: $2.99 per month

## Project Structure

```
safe_enter_ai_helper/
├── manifest.json           # Extension configuration
├── _locales/               # Localization files
│   ├── en/                 # English
│   ├── es/                 # Spanish
│   ├── ru/                 # Russian
│   └── ...                 # Other languages
├── icons/                  # Extension icons
├── popup/                  # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/             # Background scripts
│   └── background.js
├── content/                # Content scripts
│   ├── keyHandler.js
│   └── visualFeedback.js
└── common/                 # Shared code
```

## Recent Updates

- **v1.5.0**: Simplified behavior to focus only on intercepting Enter key presses, improved universal compatibility
- **v1.4.0**: Enhanced visual feedback, improved support for chatgpt.com
- **v1.3.0**: Renamed to "Safe Enter AI-helper", improved handling of complex websites
- **v1.2.0**: Added language selector with 10 languages
- **v1.1.0**: Simplified interface, added delay slider (200-2000ms), updated color scheme (gray steel with bright orange accent), improved paywall logic (20 free submissions, $2.99/month)
- **v1.0.0**: Initial release

## Privacy Policy

Safe Enter AI-helper respects your privacy and does not collect any personal information. The extension only stores:

- Your settings and preferences
- Domain-specific configurations
- Usage count for free tier limitations

All data is stored locally in your browser using Chrome's storage API and is not transmitted to external servers.

## Support

For issues, feature requests, or questions:

- Create an issue on our [GitHub repository](https://github.com/username/safe_enter_ai_helper)
- Email us at support@safeenterai.example.com

## License

This project is licensed under the MIT License - see the LICENSE file for details.