# Firestore Setup Guide for Railway

## Current Issue
```
Error: 7 PERMISSION_DENIED: Missing or insufficient permissions.
```

Your service account credentials are loading, but don't have the right permissions to access Firestore.

---

## Step 1: Enable Firestore

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **ai-mentor-ce305**
3. In the left sidebar, go to **Firestore** (or search for "Firestore")
4. Click **Create Database**
5. Choose:
   - **Native Mode** (recommended)
   - **Location**: Choose closest to your users (e.g., `us-central` or `europe-west`)
6. Click **Create**

---

## Step 2: Create Service Account with Proper Permissions

### 2A. Go to Service Accounts

1. In Google Cloud Console, go to **IAM & Admin** → **Service Accounts**
2. Or visit: https://console.cloud.google.com/iam-admin/serviceaccounts?project=ai-mentor-ce305

### 2B. Create New Service Account (or Update Existing)

**If you already have a service account:**
1. Find your existing service account
2. Click the **three dots** (⋮) → **Manage Permissions**
3. Skip to Step 2C

**If creating a new one:**
1. Click **+ CREATE SERVICE ACCOUNT**
2. Fill in:
   - **Service account name**: `wandercut-backend` (or any name)
   - **Service account ID**: Will auto-generate
   - **Description**: "Backend service for WanderCut app"
3. Click **CREATE AND CONTINUE**

### 2C. Grant Firestore Permissions

Add the following roles (click **+ ADD ANOTHER ROLE** for each):

**Required Roles:**
1. **Cloud Datastore User** (`roles/datastore.user`)
   - Allows read/write access to Firestore

2. **Firebase Admin SDK Administrator Service Agent** (optional but recommended)
   - Or just use **Cloud Datastore User** which should be sufficient

**Alternative: More Specific Permissions**
If you want tighter security, use these instead:
- **Cloud Datastore Import Export Admin** (if you need exports)
- **Cloud Datastore Index Admin** (if you need to manage indexes)
- **Cloud Datastore Viewer** (read-only, if needed)

**For this app, just use**: `Cloud Datastore User`

Click **CONTINUE**, then **DONE**

---

## Step 3: Create Service Account Key (JSON)

1. In the Service Accounts list, find your service account
2. Click on it to open details
3. Go to the **KEYS** tab
4. Click **ADD KEY** → **Create new key**
5. Choose **JSON** format
6. Click **CREATE**

A JSON file will download to your computer. **Keep this file secure!**

The file looks like this:
```json
{
  "type": "service_account",
  "project_id": "ai-mentor-ce305",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "wandercut-backend@ai-mentor-ce305.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

---

## Step 4: Add Credentials to Railway

### 4A. Copy the JSON Content

1. Open the downloaded JSON file in a text editor (Notepad, VS Code, etc.)
2. Select **ALL** the content (Ctrl+A)
3. Copy it (Ctrl+C)

### 4B. Add to Railway Environment Variables

1. Go to your Railway project dashboard
2. Click on your **backend service**
3. Go to the **Variables** tab
4. Find or add: `GOOGLE_APPLICATION_CREDENTIALS_JSON`
5. Paste the **entire JSON content** as the value
6. Click **Save** or **Add**

**IMPORTANT**: Make sure you paste the ENTIRE JSON, including the opening `{` and closing `}`

### 4C. Verify Other Variables

Make sure you also have:
- ✅ `GOOGLE_CLOUD_PROJECT_ID` = `ai-mentor-ce305`
- ✅ `GOOGLE_CLOUD_STORAGE_BUCKET` = `ai-mentor-ce305.firebasestorage.app` (if using storage)

### 4D. Redeploy

Railway should automatically redeploy. If not:
1. Go to the **Deployments** tab
2. Click **Deploy** on the latest deployment

---

## Step 5: Verify It's Working

After redeploying, check the Railway logs. You should see:

✅ **Success**:
```
✅ Using Google Cloud credentials from environment variable
✅ Firestore initialized successfully
YouTube download complete: ...
Project created in Firestore: ...
```

❌ **Still Failing?**

If you still see permissions errors, check:

1. **Firestore is enabled** in your project
2. **Service account has `Cloud Datastore User` role**
3. **JSON is complete** (no missing quotes, brackets, or characters)
4. **Project ID matches** in both the JSON and the GOOGLE_CLOUD_PROJECT_ID variable

---

## Alternative: Use Mock Storage (Quick Test)

If you want to test without Firestore setup:

**In Railway Variables:**
1. Change `GOOGLE_CLOUD_PROJECT_ID` to `your_project_id`
2. Or delete `GOOGLE_APPLICATION_CREDENTIALS_JSON`

This will use in-memory mock storage (data lost on restart).

---

## Security Notes

⚠️ **IMPORTANT**:
- **NEVER** commit the service account JSON to Git
- Keep it in Railway environment variables only
- Rotate keys periodically (every 90 days recommended)
- Use separate service accounts for dev/staging/production

---

## Firestore Collections Structure

Your app will create these collections:

```
/projects/{projectId}
  - title, videoPath, audioPath, transcript, etc.

/users/{userId}
  - email, subscriptionStatus, videoCount, etc.

/conversations/{conversationId}
  - messages, projectId, userId, etc.
```

---

## Cost Estimate

Firestore pricing (as of 2024):
- **Free tier**:
  - 50,000 reads/day
  - 20,000 writes/day
  - 20,000 deletes/day
  - 1 GB storage

For a small app, you'll likely stay within the free tier.

---

## Need Help?

If you encounter any issues:
1. Check Railway logs for specific error messages
2. Verify Firestore is in **Native Mode** (not Datastore mode)
3. Ensure service account has `Cloud Datastore User` role
4. Make sure the JSON is properly formatted in Railway

---

## Quick Checklist

- [ ] Firestore enabled in Google Cloud Console
- [ ] Service account created with `Cloud Datastore User` role
- [ ] Service account key (JSON) downloaded
- [ ] JSON added to Railway as `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- [ ] `GOOGLE_CLOUD_PROJECT_ID` set to `ai-mentor-ce305`
- [ ] Redeployed on Railway
- [ ] Checked logs for success messages

Once these are done, your app will store data persistently in Firestore! 🎉
