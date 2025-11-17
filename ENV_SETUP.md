# Environment Variables Setup Guide

## Issue
The Supabase credentials are in `frontend.env.local`, but Next.js requires `.env.local` in the `frontend/` directory.

## Quick Fix

### Step 1: Create Frontend `.env.local` File

Create a file named `.env.local` in the `frontend/` directory with the following content:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://psxsunlvzrojnsngpzqo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeHN1bmx2enJvam5zbmdwenFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzU2MzMsImV4cCI6MjA3ODk1MTYzM30.7YOZ0GZ0sksbe-B3vuBBJfC18Liwn4To6_qu5cnj50E
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SURrSBbAbQG1UB4TqHvm6i2fiixWEUEmoZLB7Nb624x82WUPaRxfc446IgIzMkjVhXjTK722zwGBQLdf0sTHPai00OPE5t5NV
NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID=price_1SURuDBbAbQG1UB4WcwzQbaK
```

**Windows PowerShell:**
```powershell
cd frontend
@"
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://psxsunlvzrojnsngpzqo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeHN1bmx2enJvam5zbmdwenFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzU2MzMsImV4cCI6MjA3ODk1MTYzM30.7YOZ0GZ0sksbe-B3vuBBJfC18Liwn4To6_qu5cnj50E
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SURrSBbAbQG1UB4TqHvm6i2fiixWEUEmoZLB7Nb624x82WUPaRxfc446IgIzMkjVhXjTK722zwGBQLdf0sTHPai00OPE5t5NV
NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID=price_1SURuDBbAbQG1UB4WcwzQbaK
"@ | Out-File -FilePath .env.local -Encoding utf8
```

**Or manually:**
1. Navigate to the `frontend/` directory
2. Create a new file named `.env.local` (note the leading dot)
3. Copy the content above into the file
4. Save the file

### Step 2: Add Stripe Keys to Backend

Add the following to `backend.env` (or create `backend/.env` if it doesn't exist):

```env
# Add these lines to backend.env
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=we_1SUS0IBbAbQG1UB4e42OQD4r
```

**Note:** You need to get your Stripe Secret Key from:
1. Stripe Dashboard → Developers → API keys
2. Copy the **Secret key** (starts with `sk_test_...`)

### Step 3: Restart Development Servers

After creating/updating the environment files:

1. **Stop** both frontend and backend servers (Ctrl+C)
2. **Restart** the frontend:
   ```bash
   cd frontend
   npm run dev
   ```
3. **Restart** the backend:
   ```bash
   cd backend
   npm run dev
   ```

## Verification

After restarting, you should:
- ✅ **No more Supabase warnings** in the browser console
- ✅ **Authentication should work** (sign up/sign in)
- ✅ **Stripe checkout should work** (if backend Stripe keys are set)

## Current Status

### ✅ Frontend Environment Variables (from frontend.env.local)
- `NEXT_PUBLIC_SUPABASE_URL` - ✅ Configured
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - ✅ Configured
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - ✅ Configured
- `NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID` - ✅ Configured

### ⚠️ Backend Environment Variables (needs update)
- `STRIPE_SECRET_KEY` - ❌ **MISSING** (needs to be added to backend.env)
- `STRIPE_WEBHOOK_SECRET` - ✅ Configured (we_1SUS0IBbAbQG1UB4e42OQD4r)

## Next Steps

1. Create `frontend/.env.local` with the content above
2. Add `STRIPE_SECRET_KEY` to `backend.env`
3. Restart both servers
4. Test authentication and payments

