# YouTube Caption Fetching - Fix Guide

## Problem Summary

YouTube is detecting and blocking automated caption requests with the error:
```
ERROR: [youtube] Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies for the authentication.
```

Even with Puppeteer (real browser), YouTube returns empty (0 bytes) caption responses due to aggressive bot detection.

## Root Cause

YouTube requires authenticated requests to access captions. The methods being used:
1. **Puppeteer (real browser)** - Blocked: YouTube detects automation even with real Chrome
2. **Python youtube-transcript-api** - Blocked: Makes direct API calls that YouTube blocks
3. **yt-dlp with cookies** - **THIS IS THE SOLUTION** but requires proper setup

## Solution: yt-dlp with Browser Cookies

Your code already has this implemented in `channelTranscriptService.js` (line 96-174), but it requires browser cookies to work.

### How It Works

yt-dlp can extract cookies from your installed browsers (Chrome, Firefox, Edge) and use them to authenticate requests, bypassing YouTube's bot detection.

### Setup Instructions

#### Step 1: Sign into YouTube

1. Open Chrome (or Firefox/Edge)
2. Go to https://youtube.com
3. Sign in with your Google account
4. Visit a few videos to establish a normal browsing session

#### Step 2: Verify yt-dlp Installation

```bash
# Check if yt-dlp is installed
yt-dlp --version

# If not installed, install it:
# Windows (with Python):
pip install yt-dlp

# Or with Chocolatey:
choco install yt-dlp

# Linux/Mac:
pip3 install yt-dlp
```

#### Step 3: Test Cookie Extraction

```bash
# Test if yt-dlp can extract cookies from Chrome
yt-dlp --cookies-from-browser chrome --skip-download --print title "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# If Chrome doesn't work, try Firefox:
yt-dlp --cookies-from-browser firefox --skip-download --print title "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Or Edge:
yt-dlp --cookies-from-browser edge --skip-download --print title "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

If this works, you'll see the video title printed. If not, you'll see an error.

#### Step 4: Update Code Configuration

The code already tries Chrome, Firefox, and Edge in order. You can verify the order in `channelTranscriptService.js`:

```javascript
// Line 290-304
const browsers = ['chrome', 'firefox', 'edge'];
for (const browser of browsers) {
  try {
    console.log(`[ChannelTranscript] Using yt-dlp (${browser} cookies) for ${videoId}`);
    const transcript = await this.fetchCaptionsWithYtDlp(videoId, browser);
    // ...
  }
}
```

### Alternative: Direct Cookie Export

If browser cookie extraction fails (common on Windows due to encryption), you can export cookies manually:

1. **Install Browser Extension**: Get a cookie export extension:
   - Chrome: "Get cookies.txt LOCALLY" or "Export Cookies"
   - Firefox: "cookies.txt" extension

2. **Export YouTube Cookies**:
   - Visit youtube.com
   - Use the extension to export cookies to `cookies.txt`
   - Save to: `C:\Users\maher\Desktop\wandercut\backend\cookies.txt`

3. **Update Code** to use cookie file instead of browser:
   ```javascript
   // In channelTranscriptService.js, line 102-111
   const output = await youtubedl(videoUrl, {
     dumpSingleJson: true,
     skipDownload: true,
     writeAutoSub: true,
     subLang: 'en,fr,es,de,it,pt,ar',
     noWarnings: true,
     cookies: './cookies.txt', // Use cookie file instead of cookiesFromBrowser
   });
   ```

## Implementation Status

### ✅ Completed
- Connected `tripleLayeredIndexService.fetchCaptionsBestEffort()` to use Puppeteer and Python API
- Added batching for video tier processing (10 videos at a time)
- Improved error handling and logging
- Fixed session context for Puppeteer caption fetching

### ⚠️ Requires User Action
- **YouTube authentication via browser cookies**
  - User must be signed into YouTube in Chrome/Firefox/Edge
  - yt-dlp must be able to access browser cookies
  - On Windows, may require cookie export to file

## Testing

After setting up cookies, test with:

```bash
cd C:\Users\maher\Desktop\wandercut\backend
node test-caption-fetch.js
```

You should see successful caption fetching with >0 segments.

## Production Deployment

For Railway/Vercel/cloud deployment:
1. Use the cookie file method (browser cookies won't be available)
2. Store `cookies.txt` as an environment secret
3. Update deployment to write cookies from environment variable to file
4. **Important**: Rotate cookies every 30-60 days as they expire

## Cost Implications for Triple-Layered Strategy

Once caption fetching works:
- **Tier 1 (Metadata)**: FREE ✓ Working
- **Tier 2 (Captions)**: FREE ✓ Will work with cookies
- **Tier 3 (Transcription)**: ~$0.15/min (on-demand only)

Expected savings: 70-90% of videos will have captions, eliminating need for expensive transcription.

## Alternative Solutions (If cookies don't work)

1. **YouTube Data API v3** - Can check caption availability but doesn't provide caption text
2. **Paid Services** - Rev.ai, Deepgram can transcribe from video URLs
3. **Full Tier 3** - Skip Tier 2 entirely, always use audio transcription (expensive)

## Next Steps

1. **Immediate**: Set up YouTube authentication (see Step 1-3 above)
2. **Test**: Run `node test-caption-fetch.js` to verify
3. **Deploy**: If using cloud, set up cookie file method
4. **Monitor**: Check logs for "yt-dlp (chrome): Successfully fetched" messages

