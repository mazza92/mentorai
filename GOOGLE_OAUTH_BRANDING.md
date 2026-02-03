# Google OAuth Branding - Update to Show Lurnia

This guide shows you how to update the Google OAuth consent screen to display "Lurnia" or "Lurnia.app" instead of the Supabase domain.

## Current Issue

When users click "Sign in with Google", they see:
- "Sign in to continue to **psxsunlvzrojnsngpzqo.supabase.co**"

This is not user-friendly and doesn't show your app branding.

## Solution: Update OAuth Consent Screen

The OAuth consent screen in Google Cloud Console controls what users see during sign-in.

## Step-by-Step Instructions

### Step 1: Go to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **OAuth consent screen**

### Step 2: Edit OAuth Consent Screen

1. Click **EDIT APP** (or **+ CREATE** if not configured)
2. You'll see a multi-step form

### Step 3: Configure App Information

**App information:**
- **App name**: `Lurnia` or `Lurnia.app`
  - This is what appears on the sign-in page
  - Example: "Sign in to **Lurnia**"
- **User support email**: Your email address
- **App logo** (Highly recommended):
  - Upload your Lurnia logo
  - Size: 120x120px minimum
  - Format: PNG or JPG
  - This appears on the Google sign-in page
  - **Tip**: Create a simple logo with the ⚡ icon and "Lurnia" text

**App domain:**
- **Application home page**: `https://lurnia.app` (or your production domain)
- **Privacy policy link** (Optional but recommended): `https://lurnia.app/privacy`
- **Terms of service link** (Optional): `https://lurnia.app/terms`
- **Authorized domains**: Add `lurnia.app` (without https://)

**Developer contact information:**
- Your email address

Click **SAVE AND CONTINUE**

### Step 4: Configure Scopes

1. Click **Add or Remove Scopes**
2. Select these scopes:
   - `.../auth/userinfo.email` - See your email address
   - `.../auth/userinfo.profile` - See your personal info
   - `openid` - Associate you with your personal Google account
3. Click **UPDATE** → **SAVE AND CONTINUE**

### Step 5: Test Users (If in Testing Mode)

If your app is in "Testing" mode:
1. Add test user emails (including your own)
2. Only these users can sign in until you publish
3. Click **SAVE AND CONTINUE**

### Step 6: Summary & Publish

1. Review all settings
2. Click **BACK TO DASHBOARD**

**To make it public:**
- If you want all users to be able to sign in, click **PUBLISH APP**
- You may need to submit for verification if you add sensitive scopes
- For basic email/profile scopes, you can usually publish without verification

## Result

After updating, when users click "Sign in with Google", they will see:
- ✅ "Sign in to **Lurnia**" (instead of Supabase domain)
- ✅ Your Lurnia logo (if uploaded)
- ✅ Professional, branded experience

## Creating a Simple Logo

If you don't have a logo yet, create a simple one:

1. **Size**: 120x120px minimum (Google recommends 120x120px)
2. **Format**: PNG with transparent background
3. **Design**: 
   - Use the ⚡ icon in a colored square (blue/purple gradient to match your app)
   - Add "Lurnia" text below or next to it
   - Keep it simple and recognizable at small sizes

**Quick design options:**
- Option 1: Blue/purple gradient square with white ⚡ icon
- Option 2: White background with colored ⚡ icon and "Lurnia" text
- Option 3: Use a design tool like Canva, Figma, or even PowerPoint

## Verification Status

### Testing Mode
- Only test users can sign in
- Shows "This app isn't verified" warning
- Good for development

### Published (Unverified)
- All users can sign in
- Shows "This app isn't verified" warning
- Works for most apps with basic scopes

### Published (Verified)
- All users can sign in
- No warnings
- Requires Google verification process (can take weeks)
- Usually not needed for basic email/profile scopes

## Troubleshooting

### Issue: Changes not appearing

**Solution:**
1. Wait a few minutes for changes to propagate
2. Clear browser cache
3. Try signing in again
4. Check that you saved all steps in the consent screen

### Issue: "This app isn't verified" warning

**Solution:**
- This is normal for apps in testing or unverified state
- For basic scopes (email, profile), you can usually publish without verification
- Users can still sign in, they just see a warning
- To remove warning, submit for Google verification (optional)

### Issue: Logo not showing

**Solution:**
1. Check logo size (minimum 120x120px)
2. Check format (PNG or JPG)
3. Wait a few minutes for changes to propagate
4. Try clearing browser cache

## Quick Checklist

- [ ] OAuth consent screen configured
- [ ] App name set to "Lurnia" or "Lurnia.app"
- [ ] Logo uploaded (optional but recommended)
- [ ] App domain set to your production domain
- [ ] Scopes configured (email, profile, openid)
- [ ] Test users added (if in testing mode)
- [ ] Changes saved
- [ ] Tested sign-in flow - see "Sign in to Lurnia"

## Additional Resources

- [Google OAuth Consent Screen Documentation](https://support.google.com/cloud/answer/10311615)
- [Google App Verification](https://support.google.com/cloud/answer/9110914)

