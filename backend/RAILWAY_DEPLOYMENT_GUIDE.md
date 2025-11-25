# Railway Deployment Guide - YouTube Caption Fix

## Problem

Your Railway production logs show: `✓ Fetched 0/10 transcripts successfully`

**Why?** On Railway, there are no browser cookies available, so yt-dlp can't authenticate with YouTube:
- ❌ `could not find chrome cookies database`
- ❌ `could not find firefox cookies database`
- ❌ `could not find edge cookies database`

**Result:** Users get answers based only on video titles/descriptions, not actual content.

## Solution

Export your YouTube cookies to a file, then upload them to Railway as an environment variable.

---

## Step 1: Export YouTube Cookies

### Method A: Using Browser Extension (Easiest)

1. **Install Cookie Extension**:
   - Chrome: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - Firefox: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

2. **Sign into YouTube**:
   - Go to https://youtube.com
   - Sign in with your Google account
   - Watch a few videos to establish a "normal" session

3. **Export Cookies**:
   - Click the extension icon
   - Select "Export" or "Get cookies.txt"
   - Save as `cookies.txt`

### Method B: Using Command Line (Alternative)

```bash
# Install yt-dlp's cookie extraction tool
pip install browser-cookie3

# Extract cookies
python -c "import browser_cookie3; print('\n'.join([f'{c.domain}\tTRUE\t{c.path}\tFALSE\t{c.expires}\t{c.name}\t{c.value}' for c in browser_cookie3.chrome(domain_name='youtube.com')]))" > cookies.txt
```

---

## Step 2: Verify Cookies Work Locally

Test that your cookies file works before deploying:

```bash
cd C:\Users\maher\Desktop\wandercut\backend

# Test with yt-dlp
python -m yt_dlp --cookies cookies.txt --skip-download --print title "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# If successful, you'll see the video title
# If it fails, the cookies are invalid or expired
```

---

## Step 3: Encode Cookies to Base64

Railway requires environment variables to be strings. Encode your cookies file:

### Windows (PowerShell):
```powershell
cd C:\Users\maher\Desktop\wandercut\backend
$cookies = Get-Content cookies.txt -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($cookies)
$base64 = [Convert]::ToBase64String($bytes)
$base64 | Out-File -FilePath cookies-base64.txt
Write-Host "Base64 cookies saved to cookies-base64.txt"
```

### Linux/Mac:
```bash
cd backend
cat cookies.txt | base64 -w 0 > cookies-base64.txt
echo "Base64 cookies saved to cookies-base64.txt"
```

---

## Step 4: Add to Railway

1. **Go to Railway Dashboard**:
   - Open https://railway.app
   - Select your project

2. **Add Environment Variable**:
   - Go to your service → Variables
   - Click "New Variable"
   - Name: `YOUTUBE_COOKIES_BASE64`
   - Value: Copy entire contents of `cookies-base64.txt`
   - Click "Add"

3. **Railway will automatically redeploy** with the new environment variable

---

## Step 5: Deploy Updated Code

The code changes have been made to automatically use the environment variable in production. Now deploy:

```bash
cd C:\Users\maher\Desktop\wandercut\backend

# Commit changes
git add services/channelTranscriptService.js .env.example
git commit -m "Add production cookie support for Railway deployment

- Use YOUTUBE_COOKIES_BASE64 environment variable in production
- Fallback to browser cookies in local development
- Fixes 0/10 transcript fetch rate on Railway

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to Railway
git push
```

---

## Step 6: Verify It Works

1. **Check Railway Logs**:
   ```
   # You should see:
   [ChannelTranscript] Using cookies from environment variable
   [ChannelTranscript] ✓ yt-dlp (chrome): Successfully fetched X caption segments
   ```

2. **Test a Query**:
   - Ask your app a question about a YouTube channel
   - Check the response includes actual transcript content
   - Look for increased "✓ Fetched X/10 transcripts successfully" rate

---

## Expected Results

**Before:**
```
[inf] ✓ Fetched 0/10 transcripts successfully
[inf] Context built: 0 videos with transcripts, 10 without
```

**After:**
```
[inf] [ChannelTranscript] Using cookies from environment variable
[inf] [ChannelTranscript] ✓ yt-dlp (chrome): Successfully fetched 52 caption segments
[inf] ✓ Fetched 7/10 transcripts successfully (70%)
[inf] Context built: 7 videos with transcripts, 3 without
```

---

## Troubleshooting

### Cookies Expire Too Quickly

**Problem:** Cookies expire every 30-60 days

**Solutions:**
1. **Automate rotation**: Set up a monthly reminder to refresh cookies
2. **Use a dedicated YouTube account**: Create a new Google account just for this
3. **Monitor logs**: Set up Railway log alerts for "could not find chrome cookies"

### Still Getting 0 Transcripts

**Check:**
1. Environment variable name is exactly `YOUTUBE_COOKIES_BASE64`
2. Base64 encoding didn't add line breaks (use `-w 0` flag)
3. Cookies were exported while signed into YouTube
4. Try re-signing into YouTube and exporting fresh cookies

### Logs Show "Invalid cookies"

**Fix:**
1. Sign out of YouTube completely
2. Clear browser cookies
3. Sign back in
4. Export cookies again
5. Encode and upload to Railway

---

## Security Notes

⚠️ **Important**:
- Cookies provide access to your YouTube account
- Store cookies as Railway environment variables (encrypted at rest)
- DO NOT commit cookies.txt to git (already in .gitignore)
- Use a dedicated account, not your personal one
- Rotate cookies regularly

---

## Alternative: Use a Proxy Service

If managing cookies is too complex, consider these alternatives:

1. **YouTube Transcript API Services**:
   - Paid services that handle bot detection
   - More reliable but costs money

2. **Proxy Rotation**:
   - Use residential proxies
   - More expensive but avoids cookie management

3. **Skip Tier 2 Entirely**:
   - Go straight to Tier 3 (Audio transcription)
   - More expensive (~$1.50 per 10-min video)
   - 100% reliable

---

## Cost Comparison

Current strategy with working cookies:
- Tier 1 (Metadata): FREE ✓
- Tier 2 (Captions): FREE ✓ (70-90% success rate)
- Tier 3 (Transcription): ~$1.50/video (10-30% of videos)

Without Tier 2 (current production state):
- Tier 1 (Metadata): FREE ✓
- Tier 2 (Captions): BROKEN ✗ (0% success rate)
- Tier 3 (Transcription): Not being used → **Poor results**

With working Tier 2, you save **$100-800 per 100-video channel**.

---

## Next Steps

1. Export cookies (Step 1)
2. Test locally (Step 2)
3. Encode to base64 (Step 3)
4. Add to Railway (Step 4)
5. Deploy code (Step 5)
6. Monitor results (Step 6)

After deployment, monitor your Railway logs to confirm caption fetching works!
