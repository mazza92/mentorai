# WanderCut MVP Setup Guide

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **FFMPEG** - Required for video processing
   - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH
   - Mac: `brew install ffmpeg`
   - Linux: `sudo apt-get install ffmpeg`
3. **Google Cloud Account** with:
   - Firestore enabled
   - Cloud Storage enabled
   - Speech-to-Text API enabled
   - Gemini API access

## Installation Steps

### 1. Install Dependencies

```bash
npm run install:all
```

This will install dependencies for:
- Root package (concurrently for running both servers)
- Frontend (Next.js, React, Tailwind)
- Backend (Express, FFMPEG, Google Cloud SDKs)

### 2. Set Up Google Cloud

1. Create a new Google Cloud project or use an existing one
2. Enable the following APIs:
   - Cloud Firestore API
   - Cloud Storage API
   - Cloud Speech-to-Text API
   - Generative AI API (Gemini)
3. Create a service account and download the JSON key file
4. Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to your key file

### 3. Create Cloud Storage Bucket

```bash
gsutil mb gs://your-bucket-name
```

Or use the Google Cloud Console to create a bucket.

### 4. Configure Environment Variables

**Backend** (`backend/.env`):
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CLOUD_PROJECT_ID=your_google_cloud_project_id
GOOGLE_CLOUD_STORAGE_BUCKET=your_storage_bucket_name
SPEECH_TO_TEXT_API_KEY=your_speech_api_key
NODE_ENV=development
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account-key.json
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

### 5. Initialize Firestore

1. Go to Google Cloud Console > Firestore
2. Create a database in Native mode
3. The app will automatically create collections (`projects`, `users`) on first use

### 6. Run the Application

```bash
npm run dev
```

This starts:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Testing the MVP

1. **Upload a Video**: Go to http://localhost:3000 and upload a test video (MP4, MOV, etc.)
2. **Wait for Transcription**: The video will be automatically transcribed (may take a few minutes)
3. **Use Conversational Editor**: Try commands like:
   - "Cut the first 30 seconds and add dynamic captions"
   - "Make it cinematic and speed it up 2x"
   - "Remove all silences longer than 2 seconds"
4. **Export**: Click export to download your edited video (free tier: watermarked, 720p)

## Development Notes

### Mock Mode

If Google Cloud credentials are not configured, the app will use mock responses:
- Transcription: Returns a sample transcript
- Gemini API: Returns mock editing instructions based on keyword matching

This allows you to test the UI and workflow without full cloud setup.

### File Structure

```
wandercut/
├── frontend/          # Next.js app
│   ├── app/          # Pages and layouts
│   ├── components/   # React components
│   └── lib/          # Utilities
├── backend/          # Express API
│   ├── routes/       # API endpoints
│   ├── services/     # Business logic
│   └── utils/        # Helpers
├── uploads/          # Temporary upload storage
├── processed/        # Processed videos
└── temp/             # Temporary files
```

## Troubleshooting

### FFMPEG Not Found
- Ensure FFMPEG is installed and in your PATH
- Test with: `ffmpeg -version`

### Google Cloud Authentication Errors
- Verify `GOOGLE_APPLICATION_CREDENTIALS` points to valid JSON key
- Check service account has necessary permissions

### Port Already in Use
- Change `PORT` in `backend/.env` to a different port
- Update `NEXT_PUBLIC_API_URL` in `frontend/.env.local` accordingly

### Video Processing Fails
- Check FFMPEG installation
- Verify video file format is supported
- Check available disk space

## Next Steps

After MVP validation:
1. Add Firebase Authentication for real user management
2. Implement payment processing for Creator Tier
3. Add more advanced AI features (Golden Moment detection, etc.)
4. Optimize video processing for production scale
5. Add analytics and user feedback collection

