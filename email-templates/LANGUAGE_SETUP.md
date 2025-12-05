# Language-Specific Email Setup Guide

## Overview

Lurnia supports both English and French email templates. However, Supabase's email template system doesn't natively support automatic language detection based on user locale.

## Available Templates

1. **`confirm-signup-supabase.html`** - English version (default)
2. **`confirm-signup-supabase-fr.html`** - French version

## Setup Options

### Option 1: Use English Template (Default - Recommended for MVP)

**Simplest approach** - Use the English template for all users:
- Copy `confirm-signup-supabase.html` to Supabase
- All users receive English emails
- Works immediately, no additional setup

### Option 2: Manual Language Switching

If you want to support French emails, you have a few options:

#### A. Use French Template for All Users
- Copy `confirm-signup-supabase-fr.html` to Supabase
- All users receive French emails

#### B. Switch Templates Based on User Base
- Monitor your user base language preferences
- Manually switch the template in Supabase dashboard if needed
- Not ideal for mixed user bases

### Option 3: Custom Email Sending (Advanced)

For automatic language detection, you'd need to implement custom email sending:

1. **Detect user language** during signup (from browser locale or user preference)
2. **Store language preference** in user metadata
3. **Use Supabase Edge Functions** or custom backend to send emails
4. **Select appropriate template** based on user's language preference

**Example Implementation:**
```javascript
// In your signup flow
const userLanguage = navigator.language.startsWith('fr') ? 'fr' : 'en'

// Store in user metadata
await supabase.auth.updateUser({
  data: { preferred_language: userLanguage }
})

// In Edge Function or backend
const template = userLanguage === 'fr' 
  ? 'confirm-signup-supabase-fr.html' 
  : 'confirm-signup-supabase.html'
```

## Recommendation for MVP

**Use Option 1** (English template for all):
- ✅ Simplest setup
- ✅ Works immediately
- ✅ Most email clients support English
- ✅ Can add French support later when needed

If you have a significant French user base, consider implementing **Option 3** (custom email sending) for automatic language detection.

## Testing

To test both templates:
1. Set up English template in Supabase
2. Sign up with a test email → verify English email
3. Manually switch to French template
4. Sign up with another test email → verify French email

## Future Enhancements

Consider implementing:
- Automatic language detection based on browser locale
- User preference selection during signup
- Custom email sending service with language routing
- A/B testing different email templates

