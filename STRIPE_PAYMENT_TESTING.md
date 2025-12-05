# Stripe Payment Testing Guide - Pro Tier

Complete guide for testing the Stripe payment integration for Lurnia Pro tier subscriptions.

## Prerequisites

### 1. Stripe Test Mode Setup

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com/test
2. **Verify you're in Test Mode** (toggle in top right should show "Test mode")
3. **Get your test API keys**:
   - Go to **Developers** → **API keys**
   - Copy **Publishable key** (starts with `pk_test_...`)
   - Copy **Secret key** (starts with `sk_test_...`)

### 2. Verify Product & Price ID

1. Go to **Products** in Stripe Dashboard
2. Find your "Pro" or "Creator Tier" product
3. Copy the **Price ID** (starts with `price_...`)
   - Current: `price_1SURuDBbAbQG1UB4WcwzQbaK` (check if this is correct)

### 3. Environment Variables Check

**Backend (`backend/.env`):**
```env
STRIPE_SECRET_KEY=sk_test_...  # Your Stripe test secret key
STRIPE_WEBHOOK_SECRET=we_...    # For local testing (from Stripe CLI)
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Your Stripe test publishable key
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_1SURuDBbAbQG1UB4WcwzQbaK  # Your Pro tier price ID
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Note:** The variable name is `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` (not CREATOR_PRICE_ID)

## Testing Process

### Step 1: Start Backend Server

```bash
cd backend
npm start
# Server should start on http://localhost:3001
```

**Verify:**
- ✅ Server starts without errors
- ✅ You see: `✅ Stripe initialized successfully`
- ✅ No warnings about missing Stripe keys

### Step 2: Start Frontend Server

```bash
cd frontend
npm run dev
# Server should start on http://localhost:3000
```

### Step 3: Set Up Webhook Forwarding (Local Testing)

**Install Stripe CLI** (if not already installed):
- macOS: `brew install stripe/stripe-cli/stripe`
- Windows: Download from https://github.com/stripe/stripe-cli/releases
- Linux: See https://stripe.com/docs/stripe-cli

**Login to Stripe CLI:**
```bash
stripe login
```

**Forward webhooks to local backend:**
```bash
stripe listen --forward-to localhost:3001/api/subscriptions/webhook
```

**Important:** This will output a webhook signing secret (starts with `whsec_...` or `we_...`). 
- Copy this secret
- Update `STRIPE_WEBHOOK_SECRET` in `backend/.env`
- Restart backend server

**Keep this terminal open** - it will show webhook events in real-time.

### Step 4: Test the Payment Flow

#### 4.1 Sign Up / Sign In

1. Go to http://localhost:3000
2. Sign up with a test email (e.g., `test@example.com`)
3. Confirm your email (check inbox or use Supabase dashboard to confirm manually)
4. Sign in with your test account

#### 4.2 Navigate to Pricing Page

1. Go to http://localhost:3000/pricing
2. You should see:
   - **Free tier** (current if you're on free)
   - **Pro tier** with "Upgrade to Pro" button

#### 4.3 Initiate Checkout

1. Click **"Upgrade to Pro"** button
2. You should be redirected to Stripe Checkout page
3. **Verify checkout page shows:**
   - Correct price (€24.99/month or your configured price)
   - Product name: "Pro" or "Creator Tier"
   - Your email address

#### 4.4 Complete Payment with Test Card

**Use Stripe Test Cards:**

| Card Number | Description | Expected Result |
|------------|-------------|-----------------|
| `4242 4242 4242 4242` | Success | Payment succeeds, subscription created |
| `4000 0000 0000 0002` | Card declined | Payment fails with decline message |
| `4000 0000 0000 9995` | Insufficient funds | Payment fails |

**For successful test:**
- Card: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

#### 4.5 Verify Success

After completing payment:

1. **Check Stripe CLI terminal** - You should see:
   ```
   checkout.session.completed [200] POST /api/subscriptions/webhook
   ```

2. **Check backend logs** - You should see:
   ```
   User <userId> upgraded to pro tier
   ```

3. **Check redirect** - You should be redirected to:
   ```
   http://localhost:3000/subscription/success?session_id=cs_test_...
   ```

4. **Verify subscription status:**
   - Go to http://localhost:3000/settings
   - You should see "Pro Tier" status
   - Or go to http://localhost:3000/pricing
   - Pro tier should show "Current Plan"

5. **Check Stripe Dashboard:**
   - Go to **Customers** → Find your test customer
   - Go to **Subscriptions** → Should see active subscription
   - Status should be "Active"

### Step 5: Test Subscription Management

1. Go to http://localhost:3000/settings
2. Click **"Manage Subscription"** button
3. You should be redirected to Stripe Customer Portal
4. Test features:
   - View subscription details
   - Update payment method
   - Cancel subscription (if enabled)

### Step 6: Test Webhook Events

You can manually trigger webhook events using Stripe CLI:

```bash
# Test checkout completion
stripe trigger checkout.session.completed

# Test subscription update
stripe trigger customer.subscription.updated

# Test subscription cancellation
stripe trigger customer.subscription.deleted
```

**Watch for:**
- Webhook events in Stripe CLI terminal
- Backend logs showing event processing
- User tier updates in database

## Verification Checklist

### ✅ Payment Flow
- [ ] Checkout session creates successfully
- [ ] Redirects to Stripe Checkout
- [ ] Test payment completes successfully
- [ ] Redirects to success page after payment
- [ ] User tier updates to "pro" in database
- [ ] Subscription status shows as "active"

### ✅ Webhook Processing
- [ ] `checkout.session.completed` webhook received
- [ ] User tier updated in database/Firestore
- [ ] Stripe customer ID saved
- [ ] Subscription ID saved
- [ ] Backend logs show successful processing

### ✅ Frontend Updates
- [ ] Pricing page shows "Current Plan" for Pro
- [ ] Settings page shows "Pro Tier" status
- [ ] Header shows Pro tier indicator (if implemented)
- [ ] Usage limits reflect Pro tier limits

### ✅ Subscription Management
- [ ] Customer Portal opens successfully
- [ ] Can view subscription details
- [ ] Can update payment method
- [ ] Can cancel subscription (if enabled)

## Common Issues & Troubleshooting

### Issue: "Payment service is not configured"

**Cause:** `STRIPE_SECRET_KEY` not set or invalid

**Solution:**
1. Check `backend/.env` has `STRIPE_SECRET_KEY=sk_test_...`
2. Verify key starts with `sk_test_` (test mode)
3. Restart backend server

### Issue: Webhook not received

**Cause:** Webhook forwarding not set up or wrong endpoint

**Solution:**
1. Verify Stripe CLI is running: `stripe listen --forward-to localhost:3001/api/subscriptions/webhook`
2. Check webhook secret matches in `backend/.env`
3. Verify backend is running on port 3001
4. Check backend logs for webhook errors

### Issue: User tier not updating after payment

**Cause:** Webhook not processing correctly or database update failing

**Solution:**
1. Check Stripe CLI shows webhook received
2. Check backend logs for webhook processing errors
3. Verify Firestore/database connection
4. Manually check Stripe Dashboard → Customers → Subscriptions
5. Try manually triggering webhook: `stripe trigger checkout.session.completed`

### Issue: "Price ID not configured"

**Cause:** Missing or incorrect `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`

**Solution:**
1. Check `frontend/.env.local` has `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_...`
2. Verify price ID exists in Stripe Dashboard
3. Restart frontend server
4. Check browser console for exact error message

### Issue: Checkout redirects to wrong URL

**Cause:** Incorrect `FRONTEND_URL` or origin detection

**Solution:**
1. Check `backend/.env` has `FRONTEND_URL=http://localhost:3000`
2. Or verify `req.headers.origin` is being detected correctly
3. Check success/cancel URLs in checkout session creation

## Testing Different Scenarios

### Scenario 1: New User Subscription
1. Create new account
2. Go directly to pricing
3. Upgrade to Pro
4. Complete payment
5. Verify tier update

### Scenario 2: Existing User Upgrade
1. Sign in with existing free account
2. Go to pricing page
3. Upgrade to Pro
4. Complete payment
5. Verify tier changes from "free" to "pro"

### Scenario 3: Payment Failure
1. Use declined card: `4000 0000 0000 0002`
2. Verify error message shown
3. Verify user tier remains "free"
4. Try again with valid card

### Scenario 4: Subscription Cancellation
1. Complete successful payment
2. Go to Settings → Manage Subscription
3. Cancel subscription in Stripe Portal
4. Verify webhook `customer.subscription.deleted` received
5. Verify user tier reverts to "free"

## Production Testing

Before going live:

1. **Switch to Live Mode:**
   - Update `STRIPE_SECRET_KEY` to live key (starts with `sk_live_...`)
   - Update `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to live key (starts with `pk_live_...`)
   - Update price ID if different in live mode

2. **Set Up Production Webhook:**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-domain.com/api/subscriptions/webhook`
   - Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy webhook signing secret
   - Update `STRIPE_WEBHOOK_SECRET` in production environment

3. **Test with Real Card (Small Amount):**
   - Use a real card with small amount
   - Verify webhook received in production
   - Verify subscription created
   - Cancel immediately to avoid charges

## API Endpoints Reference

- `POST /api/subscriptions/create-checkout-session` - Create checkout
- `POST /api/subscriptions/create-portal-session` - Open customer portal
- `GET /api/subscriptions/status/:userId` - Get subscription status
- `POST /api/subscriptions/webhook` - Handle Stripe webhooks

## Next Steps

After successful testing:
1. ✅ Document any issues found
2. ✅ Fix any bugs discovered
3. ✅ Test edge cases (cancellation, updates, etc.)
4. ✅ Prepare for production deployment
5. ✅ Set up monitoring for webhook events

## Additional Resources

- [Stripe Testing Documentation](https://stripe.com/docs/testing)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)

