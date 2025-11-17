# Quick Vercel Deployment Guide

## Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

## Step 2: Deploy Frontend

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Login to Vercel** (if not already):
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   
   When prompted:
   - **Set up and deploy?** → Yes
   - **Which scope?** → Your account
   - **Link to existing project?** → No (first time) or Yes (if updating)
   - **What's your project's name?** → wandermind (or your choice)
   - **In which directory is your code located?** → `./` (current directory)
   - **Want to override the settings?** → No

4. **Deploy to production**:
   ```bash
   vercel --prod
   ```

## Step 3: Set Environment Variables

After deployment, go to Vercel Dashboard:
1. Open your project
2. Go to **Settings** → **Environment Variables**
3. Add these variables:

```
NEXT_PUBLIC_API_URL=https://your-backend-url.com
NEXT_PUBLIC_SUPABASE_URL=https://psxsunlvzrojnsngpzqo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeHN1bmx2enJvam5zbmdwenFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzU2MzMsImV4cCI6MjA3ODk1MTYzM30.7YOZ0GZ0sksbe-B3vuBBJfC18Liwn4To6_qu5cnj50E
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SURrSBbAbQG1UB4TqHvm6i2fiixWEUEmoZLB7Nb624x82WUPaRxfc446IgIzMkjVhXjTK722zwGBQLdf0sTHPai00OPE5t5NV
NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID=price_1SURuDBbAbQG1UB4WcwzQbaK
```

**Important**: Update `NEXT_PUBLIC_API_URL` with your actual backend URL once you deploy the backend.

## Step 4: Deploy Backend (Separate Service)

The backend needs to be deployed separately because it requires:
- FFmpeg for video processing
- Long-running processes
- File storage

### Recommended: Railway.app

1. Go to https://railway.app
2. Sign up/login
3. **New Project** → **Deploy from GitHub repo**
4. Select your repository
5. **Add Service** → **GitHub Repo** → Select your repo
6. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
7. Add environment variables (from `backend.env` + Stripe keys)
8. Add FFmpeg: Railway has a plugin or use a Dockerfile

### Alternative: Render.com

1. Go to https://render.com
2. **New** → **Web Service**
3. Connect GitHub repo
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variables
6. For FFmpeg, you may need a Dockerfile

## Step 5: Update Frontend API URL

Once backend is deployed:
1. Copy your backend URL (e.g., `https://your-app.railway.app`)
2. Update `NEXT_PUBLIC_API_URL` in Vercel dashboard
3. Redeploy frontend or wait for automatic redeploy

## Troubleshooting

- **Build fails**: Check that all dependencies are in `package.json`
- **API calls fail**: Verify `NEXT_PUBLIC_API_URL` is set correctly
- **CORS errors**: Make sure backend CORS allows your Vercel domain

