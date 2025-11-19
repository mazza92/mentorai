# Google OAuth Setup Guide for Supabase

This guide will help you enable Google OAuth authentication in your Supabase project.

## Error Message
If you see this error:
```json
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

This means Google OAuth is not enabled in your Supabase project. Follow the steps below to enable it.

---

## Step 1: Enable Google Provider in Supabase

1. Go to your Supabase Dashboard: https://app.supabase.com/project/psxsunlvzrojnsngpzqo
2. Navigate to **Authentication** → **Providers**
3. Find **Google** in the list of providers
4. Click the toggle to **Enable** Google provider
5. You'll see a form with fields for Google OAuth credentials

---

## Step 2: Create Google OAuth Credentials

### 2.1 Go to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**

### 2.2 Create OAuth 2.0 Client ID

1. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
2. If prompted, configure the OAuth consent screen first:
   - **User Type**: External (unless you have a Google Workspace)
   - **App name**: WanderMind (or your app name)
   - **User support email**: Your email
   - **Developer contact information**: Your email
   - Click **Save and Continue**
   - **Scopes**: Click **Add or Remove Scopes** → Select:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - Click **Save and Continue**
   - **Test users** (if in testing mode): Add your email
   - Click **Save and Continue** → **Back to Dashboard**

3. Now create the OAuth Client ID:
   - **Application type**: Web application
   - **Name**: WanderMind Web Client (or any name)
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3000
     https://your-production-domain.com
     https://your-vercel-app.vercel.app
     ```
   - **Authorized redirect URIs**:
     ```
     https://psxsunlvzrojnsngpzqo.supabase.co/auth/v1/callback
     ```
     **Important**: This is your Supabase project's OAuth callback URL. The format is:
     `https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback`
   
4. Click **Create**
5. Copy the **Client ID** and **Client Secret**

---

## Step 3: Add Credentials to Supabase

1. Go back to Supabase Dashboard → **Authentication** → **Providers** → **Google**
2. Paste your credentials:
   - **Client ID (for OAuth)**: Paste the Client ID from Google Cloud Console
   - **Client Secret (for OAuth)**: Paste the Client Secret from Google Cloud Console
3. Click **Save**

---

## Step 4: Configure Redirect URLs in Supabase

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Add these URLs to **Redirect URLs**:
   
   **For Development:**
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/**
   ```
   
   **For Production:**
   ```
   https://your-production-domain.com/auth/callback
   https://your-production-domain.com/**
   https://your-vercel-app.vercel.app/auth/callback
   https://your-vercel-app.vercel.app/**
   ```

3. Set **Site URL**:
   - Development: `http://localhost:3000`
   - Production: `https://your-production-domain.com`

---

## Step 5: Test Google OAuth

1. Go to your app's `/auth` page
2. Click **Continue with Google**
3. You should be redirected to Google's sign-in page
4. After signing in, you'll be redirected back to `/auth/callback`
5. You should then be redirected to the home page, logged in

---

## Troubleshooting

### Issue: "Redirect URI mismatch"

**Error**: `redirect_uri_mismatch`

**Solution**:
1. Make sure you added the Supabase callback URL to Google Cloud Console:
   `https://psxsunlvzrojnsngpzqo.supabase.co/auth/v1/callback`
2. Check that your Supabase project reference is correct in the URL
3. Make sure there are no trailing slashes

### Issue: "Provider is not enabled"

**Error**: `Unsupported provider: provider is not enabled`

**Solution**:
1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Make sure Google is **enabled** (toggle should be ON)
3. Make sure you've saved the Client ID and Client Secret

### Issue: "Invalid client"

**Error**: `invalid_client`

**Solution**:
1. Double-check that you copied the Client ID and Client Secret correctly
2. Make sure there are no extra spaces
3. Try regenerating the credentials in Google Cloud Console

### Issue: OAuth works locally but not in production

**Solution**:
1. Make sure you added your production URLs to:
   - Google Cloud Console → Authorized JavaScript origins
   - Supabase → Redirect URLs
2. Make sure `NEXT_PUBLIC_SITE_URL` is set correctly in Vercel environment variables

---

## Quick Checklist

- [ ] Google provider enabled in Supabase Dashboard
- [ ] OAuth consent screen configured in Google Cloud Console
- [ ] OAuth Client ID created in Google Cloud Console
- [ ] Supabase callback URL added to Google Cloud Console redirect URIs
- [ ] Client ID and Client Secret added to Supabase
- [ ] Redirect URLs configured in Supabase
- [ ] Site URL set in Supabase
- [ ] Tested locally
- [ ] Tested in production

---

## Additional Notes

- **OAuth Consent Screen**: If your app is in "Testing" mode, only users you add as test users can sign in. To make it public, you need to submit for verification (or publish as unverified, which shows a warning).

- **Supabase Callback URL**: The format is always:
  `https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback`
  
  Your project reference is: `psxsunlvzrojnsngpzqo`
  
  So your callback URL is:
  `https://psxsunlvzrojnsngpzqo.supabase.co/auth/v1/callback`

- **Security**: Never commit your Client Secret to version control. It's only stored in Supabase Dashboard.

---

## Need Help?

If you're still having issues:
1. Check the browser console for detailed error messages
2. Check Supabase logs: Dashboard → **Logs** → **Auth**
3. Verify all URLs match exactly (no trailing slashes, correct protocol)
4. Make sure you're using the correct Supabase project reference

