# YouTube Cookie Refresh Guide - URGENT

## ⚠️ Your YouTube Cookies Need Refreshing

**Symptom:** Getting "Sign in to confirm you're not a bot" errors even though cookies show as "valid"

**Why:** YouTube invalidates cookies server-side after ~7 days or if you change YouTube account settings. The expiry date looks valid, but YouTube won't accept them.

---

## 🔧 Quick Fix (5 minutes)

### **Option 1: Export Fresh Cookies (Chrome - Recommended)**

1. **Install "Get cookies.txt LOCALLY" extension**
   - Chrome: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
   - **IMPORTANT**: Use "LOCALLY" version (safer, no server upload)

2. **Sign into YouTube in your browser**
   - Go to https://youtube.com
   - Make sure you're fully logged in
   - Watch any video to ensure session is active

3. **Export cookies**
   - Click the extension icon while on YouTube
   - Click "Export" → Saves `youtube.com_cookies.txt`

4. **Convert to Base64**
   ```bash
   # Windows PowerShell:
   $cookieContent = Get-Content "youtube.com_cookies.txt" -Raw
   $bytes = [System.Text.Encoding]::UTF8.GetBytes($cookieContent)
   [Convert]::ToBase64String($bytes) | clip
   # (Copied to clipboard)
   ```

   ```bash
   # Mac/Linux:
   base64 -i youtube.com_cookies.txt | pbcopy
   # (Copied to clipboard)
   ```

5. **Update Railway Environment Variable**
   - Go to: Railway Dashboard → Your Project → Variables
   - Find: `YOUTUBE_COOKIES`
   - Replace with: Paste the new Base64 string
   - Save → Railway will auto-redeploy (~2 minutes)

6. **Test**
   - Wait 2-3 minutes for deployment
   - Try uploading a YouTube video
   - Should work immediately

---

### **Option 2: Use Browser-Based Export (Firefox)**

1. **Install "cookies.txt" extension**
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/

2. **Follow same steps** as Option 1 (starting from step 2)

---

## 🚨 Common Mistakes

### ❌ **"I updated the cookies but still getting errors"**
- **Wait 2-3 minutes** after updating environment variable
- Railway needs time to redeploy
- Check Railway deployment logs for "✅ All cookies are valid"

### ❌ **"Cookies show as expired immediately after refresh"**
- You exported cookies while **logged out** of YouTube
- Solution: Sign into YouTube FIRST, then export

### ❌ **"I'm using the wrong file"**
- Make sure you export from **youtube.com**, not "www.youtube.com"
- Both work, but yt-dlp expects `youtube.com` domain

---

## 📊 How to Tell if Cookies Are Working

### **Good Logs:**
```
✅ Using YouTube cookies for authentication
✅ All 26 cookies are valid
Processing YouTube video: [Video Title] (120s)
Video download complete
```

### **Bad Logs (Need Refresh):**
```
✅ Using YouTube cookies for authentication
✅ 1 non-critical cookies expired (okay, 25 valid)
ERROR: Sign in to confirm you're not a bot ❌
```

**Key**: Even if cookies show "25 valid", YouTube can reject them!

---

## 🔄 How Often to Refresh

| Frequency | Why |
|-----------|-----|
| **Every 7 days** | Recommended proactive refresh |
| **When errors appear** | YouTube invalidated them |
| **After YouTube login changes** | Changing password/2FA resets cookies |

---

## 🛠️ Automated Solution (Future)

**Option A: Cookie rotation** (requires multiple YouTube accounts)
- Rotate between different accounts' cookies
- More complex setup

**Option B: Browser automation** (requires headless Chrome)
- Auto-refresh cookies daily
- More infrastructure

**For now**: Manual refresh every week (5 minutes) is simplest.

---

## 📝 Troubleshooting Checklist

- [ ] Logged into YouTube in browser BEFORE exporting
- [ ] Used "Get cookies.txt LOCALLY" extension (not server-based)
- [ ] Exported from `youtube.com` (not `www.youtube.com`)
- [ ] Converted to Base64 correctly (no extra spaces/newlines)
- [ ] Updated `YOUTUBE_COOKIES` environment variable in Railway
- [ ] Waited 2-3 minutes for Railway to redeploy
- [ ] Checked Railway logs for "✅ All cookies are valid"

---

## 🔗 Quick Links

- **Chrome Extension**: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
- **Firefox Extension**: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/
- **Railway Dashboard**: https://railway.app/dashboard
- **yt-dlp Cookie Guide**: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp

---

**Last Updated**: November 20, 2025
**Status**: Cookies need refresh ~every 7 days
