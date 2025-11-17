# Vercel Deployment Guide

This guide will help you deploy the WanderMind app to Vercel.

## Architecture Overview

- **Frontend**: Next.js app in `frontend/` directory
- **Backend**: Express.js API server in `backend/` directory

## Deployment Options

### Option 1: Deploy Frontend to Vercel + Backend Separately (Recommended)

Since the backend uses FFmpeg, file processing, and long-running operations, it's better to deploy it separately.

#### Step 1: Deploy Frontend to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

3. **Deploy to Vercel**:
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Link to existing project or create new
   - Set root directory: `frontend`
   - Override settings: No (use defaults)

4. **Set Environment Variables in Vercel Dashboard**:
   - Go to your project on Vercel → Settings → Environment Variables
   - Add the following:
     ```
     NEXT_PUBLIC_API_URL=https://your-backend-url.com
     NEXT_PUBLIC_SUPABASE_URL=https://psxsunlvzrojnsngpzqo.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeHN1bmx2enJvam5zbmdwenFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzU2MzMsImV4cCI6MjA3ODk1MTYzM30.7YOZ0GZ0sksbe-B3vuBBJfC18Liwn4To6_qu5cnj50E
     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SURrSBbAbQG1UB4TqHvm6i2fiixWEUEmoZLB7Nb624x82WUPaRxfc446IgIzMkjVhXjTK722zwGBQLdf0sTHPai00OPE5t5NV
     NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID=price_1SURuDBbAbQG1UB4WcwzQbaK
     ```

#### Step 2: Deploy Backend Separately

The backend needs to be deployed to a platform that supports:
- Long-running processes
- FFmpeg installation
- File storage
- Background jobs

**Recommended platforms:**
- **Railway** (https://railway.app) - Easy deployment, supports FFmpeg
- **Render** (https://render.com) - Free tier available
- **Fly.io** (https://fly.io) - Good for Docker deployments
- **DigitalOcean App Platform** - Simple deployment

**For Railway deployment:**

1. Create account at https://railway.app
2. New Project → Deploy from GitHub
3. Select your repository
4. Add environment variables from `backend.env`
5. Set build command: `cd backend && npm install`
6. Set start command: `cd backend && npm start`
7. Add FFmpeg to your Railway service (they have a plugin)

### Option 2: Deploy Both to Vercel (Serverless Functions)

This approach converts the Express backend to Vercel serverless functions. **Note**: This has limitations with FFmpeg and long-running processes.

1. **Update vercel.json** (already created)
2. **Convert Express routes to serverless functions** (requires significant refactoring)
3. **Deploy**: `vercel --prod`

## Quick Deploy (Frontend Only)

If you just want to deploy the frontend quickly:

```bash
cd frontend
vercel --prod
```

Then set environment variables in Vercel dashboard.

## Environment Variables Checklist

### Frontend (Vercel)
- [ ] `NEXT_PUBLIC_API_URL` - Your backend API URL
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID`

### Backend (Separate deployment)
- [ ] `PORT` - Server port (usually auto-set by platform)
- [ ] `GOOGLE_CLOUD_PROJECT_ID` - For Firestore (optional)
- [ ] `GOOGLE_CLOUD_STORAGE_BUCKET` - For file storage (optional)
- [ ] `GEMINI_API_KEY` - For AI features
- [ ] `OPENAI_API_KEY` - For transcription (optional)
- [ ] `STRIPE_SECRET_KEY` - For payments
- [ ] `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks
- [ ] `SUPABASE_URL` - For user management
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - For backend Supabase operations

## Post-Deployment

1. Update `NEXT_PUBLIC_API_URL` in Vercel to point to your deployed backend
2. Test authentication flow
3. Test video upload
4. Test Q&A functionality
5. Configure Stripe webhook URL in Stripe dashboard

