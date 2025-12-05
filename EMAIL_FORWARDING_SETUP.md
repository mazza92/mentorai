# Email Forwarding Setup Guide for Lurnia

## Overview
Forward all emails from `team@lurnia.app` to `team@newcollab.co`

---

## Method 1: Cloudflare Email Routing (Recommended - FREE)

✅ **Best Option:** Free, reliable, easy to set up, no extra costs

### Prerequisites
- Domain `lurnia.app` must be using Cloudflare nameservers

### Setup Steps

1. **Log in to Cloudflare Dashboard**
   - Go to https://dash.cloudflare.com
   - Select your `lurnia.app` domain

2. **Navigate to Email Routing**
   - Click on **"Email"** in the left sidebar
   - Or go directly to the **"Email Routing"** section

3. **Enable Email Routing**
   - Click **"Get Started"** or **"Enable Email Routing"**
   - Cloudflare will automatically add the required DNS records:
     - MX records (for receiving email)
     - TXT records (for SPF/DKIM authentication)

4. **Add Destination Address**
   - Click **"Destination addresses"** tab
   - Click **"Add destination"**
   - Enter: `team@newcollab.co`
   - Click **"Send verification email"**
   - Check `team@newcollab.co` inbox and click the verification link

5. **Create Routing Rule**
   - Click **"Routing rules"** tab
   - Click **"Create address"** or **"Create custom address"**
   - Custom address: `team@lurnia.app`
   - Action: **"Send to an email"**
   - Destination: `team@newcollab.co`
   - Click **"Save"**

6. **Test the Forwarding**
   - Send a test email to `team@lurnia.app`
   - Check if it arrives at `team@newcollab.co`

### Catch-All (Optional)
If you want ALL emails to `*@lurnia.app` to forward to `team@newcollab.co`:
- Create a **"Catch-all"** rule
- Forward to: `team@newcollab.co`

---

## Method 2: Google Workspace (Paid - $6/month per user)

✅ **Professional Option:** Full email service, send from team@lurnia.app

### Setup Steps

1. **Sign up for Google Workspace**
   - Go to https://workspace.google.com
   - Choose "Business Starter" plan ($6/month)
   - Enter domain: `lurnia.app`

2. **Verify Domain Ownership**
   - Add TXT record to DNS:
     ```
     Name: @
     Type: TXT
     Value: google-site-verification=XXXXX
     ```

3. **Configure MX Records**
   - Remove existing MX records
   - Add Google's MX records (provided during setup):
     ```
     Priority 1: ASPMX.L.GOOGLE.COM
     Priority 5: ALT1.ASPMX.L.GOOGLE.COM
     Priority 5: ALT2.ASPMX.L.GOOGLE.COM
     Priority 10: ALT3.ASPMX.L.GOOGLE.COM
     Priority 10: ALT4.ASPMX.L.GOOGLE.COM
     ```

4. **Create User Account**
   - Create user: `team@lurnia.app`
   - Set password

5. **Set Up Forwarding**
   - Log in to Gmail as `team@lurnia.app`
   - Go to **Settings** → **Forwarding and POP/IMAP**
   - Click **"Add a forwarding address"**
   - Enter: `team@newcollab.co`
   - Verify the forwarding address
   - Choose: **"Forward a copy of incoming mail to team@newcollab.co"**
   - Choose: **"Keep Gmail's copy in the Inbox"** or **"Delete"**

---

## Method 3: Namecheap Email Forwarding (If domain is with Namecheap)

### Setup Steps

1. **Log in to Namecheap Account**
   - Go to https://www.namecheap.com
   - Navigate to **Domain List**
   - Click **"Manage"** next to `lurnia.app`

2. **Enable Email Forwarding**
   - Go to **"Email Forwarding"** tab
   - Turn on **"Email Forwarding"**
   - Wait for DNS propagation (can take up to 30 minutes)

3. **Add Forwarding Rule**
   - Mailbox: `team@lurnia.app`
   - Forward To: `team@newcollab.co`
   - Click **"Add Forwarder"**

4. **Verify DNS Records**
   - Namecheap automatically adds:
     - MX records
     - TXT record for SPF

---

## Method 4: ImprovMX (FREE Email Forwarding Service)

✅ **Simple FREE Option:** No account required, quick setup

### Setup Steps

1. **Go to ImprovMX**
   - Visit https://improvmx.com
   - No account required

2. **Add Domain**
   - Enter domain: `lurnia.app`
   - Click **"Add domain"**

3. **Configure DNS Records**
   Add these MX records to your DNS:
   ```
   Priority 10: mx1.improvmx.com
   Priority 20: mx2.improvmx.com
   ```

4. **Add Email Alias**
   - Alias: `team@lurnia.app`
   - Forward to: `team@newcollab.co`
   - Click **"Add alias"**

5. **Optional: SPF Record**
   Add TXT record:
   ```
   Name: @
   Type: TXT
   Value: v=spf1 include:spf.improvmx.com ~all
   ```

---

## Method 5: SendGrid Inbound Parse (Free Tier Available)

### Setup Steps

1. **Sign up for SendGrid**
   - Go to https://sendgrid.com
   - Create free account

2. **Configure Inbound Parse**
   - Go to **Settings** → **Inbound Parse**
   - Click **"Add Host & URL"**
   - Subdomain: `mail` (creates mail.lurnia.app)
   - URL: Your server endpoint

3. **Add MX Records**
   ```
   Name: mail.lurnia.app
   Type: MX
   Priority: 10
   Value: mx.sendgrid.net
   ```

4. **Forward via Webhook**
   - Configure webhook to forward to `team@newcollab.co`
   - Requires custom server code

---

## DNS Records Summary (Cloudflare Email Routing - Recommended)

After setup, your DNS should include:

### MX Records (Mail Exchange)
```
Type: MX
Name: lurnia.app (or @)
Priority: 53
Value: isaac.mx.cloudflare.net

Type: MX
Name: lurnia.app (or @)
Priority: 11
Value: linda.mx.cloudflare.net

Type: MX
Name: lurnia.app (or @)
Priority: 56
Value: amir.mx.cloudflare.net
```

### TXT Records (Email Authentication)
```
Type: TXT
Name: lurnia.app (or @)
Value: v=spf1 include:_spf.mx.cloudflare.net ~all

Type: TXT
Name: _dmarc.lurnia.app
Value: v=DMARC1; p=none; rua=mailto:team@lurnia.app
```

---

## Testing Email Forwarding

### Test #1: Basic Send Test
1. Send email from your personal Gmail to `team@lurnia.app`
2. Check if it arrives at `team@newcollab.co`
3. Reply from `team@newcollab.co` and see if user receives it

### Test #2: Spam/Bounce Test
1. Use https://www.mail-tester.com
2. Send email from `team@lurnia.app` to the test address
3. Check your spam score (aim for 8/10 or higher)

### Test #3: DNS Validation
1. Use https://mxtoolbox.com/SuperTool.aspx
2. Enter: `lurnia.app`
3. Check MX records are valid
4. Check SPF record is valid

---

## Sending Email FROM team@lurnia.app

### Option A: Gmail "Send mail as" (Simple)
1. Log in to `team@newcollab.co` Gmail
2. Go to **Settings** → **Accounts and Import**
3. Click **"Add another email address"**
4. Enter: `team@lurnia.app`
5. Use SMTP: `smtp.gmail.com` (if using Google Workspace for lurnia.app)
6. Or use your email provider's SMTP settings

### Option B: Cloudflare Email Routing + Gmail
Cloudflare Email Routing is **receive-only**. To send:
1. Use Gmail's "Send mail as" feature
2. Or use a transactional email service (SendGrid, Mailgun)

---

## Recommended Setup for Lurnia

### For Production Launch:
✅ **Use Cloudflare Email Routing** (FREE)
- Reliable, no cost, easy setup
- Receive emails at `team@lurnia.app`
- Reply from `team@newcollab.co` (or set up "Send mail as")

### Alternative (More Professional):
✅ **Use Google Workspace** ($6/month)
- Full email service
- Send and receive from `team@lurnia.app`
- Professional Gmail interface
- Calendar, Drive included

---

## Current Configuration Needed

Based on your legal pages, you need forwarding for:
- ✅ `team@lurnia.app` → `team@newcollab.co`

All legal pages and footer now use `team@lurnia.app` as the single contact email.

---

## Quick Start (Cloudflare - 5 minutes)

1. Log in to Cloudflare
2. Select `lurnia.app` domain
3. Click "Email" → "Email Routing"
4. Enable Email Routing
5. Add destination: `team@newcollab.co` (verify)
6. Create custom address: `team@lurnia.app` → `team@newcollab.co`
7. Test by sending email to `team@lurnia.app`

✅ Done! All emails to `team@lurnia.app` will forward to `team@newcollab.co`

---

## Troubleshooting

### Emails Not Forwarding
- Check MX records are correct (use mxtoolbox.com)
- Wait 30-60 minutes for DNS propagation
- Check spam folder at `team@newcollab.co`
- Verify destination email is confirmed in Cloudflare

### Emails Going to Spam
- Add SPF record to DNS
- Add DMARC record to DNS
- Ask recipients to whitelist `team@lurnia.app`

### Can't Send FROM team@lurnia.app
- Cloudflare Email Routing is receive-only
- Use Gmail "Send mail as" or Google Workspace

---

## Next Steps After Setup

1. ✅ Set up email forwarding (Cloudflare recommended)
2. Test forwarding by sending email to `team@lurnia.app`
3. Set up "Send mail as" in Gmail (optional)
4. Add signature with Lurnia branding (optional)
5. Set up auto-responder for support emails (optional)

---

## Support

If you need help:
- Cloudflare: https://dash.cloudflare.com
- Google Workspace: https://workspace.google.com/support
- ImprovMX: https://improvmx.com/support

---

**Recommendation: Start with Cloudflare Email Routing (free, 5 min setup)**
