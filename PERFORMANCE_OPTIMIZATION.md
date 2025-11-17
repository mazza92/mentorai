# Performance Optimization Guide

## Issues Identified

### 1. **Port Conflict (EADDRINUSE)**
- **Problem**: Backend server not shutting down cleanly
- **Solution**: Use `killall node` or Task Manager to kill stale Node processes on Windows

### 2. **Excessive Frontend Polling**
- **Problem**: Frontend polls `/api/projects/project/:projectId` every 5 seconds
- **Impact**: Causes excessive server load and API calls
- **Solution**: Implement exponential backoff (5s → 10s → 20s → 30s max)

### 3. **API Rate Limiting**
- **Problem**: Gemini API returning 503 (Service Unavailable), OpenAI returning 429 (Quota Exceeded)
- **Impact**: Processing failures and retries cause more load
- **Solution**: Implement intelligent retry with exponential backoff + jitter

### 4. **Blocking Processing**
- **Problem**: Video processing blocks user experience
- **Impact**: Users see loading screen for 1-2 minutes
- **Solution**: Make processing truly asynchronous with status updates

## Performance Improvements

### Frontend Optimizations

#### 1. Exponential Backoff for Polling
```typescript
// Instead of fixed 5s interval:
setInterval(() => fetch(), 5000)

// Use exponential backoff:
let pollInterval = 5000; // Start at 5s
const maxInterval = 30000; // Max 30s

setInterval(() => {
  if (stillProcessing) {
    fetch();
    pollInterval = Math.min(pollInterval * 1.5, maxInterval);
  }
}, pollInterval)
```

#### 2. Stop Polling When Complete
- Stop polling once transcription + TOC are complete
- Reduce unnecessary API calls

### Backend Optimizations

#### 1. Rate Limiting with Exponential Backoff
```javascript
// Add jitter to avoid thundering herd
const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
```

#### 2. Queue-Based Processing
- Process videos sequentially to avoid overwhelming APIs
- Limits concurrent API calls

#### 3. Caching Strategy
- Cache TOC and suggested prompts aggressively
- Avoid regenerating on every request

## Quick Fixes

### Kill Stale Node Processes (Windows)
```bash
# PowerShell
Get-Process -Name node | Stop-Process -Force

# Or use Task Manager
1. Open Task Manager (Ctrl+Shift+Esc)
2. Find "Node.js" processes
3. End task on all
```

### Restart Backend with Clean State
```bash
cd backend
npm run dev
```

### Monitor API Usage
- Check Gemini API quota at: https://makersuite.google.com/app/apikey
- Check OpenAI API quota at: https://platform.openai.com/usage
- Consider upgrading API tiers if hitting limits frequently

## Implementation Priority

1. **HIGH**: Fix polling to use exponential backoff (immediate impact)
2. **HIGH**: Add better error handling for 503/429 errors
3. **MEDIUM**: Implement request queuing
4. **LOW**: Add Redis caching for production

## Expected Results

- **Before**: 1-2 minute loading time, frequent API errors
- **After**: Immediate response, background processing, <30s for completion
- **API Calls Reduced**: ~90% reduction in polling requests
