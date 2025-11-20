# Freemium Implementation - Anonymous Trial with Signup Wall

## Overview

Implemented a freemium validation strategy that allows users to try the product without signup, then triggers a signup wall when limits are reached.

**Validation Flow:**
1. **Anonymous Trial** (No signup) → 1 upload + 3 questions
2. **Signup Wall Triggered** → Prompts user to create account
3. **Free Tier** (After signup) → 3 uploads + 15 questions/month
4. **Pro Tier** (Upgrade) → 50 uploads + unlimited questions/month

---

## Implementation Details

### 1. Anonymous Tier (`config/pricing.js`)

Added new pricing tier for anonymous users:

```javascript
anonymous: {
  id: 'anonymous',
  name: 'Trial (No Signup)',
  price: 0,
  features: {
    videosPerMonth: 1,
    questionsPerMonth: 3,
    // ...
  }
}
```

**Limits:**
- ✅ **1 video upload** (direct or YouTube)
- ✅ **3 questions** total
- ✅ **No account required**
- ✅ **7-day session expiry**

---

### 2. Anonymous Session Tracking (`services/anonymousSessionService.js`)

**NEW SERVICE** - Tracks anonymous usage without database:

```javascript
// Key Functions:
- getSession(sessionId)           // Get or create session
- checkVideoQuota(sessionId)      // Check if can upload
- checkQuestionQuota(sessionId)   // Check if can ask
- incrementVideoCount(sessionId)  // Track upload
- incrementQuestionCount(sessionId) // Track question
```

**Features:**
- In-memory storage (Map-based)
- 7-day session expiry
- Auto-cleanup hourly
- Production-ready (extend with Redis)

**Session Structure:**
```javascript
{
  sessionId: "session_xyz123",
  tier: "anonymous",
  videosUploaded: 0,
  questionsAsked: 0,
  createdAt: Date,
  lastActivity: Date
}
```

---

### 3. User Service Updates (`services/userService.js`)

**NEW FUNCTIONS:**
```javascript
isAnonymousUser(userId)           // Detect anonymous sessions
checkVideoQuota(userId)           // Check upload limits
incrementVideoCount(userId)       // Track uploads
```

**Detection Logic:**
```javascript
// Anonymous if userId is:
- "anonymous"
- "anon_..."
- "session_..."
- null/undefined
```

**Updated Functions:**
- `checkQuestionQuota()` - Now handles anonymous users
- `incrementQuestionCount()` - Now handles anonymous users

---

### 4. Route Updates

#### Upload Route (`routes/upload.js`)

**BEFORE Upload:**
```javascript
// Check quota
const quota = await userService.checkVideoQuota(userId);

if (!quota.canProcess) {
  // Delete file, return signup wall
  return res.status(403).json({
    error: 'Upload limit reached',
    message: 'Sign up to get 3 uploads per month!',
    requiresSignup: true  // ← SIGNUP WALL
  });
}
```

**AFTER Upload:**
```javascript
// Increment count
await userService.incrementVideoCount(userId);
```

#### YouTube Upload Route (`routes/uploadYoutube.js`)

- Same quota checking logic
- Same signup wall trigger
- Replaced HTTP calls with direct service calls

#### Q&A Route (`routes/qa.js`)

**BEFORE Question:**
```javascript
const { canAsk, requiresSignup } = await userService.checkQuestionQuota(userId);

if (!canAsk) {
  return res.status(403).json({
    error: 'Question limit reached',
    message: 'Sign up to get 15 questions per month!',
    requiresSignup: true  // ← SIGNUP WALL
  });
}
```

**AFTER Question:**
```javascript
// Already implemented - incrementQuestionCount()
```

---

## API Response Format

### Signup Wall Response (Anonymous User)

```json
{
  "error": "Upload limit reached",
  "message": "You've used your 1 free upload. Sign up to get 3 uploads per month!",
  "tier": "anonymous",
  "videosThisMonth": 1,
  "limit": 1,
  "requiresSignup": true,    ← Frontend shows signup wall
  "upgradeRequired": false
}
```

### Upgrade Required Response (Free User)

```json
{
  "error": "Upload limit reached",
  "message": "You've reached your monthly upload limit. You've uploaded 3/3 videos this month.",
  "tier": "free",
  "videosThisMonth": 3,
  "limit": 3,
  "requiresSignup": false,
  "upgradeRequired": true     ← Frontend shows upgrade prompt
}
```

---

## Frontend Integration

### 1. Pass SessionId

The frontend should generate and persist a sessionId:

```javascript
// Generate once per browser
let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
  sessionId = `session_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('sessionId', sessionId);
}

// Pass to API calls
const formData = new FormData();
formData.append('video', file);
formData.append('userId', sessionId); // Use sessionId for anonymous
```

### 2. Handle Signup Wall

```javascript
// Upload response handler
const response = await fetch('/api/upload', { ... });
const data = await response.json();

if (data.requiresSignup) {
  // Show signup modal/wall
  showSignupModal({
    title: 'Free Trial Complete!',
    message: data.message,
    benefits: ['3 uploads per month', '15 questions per month', 'All AI features']
  });
} else if (data.upgradeRequired) {
  // Show upgrade prompt
  showUpgradeModal({
    title: 'Upgrade to Pro',
    message: data.message,
    benefits: ['50 uploads per month', 'Unlimited questions', 'Priority support']
  });
}
```

### 3. After Signup

Once user signs up, replace sessionId with real userId:

```javascript
// After successful signup/login
const userId = authUser.uid;
localStorage.setItem('userId', userId);

// Use userId instead of sessionId
formData.append('userId', userId);
```

---

## User Journey

### Anonymous User (First Visit)

```
1. Land on homepage
   → No signup required

2. Upload first video
   ✅ Allowed (1/1 uploads used)
   → Video processed

3. Ask first question
   ✅ Allowed (1/3 questions used)
   → Answer received

4. Ask second question
   ✅ Allowed (2/3 questions used)
   → Answer received

5. Ask third question
   ✅ Allowed (3/3 questions used)
   → Answer received

6. Try to ask fourth question
   ❌ BLOCKED
   → Signup wall appears
   → Message: "Sign up to get 15 questions per month!"
```

### After Signup

```
7. User signs up
   → Tier upgraded: anonymous → free
   → New limits: 3 uploads, 15 questions

8. Upload second video
   ✅ Allowed (1/3 uploads used)
   → Using free tier

9. Ask more questions
   ✅ Allowed (up to 15 total)
   → Using free tier

10. Hit free tier limits
    → Upgrade prompt appears
    → Message: "Upgrade to Pro for unlimited!"
```

---

## Testing

### Test Anonymous Flow

**Test 1: First Upload (Should Work)**
```bash
curl -X POST http://localhost:8080/api/upload \
  -F "video=@test.mp4" \
  -F "userId=session_test123"

# Expected: Success (1/1 uploads used)
```

**Test 2: Second Upload (Should Block)**
```bash
curl -X POST http://localhost:8080/api/upload \
  -F "video=@test2.mp4" \
  -F "userId=session_test123"

# Expected: 403 with requiresSignup: true
```

**Test 3: Questions (3 allowed)**
```bash
# Q1, Q2, Q3 - Should work
curl -X POST http://localhost:8080/api/qa \
  -H "Content-Type: application/json" \
  -d '{"userId":"session_test123", "projectId":"...", "question":"..."}'

# Q4 - Should block
# Expected: 403 with requiresSignup: true
```

### Test Authenticated Flow

```bash
# With real userId (free tier)
curl -X POST http://localhost:8080/api/upload \
  -F "video=@test.mp4" \
  -F "userId=user_abc123"

# Expected: Success (up to 3 uploads)
```

---

## Production Considerations

### 1. Replace In-Memory Storage

Current implementation uses `Map` for sessions. For production:

```javascript
// Replace with Redis
const redis = require('redis');
const client = redis.createClient();

async function getSession(sessionId) {
  const session = await client.get(`session:${sessionId}`);
  return JSON.parse(session);
}

async function incrementVideoCount(sessionId) {
  await client.hincrby(`session:${sessionId}`, 'videosUploaded', 1);
}
```

### 2. IP-Based Fallback

For users who clear cookies:

```javascript
// Combine sessionId + IP for better tracking
const identifier = sessionId || req.ip;
```

### 3. Analytics

Track conversion funnel:

```javascript
// Track events
analytics.track({
  event: 'signup_wall_shown',
  properties: {
    trigger: 'upload_limit',  // or 'question_limit'
    videosUsed: 1,
    questionsUsed: 3
  }
});
```

---

## Files Modified

1. **`config/pricing.js`**
   - Added `anonymous` tier definition

2. **`services/anonymousSessionService.js`** (NEW)
   - Session tracking logic
   - Quota checking
   - Auto-cleanup

3. **`services/userService.js`**
   - Added `isAnonymousUser()`
   - Added `checkVideoQuota()`
   - Added `incrementVideoCount()`
   - Updated quota functions to handle anonymous

4. **`routes/upload.js`**
   - Pre-upload quota check
   - Post-upload increment
   - Signup wall response

5. **`routes/uploadYoutube.js`**
   - Same quota logic as upload.js
   - Replaced HTTP calls with service calls

6. **`routes/qa.js`**
   - Updated quota check response
   - Added `requiresSignup` flag

---

## Deployment

**Commit:** `91b8c50` (initial implementation)
**Latest Commit:** `32c4ddf` (documentation)
**Status:** ✅ Pushed to GitHub, ready for Railway deployment

**Railway will:**
1. Build new code
2. Deploy changes
3. Start serving freemium flow

**Monitor:**
- Anonymous session creation
- Signup wall triggers
- Conversion to free tier

---

## Monitoring & Metrics

### Key Metrics to Track

1. **Anonymous Usage**
   - Sessions created
   - Videos uploaded (anonymous)
   - Questions asked (anonymous)

2. **Conversion**
   - Signup wall shown (upload limit)
   - Signup wall shown (question limit)
   - Signup completion rate

3. **Free Tier Usage**
   - Post-signup uploads
   - Post-signup questions
   - Upgrade wall shown

4. **Upgrade Conversion**
   - Free → Pro conversion rate
   - Time to upgrade

### Example Logs

```
✅ Anonymous session session_abc123: 1 video(s) uploaded
✅ Anonymous session session_abc123: 3 question(s) asked
❌ Anonymous session session_abc123: Upload limit reached → Signup wall
✅ User user_xyz789 (free): 2/3 uploads used
```

---

## Next Steps

### Frontend Tasks

1. **Session Management**
   - Generate sessionId on first visit
   - Store in localStorage
   - Pass to all API calls

2. **Signup Wall UI**
   - Design modal/wall component
   - Show benefits of signing up
   - Integrate with auth system

3. **Progress Indicators**
   - Show "1/1 uploads used" badge
   - Show "3/3 questions used" badge
   - Prompt before hitting limit

4. **Post-Signup Flow**
   - Replace sessionId with userId
   - Migrate session data (optional)
   - Show "Upgraded to Free!" message

### Backend Tasks (Optional)

1. **Redis Integration**
   - Replace in-memory Map
   - Distributed session storage

2. **Session Migration**
   - Endpoint to migrate anonymous → user
   - Transfer quota usage

3. **Analytics Integration**
   - Track signup wall triggers
   - Measure conversion funnel

---

## Summary

✅ **Implemented:** Freemium model with 3-tier validation
✅ **Anonymous:** 1 upload, 3 questions (no signup)
✅ **Free:** 3 uploads, 15 questions (after signup)
✅ **Pro:** 50 uploads, unlimited questions (paid)

✅ **Signup Wall:** Triggers when anonymous limits reached
✅ **Session Tracking:** In-memory (extend with Redis)
✅ **API Responses:** Include `requiresSignup` flag

**Ready for production validation!** 🚀
