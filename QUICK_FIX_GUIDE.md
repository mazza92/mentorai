# Quick Performance Fix Guide

## Immediate Actions Needed

### 1. Kill Stale Node Processes (PORT 3001 IN USE)

**PowerShell:**
```powershell
Get-Process -Name node | Stop-Process -Force
```

**OR via Task Manager:**
1. Press `Ctrl + Shift + Esc`
2. Find all "Node.js: Server-side JavaScript" processes
3. Right-click → End Task on each

### 2. Apply Backend Retry Delay Fixes

The current retry delays are too aggressive (2s, 4s, 8s) and causing API overload.

**Files to update:**
- `backend/services/videoQAService.js` (2 locations)
- `backend/services/videoAnalysisService.js` (1 location)
- `backend/routes/topics.js` (1 location)

**Find and replace:**
```javascript
// OLD (too aggressive):
const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s

// NEW (more conservative):
const waitTime = Math.pow(2, retryCount) * 1500 + Math.random() * 1000; // 3-4s, 6-7s, 12-13s with jitter
```

### 3. Increase Base Delays Between API Calls

**In `backend/routes/uploadYoutube.js` (line 101):**
```javascript
// OLD:
}, 1000); // Small delay

// NEW:
}, 3000); // 3s delay to avoid overwhelming API
```

**In `backend/routes/transcribe.js` (if TOC generation exists):**
```javascript
// OLD:
}, 5000); // 5s delay

// NEW:
}, 10000); // 10s delay to spread out API calls
```

## What Was Already Fixed

✅ **Frontend Polling** - Now uses exponential backoff (5s → 30s)
- `WanderMindViewer.tsx`
- `ProjectViewer.tsx`

✅ **Rate Limiter Created** - Prevents concurrent API bombardment
- `backend/utils/rateLimiter.js`

## Testing the Fixes

### 1. Start Backend
```bash
cd backend
npm run dev
```

### 2. Start Frontend
```bash
cd frontend
npm run dev
```

### 3. Test Video Processing
1. Navigate to http://localhost:3000
2. Enter a YouTube URL (use a short video ~5-10 min)
3. Watch the console logs for:
   - ✅ Fewer "503 Service Unavailable" errors
   - ✅ Longer delays between retries
   - ✅ Successful completions

### 4. Monitor API Usage
Check your API quotas:
- **Gemini**: https://aistudio.google.com/app/apikey
- **OpenAI**: https://platform.openai.com/usage

## Expected Behavior After Fixes

### Before:
- ❌ Port 3001 conflicts
- ❌ Frontend polls every 3-5s constantly
- ❌ Backend retries every 2-4s → API overload
- ❌ 503 errors cascade causing more failures
- ❌ User sees loading screen for 2-3 minutes

### After:
- ✅ Clean startup (no port conflicts)
- ✅ Frontend polls: 5s → 7.5s → 11s → 17s → 25s → 30s
- ✅ Backend retries: 3s → 6s → 12s (with jitter to avoid thundering herd)
- ✅ Fewer API errors, graceful degradation
- ✅ User sees results within 30-60 seconds

## Advanced: Enable Rate Limiter (Optional)

To use the rate limiter for coordinated API calls, wrap Gemini API calls:

```javascript
const { geminiRateLimiter } = require('../utils/rateLimiter');

// OLD:
const result = await model.generateContent(...);

// NEW:
const result = await geminiRateLimiter.enqueue(async () => {
  return await model.generateContent(...);
});
```

This ensures only 2 Gemini requests run concurrently with 3s between each.

## Troubleshooting

### Still Getting 503 Errors?
- Check if your Gemini API key has quota
- Consider upgrading to paid tier
- Increase retry delays further (5s → 10s → 20s)

### Still Getting 429 OpenAI Errors?
- Your OpenAI quota is exhausted
- Add credits to your OpenAI account
- OR disable OpenAI Whisper and use Gemini-only transcription

### Frontend Still Polling Too Much?
- Check browser console for multiple component mounts
- Ensure `useEffect` dependencies are correct
- Clear browser cache and hard reload (Ctrl+F5)

## Performance Metrics

Target metrics after fixes:
- **Initial Response**: < 2 seconds (project created)
- **Transcription Complete**: 30-60 seconds (10min video)
- **TOC Generated**: +10-20 seconds after transcription
- **Ready for Q&A**: ~60-90 seconds total

## Next Steps

1. Fix the 4 retry delay locations mentioned above
2. Restart backend server (kill old process first!)
3. Test with a short YouTube video
4. Monitor console logs for improvements
5. If still issues, consider implementing rate limiter integration

## Production Recommendations

For production deployment:
1. Use a job queue (Bull, BullMQ, or AWS SQS)
2. Separate workers for transcription, analysis, TOC
3. Redis for caching TOC and analysis results
4. WebSocket for real-time status updates (vs. polling)
5. Rate limiting at API gateway level
6. CDN for serving processed videos

## Questions?

Check the logs for specific error patterns and adjust delays accordingly.
- If seeing "overloaded" → Increase delays
- If seeing "quota" → Check API limits
- If seeing "timeout" → Increase timeout limits
