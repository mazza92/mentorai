# Railway Deployment Troubleshooting

## Issue: Railway Not Deploying New Updates

If Railway is not automatically deploying when you push to GitHub, check the following:

## 1. Check Railway Service Settings

### Verify GitHub Connection:
1. Go to Railway Dashboard → Your Project → Your Service
2. Click on **Settings** tab
3. Check **Source** section:
   - Ensure it's connected to your GitHub repository
   - Verify the repository URL is correct: `https://github.com/mazza92/mentorai.git`
   - Check that the branch is set to `main` (not `master`)

### Check Auto-Deploy:
1. In the same **Settings** tab
2. Look for **Deploy** section
3. Ensure **Auto Deploy** is enabled
4. Verify **Branch** is set to `main`

## 2. Check Root Directory

Railway needs to know where your backend code is:

1. Go to **Settings** → **Service**
2. Check **Root Directory**:
   - Should be set to: `backend`
   - If empty or wrong, set it to `backend`

## 3. Manual Redeploy

If auto-deploy is not working, manually trigger a deployment:

1. Go to Railway Dashboard → Your Project → Your Service
2. Click on **Deployments** tab
3. Click **Redeploy** button (or three dots menu → Redeploy)
4. Select the latest commit or branch `main`

## 4. Check Build Settings

Verify build configuration:

1. Go to **Settings** → **Build**
2. **Build Command**: Should be `npm install` (or leave empty if using Nixpacks)
3. **Start Command**: Should be `npm start`
4. **Builder**: Should be `Nixpacks` (or `Dockerfile` if you have one)

## 5. Check Railway Logs

1. Go to **Deployments** tab
2. Click on the latest deployment
3. Check **Build Logs** for errors
4. Check **Deploy Logs** for runtime errors

## 6. Verify GitHub Webhook

Railway uses GitHub webhooks to detect pushes:

1. Go to your GitHub repository: `https://github.com/mazza92/mentorai`
2. Go to **Settings** → **Webhooks**
3. Look for a Railway webhook
4. If missing, Railway might not be properly connected

## 7. Reconnect GitHub Repository

If nothing works, try reconnecting:

1. Railway Dashboard → Your Service → **Settings**
2. Under **Source**, click **Disconnect**
3. Then **Connect Repo** again
4. Select your repository and branch `main`
5. Set **Root Directory** to `backend`

## 8. Check Railway Status

Sometimes Railway has service issues:
- Check https://status.railway.app
- Check Railway Discord/Twitter for announcements

## Quick Fix: Force Redeploy

To force a redeploy right now:

1. Make a small change (we just added a timestamp log)
2. Commit and push to GitHub
3. Go to Railway → Deployments → Click **Redeploy**

## Alternative: Use Railway CLI

If you have Railway CLI installed:

```bash
railway up
```

This will trigger a manual deployment.

## Common Issues:

- **Wrong branch**: Railway watching `master` instead of `main`
- **Wrong root directory**: Should be `backend`, not root
- **Auto-deploy disabled**: Check settings
- **GitHub webhook failed**: Reconnect repository
- **Build failing**: Check build logs for errors

