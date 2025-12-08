# Google Ads Conversion Tracking Setup

## ✅ Already Implemented

- [x] Google Ads tag (AW-17789946840) added to site
- [x] Signup conversion tracking in Auth component
- [x] Cookie consent integration
- [x] Vercel Analytics for page views
- [x] GA4 Analytics (G-4QHLCL3S60)

## 📋 Step 1: Create Conversion Actions in Google Ads

### 1. Go to Google Ads Dashboard
```
1. Visit: https://ads.google.com
2. Click "Tools & Settings" (wrench icon)
3. Under "Measurement", click "Conversions"
```

### 2. Create "Sign Up" Conversion

```
1. Click "+ New conversion action"
2. Select "Website"
3. Select "Manually create conversion action"
4. Fill in:
   - Conversion name: "Sign Up"
   - Category: "Lead"
   - Value: Don't assign a value (or €0)
   - Count: Every (count every signup)
   - Conversion window: 30 days
   - Attribution model: Last click
5. Click "Create and continue"
6. Select "Use Google tag" → Skip (already installed)
7. COPY THE CONVERSION LABEL
   - Format: AW-17789946840/XXXXXXXXXX
   - You need the XXXXXXXXXX part (conversion label)
8. Click "Done"
```

### 3. Create "Pro Upgrade" Conversion

```
1. Click "+ New conversion action"
2. Select "Website"
3. Select "Manually create conversion action"
4. Fill in:
   - Conversion name: "Pro Upgrade"
   - Category: "Purchase"
   - Value: €24.99 (or use transaction-specific values)
   - Count: Every (count every purchase)
   - Conversion window: 30 days
   - Attribution model: Last click
5. Click "Create and continue"
6. Select "Use Google tag" → Skip (already installed)
7. COPY THE CONVERSION LABEL
   - Format: AW-17789946840/YYYYYYYYYY
   - You need the YYYYYYYYYY part (conversion label)
8. Click "Done"
```

## 📋 Step 2: Update Conversion Labels in Code

After creating conversions, update the labels in the code:

### File: `frontend/components/GoogleAnalytics.tsx`

Replace the placeholder labels:

```typescript
// Line 127: Replace SIGNUP_LABEL with your actual label
export function trackSignupConversion() {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'conversion', {
      'send_to': 'AW-17789946840/XXXXXXXXXX' // ← Replace XXXXXXXXXX
    })
  }
}

// Line 139: Replace PURCHASE_LABEL with your actual label
export function trackPurchaseConversion(value: number = 24.99) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'conversion', {
      'send_to': 'AW-17789946840/YYYYYYYYYY', // ← Replace YYYYYYYYYY
      'value': value,
      'currency': 'EUR',
      'transaction_id': Date.now().toString()
    })
  }
}
```

### Then commit and deploy:

```bash
cd frontend
git add components/GoogleAnalytics.tsx
git commit -m "Update Google Ads conversion labels"
git push origin main
```

## 📋 Step 3: Test Conversions

### Test Signup Conversion

1. **Open your production site**
2. **Open Chrome DevTools** (F12) → Console tab
3. **Paste and run**:

```javascript
// Manually trigger signup conversion
gtag('event', 'conversion', {
  'send_to': 'AW-17789946840/XXXXXXXXXX' // Use your actual label
});
console.log('Signup conversion sent!');
```

4. **Check Google Ads**:
   - Go to: Tools & Settings → Conversions
   - Click on "Sign Up" conversion
   - You should see it in "Recent conversions" within 2-3 hours

### Test Purchase Conversion

```javascript
// Manually trigger purchase conversion
gtag('event', 'conversion', {
  'send_to': 'AW-17789946840/YYYYYYYYYY', // Use your actual label
  'value': 24.99,
  'currency': 'EUR',
  'transaction_id': Date.now().toString()
});
console.log('Purchase conversion sent!');
```

### Use Google Tag Assistant

```
1. Install: https://tagassistant.google.com/
2. Open your site
3. Click Tag Assistant extension
4. Click "Finish" to see tags firing
5. Sign up on your site
6. Check if "AW-17789946840" conversion fired
```

## 📋 Step 4: Add Purchase Conversion to Checkout

When a user successfully upgrades to Pro, call the purchase conversion:

### File to update: `frontend/app/subscription/success/page.tsx` (or wherever Stripe success is handled)

```typescript
import { trackPurchaseConversion } from '@/components/GoogleAnalytics'

// After successful Stripe payment
useEffect(() => {
  // Track purchase conversion
  trackPurchaseConversion(24.99)
}, [])
```

Or if you have a checkout success handler:

```typescript
const handleCheckoutSuccess = async () => {
  // ... your existing code ...

  // Track Google Ads conversion
  trackPurchaseConversion(24.99)
}
```

## 📊 Monitoring Conversions

### Check Conversion Performance

```
1. Google Ads → Reports → Predefined reports (Overview)
2. Or: Campaigns → Your campaign → See conversions column
3. Or: Tools & Settings → Conversions → View stats
```

### Expected Timeline

- **Real-time tracking**: Console shows conversion fired immediately
- **Google Ads dashboard**: 2-3 hours delay
- **Attribution**: May take 24-48 hours for full attribution data

## 🎯 Campaign Optimization Tips

### 1. Set Up Conversion Bidding

Once conversions are tracking:

```
1. Go to your Search Campaign
2. Settings → Bidding
3. Change to "Maximize conversions" or "Target CPA"
4. Set target CPA: €5-10 per signup (adjust based on data)
```

### 2. Track Conversion Rate by Keyword

```
1. Campaigns → Keywords
2. Columns → Modify columns
3. Add "Conversions" and "Conv. rate"
4. Sort by Conv. rate to find best keywords
```

### 3. Recommended Budget

- **Testing phase**: €10-20/day, optimize for "Sign Up" conversions
- **Scaling phase**: €30-50/day, optimize for "Pro Upgrade" conversions
- **Mature phase**: €100+/day with proven ROAS

### 4. Conversion Goals by Funnel Stage

```
Top of funnel (Awareness):
- Keywords: "youtube learning tool", "ai video summary"
- Goal: Sign Ups (€0 value, high volume)

Bottom of funnel (Purchase):
- Keywords: "youtube knowledge base software", "youtube transcript search tool"
- Goal: Pro Upgrades (€24.99 value, lower volume)
```

## 🔍 Troubleshooting

### Conversions Not Showing

**Check:**
1. ✅ Conversion labels are correct (no placeholder SIGNUP_LABEL)
2. ✅ Google Ads tag is loading (check with Tag Assistant)
3. ✅ User accepted cookies (ad_storage granted)
4. ✅ Wait 2-3 hours for data to appear
5. ✅ Check "Recent conversions" in conversion details

### Tag Not Loading

**Possible causes:**
1. ❌ Ad blocker enabled (uBlock Origin, Adblock Plus)
2. ❌ Browser privacy settings blocking trackers
3. ❌ Corporate firewall blocking Google domains

**Test without blockers:**
- Use Chrome Incognito without extensions
- Or Safari Private Browsing

### Conversion Tracked Twice

**Fix:**
- Check you're only calling `trackSignupConversion()` once
- Look for duplicate gtag configs in the code

## 📈 Success Metrics

### Week 1-2 (Testing)
- Goal: 10+ signups, validate tracking works
- Check: Conversions appear in Google Ads
- Optimize: Pause underperforming keywords

### Month 1 (Optimization)
- Goal: <€5 cost per signup
- Goal: 5-10% signup → Pro conversion rate
- Optimize: Shift budget to best-performing keywords

### Month 2+ (Scaling)
- Goal: 100+ signups/month
- Goal: 10+ Pro upgrades/month
- Goal: Positive ROAS (Return on Ad Spend)

## 🚀 Launch Checklist

- [ ] Created "Sign Up" conversion in Google Ads
- [ ] Created "Pro Upgrade" conversion in Google Ads
- [ ] Copied conversion labels from Google Ads
- [ ] Updated labels in GoogleAnalytics.tsx (replace SIGNUP_LABEL and PURCHASE_LABEL)
- [ ] Committed and deployed changes
- [ ] Tested conversions with console commands
- [ ] Verified with Google Tag Assistant
- [ ] Added purchase tracking to checkout success page
- [ ] Waited 2-3 hours and verified conversions appear in Google Ads dashboard
- [ ] Set up conversion bidding in campaigns
- [ ] Launched campaigns with €10-20/day budget

---

## Current Status

✅ **Implemented:**
- Google Ads tag loaded (AW-17789946840)
- Signup conversion tracking on auth page
- Cookie consent integration
- Helper functions for conversions

⏳ **Pending:**
1. Create conversion actions in Google Ads dashboard
2. Replace conversion labels (SIGNUP_LABEL and PURCHASE_LABEL)
3. Add purchase conversion to Stripe success page
4. Test conversions
5. Launch campaign

---

**Need Help?**
- Google Ads Support: https://support.google.com/google-ads
- Google Tag Manager: https://tagmanager.google.com
- Tag Assistant: https://tagassistant.google.com
