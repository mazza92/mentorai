# WanderCut MVP

Conversational AI Video Editor for Travel Content Creators

## Overview

WanderCut is an MVP that validates whether a conversational, prompt-based editing experience for raw travel footage significantly reduces production time and increases the quality of social media clips.

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: Google Firestore
- **Video Processing**: FFMPEG
- **AI**: Google Gemini API
- **Transcription**: Google Cloud Speech-to-Text API
- **Storage**: Google Cloud Storage

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- FFMPEG installed on your system
- Google Cloud account with:
  - Firestore enabled
  - Cloud Storage enabled
  - Speech-to-Text API enabled
  - Gemini API access

### Installation

1. Install all dependencies:
```bash
npm run install:all
```

2. Set up environment variables:

**Backend** (`backend/.env`):
```
PORT=3001
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_STORAGE_BUCKET=your_bucket_name
SPEECH_TO_TEXT_API_KEY=your_speech_api_key
NODE_ENV=development
```

**Frontend** (`frontend/.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

3. Run the development servers:
```bash
npm run dev
```

This will start:
- Frontend on `http://localhost:3000`
- Backend API on `http://localhost:3001`

## Features

### MVP Core Features

- ✅ Video Upload & Processing
- ✅ Automatic Transcription
- ✅ Conversational Editor Interface
- ✅ Auto-Cut/Trim Commands
- ✅ Trend-Aware Aspect Ratio (9:16) & Captions
- ✅ Basic Visual Style Filters
- ✅ Free Tier (3 videos/month, watermarked, 720p)
- ✅ Paid Tier (Unlimited, unwatermarked, 4K)

## Project Structure

```
wandercut/
├── frontend/          # Next.js application
│   ├── app/          # App router pages
│   ├── components/   # React components
│   └── lib/          # Utilities and Firebase config
├── backend/          # Express API server
│   ├── routes/       # API routes
│   ├── services/     # Business logic (FFMPEG, Gemini, etc.)
│   └── utils/        # Helper functions
└── package.json      # Root package.json
```

## Development

- Frontend: `npm run dev:frontend`
- Backend: `npm run dev:backend`
- Both: `npm run dev`

## License

Private - All Rights Reserved

