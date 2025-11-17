# WanderCut MVP Architecture

## System Overview

WanderCut is a full-stack application that enables conversational AI video editing for travel content creators. The system processes raw video files, transcribes audio, and allows users to edit videos through natural language commands.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ VideoUpload  │  │ Conversational│  │ ProjectViewer│     │
│  │  Component   │  │    Editor     │  │  Component   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/REST API
┌───────────────────────────▼─────────────────────────────────┐
│              Backend API (Express.js)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Upload  │  │Transcribe│  │   Edit   │  │  Export  │   │
│  │  Route   │  │  Route   │  │  Route   │  │  Route   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────┬───────────┬───────────┬───────────┬───────────────┘
        │           │           │           │
        ▼           ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Google  │ │  Google  │ │  Gemini  │ │  FFMPEG  │
│  Cloud   │ │  Speech  │ │   API    │ │ Processor│
│ Storage  │ │  to Text │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
        │
        ▼
┌──────────┐
│ Firestore│
│ Database │
└──────────┘
```

## Component Details

### Frontend (Next.js 14)

**Technology Stack:**
- React 18 with TypeScript
- Next.js 14 (App Router)
- Tailwind CSS for styling
- Axios for API calls

**Key Components:**
1. **VideoUpload**: Handles file selection, validation, and upload progress
2. **ConversationalEditor**: Chat interface for natural language editing commands
3. **ProjectViewer**: Displays video preview, transcript, and export functionality
4. **Header**: Shows user tier, export limits, and navigation

**State Management:**
- React hooks (useState, useEffect)
- Local storage for user ID (MVP - will be replaced with Firebase Auth)

### Backend (Express.js)

**Technology Stack:**
- Node.js with Express
- Multer for file uploads
- Google Cloud SDKs (Storage, Firestore, Speech-to-Text)
- Gemini API for AI processing
- FFMPEG for video manipulation

**API Routes:**
1. `/api/upload` - Video file upload and storage
2. `/api/transcribe` - Audio transcription using Google Speech-to-Text
3. `/api/edit` - Process editing commands via Gemini API
4. `/api/export` - Export video with tier-based restrictions
5. `/api/projects` - Project management (CRUD)
6. `/api/user` - User tier and usage tracking

**Services:**
1. **geminiService**: Parses natural language into structured editing instructions
2. **videoProcessor**: Executes FFMPEG commands for video manipulation

## Data Flow

### Video Upload Flow
```
1. User selects video file
2. Frontend validates file (type, size)
3. POST /api/upload with FormData
4. Backend saves to local temp storage
5. Upload to Google Cloud Storage
6. Save project metadata to Firestore
7. Return projectId to frontend
8. Auto-trigger transcription
```

### Editing Flow
```
1. User enters natural language command
2. POST /api/edit with projectId and prompt
3. Backend fetches project and transcript from Firestore
4. Send prompt + transcript to Gemini API
5. Gemini returns structured editing instructions
6. Download video from GCS to temp storage
7. Process video with FFMPEG based on instructions
8. Add captions if requested
9. Upload processed video to GCS
10. Update project in Firestore
11. Return processed video URL
```

### Export Flow
```
1. User clicks export button
2. POST /api/export with projectId and userId
3. Check user tier and export limits
4. Download processed video from GCS
5. Apply tier-based processing:
   - Free: Add watermark + resize to 720p
   - Creator: No watermark, keep original resolution
6. Upload final export to GCS
7. Increment user export count
8. Return export URL for download
```

## Data Models

### Project (Firestore)
```javascript
{
  projectId: string,
  userId: string,
  originalFileName: string,
  fileName: string,
  gcsPath: string,
  publicUrl: string,
  processedGcsPath?: string,
  processedUrl?: string,
  status: 'uploaded' | 'processing' | 'completed',
  transcript?: {
    text: string,
    words: Array<{
      word: string,
      startTime: number,
      endTime: number,
      confidence: number
    }>
  },
  instructions?: Array<{
    action: string,
    parameters: object
  }>,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### User (Firestore)
```javascript
{
  userId: string,
  tier: 'free' | 'creator',
  exportsThisMonth: number,
  lastResetDate?: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## AI Processing

### Gemini API Integration
- **Model**: `gemini-2.0-flash-exp` (or fallback to mock for development)
- **Input**: User prompt + transcript with timestamps
- **Output**: Structured JSON array of editing instructions
- **Fallback**: Keyword-based mock responses when API unavailable

### Editing Instructions Format
```json
[
  {
    "action": "trim",
    "parameters": {
      "start": "0:00",
      "end": "0:30"
    }
  },
  {
    "action": "add_captions",
    "parameters": {
      "style": "dynamic",
      "position": "bottom"
    }
  }
]
```

## Video Processing

### Supported Actions
- **trim/cut**: Remove segments by time range
- **speed_change**: Adjust playback speed
- **resize**: Change aspect ratio (default: 9:16 for social media)
- **apply_filter**: Apply visual filters (cinematic, travel, vibrant, moody)
- **add_captions**: Generate dynamic word-by-word captions from transcript
- **remove_silence**: Remove silent segments

### FFMPEG Pipeline
1. Download video from GCS
2. Apply editing instructions sequentially
3. Generate SRT subtitle file from transcript
4. Burn captions into video
5. Apply watermark (free tier only)
6. Resize (free tier: 720p, creator: original)
7. Upload processed video to GCS

## Monetization Logic

### Free Tier
- 3 exports per month
- Watermarked videos
- Maximum 720p resolution
- All editing features available

### Creator Tier
- Unlimited exports
- No watermark
- Up to 4K resolution
- All editing features + future premium features

## Security Considerations

### MVP (Current)
- Basic file validation (type, size)
- User ID stored in localStorage (temporary)
- No authentication (development only)

### Production (Future)
- Firebase Authentication
- JWT tokens for API access
- Signed URLs for GCS access
- Rate limiting
- Input sanitization

## Scalability

### Current Limitations
- Synchronous video processing (blocks request)
- Local temp file storage
- No queue system for long-running jobs

### Future Improvements
- Async job queue (Cloud Tasks / Bull)
- Cloud Functions for video processing
- CDN for video delivery
- Caching layer for transcripts
- Batch processing for multiple edits

## Error Handling

### Frontend
- Try-catch blocks around API calls
- User-friendly error messages
- Loading states for async operations
- Retry logic for failed uploads

### Backend
- Try-catch in all route handlers
- Graceful degradation (mock responses)
- Temp file cleanup on errors
- Detailed error logging

## Development vs Production

### Development Mode
- Mock responses when APIs unavailable
- Local file storage
- Console logging
- Hot reload enabled

### Production Mode
- All APIs required
- Google Cloud Storage only
- Structured logging
- Error monitoring (future: Sentry)

