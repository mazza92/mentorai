# Lurnia Chrome Extension

A lite Chrome extension for asking questions about YouTube videos using AI.

## Features

- **Video Q&A**: Ask questions about any YouTube video
- **Timestamp Navigation**: Click timestamps in answers to jump to that moment
- **Quota Tracking**: See your question usage
- **Quick Access**: Works directly from the browser toolbar

## Installation (Development)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder

## Project Structure

```
extension/
├── manifest.json          # Extension configuration
├── popup/                 # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/               # YouTube content scripts
│   ├── youtube-detector.js
│   └── youtube-overlay.css
├── background/            # Service worker
│   └── service-worker.js
├── utils/                 # Shared utilities
│   ├── api.js
│   └── storage.js
└── assets/               # Icons and images
    └── icon.svg
```

## Building for Production

### Generate Icons

Convert `assets/icon.svg` to PNG files:
- icon16.png (16x16)
- icon32.png (32x32)
- icon48.png (48x48)
- icon128.png (128x128)

You can use tools like:
- [svg2png](https://www.npmjs.com/package/svg2png-cli)
- [Inkscape](https://inkscape.org/)
- Online converters

### Package Extension

1. Generate production icons
2. Zip the extension folder
3. Upload to Chrome Web Store

## API Integration

The extension connects to the Lurnia backend API:

- **Development**: `http://localhost:3001/api`
- **Production**: `https://lurnia.app/api`

Toggle in `utils/api.js`:
```javascript
const IS_DEV = false; // Set to true for local development
```

## Authentication

The extension uses OAuth flow through the main Lurnia app:
1. User clicks "Sign in with Google"
2. Opens Lurnia auth page
3. After login, redirects back with user credentials
4. Extension stores user ID for API requests

## Endpoints Used

- `POST /api/qa/video-direct` - Direct video Q&A (no project required)
- `POST /api/user/:userId/check-question` - Check quota

## Development Notes

- Uses Manifest V3
- No external dependencies (vanilla JS)
- Content script detects YouTube videos automatically
- Service worker handles background tasks

## TODO for v1.1

- [ ] Add conversation history persistence
- [ ] Implement keyboard shortcuts
- [ ] Add dark mode support
- [ ] Floating button on YouTube pages
- [ ] Quick insights feature
