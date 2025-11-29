# YouTube Bot Bypass System

## Overview

Custom YouTube bot bypass solution that automatically handles YouTube's aggressive bot detection using real browser automation (Puppeteer) to extract fresh cookies and rotate user agents.

**Similar to our custom transcript scraper approach**, this system provides a robust fallback when YouTube blocks automated requests.

## Problem

YouTube implements aggressive bot detection that causes these errors:

```
WARNING: [youtube] The provided YouTube account cookies are no longer valid.
They have likely been rotated in the browser as a security measure.

ERROR: [youtube] Sign in to confirm you're not a bot.
Use --cookies-from-browser or --cookies for the authentication.
```

## Solution Architecture

### 1. **Fresh Cookie Extraction** (`youtubeBotBypass.js`)
- Uses Puppeteer (headless Chrome) to visit YouTube
- Extracts all cookies from real browser session
- Converts to Netscape format for yt-dlp compatibility
- Caches cookies for 30 minutes

### 2. **User Agent Rotation**
- Pool of 4 realistic user agents
- Rotates automatically on each request
- Appears as different browsers to avoid detection

### 3. **Anti-Detection Measures**
```javascript
- Hide webdriver property
- Disable automation flags
- Set realistic headers (Accept-Language, etc.)
- Mimic real browser viewport (1920x1080)
- Scroll behavior on page
- Network idle wait
```

### 4. **Retry Logic with Exponential Backoff**
- 3 attempts by default
- Base delay: 2 seconds
- Exponential backoff: 2s → 4s → 8s
- Fresh cookies on each retry

### 5. **Fallback Mechanism**
```
Bot Bypass (Fresh Cookies)
    ↓ (if fails)
Env Cookies (YOUTUBE_COOKIES_BASE64)
    ↓ (if fails)
Error
```

## Usage

### Automatic (Recommended)

The bot bypass is **automatically enabled** in `youtubeDlpScraper.js`:

```javascript
const youtubeDlpScraper = require('./services/youtubeDlpScraper');

// Bot bypass is used automatically
const result = await youtubeDlpScraper.fetchTranscript('dQw4w9WgXcQ');
```

### Manual Control

```javascript
const youtubeBotBypass = require('./services/youtubeBotBypass');

// Extract fresh cookies
const cookies = await youtubeBotBypass.getFreshCookies();

// Execute command with retry
const command = 'yt-dlp --cookies "{{cookies}}" ...';
const result = await youtubeBotBypass.executeWithRetry(command, {
  timeout: 30000,
  maxRetries: 3,
  baseDelay: 2000
});

// Cleanup when done
await youtubeBotBypass.cleanup();
```

### Disable Bot Bypass

```javascript
const youtubeDlpScraper = require('./services/youtubeDlpScraper');

// Disable bot bypass (use env cookies only)
youtubeDlpScraper.useBotBypass = false;
```

## Features

### ✅ Cookie Caching
- Cookies cached for 30 minutes
- Prevents unnecessary browser launches
- Thread-safe refresh (prevents race conditions)

### ✅ Smart Retry
- Detects bot-specific errors
- Only retries on bot detection
- Fresh cookies on each retry
- Exponential backoff to avoid rate limits

### ✅ Resource Management
- Automatic browser cleanup
- Temp file cleanup (cookies.txt)
- Singleton pattern (one instance)

### ✅ Monitoring
- Detailed logging at each step
- Success/failure tracking
- Performance metrics (fetch time)

## Testing

Run the comprehensive test suite:

```bash
node test-bot-bypass.js
```

Tests include:
1. Fresh cookie extraction
2. Cookie caching
3. Transcript fetching with bot bypass
4. Retry mechanism
5. Resource cleanup

## Architecture Comparison

### Before (Static Cookies)
```
yt-dlp → Static env cookies → ❌ Bot detected → Fail
```

### After (Bot Bypass)
```
yt-dlp → Fresh cookies (Puppeteer) → ✅ Success
           ↓ (if bot detected)
       Retry with new cookies (3x)
           ↓ (if all fail)
       Fallback to env cookies
           ↓ (if fails)
       Error with helpful message
```

## Performance

| Metric | Value |
|--------|-------|
| Cookie extraction | 3-5 seconds (first time) |
| Cached cookie retrieval | < 10ms |
| Transcript fetch (with bypass) | 5-8 seconds |
| Cache duration | 30 minutes |
| Memory overhead | ~50MB (Puppeteer) |

## Configuration

### Environment Variables

```bash
# Optional: Fallback cookies (base64 encoded)
YOUTUBE_COOKIES_BASE64=<base64-encoded-cookies>

# Optional: Disable bot bypass globally
DISABLE_BOT_BYPASS=true
```

### Code Configuration

```javascript
// Adjust cache duration (default: 30 minutes)
youtubeBotBypass.cookiesCacheDuration = 60 * 60 * 1000; // 1 hour

// Add custom user agents
youtubeBotBypass.userAgents.push('Your custom user agent');

// Adjust retry settings
const result = await youtubeBotBypass.executeWithRetry(command, {
  maxRetries: 5,      // More retries
  baseDelay: 3000,    // Longer delay
  timeout: 60000      // Longer timeout
});
```

## Troubleshooting

### Issue: Browser won't launch

**Error**: `Failed to launch the browser process`

**Solution**:
```bash
# Install Chromium dependencies
npm install puppeteer
npx puppeteer browsers install chrome
```

### Issue: Cookies still failing

**Solution**:
1. Force fresh cookies: `youtubeBotBypass.getFreshCookies(true)`
2. Clear cache: `youtubeBotBypass.cookiesCache = null`
3. Increase retries in `executeWithRetry`

### Issue: Memory usage high

**Solution**:
```javascript
// Cleanup browser after use
await youtubeBotBypass.cleanup();

// Reduce cache duration
youtubeBotBypass.cookiesCacheDuration = 10 * 60 * 1000; // 10 min
```

## Integration Points

### Services Using Bot Bypass

1. **youtubeDlpScraper.js** - Transcript fetching ✅
2. **youtubeInnertubeService.js** - Indirect (uses ytdlpScraper) ✅
3. **videoQAService.js** - Indirect (uses youtubeInnertubeService) ✅
4. **channelTranscriptService.js** - Batch transcript fetching ✅

### Future Integrations

- Video downloads (youtubeService.js)
- Channel metadata fetching
- Video info extraction

## Security Considerations

### ✅ Safe
- No credentials stored
- Cookies are session-based
- Temp files cleaned up immediately
- Runs in isolated headless browser

### ⚠️ Consider
- Cookies cached in memory (cleared on restart)
- Browser automation detectable by sophisticated systems
- Respect YouTube's Terms of Service
- Use for legitimate purposes only

## Comparison with Alternatives

| Approach | Speed | Reliability | Cost | Complexity |
|----------|-------|-------------|------|------------|
| **Bot Bypass** | 🟢 Fast | 🟢 High | 🟢 Free | 🟡 Medium |
| Static Cookies | 🟢 Fast | 🔴 Low | 🟢 Free | 🟢 Simple |
| Browser Automation | 🔴 Slow | 🟡 Medium | 🟢 Free | 🔴 High |
| Paid API | 🟢 Fast | 🟢 High | 🔴 Paid | 🟢 Simple |

## Maintenance

### Cookie Refresh Schedule

The system automatically handles cookie refresh:
- **Cached**: 30 minutes (configurable)
- **On error**: Immediate refresh
- **On retry**: Fresh cookies each attempt

### Monitoring

Key metrics to track:
- Bot bypass success rate
- Cache hit rate
- Average fetch time
- Browser launch failures

### Updates

Update Puppeteer regularly for latest Chrome version:
```bash
npm update puppeteer
```

## Credits

Inspired by:
- Custom YouTube Transcript Scraper approach
- yt-dlp cookie handling
- Puppeteer anti-detection patterns
- Exponential backoff best practices

## License

Same as project license (see LICENSE file).
