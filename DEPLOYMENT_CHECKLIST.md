# Production Deployment Checklist

## ✅ Pre-Deployment Setup

### 1. YouTube Cookies (CRITICAL)
YouTube blocks automated downloads in production. You MUST set up cookies:

- [ ] Extract YouTube cookies following `YOUTUBE_COOKIES_GUIDE.md`
- [ ] Convert cookies to base64 using `node scripts/convert-cookies.js cookies.txt`
- [ ] Add `YOUTUBE_COOKIES` variable to Railway environment
- [ ] Test with a sample video after deployment

**Without cookies, ALL YouTube uploads will fail in production!**

---

### 2. Environment Variables

Ensure these are set in Railway:

**Required:**
- [ ] `GEMINI_API_KEY` - Your Google Gemini API key
- [ ] `YOUTUBE_COOKIES` - Base64 encoded YouTube cookies (see above)
- [ ] `NODE_ENV` - Set to `production`
- [ ] `PORT` - Railway sets this automatically (usually 8080)

**Optional but Recommended:**
- [ ] `STRIPE_SECRET_KEY` - For payment processing
- [ ] `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks
- [ ] `GOOGLE_CLOUD_PROJECT_ID` - For Firestore (if using)
- [ ] `GOOGLE_CLOUD_STORAGE_BUCKET` - For Cloud Storage (if using)

**Frontend Variables:**
- [ ] `NEXT_PUBLIC_API_URL` - Your Railway backend URL
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- [ ] `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID` - Stripe price ID
- [ ] `NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID` - Stripe price ID
- [ ] `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` - Stripe price ID

---

### 3. Stripe Setup (For Payments)

- [ ] Create products in Stripe Dashboard
- [ ] Set price IDs in environment variables
- [ ] Configure webhook endpoint: `https://your-backend.railway.app/api/subscriptions/webhook`
- [ ] Test subscription flow

---

### 4. Domain Setup

- [ ] Configure custom domain in Railway (optional)
- [ ] Update CORS settings if using custom domain
- [ ] Update `NEXT_PUBLIC_API_URL` to match backend domain

---

## 🚀 Deployment Steps

### Backend Deployment

1. **Push to Railway:**
   ```bash
   git add .
   git commit -m "Deploy to production"
   git push
   ```

2. **Verify Deployment:**
   - Check Railway logs for errors
   - Look for: `✅ Using YouTube cookies for authentication`
   - Test health endpoint: `https://your-backend.railway.app/health`

3. **Test YouTube Upload:**
   - Upload a test video
   - Check logs for successful download
   - Verify no bot detection errors

### Frontend Deployment

1. **Update API URL:**
   ```bash
   # In Vercel/Netlify environment variables
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   ```

2. **Deploy:**
   ```bash
   git push
   ```

3. **Test Full Flow:**
   - Sign up
   - Upload YouTube video
   - Ask questions
   - Check quota limits

---

## 🔍 Post-Deployment Verification

### Critical Tests

- [ ] YouTube video upload works (no bot detection)
- [ ] Transcription completes successfully
- [ ] Q&A chat responds correctly
- [ ] Quota tracking increments properly
- [ ] Upgrade modal shows when limit hit
- [ ] Stripe checkout works (if implemented)

### Monitoring

- [ ] Check Railway logs for errors
- [ ] Monitor Gemini API usage
- [ ] Track conversion rates (free → paid)
- [ ] Set up error alerting (optional)

---

## 🔧 Common Issues

### Issue: YouTube Bot Detection
**Error:** `Sign in to confirm you're not a bot`

**Solution:**
1. Regenerate YouTube cookies (they expire monthly)
2. Update `YOUTUBE_COOKIES` in Railway
3. Redeploy

### Issue: Transcription Fails
**Error:** `Gemini API error` or `Rate limit exceeded`

**Solution:**
1. Check `GEMINI_API_KEY` is set correctly
2. Verify API quota in Google Cloud Console
3. Implement retry logic (already done)

### Issue: CORS Errors
**Error:** `Access-Control-Allow-Origin` errors

**Solution:**
1. Update CORS whitelist in `server.js`
2. Add your frontend domain to allowed origins
3. Redeploy backend

### Issue: Mock Storage in Production
**Warning:** `Using mock storage for development`

**Solution:**
1. Set `NODE_ENV=production` in Railway
2. Configure Firestore credentials (optional)
3. Redeploy

---

## 📊 Performance Optimization

### After Launch

- [ ] Monitor API costs (Gemini usage)
- [ ] Implement caching for common questions
- [ ] Optimize video frame analysis
- [ ] Set up CDN for static assets
- [ ] Enable database indexing (if using Firestore)

### Cost Reduction

- [ ] Cache transcriptions (avoid re-transcribing)
- [ ] Reduce video analysis frames for longer videos
- [ ] Implement question result caching
- [ ] Set up Gemini free tier where possible

---

## 🔒 Security

- [ ] Never commit `.env` files
- [ ] Rotate API keys regularly
- [ ] Use HTTPS only
- [ ] Implement rate limiting (optional)
- [ ] Set up monitoring and alerts

---

## 📝 Maintenance

### Monthly Tasks

- [ ] Regenerate YouTube cookies (they expire ~30 days)
- [ ] Review API usage and costs
- [ ] Check error logs
- [ ] Update dependencies: `npm update`

### As Needed

- [ ] Update yt-dlp: `npm update youtube-dl-exec`
- [ ] Scale Railway instances if needed
- [ ] Adjust quota limits based on usage

---

## 🆘 Support

If you encounter issues:

1. Check Railway logs first
2. Review `YOUTUBE_COOKIES_GUIDE.md`
3. Test locally with same environment variables
4. Check GitHub issues for similar problems

---

## 🎉 Success Criteria

Your deployment is successful when:

✅ Users can upload YouTube videos without errors
✅ Transcription completes within 2-3 minutes
✅ Q&A responses are accurate and fast
✅ Quota limits enforce correctly
✅ Upgrade prompts show when limits hit
✅ No critical errors in logs for 24 hours

---

**Good luck with your launch! 🚀**
