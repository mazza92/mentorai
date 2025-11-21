# 🍪 YouTube Cookie Refresh Guide (5 Minutes)

## Why You Need This
YouTube blocks our app after ~7 days when cookies expire. This causes:
- ❌ All captions to fail
- ❌ All video downloads to fail
- ❌ Q&A to only work with metadata (poor quality)

## Quick Fix (5 Minutes)

### Step 1: Export Fresh Cookies from Browser

**Option A: Using Chrome Extension (EASIEST)**
1. Install [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
2. Go to https://youtube.com (make sure you're logged in)
3. Click the extension icon
4. Click "Export" → Save as `youtube_cookies.txt`

**Option B: Using Firefox Extension**
1. Install [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)
2. Go to https://youtube.com (logged in)
3. Click extension → Export cookies

### Step 2: Convert to Base64

**Windows PowerShell:**
```powershell
$content = Get-Content -Path "youtube_cookies.txt" -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$base64 = [Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard
Write-Host "✅ Base64 copied to clipboard!"
```

**Mac/Linux Terminal:**
```bash
cat youtube_cookies.txt | base64 | pbcopy  # Mac
cat youtube_cookies.txt | base64 | xclip   # Linux
echo "✅ Base64 copied to clipboard!"
```

### Step 3: Update Environment Variable

**Railway:**
1. Go to your project → Variables
2. Find `YOUTUBE_COOKIES`
3. Paste the Base64 string (Ctrl+V)
4. Save
5. Redeploy automatically happens

**Local Development:**
1. Open `.env` file
2. Update: `YOUTUBE_COOKIES=<paste_base64_here>`
3. Restart server: `npm run dev`

---

## Expected Results After Refresh

Before (Stale):
```
❌ [CaptionService] Error: Transcript is disabled
❌ [YouTube] Sign in to confirm you're not a bot
```

After (Fresh):
```
✅ [CaptionService] ✓ Captions fetched: 245 segments
✅ [YouTube] Video download complete
```

---

## How Often?

**Refresh cookies every 5-7 days** to avoid issues.

Set a calendar reminder! ⏰

---

## Troubleshooting

**"Still getting errors after refresh"**
- Make sure you're logged into YouTube in the browser when exporting
- Try incognito/private mode then log in fresh
- Check cookies.txt file has content (should be ~50+ lines)

**"Base64 conversion failed"**
- Make sure `youtube_cookies.txt` exists in current directory
- File should start with: `# Netscape HTTP Cookie File`
- Windows: Use PowerShell, not CMD

---

## Need Help?

The full technical guide is in `YOUTUBE_COOKIE_REFRESH_GUIDE.md`
