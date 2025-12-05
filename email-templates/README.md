# Lurnia Email Templates

This directory contains branded email templates for Lurnia that match the app's design system.

## Templates

### `confirm-signup-supabase.html` (English - Recommended)
**Use this version for Supabase** - Optimized for email client compatibility:
- Uses Lurnia's blue-purple gradient design (`#3b82f6` to `#8b5cf6`)
- Includes emoji-based logo (⚡) for maximum compatibility
- Features a modern, **mobile-responsive** layout
- Provides clear onboarding information
- **Updated for MVP:** Only mentions YouTube channel import (not single video upload)
- Works across all major email clients including Outlook

### `confirm-signup-supabase-fr.html` (French - Recommended)
**French version** for French-speaking users:
- Same design and features as English version
- Fully translated to French
- Mobile-responsive
- Mentions YouTube channel import only

### `confirm-signup.html` (Advanced)
Full-featured version with SVG logo:
- Same design as above but with SVG Zap icon
- May have compatibility issues with some email clients
- Use if you need the exact logo rendering

## Setup Instructions

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project
   - Navigate to **Authentication** → **Email Templates**

2. **Configure the Confirm Signup Template**
   
   **For English users:**
   - Click on **Confirm Signup** template
   - Switch to **HTML** mode (if available) or paste the HTML directly
   - Copy the entire contents of `confirm-signup-supabase.html`
   - Paste into the Supabase email template editor
   - Save the template
   
   **For French users (Optional - if you want language-specific emails):**
   - Supabase doesn't natively support language detection in email templates
   - You can manually switch between templates based on user locale
   - Or use the French template: `confirm-signup-supabase-fr.html`
   - **Note:** Most users will see the default template. For automatic language detection, you'd need to implement custom email sending logic

3. **Test the Template**
   - Sign up with a test email address
   - Check your inbox (and spam folder) for the confirmation email
   - Verify the design renders correctly
   - Test the confirmation link

## Template Variables

Supabase provides these template variables:
- `{{ .ConfirmationURL }}` - The confirmation link (required)
- `{{ .SiteURL }}` - Your site URL (optional, used in footer)

## Design System

The email template matches Lurnia's design system:
- **Primary Colors:** Blue (`#3b82f6`) to Purple (`#8b5cf6`) gradient
- **Background:** Light slate (`#f8fafc`)
- **Text Colors:** Slate-900 for headings, Slate-600 for body text
- **Border Radius:** 8px-16px for modern rounded corners
- **Typography:** System font stack for best compatibility

## Mobile Responsiveness

The templates are fully mobile-responsive:
- ✅ Responsive padding and spacing on mobile devices
- ✅ Scalable text sizes (smaller on mobile)
- ✅ Full-width button on mobile (max 280px)
- ✅ Optimized logo size for mobile
- ✅ Proper word-break for long URLs
- ✅ Tested on iOS Mail, Gmail mobile, Outlook mobile

## Email Client Compatibility

The template is designed to work across:
- ✅ Gmail (web, iOS, Android)
- ✅ **Outlook (Windows, Mac, Web)** - Uses VML for gradients and proper table structure
- ✅ Apple Mail
- ✅ Yahoo Mail
- ✅ Other major email clients

### Outlook-Specific Fixes

The templates include special Outlook compatibility:
- **VML gradients** for the header background (Outlook doesn't support CSS gradients)
- **VML rounded rectangles** for buttons (Outlook doesn't support border-radius)
- **Table-based layout** instead of divs (Outlook has limited div support)
- **MSO conditional comments** to hide/show content based on email client
- **Fallback colors** using hex values (Outlook doesn't support rgba)

## Customization

To customize the template:
1. Edit `confirm-signup.html`
2. Update colors, text, or layout as needed
3. Re-upload to Supabase dashboard
4. Test thoroughly before deploying

## Notes

- The template uses inline CSS for maximum email client compatibility
- SVG logo is embedded directly for reliability
- All links use the Supabase template variables
- The design is mobile-responsive

