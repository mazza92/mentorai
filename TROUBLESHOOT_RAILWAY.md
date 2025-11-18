# Railway YouTube Cookies Troubleshooting

## Current Issue

Your Railway logs show:
```
ERROR: [youtube] Sign in to confirm you're not a bot
```

**And there's NO message saying**: `"Using YouTube cookies for authentication"`

This means the cookies **are not being loaded**. Let's fix this step by step.

---

## Step 1: Deploy Updated Code

First, deploy the updated code with better logging:

```bash
cd wandercut
git add .
git commit -m "Add YouTube cookie debugging"
git push
```

Wait for Railway to redeploy (watch the logs).

---

## Step 2: Verify Environment Variable in Railway

### Option A: Using Railway Dashboard

1. Go to https://railway.app/dashboard
2. Click your project
3. Click **"Variables"** tab
4. Look for `YOUTUBE_COOKIES`

**Is it there?**
- ❌ **NO** → Continue to Step 3 to add it
- ✅ **YES** → Skip to Step 4 to verify it's correct

### Option B: Using Railway CLI

```bash
railway variables
```

Look for `YOUTUBE_COOKIES` in the output.

---

## Step 3: Add YOUTUBE_COOKIES to Railway

### **Method 1: Via Dashboard (Recommended)**

1. **Extract Cookies** (if you haven't already):
   ```bash
   # Using browser extension
   # Install: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
   # Then go to YouTube.com (logged in) → Click extension → Export
   ```

2. **Convert to Base64**:
   ```bash
   cd wandercut
   node scripts/convert-cookies.js ~/Downloads/cookies.txt
   ```
   This creates `cookies_base64.txt`

3. **Copy the base64 string**:
   ```bash
   # Mac
   cat ~/Downloads/cookies_base64.txt | pbcopy

   # Windows PowerShell
   Get-Content ~/Downloads/cookies_base64.txt | Set-Clipboard

   # Linux
   cat ~/Downloads/cookies_base64.txt | xclip -selection clipboard
   ```

4. **Add to Railway**:
   - Railway Dashboard → Your Project → **Variables**
   - Click **"New Variable"**
   - Name: `YOUTUBE_COOKIES`
   - Value: **Paste the base64 string** (should be very long, 1000+ characters)
   - Click **"Add"**

5. **Redeploy**:
   Railway will automatically redeploy after adding the variable.

### **Method 2: Via Railway CLI**

```bash
# Set the variable directly
railway variables --set YOUTUBE_COOKIES="<paste-your-base64-string-here>"

# Redeploy
railway up
```

---

## Step 4: Test the Configuration

### After Redeployment

1. **Watch Railway logs** for these messages:
   ```
   🍪 Checking for YouTube cookies...
      YOUTUBE_COOKIES env var exists: true
   ✅ Using YouTube cookies for authentication
      Cookie file saved to: /app/services/../temp/youtube_cookies.txt
      Cookie file size: XXXX bytes
   ```

   **If you see this** → Cookies are loaded! ✅
   **If you see**:
   ```
   ⚠️  No YouTube cookies found in environment
   ```
   → The env var is NOT set in Railway. Go back to Step 3.

2. **Test with Cookie Verification Script**:
   ```bash
   # SSH into Railway container (if available)
   railway run npm run test:cookies
   ```

   Or trigger it via the Railway dashboard shell.

---

## Step 5: Test YouTube Upload

1. Go to your app frontend
2. Try uploading a YouTube video
3. Watch the Railway logs

**Expected Success Logs:**
```
🍪 Checking for YouTube cookies...
   YOUTUBE_COOKIES env var exists: true
✅ Using YouTube cookies for authentication
   Cookie file saved to: /app/services/../temp/youtube_cookies.txt
Starting YouTube video download: https://www.youtube.com/...
Processing YouTube video: <video title>
Video download complete
```

**If you still see bot detection:**
```
ERROR: [youtube] Sign in to confirm you're not a bot
```

→ Continue to Step 6

---

## Step 6: Verify Cookie Quality

Your cookies might be invalid or expired. Let's verify:

### Check Locally First

```bash
cd wandercut/backend
node test-cookies.js
```

This will show:
- ✅ If cookies are properly formatted
- ⚠️  If cookies are missing YouTube domains
- ❌ If cookies are corrupted

### Common Cookie Issues

**Issue**: "Cookies don't appear to be from YouTube"
- **Cause**: You extracted cookies from the wrong site
- **Fix**: Go to YouTube.com (not any other site), log in, then extract

**Issue**: "Very few cookies found"
- **Cause**: Extension didn't export properly
- **Fix**: Try a different browser or method (yt-dlp)

**Issue**: "Failed to decode base64"
- **Cause**: Base64 encoding failed
- **Fix**: Re-run `node scripts/convert-cookies.js cookies.txt`

---

## Step 7: Regenerate Cookies (If Needed)

Cookies expire after ~30 days. If they're old:

1. **Log into YouTube** in your browser
2. **Re-extract cookies**:
   ```bash
   # Using yt-dlp (most reliable)
   yt-dlp --cookies-from-browser chrome --cookies cookies.txt "https://www.youtube.com"

   # Or use browser extension again
   ```

3. **Re-convert to base64**:
   ```bash
   node scripts/convert-cookies.js cookies.txt
   cat cookies_base64.txt  # Copy this
   ```

4. **Update Railway**:
   - Railway → Variables → Find `YOUTUBE_COOKIES`
   - Click **"Edit"**
   - Replace with new base64 string
   - Save & Redeploy

---

## Step 8: Alternative Solutions (If Cookies Still Don't Work)

### Option 1: Use YouTube API (Limited)

YouTube Data API v3 can get video metadata but **cannot download videos**.

### Option 2: Third-Party Download Services

Use APIs like:
- **RapidAPI YouTube Downloader**: https://rapidapi.com/ytjar/api/youtube-mp36
- **loader.to API**: https://loader.to/api/
- **SaveFrom.net API**

Example integration:

```javascript
// Replace yt-dlp with third-party API
const response = await axios.get('https://rapidapi.com/ytjar/api/youtube-mp36', {
  params: { url: youtubeUrl },
  headers: { 'X-RapidAPI-Key': process.env.RAPIDAPI_KEY }
});
```

### Option 3: Proxy/VPN

Railway IP might be permanently blocked. Use a proxy service:

```javascript
// Add proxy to yt-dlp
const options = {
  proxy: 'http://your-proxy-server:port',
  // ... other options
};
```

---

## Quick Diagnostic Checklist

Run through this checklist:

- [ ] Code deployed to Railway (latest commit)
- [ ] `YOUTUBE_COOKIES` variable exists in Railway
- [ ] Variable value is base64 encoded (1000+ characters)
- [ ] Logs show: `YOUTUBE_COOKIES env var exists: true`
- [ ] Logs show: `✅ Using YouTube cookies for authentication`
- [ ] Cookies were extracted while logged into YouTube
- [ ] Cookies are less than 30 days old
- [ ] Using `cookies.txt` (Netscape format)

If ALL boxes are checked and it still doesn't work:
- YouTube may have changed their bot detection
- Try updating `youtube-dl-exec`: `npm update youtube-dl-exec`
- Consider alternative solutions (Option 2 or 3 above)

---

## Debug Commands

```bash
# Check if variable is set in Railway
railway variables | grep YOUTUBE_COOKIES

# Test cookies locally
cd backend
npm run test:cookies

# Check Railway logs in real-time
railway logs --follow

# SSH into Railway container (if available)
railway shell
echo $YOUTUBE_COOKIES | wc -c  # Should be 1000+
```

---

## Need More Help?

1. **Show me your Railway logs** after adding cookies (look for the 🍪 emoji)
2. **Run** `npm run test:cookies` locally and share output
3. **Verify** the variable is set: `railway variables`

The detailed logs will show exactly where the problem is!
