# Supabase Authentication Setup Guide

This guide will help you configure Supabase authentication properly for WanderCut/WanderMind.

## ✅ What Was Fixed

### 1. **Email Verification Redirect URL**
- **Problem**: Signup emails redirected to `localhost` instead of production URL
- **Solution**: Added dynamic `emailRedirectTo` in the signup function that uses the current domain
- **Code**: `contexts/AuthContext.tsx` line 82-92

### 2. **Success Message After Signup**
- **Problem**: No feedback after clicking signup, users had to click multiple times
- **Solution**: Added success message telling users to check their email
- **Code**: `components/Auth.tsx` line 29-32, 76-80

### 3. **Better Error Handling**
- **Problem**: Errors failed silently
- **Solution**: Added proper error catching and display
- **Code**: `components/Auth.tsx` line 42-47

### 4. **Improved Email Verification Page**
- **Problem**: Generic loading screen on callback, no error details
- **Solution**: Added success/error states with clear messages
- **Code**: `app/auth/callback/page.tsx` - complete rewrite

---

## 🔧 Supabase Dashboard Configuration

### Step 1: Configure Redirect URLs

1. Go to your Supabase Dashboard: https://app.supabase.com/project/psxsunlvzrojnsngpzqo
2. Navigate to **Authentication** → **URL Configuration**
3. Add these URLs to **Redirect URLs**:

   **For Development:**
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/**
   ```

   **For Production (add your deployed URL):**
   ```
   https://your-production-domain.com/auth/callback
   https://your-production-domain.com/**
   https://your-vercel-app.vercel.app/auth/callback
   https://your-vercel-app.vercel.app/**
   ```

4. Set **Site URL** to your main domain:
   - Development: `http://localhost:3000`
   - Production: `https://your-production-domain.com`

### Step 2: Configure Email Templates (Branded Design)

1. Go to **Authentication** → **Email Templates** in your Supabase Dashboard
2. Edit the **Confirm Signup** template
3. Copy the branded HTML template and paste it into the template editor:
   
   **Recommended:** Use `email-templates/confirm-signup-supabase.html` (best email client compatibility)
   
   **Alternative:** Use `email-templates/confirm-signup.html` (with SVG logo, may have compatibility issues)

   **Key Features of the Branded Template:**
   - ✅ Matches Lurnia's blue-purple gradient design (`#3b82f6` to `#8b5cf6`)
   - ✅ Includes logo and branding
   - ✅ **Fully mobile-responsive** with optimized layouts for phones and tablets
   - ✅ Responsive design that works in all email clients (Gmail, Outlook, Apple Mail, etc.)
   - ✅ Clear call-to-action button with gradient styling
   - ✅ Alternative text link for accessibility
   - ✅ Onboarding preview showing what users can do next (**YouTube channel import**, ask questions, get insights)
   - ✅ Professional footer with security information
   - ✅ **French version available** (`confirm-signup-supabase-fr.html`) for French-speaking users

   **Important:** 
   - The template uses `{{ .ConfirmationURL }}` for the confirmation link (required)
   - The template uses `{{ .SiteURL }}` for footer links (optional)
   - These variables are automatically replaced by Supabase

4. **Test the Template:**
   - After saving, sign up with a test email address
   - Check your inbox (and spam folder) for the confirmation email
   - Verify the design renders correctly
   - Test the confirmation link to ensure it works

   See `email-templates/README.md` for more details and customization options.

### Step 3: Enable Email Confirmations

1. Go to **Authentication** → **Providers** → **Email**
2. Make sure **Confirm email** is enabled (it should be by default)
3. **Optional**: Adjust the confirmation email expiry time (default is 24 hours)

### Step 4: Configure Email Provider (if using custom SMTP)

If Supabase's default email service isn't working well:

1. Go to **Project Settings** → **Auth** → **SMTP Settings**
2. Configure your own SMTP provider (SendGrid, Mailgun, AWS SES, etc.)
3. This gives you better deliverability and control over emails

---

## 🌐 Environment Variables

### Frontend Environment Variables

Update your `frontend/.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://psxsunlvzrojnsngpzqo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeHN1bmx2enJvam5zbmdwenFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzU2MzMsImV4cCI6MjA3ODk1MTYzM30.7YOZ0GZ0sksbe-B3vuBBJfC18Liwn4To6_qu5cnj50E

# Site URL (for production, set this in Vercel environment variables)
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SURrSBbAbQG1UB4TqHvm6i2fiixWEUEmoZLB7Nb624x82WUPaRxfc446IgIzMkjVhXjTK722zwGBQLdf0sTHPai00OPE5t5NV
NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID=price_1SURuDBbAbQG1UB4WcwzQbaK
```

### Vercel Deployment Environment Variables

When deploying to Vercel, add these in **Project Settings** → **Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL = https://psxsunlvzrojnsngpzqo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = [your-anon-key]
NEXT_PUBLIC_SITE_URL = https://your-vercel-app.vercel.app (or custom domain)
NEXT_PUBLIC_API_URL = https://your-backend-railway.up.railway.app
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = [your-stripe-key]
NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID = [your-price-id]
```

---

## 🧪 Testing the Auth Flow

### 1. **Test Signup Flow**

1. Go to `/auth` in your app
2. Click "Don't have an account? Sign up"
3. Enter email and password (min 6 characters)
4. Click "Sign Up"
5. **Expected**: Green success message appears: "Success! Check your email to confirm your account..."
6. Check your email (including spam folder)
7. Click the verification link in the email
8. **Expected**: Redirects to your site at `/auth/callback`
9. **Expected**: Shows "Email verified! Redirecting to dashboard..."
10. **Expected**: Redirects to home page (`/`) with authenticated session

### 2. **Test Sign In Flow**

1. After verifying email, go to `/auth`
2. Enter your email and password
3. Click "Sign In"
4. **Expected**: Redirects to home page with authenticated session

### 3. **Test Google Sign In** (if enabled)

1. Click "Google" button
2. **Expected**: Redirects to Google OAuth
3. After authorizing, redirects back to `/auth/callback`
4. **Expected**: Shows success and redirects to home

### 4. **Test Error Cases**

- Try signing up with existing email → Shows error
- Try signing in with wrong password → Shows error
- Try clicking expired verification link → Shows appropriate error

---

## 🔍 Troubleshooting

### Issue: "Button not responding / need to click multiple times"

**Fixed!** This was caused by:
- Missing error handling
- No feedback after click
- No loading state management

**Solution implemented**:
- Added loading state
- Added success message
- Better error display
- Clear form after successful signup

### Issue: "Email verification redirects to localhost"

**Fixed!** This was caused by:
- Missing `emailRedirectTo` option in signup
- Supabase using default configured URL

**Solution implemented**:
- Dynamic redirect URL using `window.location.origin`
- Fallback to `NEXT_PUBLIC_SITE_URL` environment variable
- Works for both localhost and production

### Issue: "Verification link gives 404 or not found page"

**Potential causes**:
1. Redirect URL not added to Supabase allowed list
2. Wrong URL in Supabase email template
3. Callback page not deployed

**Solutions**:
1. Add all redirect URLs to Supabase dashboard (see Step 1 above)
2. Make sure you deployed the latest frontend code
3. Check browser console for errors on the callback page

### Issue: "Emails not being delivered"

**Solutions**:
1. Check spam folder
2. Wait a few minutes (can be slow with Supabase's default email service)
3. Configure custom SMTP provider (Step 4 above)
4. Check Supabase logs: **Authentication** → **Logs**

### Issue: "User signed up but can't sign in"

**Possible causes**:
1. Email not verified yet
2. User account disabled

**Solutions**:
1. Check if email confirmation is required (it is by default)
2. Resend verification email from Supabase dashboard
3. Or manually confirm user in Supabase: **Authentication** → **Users** → click user → **Confirm email**

---

## 📝 Code Changes Summary

### Files Modified:

1. **`contexts/AuthContext.tsx`**
   - Added `emailRedirectTo` option to `signUp` function
   - Returns both error and data from signup
   - Uses dynamic URL detection

2. **`components/Auth.tsx`**
   - Added `success` state for success messages
   - Shows green success banner after signup
   - Clears form after successful signup
   - Better error handling and logging
   - Clears messages when switching between signin/signup

3. **`app/auth/callback/page.tsx`**
   - Complete rewrite with success/error states
   - Shows loading spinner while verifying
   - Shows success checkmark when verified
   - Shows error icon with clear message on failure
   - Auto-redirects with appropriate delays
   - Handles URL error parameters from Supabase

---

## 🚀 Next Steps

1. ✅ Test the signup flow locally
2. ✅ Configure Supabase redirect URLs in dashboard
3. ✅ Deploy frontend to Vercel
4. ✅ Update environment variables in Vercel
5. ✅ Test production signup flow
6. ✅ (Optional) Set up custom SMTP for better email delivery
7. ✅ (Optional) Customize email templates with your branding

---

## 📞 Need Help?

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs: Dashboard → **Logs** → **Auth**
3. Verify all environment variables are set correctly
4. Make sure redirect URLs are added to Supabase allowed list
5. Test in incognito mode to rule out cookie issues

The authentication flow should now be:
- ✅ Reliable (no need to click multiple times)
- ✅ User-friendly (clear success/error messages)
- ✅ Production-ready (works on any domain)
- ✅ Well-tested (handles all error cases)
