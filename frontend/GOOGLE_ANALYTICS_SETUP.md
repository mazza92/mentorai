# Google Analytics 4 (GA4) Setup Guide for Lurnia

## ✅ Already Implemented

- [x] GA4 tracking component (`components/GoogleAnalytics.tsx`)
- [x] Cookie consent integration with GA4
- [x] Automatic page view tracking on route changes
- [x] GDPR-compliant consent management

## 📋 Setup Steps

### 1. Create Google Analytics 4 Property

1. **Go to Google Analytics**: https://analytics.google.com
2. **Create a new property** (or use existing):
   - Click **Admin** (gear icon)
   - Click **Create Property**
   - Property name: `Lurnia`
   - Reporting time zone: Your timezone
   - Currency: EUR

3. **Get your Measurement ID**:
   - After creating property, click **Data Streams**
   - Click **Add stream** → **Web**
   - Website URL: `https://lurnia.app`
   - Stream name: `Lurnia Production`
   - Copy the **Measurement ID** (format: `G-XXXXXXXXXX`)

### 2. Add Measurement ID to Environment Variables

Add to `.env.local` (frontend):
```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3. Verify Installation

1. Build and deploy the frontend:
```bash
cd frontend
npm run build
```

2. Visit your site and open Chrome DevTools → Network tab
3. Filter by `collect` or `gtag`
4. You should see requests to `www.google-analytics.com/g/collect`

5. Go to GA4 → **Reports** → **Realtime**
6. Open your site in a new tab
7. You should see yourself in the realtime report

---

## 🎯 Key Events to Track

### Events Already Tracked Automatically:
- ✅ **page_view** - All page navigation
- ✅ **cookie_consent** - User consent choices

### Events to Implement:

#### 1. Sign Up Event
**Location:** `frontend/components/Auth.tsx`
**Trigger:** After successful signup

```typescript
import { trackEvent } from '@/components/GoogleAnalytics'

// After successful signup
trackEvent('sign_up', {
  method: isGoogleSignup ? 'google' : 'email'
})
```

#### 2. Sign In Event
**Location:** `frontend/components/Auth.tsx`
**Trigger:** After successful login

```typescript
trackEvent('login', {
  method: isGoogleLogin ? 'google' : 'email'
})
```

#### 3. Channel Import Event
**Location:** `frontend/components/ChannelImport.tsx`
**Trigger:** After successful channel import

```typescript
import { trackEvent } from '@/components/GoogleAnalytics'

// After channel imported successfully
trackEvent('channel_import', {
  channel_id: channelId,
  user_tier: user ? 'registered' : 'anonymous'
})
```

#### 4. Question Asked Event
**Location:** `frontend/components/WanderMindViewer.tsx`
**Trigger:** When user submits a question

```typescript
import { trackEvent } from '@/components/GoogleAnalytics'

// When question is submitted
trackEvent('question_asked', {
  project_id: projectId,
  has_answer: true,
  user_tier: getUserTier() // 'anonymous', 'free', 'pro'
})
```

#### 5. Pro Upgrade Event (Conversion)
**Location:** `frontend/components/UpgradeModal.tsx` or checkout success page
**Trigger:** After successful Stripe payment

```typescript
import { trackEvent, trackConversion } from '@/components/GoogleAnalytics'

// After successful Pro upgrade
trackEvent('purchase', {
  transaction_id: stripeSessionId,
  value: 24.99,
  currency: 'EUR',
  items: [{
    item_id: 'pro_monthly',
    item_name: 'Pro Monthly Subscription',
    price: 24.99,
    quantity: 1
  }]
})

// Track as conversion for Google Ads
trackConversion('pro_upgrade', 24.99)
```

#### 6. Signup Wall Shown Event
**Location:** `frontend/components/SignupWall.tsx`
**Trigger:** When signup modal appears

```typescript
trackEvent('signup_wall_shown', {
  trigger_reason: 'channel_limit' // or 'question_limit'
})
```

#### 7. Upgrade Modal Shown Event
**Location:** `frontend/components/UpgradeModal.tsx`
**Trigger:** When upgrade modal appears

```typescript
trackEvent('upgrade_modal_shown', {
  trigger_reason: 'quota_exceeded'
})
```

---

## 🎯 Google Ads Conversion Tracking

### 1. Link GA4 to Google Ads

1. Go to **Google Ads**: https://ads.google.com
2. Click **Tools & Settings** → **Conversions**
3. Click **New Conversion Action**
4. Select **Import** → **Google Analytics 4 properties**
5. Select your GA4 property
6. Import key events:
   - `sign_up`
   - `purchase` (Pro upgrade)
   - `channel_import`

### 2. Set Conversion Values

1. In Google Ads → Conversions:
   - `sign_up`: Value = €0 (but mark as important)
   - `purchase`: Value = €24.99
   - `channel_import`: Value = €0 (but mark as important)

### 3. Track Conversions in Code

Already implemented in `GoogleAnalytics.tsx`:

```typescript
// Usage example
import { trackConversion } from '@/components/GoogleAnalytics'

trackConversion('sign_up')
trackConversion('pro_upgrade', 24.99)
```

---

## 📊 Recommended Custom Dimensions

Set up in GA4 → Admin → Custom Definitions:

1. **user_tier** (User-scoped)
   - Values: `anonymous`, `free`, `pro`

2. **subscription_status** (User-scoped)
   - Values: `trial`, `active`, `canceled`, `expired`

3. **quota_usage** (Event-scoped)
   - Track how close users are to their limits

---

## 🔍 Key Reports to Monitor

### 1. User Acquisition
- Go to **Reports** → **Acquisition** → **User acquisition**
- See where users come from (Google Ads, organic, direct)

### 2. Conversion Funnel
Create custom funnel:
1. Page view (landing page)
2. Channel import
3. Question asked
4. Sign up
5. Pro upgrade

### 3. Real-time Events
- Monitor live events: **Reports** → **Realtime**

---

## 🔐 Privacy & GDPR Compliance

### Already Implemented:
- ✅ Cookie consent banner
- ✅ GA4 consent mode (default: denied)
- ✅ IP anonymization (`anonymize_ip: true`)
- ✅ User can opt-out via cookie settings

### User Rights:
- Users can reset cookie consent in Footer → Cookie Settings
- Privacy Policy and Cookie Policy link to legal pages

---

## 📈 Google Ads Campaign Setup

### 1. Create Search Campaign
1. Campaign goal: **Website traffic** or **Leads**
2. Campaign type: **Search**
3. Conversion goal: `sign_up`, `purchase`

### 2. Recommended Ad Copy

**Headline 1:** Learn from YouTube Videos with AI
**Headline 2:** Turn Any Channel into Q&A Knowledge Base
**Headline 3:** Free Trial - No Credit Card Required

**Description 1:** Ask questions and get instant answers with timestamp citations. Perfect for students and creators.
**Description 2:** 2 free channels per month. Upgrade to Pro for unlimited access.

**Final URL:** https://lurnia.app

### 3. Keywords to Target
- "youtube video learning tool"
- "ai youtube summary"
- "learn from youtube videos"
- "youtube knowledge base"
- "youtube transcript search"
- "ai video q&a"

### 4. Budget Recommendation
- Start: €10-20/day
- Optimize for: **Conversions** (sign_up)
- Bid strategy: **Maximize conversions**

---

## 🧪 Testing Checklist

- [ ] GA4 Measurement ID added to `.env.local`
- [ ] Build and deploy frontend
- [ ] Visit site and check GA4 Realtime report (see yourself)
- [ ] Test cookie consent (accept/reject)
- [ ] Create test account (check `sign_up` event)
- [ ] Import test channel (check `channel_import` event)
- [ ] Ask test question (check `question_asked` event)
- [ ] Test Pro upgrade (check `purchase` event)
- [ ] Verify events in GA4 → Reports → Events
- [ ] Link GA4 to Google Ads
- [ ] Import conversions to Google Ads

---

## 🚀 Deployment Checklist

1. **Set Environment Variables:**
```bash
# On Vercel (if using Vercel)
vercel env add NEXT_PUBLIC_GA_MEASUREMENT_ID

# Or add to your hosting platform's environment variables
```

2. **Deploy Frontend:**
```bash
cd frontend
npm run build
# Deploy to production (Vercel, Railway, etc.)
```

3. **Verify in Production:**
- Open production site
- Check GA4 Realtime report
- Test all events (signup, import, question)

---

## 📞 Support

If you have issues:
- **GA4 Help Center**: https://support.google.com/analytics
- **Google Ads Help**: https://support.google.com/google-ads

---

## ✅ Final Status

**Ready to launch Google Ads campaign when:**
- [x] Legal pages live (Privacy, Terms, Cookies)
- [x] Cookie consent implemented
- [x] GA4 tracking code added
- [ ] GA4 Measurement ID configured in `.env.local`
- [ ] Events implemented in code (signup, import, question, upgrade)
- [ ] GA4 property created
- [ ] GA4 linked to Google Ads
- [ ] Conversions imported to Google Ads
- [ ] Test conversions verified

---

**Next Steps:**
1. Create GA4 property and get Measurement ID
2. Add to `.env.local`: `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`
3. Implement event tracking in Auth, ChannelImport, WanderMindViewer components
4. Deploy and test
5. Create Google Ads campaign
