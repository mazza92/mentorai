# Lurnia Chrome Extension

Don't trust the thumbnail. Rank YouTube by real engagement, steal the playbook, then ask for the number.

Same product as [lurnia.app](https://lurnia.app): Find signal, playbook, Ask.

## Features

- **Find signal**: Re-rank YouTube by comments, like rate, and long-form depth. Not views. Not the thumbnail.
- **Steal playbook**: Open the same `/v/{id}` playbook as the site (takeaways, timestamps, what to skip).
- **Ask**: Question the current watch page from captions and comments. Click timestamps to jump.
- **Quotas**: Free 6 playbooks / 25 questions. Pro €15: 60 playbooks / 250 questions. Search stays free.

YouTube does not publish save or share counts. Lurnia uses comments and likes vs views as the public proxies for “people actually valued this.”

## Load unpacked

1. Open Chrome and go to `chrome://extensions/`
2. Enable Developer mode
3. Click Load unpacked
4. Select the `extension` folder

After code changes, click **Reload** on the extension card, then refresh the YouTube tab.

## How transcript + comments are captured

The extension reads captions and comments **from the YouTube watch page** using the viewer's session (not a blocked cloud IP):

1. Caption tracks from the player (json3 / srv3 / vtt / xml)
2. Innertube `player` with WEB / Android / embed / TV clients
3. Innertube `get_transcript` (auto captions)
4. Transcript panel in the YouTube UI
5. Top comments via Innertube `next` + continuations
6. Server Innertube fallback only if the page collector returns nothing

Q&A still runs when captions are off, using comments + description. True 100% spoken transcripts is impossible for videos with captions disabled and no auto-captions.

## Project Structure

```
extension/
├── manifest.json          # MV3, v1.4.2
├── popup/                 # Find signal + Ask popup
├── content/               # Watch-page overlay + detector
├── background/            # Service worker, value search, collector
├── utils/                 # API + storage
└── assets/                # Icons
```

## API

Toggle in `utils/api.js`:

```javascript
const IS_DEV = false; // true for localhost:3001 / :3000
```

Production API: `https://lurnia.app/api`

Endpoints used:

- `POST /api/search/value` via the YouTube tab (value search)
- `POST /api/qa/video-direct` - Ask this video
- `POST /api/user/:userId/check-question` - Question quota
- `POST /api/user/:userId/check-playbook` - Unique playbook quota

## Authentication

OAuth through the Lurnia app. Guest mode works without sign-in (1 playbook / 3 questions). Sign in for the free plan (6 / 25).
