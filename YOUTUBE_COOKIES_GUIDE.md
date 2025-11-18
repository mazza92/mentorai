# YouTube Cookies Setup Guide

## Why Cookies Are Needed

YouTube blocks automated bot access in production environments. To bypass this, you need to provide authenticated cookies from a logged-in YouTube session.

## Step 1: Extract Cookies from Your Browser

### Option A: Using Browser Extension (Easiest)

1. **Install "Get cookies.txt LOCALLY" Extension**:
   - Chrome: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/

2. **Extract Cookies**:
   - Go to https://www.youtube.com
   - Log in to your YouTube account
   - Click the extension icon
   - Click "Export" to download `cookies.txt`

### Option B: Using yt-dlp (Command Line)

```bash
# Install yt-dlp if not already installed
pip install yt-dlp

# Extract cookies from your Chrome browser
yt-dlp --cookies-from-browser chrome --cookies cookies.txt "https://www.youtube.com"

# Or from Firefox
yt-dlp --cookies-from-browser firefox --cookies cookies.txt "https://www.youtube.com"
```

## Step 2: Convert Cookies to Base64

After extracting `cookies.txt`, convert it to base64:

### On Windows (PowerShell):
```powershell
$cookiesContent = Get-Content -Path "cookies.txt" -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($cookiesContent)
$base64 = [Convert]::ToBase64String($bytes)
$base64 | Out-File -FilePath "cookies_base64.txt"
Write-Host "Base64 cookies saved to cookies_base64.txt"
```

### On Linux/Mac:
```bash
cat cookies.txt | base64 > cookies_base64.txt
```

### Online Tool (Quick):
1. Go to https://www.base64encode.org/
2. Paste the contents of `cookies.txt`
3. Click "Encode"
4. Copy the result

## Step 3: Add to Railway Environment

1. **Go to Railway Dashboard**:
   - https://railway.app/dashboard

2. **Select Your Project** → Click "Variables"

3. **Add New Variable**:
   - **Name**: `YOUTUBE_COOKIES`
   - **Value**: Paste the base64 string from `cookies_base64.txt`

4. **Redeploy**:
   - Railway will automatically redeploy with the new variable

## Step 4: Verify It Works

After redeploying, check your Railway logs. You should see:
```
✅ Using YouTube cookies for authentication
```

When you upload a YouTube video, it should now work without bot detection errors.

---

## Important Notes

### Cookie Expiration
- YouTube cookies expire after **~1-2 months**
- You'll need to regenerate and update them periodically
- Set a calendar reminder to refresh cookies monthly

### Security
- **Never commit cookies.txt to Git**
- Keep cookies private (they give access to your YouTube account)
- Use a dedicated YouTube account for your app (not your personal account)

### Troubleshooting

**Issue**: Still getting bot detection errors
- **Solution**: Regenerate cookies (they may have expired)
- Make sure you're logged into YouTube when extracting
- Try using a different browser

**Issue**: Videos still won't download
- **Solution**: YouTube may be temporarily blocking the IP
- Wait 10-15 minutes and try again
- Consider using a proxy or VPN

**Issue**: "cookies.txt file not found" error
- **Solution**: Make sure the base64 conversion was successful
- Check that the `YOUTUBE_COOKIES` variable is set in Railway
- Redeploy after adding the variable

---

## Alternative Solutions (Future)

If cookie management becomes too tedious, consider:

1. **YouTube Data API v3**: For metadata only (can't download videos)
2. **Third-party APIs**: Like RapidAPI YouTube downloaders
3. **Proxy Rotation**: Use residential proxies to avoid detection
4. **Cookie Rotation Service**: Automate cookie management

---

## Quick Reference: Full Setup Commands

```bash
# 1. Extract cookies (using yt-dlp)
yt-dlp --cookies-from-browser chrome --cookies cookies.txt "https://www.youtube.com"

# 2. Convert to base64 (Linux/Mac)
cat cookies.txt | base64 > cookies_base64.txt

# 3. Copy to clipboard (Mac)
cat cookies_base64.txt | pbcopy

# 4. On Railway: Add YOUTUBE_COOKIES variable with the base64 string

# 5. Redeploy and test!
```

---

## Example cookies.txt Format

Your `cookies.txt` should look like this (Netscape format):
```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1234567890	VISITOR_INFO1_LIVE	abc123xyz
.youtube.com	TRUE	/	TRUE	1234567890	CONSENT	YES+cb.20210101
.youtube.com	TRUE	/	FALSE	1234567890	LOGIN_INFO	AFmmF2swRQI...
```

If it doesn't look like this, the extension/tool might not have worked correctly. Try a different method.
