# Triple Submit Chrome Extension

A browser extension that prevents accidental form submissions by requiring multiple Enter key presses.

## Overview

Triple Submit is a Chrome extension designed to safeguard against accidental form submissions. It requires users to press the Enter key multiple times (configurable, default is 3) before a form is submitted, helping to prevent premature submission of important data.

## Key Features

- **Multiple Enter Key Requirement**: Forms are only submitted after pressing Enter multiple times (default: 3)
- **Per-Site Control**: Enable or disable the extension for specific websites
- **Visual Feedback**: Optional visual indicator showing progress toward form submission
- **Configurable Delay**: Adjust the maximum time between Enter presses (200-1000ms)
- **Multilingual Support**: Available in 10 languages: English, Spanish, Russian, Chinese, Arabic, Portuguese, French, German, Japanese, and Italian
- **Premium Functionality**: 20 free submissions, then $2.99/month subscription

## Installation

1. Download the extension from the Chrome Web Store
2. Click "Add to Chrome" and confirm the installation
3. The extension icon will appear in your browser toolbar
4. Click the icon to configure settings for the current website

## Usage

### Basic Operation

1. Browse to any website with a form
2. Enable the extension for that site in the popup
3. When you press Enter in a form:
   - For the first N-1 presses: A newline character is inserted (in text areas)
   - On the Nth press: The form is submitted normally

### Configuration Options

- **Enable Triple Submit**: Master switch to enable/disable the extension
- **Enable for this site**: Control whether the extension works on the current website
- **Enter presses**: Set how many Enter presses are required (2-5)
- **Delay**: Adjust the maximum time between presses (200-1000ms)
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
triple_submit/
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

- **v1.2.0**: Added language selector with 10 languages
- **v1.1.0**: Simplified interface, added delay slider (200-1000ms), updated color scheme (gray steel with bright orange accent), improved paywall logic (20 free submissions, $2.99/month)
- **v1.0.0**: Initial release

## Privacy Policy

Triple Submit respects your privacy and does not collect any personal information. The extension only stores:

- Your settings and preferences
- Domain-specific configurations
- Usage count for free tier limitations

All data is stored locally in your browser using Chrome's storage API and is not transmitted to external servers.

## Support

For issues, feature requests, or questions:

- Create an issue on our [GitHub repository](https://github.com/username/triple_submit)
- Email us at support@triplesubmit.example.com

## License

This project is licensed under the MIT License - see the LICENSE file for details.