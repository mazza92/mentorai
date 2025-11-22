# QUICK FIX: Get Working App in 10 Minutes

## Problem
- Single video uploads: "Sign in to confirm you're not a bot"
- Channel imports: YouTube API playlist errors
- App is unusable

## Solution: Update Cookies NOW

### Step 1: Export Fresh Cookies (3 minutes)

1. **Open Chrome** (logged into YouTube)
2. **Install extension**: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
3. **Go to**: https://youtube.com
4. **Click extension** → Export → Save as `youtube_cookies.txt`

### Step 2: Convert to Base64 (1 minute)

**Open PowerShell**, navigate to where you saved the file, run:

```powershell
$content = Get-Content -Path "youtube_cookies.txt" -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$base64 = [Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard
Write-Host "✅ Base64 copied to clipboard - paste it in Railway!"
```

### Step 3: Update Railway (2 minutes)

1. Go to: https://railway.app/project/[your-project]
2. Click **Variables** tab
3. Find `YOUTUBE_COOKIES`
4. **Paste** the Base64 string (Ctrl+V)
5. **Save**
6. Railway auto-redeploys (~2min)

### Step 4: Disable Channel Imports (1 minute)

While you're in Railway Variables, add:
```
DISABLE_CHANNEL_IMPORTS=true
```

This will hide the broken channel import feature until we fix it properly.

---

## Expected Result

✅ Single video uploads work
✅ Q&A works
✅ No crashes
✅ Can test market TODAY

⚠️ Channel imports hidden (will fix later)

---

## Total Time: ~10 minutes

Then you have a WORKING app to test the market!

---

## Next Steps (After Market Validation)

1. Fix channel imports properly
2. Add automated cookie refresh
3. Add premium features

But FIRST, get it working!
