# Payment Integration Setup Guide

This guide will help you set up Stripe payment integration and Supabase authentication for WanderMind.

## Prerequisites

1. **Stripe Account**: Sign up at [stripe.com](https://stripe.com)
2. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)

## Step 1: Stripe Setup

### 1.1 Create a Product and Price

1. Go to Stripe Dashboard → Products
2. Click "Add product"
3. Create a product named "Creator Tier" or "WanderMind Creator"
4. Set pricing:
   - **Price**: $29/month (or your desired price)
   - **Billing period**: Monthly
   - **Recurring**: Yes
5. Copy the **Price ID** (starts with `price_...`)
   **Current Price ID:** `price_1SURuDBbAbQG1UB4WcwzQbaK`

### 1.2 Get API Keys

1. Go to Stripe Dashboard → Developers → API keys
2. Copy your **Publishable key** (starts with `pk_...`)
3. Copy your **Secret key** (starts with `sk_...`)

### 1.3 Set Up Webhook

1. For local development, use [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks:
   ```bash
   stripe listen --forward-to localhost:3001/api/subscriptions/webhook
   ```
   This will output a webhook signing secret (starts with `whsec_...` or `we_...`). 
   **Current webhook secret:** `we_1SUS0IBbAbQG1UB4e42OQD4r`

2. For production, go to Stripe Dashboard → Developers → Webhooks
   - Click "Add endpoint"
   - Set endpoint URL: `https://your-domain.com/api/subscriptions/webhook`
   - Select events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy the **Webhook signing secret** (starts with `whsec_...`)

## Step 2: Supabase Setup

### 2.1 Create a Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be fully provisioned

### 2.2 Get API Credentials

1. Go to Project Settings → API
2. Copy your **Project URL**
   **Current URL:** `https://psxsunlvzrojnsngpzqo.supabase.co`
3. Copy your **anon/public key** (starts with `eyJ...`)
   **Current Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeHN1bmx2enJvam5zbmdwenFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzU2MzMsImV4cCI6MjA3ODk1MTYzM30.7YOZ0GZ0sksbe-B3vuBBJfC18Liwn4To6_qu5cnj50E`

### 2.3 Enable Google OAuth (Optional)

1. Go to Authentication → Providers
2. Enable Google provider
3. Add your Google OAuth credentials

## Step 3: Environment Variables

### Backend (`backend/.env`)

Add the following variables:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_... # Your Stripe secret key (get from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=we_1SUS0IBbAbQG1UB4e42OQD4r # Your webhook signing secret

# Supabase (for future use if needed)
SUPABASE_URL=https://psxsunlvzrojnsngpzqo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Frontend (`frontend/.env.local`)

Add the following variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://psxsunlvzrojnsngpzqo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeHN1bmx2enJvam5zbmdwenFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzU2MzMsImV4cCI6MjA3ODk1MTYzM30.7YOZ0GZ0sksbe-B3vuBBJfC18Liwn4To6_qu5cnj50E

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # Your Stripe publishable key (get from Stripe Dashboard)
NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID=price_1SURuDBbAbQG1UB4WcwzQbaK

# API
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Step 4: Test the Integration

### 4.1 Test Stripe Checkout (Local Development)

1. Start your backend server
2. Use Stripe CLI to forward webhooks:
   ```bash
   stripe listen --forward-to localhost:3001/api/subscriptions/webhook
   ```
   Note: The webhook endpoint is `/api/subscriptions/webhook` on port 3001 (your backend port)
3. Start your frontend
4. Sign up/login
5. Go to `/pricing`
6. Click "Upgrade to Creator"
7. Use Stripe test card: `4242 4242 4242 4242`
8. Complete checkout
9. Verify webhook is received and user tier is updated

### 4.2 Test Webhook Events

You can trigger test events using Stripe CLI:

```bash
# Test checkout completion
stripe trigger checkout.session.completed

# Test subscription update
stripe trigger customer.subscription.updated

# Test subscription deletion
stripe trigger customer.subscription.deleted
```

## Step 5: Production Deployment

### 5.1 Update Environment Variables

- Use production Stripe keys (switch from test to live mode)
- Update webhook URL to your production domain
- Update Supabase credentials if needed

### 5.2 Configure Webhook in Production

1. Update webhook endpoint URL in Stripe Dashboard to your production URL
2. Copy the production webhook signing secret
3. Update `STRIPE_WEBHOOK_SECRET` in production environment

## API Endpoints

### Subscription Endpoints

- `POST /api/subscriptions/create-checkout-session` - Create Stripe Checkout session
- `POST /api/subscriptions/create-portal-session` - Create Stripe Customer Portal session
- `GET /api/subscriptions/status/:userId` - Get user subscription status
- `POST /api/subscriptions/webhook` - Handle Stripe webhook events

### User Endpoints

- `GET /api/user/:userId` - Get user info (includes tier and usage)
- `POST /api/user/:userId/check-export` - Check if user can export
- `POST /api/user/:userId/check-question` - Check if user can ask questions

## Frontend Routes

- `/auth` - Sign in/Sign up page
- `/auth/callback` - OAuth callback handler
- `/pricing` - Pricing page with subscription options
- `/subscription/success` - Success page after checkout
- `/subscription/cancel` - Cancellation page
- `/settings` - User settings and subscription management

## Troubleshooting

### Webhook Not Working

1. Check that webhook endpoint is accessible
2. Verify webhook secret is correct
3. Check Stripe Dashboard → Webhooks for delivery logs
4. Use Stripe CLI for local testing

### Subscription Not Updating

1. Check webhook logs in Stripe Dashboard
2. Verify webhook events are being received
3. Check backend logs for webhook processing errors
4. Manually sync: Call `GET /api/user/:userId` to trigger sync

### Authentication Issues

1. Verify Supabase credentials are correct
2. Check browser console for errors
3. Verify redirect URLs are configured in Supabase
4. Check Supabase Dashboard → Authentication → URL Configuration

## Security Notes

1. **Never expose** `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in frontend code
2. **Always verify** webhook signatures before processing
3. **Use HTTPS** in production for webhook endpoints
4. **Validate** user authentication before processing payments
5. **Rate limit** subscription endpoints to prevent abuse

