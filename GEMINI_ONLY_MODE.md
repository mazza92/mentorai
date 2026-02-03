# Gemini-Only Mode Configuration

## ✅ Configuration Complete!

Your app is now configured to use **Gemini-only** for transcription in development.

## 🔧 What Was Changed

### 1. Environment Variables (`.env`)
```env
# Transcription Configuration (for development)
USE_OPENAI_WHISPER=false  # ← OpenAI disabled
USE_GEMINI=true           # ← Gemini enabled
```

### 2. Transcription Route Logic Updated
**File**: `backend/routes/transcribe.js`

- Added proper flag checking for `USE_OPENAI_WHISPER` and `USE_GEMINI`
- Will skip OpenAI Whisper entirely when disabled
- Goes directly to Gemini transcription
- Added better console logging with ✅ and ⚠️ emojis

### 3. Gemini Retry Logic Enhanced
- **5 retry attempts** with exponential backoff
- Delays: 5s → 10s → 20s → 40s → 80s (with random jitter)
- Better handling of 503 Service Unavailable errors
- 5-second delay before starting to avoid overwhelming API

## 🚀 How to Start

### 1. Restart Backend
```bash
cd backend
npm run dev
```

**Look for this in console:**
```
✅ Gemini API enabled for transcription
✅ Using Gemini-only mode for transcription
```

**NOT this:**
```
✅ OpenAI Whisper enabled for transcription  # ← Should NOT see this
```

### 2. Test Transcription

Upload a **short video** (3-5 minutes) to test:
- Gemini free tier has rate limits: **15 requests/minute, 1500/day**
- Processing a video makes multiple API calls (transcription + TOC + Q&A)
- Start with ONE video at a time

## ⚙️ Gemini API Rate Limits

### Free Tier (Current):
- **15 requests per minute**
- **1500 requests per day**
- **4MB file size limit** for audio

### For a 10-minute video:
- 1x Transcription call (audio)
- 1x TOC generation call
- 1x Video analysis (5 frames = 5 calls)
- 1x Suggested prompts call
- **Total: ~8 API calls** per video

**Processing time**: 30-90 seconds (with retries if API is overloaded)

## 📊 Expected Behavior

### On Startup:
```
✅ Gemini API enabled for transcription
✅ Using Gemini-only mode for transcription
🚀 WanderCut Backend running on port 3001
```

### During Transcription:
```
Starting Gemini transcription for project: abc-123
Using Gemini for audio transcription...

# If API is overloaded (503):
Gemini transcription failed (503 overloaded). Retrying in 5s... (attempt 1/5)
Gemini transcription failed (503 overloaded). Retrying in 10s... (attempt 2/5)
Gemini transcription complete ✅
Transcript length: 12000 characters
```

### Success:
```
Gemini transcription complete
Transcript length: 12000 characters
Background transcription complete for project: abc-123
```

## ⚠️ Troubleshooting

### Issue: Still seeing "OpenAI Whisper" in logs
**Solution**:
1. Stop the backend (Ctrl+C)
2. Kill any stale processes: `Get-Process -Name node | Stop-Process -Force`
3. Restart: `npm run dev`
4. Verify `.env` has `USE_OPENAI_WHISPER=false`

### Issue: "Gemini transcription failed" (503 errors)
**Cause**: Gemini free tier rate limits hit

**Solutions**:
1. **Wait 1-2 hours** for rate limits to reset
2. **Process ONE video at a time** (not multiple)
3. **Use shorter videos** (3-5 minutes for testing)
4. **Upgrade to Gemini paid tier**:
   - Visit https://aistudio.google.com/
   - Much higher rate limits
   - ~$0.35 per 1M tokens (very cheap)

### Issue: "No audio file found for transcription"
**Cause**: Project doesn't have audio extracted yet

**Solution**:
- Make sure YouTube download completed successfully
- Check backend logs for "Audio extraction complete"
- Audio file should exist at `backend/uploads/*.mp3`

### Issue: All retries exhausted (5/5 attempts failed)
**Cause**: Persistent API overload or rate limit

**Solutions**:
1. **Stop testing temporarily** - Wait 30-60 minutes
2. **Check your Gemini quota**:
   - Visit https://aistudio.google.com/app/apikey
   - Check daily/hourly limits
3. **Consider upgrading** to paid tier for development
4. **Use mock transcription** for UI testing (see below)

## 🧪 Mock Transcription (For UI Testing)

If you want to test the UI without transcription:

### Add to `.env`:
```env
USE_MOCK_TRANSCRIPTION=true
```

### Add to `backend/routes/transcribe.js` (top of POST route):
```javascript
router.post('/', async (req, res) => {
  // Mock transcription for testing
  if (process.env.USE_MOCK_TRANSCRIPTION === 'true') {
    const { projectId } = req.body;
    const project = mockProjects.get(projectId);

    const mockTranscript = {
      text: 'This is a mock transcription for testing. It allows you to test the Q&A interface without consuming API quota. Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      words: ['This', 'is', 'a', 'mock', 'transcription'].map((word, i) => ({
        word,
        startTime: i * 0.5,
        endTime: (i + 1) * 0.5,
        confidence: 0.95
      })),
      segments: []
    };

    project.transcript = mockTranscript;
    project.transcriptionStatus = 'completed';
    mockProjects.set(projectId, project);

    return res.json({
      success: true,
      transcript: mockTranscript,
      message: 'Mock transcription completed'
    });
  }

  // ... rest of route
});
```

## 💰 Cost Estimates (If You Upgrade)

### Gemini Paid Tier:
- **Transcription** (audio): ~$0.35 per 1M tokens
- **10-minute video**: ~3,000 tokens = **$0.001** (~$0.10 cents!)
- **100 videos/month**: ~**$0.10**

**Very affordable** for development!

### OpenAI Whisper (For Comparison):
- **$0.006 per minute** of audio
- **10-minute video**: **$0.06** (6 cents)
- **100 videos/month**: **$6.00**

**Gemini is ~60x cheaper!**

## 📈 Performance Tips

### 1. Process Videos Sequentially
```javascript
// Good: Process one at a time
await processVideo1()
await processVideo2()
await processVideo3()

// Bad: Process all at once (will hit rate limits)
await Promise.all([
  processVideo1(),
  processVideo2(),
  processVideo3()
])
```

### 2. Use Shorter Videos for Testing
- 3-5 minutes = faster transcription, fewer API calls
- 10-15 minutes = good for real-world testing
- 30+ minutes = wait for production/paid tier

### 3. Cache Transcriptions
Already implemented! Transcriptions are stored in `mockStorage` and not re-processed.

### 4. Delay Between Uploads
If uploading multiple videos:
- Wait 2-3 minutes between uploads
- Allows rate limits to recover
- Reduces 503 errors

## 🎯 Next Steps

1. **Restart backend** with new configuration
2. **Upload ONE short video** (3-5 min) to test
3. **Watch console logs** for Gemini transcription progress
4. **If 503 errors**: Wait 1-2 hours OR upgrade to paid tier
5. **If successful**: Process more videos (one at a time!)

## 🔄 Switching Back to OpenAI

If you add OpenAI credits later:

### Edit `.env`:
```env
USE_OPENAI_WHISPER=true   # ← Enable
USE_GEMINI=true           # ← Keep as fallback
```

Gemini will still be used as fallback if OpenAI quota is exceeded.

## 📚 Related Documentation

- **TRANSCRIPTION_FIX.md** - Detailed transcription troubleshooting
- **PERFORMANCE_FIXES_SUMMARY.md** - All performance improvements
- **QUICK_FIX_GUIDE.md** - General troubleshooting

## ✅ Summary

- ✅ Gemini-only mode enabled
- ✅ OpenAI Whisper disabled
- ✅ Retry logic improved (5 attempts, up to 80s delays)
- ✅ Rate limit friendly (5s delays between calls)
- ✅ Cost-effective ($0.001 per 10-min video)

**Ready to test!** 🚀

Just remember:
- **One video at a time**
- **Short videos first** (3-5 min)
- **Wait if you hit 503 errors** (rate limits)

Good luck with development! 🎉
