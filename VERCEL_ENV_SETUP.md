# Vercel Environment Variables Setup

## Issue
The frontend deployed to Vercel is missing sections like the profile menu and pricing because environment variables are not set.

## Solution: Set Environment Variables in Vercel

### Step 1: Go to Vercel Dashboard
1. Navigate to [vercel.com](https://vercel.com)
2. Select your project (`mentorai` or `wandercut-frontend`)

### Step 2: Add Environment Variables
1. Go to **Settings** → **Environment Variables**
2. Add the following variables:

#### Required Variables:

```
NEXT_PUBLIC_API_URL=https://mentorai-production.up.railway.app
```

```
NEXT_PUBLIC_SUPABASE_URL=https://psxsunlvzrojnsngpzqo.supabase.co
```

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeHN1bmx2enJvam5zbmdwenFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzU2MzMsImV4cCI6MjA3ODk1MTYzM30.7YOZ0GZ0sksbe-B3vuBBJfC18Liwn4To6_qu5cnj50E
```

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SURrSBbAbQG1UB4TqHvm6i2fiixWEUEmoZLB7Nb624x82WUPaRxfc446IgIzMkjVhXjTK722zwGBQLdf0sTHPai00OPE5t5NV
```

```
NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID=price_1SURuDBbAbQG1UB4WcwzQbaK
```

### Step 3: Set Environment for Each Variable
- For each variable, select **Production**, **Preview**, and **Development** environments
- Click **Save**

### Step 4: Redeploy
1. After adding all environment variables, go to **Deployments**
2. Click the **⋯** (three dots) menu on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger a new deployment

## Verification

After redeploying, check:
1. ✅ Profile menu appears in the header (when logged in)
2. ✅ Pricing link is visible in desktop header
3. ✅ Mobile menu shows all options
4. ✅ Authentication works correctly

## Troubleshooting

### If sections still don't appear:
1. **Check build logs**: Go to **Deployments** → Click on a deployment → Check **Build Logs**
2. **Verify variables**: In **Settings** → **Environment Variables**, ensure all variables are set for **Production**
3. **Clear cache**: Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. **Check console**: Open browser DevTools → Console, look for errors about missing environment variables

### Common Issues:
- **Variables not showing**: Make sure they're set for the correct environment (Production/Preview/Development)
- **Build fails**: Check that variable names start with `NEXT_PUBLIC_` for client-side access
- **Still missing after redeploy**: Wait 1-2 minutes for the new deployment to propagate

## Notes
- `NEXT_PUBLIC_*` variables are embedded at **build time**, not runtime
- You must **redeploy** after adding/changing environment variables
- Variables are case-sensitive

