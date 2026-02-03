# Deploy Specific Commit to Railway

## Commit: e9a2650
**Message**: Force Railway to deploy latest code

## Method 1: Railway Dashboard (Recommended)

1. Go to https://railway.app
2. Navigate to your project → Your service
3. Click **Deployments** tab
4. Click **Redeploy** button (or three dots menu)
5. Select **"Deploy from GitHub"**
6. Choose **"Deploy specific commit"**
7. Enter commit hash: `e9a2650`
8. Click **Deploy**

## Method 2: Railway CLI

If you have Railway CLI installed:

```bash
# Install Railway CLI (if not installed)
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Deploy specific commit
railway up --detach
```

## Method 3: Force Push (Not Recommended)

If the above methods don't work, you can reset to that commit and force push:

```bash
# WARNING: This rewrites history
git reset --hard e9a2650
git push origin main --force
```

**Note**: Only use force push if you're sure no one else is working on the repo.

## Verify Deployment

After deployment, check Railway logs for:
- Deployment timestamp
- Commit SHA: `e9a2650`
- Server startup messages

