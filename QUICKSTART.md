# WanderCut MVP - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies
```bash
npm run install:all
```

### Step 2: Install FFMPEG
- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH
- **Mac**: `brew install ffmpeg`
- **Linux**: `sudo apt-get install ffmpeg`

### Step 3: Set Up Environment Variables

Create `backend/.env`:
```env
PORT=3001
GEMINI_API_KEY=your_key_here
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_STORAGE_BUCKET=your_bucket_name
NODE_ENV=development
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

> **Note**: For development/testing, you can skip Google Cloud setup. The app will use mock responses.

### Step 4: Run the Application
```bash
npm run dev
```

Visit http://localhost:3000

## 🎬 Try It Out

1. **Upload a Video**: Click the upload area and select a video file (MP4, MOV, etc.)
2. **Wait for Processing**: The video will be uploaded and transcribed (mock transcript in dev mode)
3. **Edit with AI**: Try commands like:
   - "Cut the first 30 seconds and add dynamic captions"
   - "Make it cinematic and speed it up 2x"
   - "Remove all silences longer than 2 seconds"
4. **Export**: Click export to download your edited video

## 📋 What's Included

✅ Video upload with progress tracking  
✅ Automatic transcription (Google Speech-to-Text or mock)  
✅ Conversational AI editor (Gemini API or keyword-based)  
✅ Video processing (FFMPEG): cut, trim, speed, filters, captions  
✅ Monetization: Free tier (3 exports, watermarked, 720p)  
✅ Project management with Firestore  
✅ Modern UI with Tailwind CSS  

## 🔧 Development Mode

Without Google Cloud credentials, the app runs in **mock mode**:
- Returns sample transcripts
- Uses keyword-based editing (no Gemini API needed)
- Stores files locally (no GCS required)
- Perfect for UI/UX testing

## 📚 Documentation

- [SETUP.md](./SETUP.md) - Detailed setup instructions
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [README.md](./README.md) - Project overview

## 🐛 Troubleshooting

**FFMPEG not found?**
- Verify installation: `ffmpeg -version`
- Add to PATH if needed

**Port already in use?**
- Change `PORT` in `backend/.env`
- Update `NEXT_PUBLIC_API_URL` in `frontend/.env.local`

**Video processing fails?**
- Check FFMPEG installation
- Verify video file format
- Check available disk space

## 🎯 Next Steps

1. Set up Google Cloud for production features
2. Add Firebase Authentication
3. Implement payment processing
4. Deploy to production

---

**Happy Editing! 🎥✨**

