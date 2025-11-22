# Lurnia - Technical Overview & Functions

**Tagline:** Turn video content into searchable knowledge

**Last Updated:** November 21, 2025
**Version:** 1.0 (MVP)

---

## Table of Contents

1. [App Overview](#app-overview)
2. [Core Features & Functionality](#core-features--functionality)
3. [Technical Architecture](#technical-architecture)
4. [Technology Stack](#technology-stack)
5. [User Management & Authentication](#user-management--authentication)
6. [Freemium Model & Usage Limits](#freemium-model--usage-limits)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [Frontend Structure](#frontend-structure)
9. [Backend Structure](#backend-structure)
10. [Database Schema](#database-schema)
11. [Deployment Infrastructure](#deployment-infrastructure)
12. [Environment Configuration](#environment-configuration)
13. [Recent Improvements](#recent-improvements)

---

## App Overview

**Lurnia** is an AI-powered video Q&A platform that transforms video content into searchable knowledge. Users can upload videos (or import from YouTube), and then ask natural language questions to get instant answers with precise timestamp citations.

### What Lurnia Does

**Input:** YouTube URL
**Output:** Instant answers to questions about the video content with timestamp references

**Core Value Proposition:**
- **No more scrubbing through hours of footage** - Ask questions, get instant answers
- **Timestamp citations** - Jump directly to the relevant moment in the video
- **AI-powered understanding** - Deep comprehension of video content through transcription and analysis
- **Multi-language support** - Upload in any language, ask questions in your preferred language

### Use Cases

1. **Educational Content**
   - "What does the instructor say about quantum mechanics?"
   - "When does the professor explain the formula?"

2. **Meetings & Interviews**
   - "What did John say about the Q3 budget?"
   - "Summarize the discussion about marketing strategy"

3. **Tutorials & How-To Videos**
   - "How do I set up the development environment?"
   - "When does the tutorial cover authentication?"

4. **Podcast & Long-form Content**
   - "What topics are discussed in this episode?"
   - "When do they talk about AI regulation?"

5. **Research & Documentation**
   - "Find all mentions of 'climate change'"
   - "What evidence is presented for this claim?"

---

## Core Features & Functionality

### 1. Video Upload & Processing

**Upload Methods:**
- **Direct file upload** - Supports MP4, MOV, AVI, WebM, and other common formats
- **YouTube URL import** - Paste any YouTube link to analyze the video
- **Drag-and-drop interface** - Simple, intuitive upload experience

**Processing Pipeline:**
```
Upload Video
    ↓
Store in Cloud Storage
    ↓
Automatic Transcription (Speech-to-Text)
    ↓
AI Analysis & Topic Extraction
    ↓
Generate Thumbnails
    ↓
Ready for Q&A
```

**What Happens:**
1. Video uploaded to backend
2. Stored in Google Cloud Storage (production) or local storage (development)
3. **Automatic transcription** using Google Cloud Speech-to-Text or AssemblyAI
4. **AI analysis** using Google Gemini, Claude, or GPT models
5. **Topic extraction** - Identifies key topics and timestamps
6. **Thumbnail generation** - Creates video preview images
7. **Ready for questions** - User can start asking questions immediately

**File Locations:**
- Backend: `routes/upload.js`, `routes/uploadYoutube.js`
- Frontend: `components/VideoUpload.tsx`
- Services: `services/transcriptionService.js`, `services/videoAnalysisService.js`

### 2. Conversational Q&A System

**This is the core feature of Lurnia.**

**How it works:**
1. User asks a natural language question
2. AI analyzes the question + video transcript
3. Generates contextual answer with timestamp references
4. User can click timestamp to jump to that moment in the video
5. Follow-up questions maintain conversation context

**Question Examples:**
- "What is this video about?"
- "When does the speaker mention climate change?"
- "Summarize the first 10 minutes"
- "What evidence is presented for this argument?"
- "List all the tools mentioned"
- "When does the tutorial cover authentication?"

**Advanced Capabilities:**
- **Multi-turn conversations** - Context awareness across multiple questions
- **Multi-language support** - Ask in English, French, Italian, or Spanish
- **Timestamp citations** - Every answer includes relevant timestamps
- **Semantic search** - Understands intent, not just keyword matching
- **Conversation history** - All Q&A exchanges are saved

**AI Models Used:**
- **Primary:** Google Gemini (latest model)
- **Fallback:** Anthropic Claude Sonnet
- **Alternative:** OpenAI GPT-4

**File Locations:**
- Backend: `routes/qa.js`, `services/videoQAService.js`
- Frontend: `components/VideoQA.tsx`, `components/WanderMindViewer.tsx`

### 3. Automatic Topic Extraction

**What it does:**
- Analyzes the entire video transcript
- Identifies key topics and themes
- Creates timestamp markers for each topic
- Generates a table of contents for the video

**Use Cases:**
- Quickly understand video structure
- Jump to specific sections
- Navigate long videos efficiently
- Get overview before watching

**Example Output:**
```
00:00 - Introduction to Machine Learning
05:23 - Supervised vs Unsupervised Learning
12:45 - Neural Networks Explained
20:10 - Real-world Applications
28:30 - Q&A Session
```

**File Locations:**
- Backend: `routes/topics.js`, `services/videoAnalysisService.js`

### 4. Conversation History & Management

**Features:**
- **Persistent storage** - All conversations saved automatically
- **Conversation list** - See all your past video Q&A sessions
- **Visual previews** - Thumbnails and titles for easy identification
- **Instant switching** - Jump between different video conversations
- **Search functionality** - Find specific conversations (coming soon)

**How it works:**
1. New video upload automatically creates a conversation
2. All Q&A exchanges saved to that conversation
3. Conversations stored both locally (frontend) and in Firestore (backend)
4. Users can return to any conversation at any time

**File Locations:**
- Frontend: `components/ConversationHistory.tsx`, `lib/conversationStorage.ts`
- Backend: `routes/conversations.js`

### 5. User Authentication & Session Management

Lurnia supports **two authentication modes** to maximize accessibility:

#### Mode 1: Anonymous Access (No Supabase)
- **No signup required** - Try the app immediately
- **Browser fingerprinting** - Persistent identity without account
- **Freemium limits** - 1 video upload, 3 questions per month
- **Upgrade prompt** - Encourage signup when limits reached

#### Mode 2: Authenticated Access (Supabase Configured)
- **Anonymous trial** - Users can still try before signup
- **Email/password auth** - Standard authentication via Supabase
- **Higher limits** - 3 uploads, 15 questions per month (free tier)
- **Pro subscription** - Unlimited uploads and questions

**Dual Authentication System:**
The app uses both Supabase (authenticated users) and sessionManager (anonymous users) to provide a seamless experience:

```typescript
// Check BOTH authentication sources
const sessionInfo = getSessionInfo()
const hasValidSession = user || (sessionInfo && !isAnonymous())
```

This ensures users are recognized even if their Supabase session expires.

**File Locations:**
- Frontend: `contexts/AuthContext.tsx`, `lib/sessionManager.ts`, `lib/fingerprint.ts`
- Components: `components/Auth.tsx`, `components/ModernHeader.tsx`

### 6. Freemium Model & Monetization

**Tier Structure:**

| Feature | Anonymous | Free (Signed Up) | Pro |
|---------|-----------|------------------|-----|
| Video Uploads | **1/month** | **3/month** | **Unlimited** |
| Questions | **3/month** | **15/month** | **Unlimited** |
| Max Video Length | 30 min | 60 min | No limit |
| Storage | 7 days | 30 days | Unlimited |
| Export Transcript | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ (future) |

**Conversion Strategy:**
1. **Anonymous users** try 1 video + 3 questions → See value → Sign up for more
2. **Free users** get 3 videos + 15 questions → Experience value → Upgrade to Pro
3. **Pro users** get unlimited access → Become power users

**Payment Integration:**
- **Stripe Checkout** - Simple subscription flow
- **Stripe Customer Portal** - Self-service subscription management
- **Webhook automation** - Auto-upgrade/downgrade based on payment events

**File Locations:**
- Backend: `routes/subscriptions.js`, `services/userService.js`
- Frontend: `components/Pricing.tsx`, `components/SignupWall.tsx`, `components/UpgradeModal.tsx`

### 7. Usage Tracking & Quota Enforcement

**What's tracked:**
- Video uploads per month
- Questions asked per month
- Usage resets on 1st of each month

**How it works:**
1. User attempts action (upload or question)
2. Backend checks quota via `userService.checkUploadQuota()` or `checkQuestionQuota()`
3. If within limits → Action proceeds
4. If limit exceeded → 403 error returned
5. Frontend shows SignupWall modal
6. Usage counter incremented after successful action

**Backend Enforcement:**
```javascript
// Check before processing
const { canAsk, limit, remaining } = await userService.checkQuestionQuota(userId)

if (!canAsk) {
  return res.status(403).json({
    error: 'Question limit reached',
    message: 'Sign up to get 15 questions per month!',
    tier: 'anonymous',
    requiresSignup: true
  })
}
```

**File Locations:**
- Backend: `services/userService.js` (`checkUploadQuota`, `checkQuestionQuota`)
- Frontend: `components/SignupWall.tsx`

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER BROWSER                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Next.js Frontend (Vercel)                      │ │
│  │  - React 18 + Next.js 14 (App Router)                 │ │
│  │  - Tailwind CSS for styling                           │ │
│  │  - i18next for internationalization                   │ │
│  │  - Supabase Client (optional auth)                    │ │
│  │  - Stripe.js for payments                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Express Backend (Railway)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  - Node.js + Express                                   │ │
│  │  - Rate limiting (express-rate-limit)                  │ │
│  │  - Security headers (helmet)                           │ │
│  │  - CORS configured                                     │ │
│  │  - Trust proxy for Railway                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           │              │              │              │
           ▼              ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Firestore│   │   GCS    │   │ AI APIs  │   │  Stripe  │
    │ Database │   │ Storage  │   │          │   │ Payments │
    └──────────┘   └──────────┘   └──────────┘   └──────────┘
    - Projects     - Videos       - Gemini      - Checkout
    - Users        - Thumbnails   - Claude      - Webhooks
    - Convos       - Transcripts  - GPT         - Portal
    - Usage                       - Speech-to-
                                    Text
```

### Data Flow - Video Upload & Q&A

```
┌─────────────────────────────────────────────────────────────┐
│                    VIDEO UPLOAD FLOW                         │
└─────────────────────────────────────────────────────────────┘

1. User uploads video or pastes YouTube URL
   ↓
2. Frontend → POST /api/upload or /api/upload-youtube (with userId)
   ↓
3. Backend checks upload quota (checkUploadQuota)
   ↓
4. If quota OK: Video saved to Google Cloud Storage
   ↓
5. Project created in Firestore (status: 'processing')
   ↓
6. Transcription started asynchronously
   ↓
7. Frontend receives projectId, creates conversation
   ↓
8. Frontend polls /api/projects/project/:id for status
   ↓
9. When status = 'ready', Q&A interface activated

┌─────────────────────────────────────────────────────────────┐
│                         Q&A FLOW                             │
└─────────────────────────────────────────────────────────────┘

1. User types question in chat interface
   ↓
2. Frontend → POST /api/qa (with projectId, userId, question, chatHistory)
   ↓
3. Backend checks question quota (checkQuestionQuota)
   ↓
4. If quota OK: AI service processes question
   ↓
5. AI analyzes transcript + chat history for context
   ↓
6. AI generates answer with timestamp references
   ↓
7. Response streamed back to frontend
   ↓
8. Frontend displays answer + clickable timestamps
   ↓
9. Conversation saved to Firestore + localStorage
   ↓
10. Usage counter incremented (questionsThisMonth++)
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.0 | React framework with App Router |
| **React** | 18.2 | UI library |
| **TypeScript** | 5.3 | Type safety |
| **Tailwind CSS** | 3.3 | Styling framework |
| **i18next** | 25.6 | Internationalization (EN, FR, IT, ES) |
| **Lucide React** | 0.294 | Icon library |
| **Supabase Client** | 2.78 | Optional authentication |
| **Stripe.js** | 8.4 | Payment UI |
| **Axios** | 1.6 | HTTP client |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | Runtime |
| **Express** | 4.18 | Web framework |
| **Google Cloud Firestore** | 7.1 | NoSQL database |
| **Google Cloud Storage** | 7.7 | Video/file storage |
| **Google Cloud Speech-to-Text** | 6.0 | Transcription |
| **Google Gemini AI** | 0.2 | Primary AI model for Q&A |
| **Anthropic Claude** | 0.69 | Alternative AI model |
| **OpenAI GPT** | 6.9 | Alternative AI model |
| **AssemblyAI** | 4.19 | Alternative transcription |
| **Stripe** | 19.3 | Payment processing |
| **FFmpeg** | 2.1 (fluent-ffmpeg) | Video processing (thumbnails) |
| **helmet** | 8.1 | Security headers |
| **express-rate-limit** | 8.2 | Rate limiting |
| **youtube-dl-exec** | 3.0 | YouTube video import |

### Infrastructure

| Service | Purpose |
|---------|---------|
| **Vercel** | Frontend hosting (Next.js) |
| **Railway** | Backend hosting (Express) |
| **Google Cloud Storage** | Video file storage |
| **Google Cloud Firestore** | Database |
| **Stripe** | Payment processing |
| **Supabase** (optional) | Authentication |

---

## User Management & Authentication

### Session Types

#### 1. Anonymous Users (No Supabase Configured)
```javascript
// Session ID generation with browser fingerprinting
const fingerprint = getCachedFingerprint() // Browser fingerprint
const randomPart = Math.random().toString(36).substr(2, 9)
const sessionId = `session_${randomPart}_${fingerprint.substring(3, 11)}`

// Stored in localStorage
localStorage.setItem('wandercut_session_id', sessionId)
```

**Fingerprinting Components:**
- Screen resolution
- Timezone
- Language
- Platform
- Color depth
- Hardware concurrency

**Purpose:** Prevent abuse by tracking users without requiring signup

#### 2. Authenticated Users (Supabase Configured)
```javascript
// Supabase user ID used as primary identifier
const userId = user.id // UUID from Supabase auth

// Stored in localStorage
localStorage.setItem('wandercut_user_id', userId)
```

### Dual Authentication Check

The app uses a dual authentication system to support both anonymous and authenticated users:

```typescript
// Check BOTH Supabase user AND sessionManager
const sessionInfo = getSessionInfo()
const hasValidSession = user || (sessionInfo && !isAnonymous())

// This ensures:
// - Authenticated users are recognized even if Supabase session expires
// - Anonymous users with valid sessions can use the app
// - UI shows correct state for both user types
```

### User Data Structure (Firestore)

```javascript
{
  userId: string,              // Supabase UUID or session_xxx for anonymous
  email: string | null,        // Only for authenticated users
  tier: 'anonymous' | 'free' | 'pro',

  // Usage tracking
  uploadsThisMonth: number,
  questionsThisMonth: number,
  lastUploadDate: Timestamp,
  lastQuestionDate: Timestamp,

  // Subscription
  stripeCustomerId: string | null,
  subscriptionId: string | null,

  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## Freemium Model & Usage Limits

### Tier Definitions

```javascript
const TIER_LIMITS = {
  anonymous: {
    uploads: 1,      // 1 video upload per month
    questions: 3,    // 3 questions per month
    requiresSignup: true
  },
  free: {
    uploads: 3,      // 3 video uploads per month
    questions: 15,   // 15 questions per month
    requiresSignup: false
  },
  pro: {
    uploads: -1,     // Unlimited (-1 = no limit)
    questions: -1,   // Unlimited
    requiresSignup: false
  }
}
```

### Quota Checking Flow

**Upload Quota:**
```javascript
// Backend: services/userService.js
async function checkUploadQuota(userId) {
  const user = await getUserFromDB(userId)
  const tier = user?.tier || 'anonymous'
  const limit = TIER_LIMITS[tier].uploads

  // Unlimited = -1
  if (limit === -1) return { canUpload: true, ... }

  // Check monthly usage
  const uploadsThisMonth = user?.uploadsThisMonth || 0
  const canUpload = uploadsThisMonth < limit

  return {
    canUpload,
    limit,
    remaining: limit - uploadsThisMonth,
    uploadsThisMonth,
    tier,
    requiresSignup: TIER_LIMITS[tier].requiresSignup
  }
}
```

**Question Quota:**
```javascript
// Similar pattern for questions
async function checkQuestionQuota(userId) {
  // ... same logic for questions
}
```

### Signup Wall Triggers

The `SignupWall` modal appears when:

1. **Upload limit reached:**
   - Anonymous user tries 2nd upload
   - Free user tries 4th upload

2. **Question limit reached:**
   - Anonymous user asks 4th question
   - Free user asks 16th question

```typescript
// Frontend: components/SignupWall.tsx
<SignupWall
  isOpen={showSignupWall}
  onClose={() => setShowSignupWall(false)}
  reason="video" | "question"
  currentUsage={{ used: 1, limit: 1 }}
  message="Sign up to get 15 questions per month!"
/>
```

### Monthly Reset

- Usage counters reset on the 1st of each month
- Backend checks `lastUploadDate` and `lastQuestionDate`
- If in different month, resets counters to 0

---

## API Endpoints Reference

### Base URL
- **Development:** `http://localhost:3001`
- **Production:** `https://wandercut-backend.up.railway.app`

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check (returns "OK") |
| `/api/health` | GET | Health check endpoint |

### Video Upload

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload video file |
| `/api/upload-youtube` | POST | Import from YouTube URL |

**Request Body (upload):**
```json
{
  "userId": "string",
  "file": "multipart/form-data"
}
```

**Response:**
```json
{
  "success": true,
  "projectId": "uuid",
  "message": "Upload successful"
}
```

**Error (Quota Exceeded):**
```json
{
  "error": "Upload limit reached",
  "message": "You've used your 1 free upload. Sign up to get 3 uploads per month!",
  "tier": "anonymous",
  "uploadsThisMonth": 1,
  "limit": 1,
  "requiresSignup": true
}
```

### Transcription

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transcribe` | POST | Start transcription for project |

**Request Body:**
```json
{
  "projectId": "string",
  "language": "en" | "fr" | "it" | "es"
}
```

### Q&A (Core Feature)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/qa` | POST | Ask question about video |

**Request Body:**
```json
{
  "projectId": "string",
  "userId": "string",
  "question": "string",
  "chatHistory": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "language": "en" | "fr" | "it" | "es"
}
```

**Response:**
```json
{
  "answer": "The speaker discusses climate change at 5:23 and 12:45...",
  "sources": [
    {"timestamp": 323, "text": "Climate change affects..."},
    {"timestamp": 765, "text": "We need to address..."}
  ],
  "tokensUsed": 1234
}
```

**Error (Quota Exceeded):**
```json
{
  "error": "Question limit reached",
  "message": "You've used your 3 free questions. Sign up to get 15 questions per month!",
  "tier": "anonymous",
  "questionsThisMonth": 3,
  "limit": 3,
  "requiresSignup": true
}
```

### Projects

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/:userId` | GET | Get all projects for user |
| `/api/projects/project/:projectId` | GET | Get single project details |

**Project Response:**
```json
{
  "id": "uuid",
  "userId": "string",
  "title": "My Video Title",
  "originalFileName": "video.mp4",
  "filePath": "gs://bucket/path/to/video.mp4",
  "thumbnail": "https://...",
  "transcription": "Full transcript text...",
  "status": "ready" | "processing" | "failed",
  "createdAt": "2025-11-21T10:00:00Z",
  "updatedAt": "2025-11-21T10:05:00Z"
}
```

### Topics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/topics/:projectId` | GET | Get topics/table of contents |

**Response:**
```json
{
  "topics": [
    {
      "name": "Introduction",
      "startTime": 0,
      "endTime": 120,
      "description": "Overview of the main concepts"
    },
    {
      "name": "Machine Learning Basics",
      "startTime": 120,
      "endTime": 450,
      "description": "Core ML concepts explained"
    }
  ]
}
```

### Conversations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/conversations/:userId` | GET | Get all conversations for user |
| `/api/conversations` | POST | Create new conversation |
| `/api/conversations/:conversationId` | PUT | Update conversation |
| `/api/conversations/:conversationId` | DELETE | Delete conversation |

### User Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/:userId` | GET | Get user data and usage stats |
| `/api/user/:userId/usage` | GET | Get detailed usage information |

**Usage Response:**
```json
{
  "tier": "free",
  "uploads": {
    "used": 1,
    "limit": 3,
    "remaining": 2
  },
  "questions": {
    "used": 5,
    "limit": 15,
    "remaining": 10
  }
}
```

### Subscriptions (Stripe)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/subscriptions/create-checkout-session` | POST | Create Stripe checkout |
| `/api/subscriptions/create-portal-session` | POST | Create billing portal session |
| `/api/subscriptions/status/:userId` | GET | Get subscription status |
| `/api/subscriptions/webhook` | POST | Stripe webhook handler |

---

## Frontend Structure

```
frontend/
├── app/                           # Next.js App Router
│   ├── page.tsx                  # Home page (upload or Q&A view)
│   ├── auth/
│   │   └── page.tsx              # Authentication page
│   ├── pricing/
│   │   └── page.tsx              # Pricing plans
│   └── layout.tsx                # Root layout
│
├── components/                    # React Components
│   ├── ModernHeader.tsx          # Main app header with auth status
│   ├── VideoUpload.tsx           # Video upload interface
│   ├── WanderMindViewer.tsx      # Main Q&A interface (split panel)
│   ├── VideoQA.tsx               # Q&A chat component
│   ├── ConversationHistory.tsx   # Sidebar with conversation list
│   ├── SignupWall.tsx            # Freemium limit modal
│   ├── Pricing.tsx               # Pricing cards
│   ├── Auth.tsx                  # Login/signup forms
│   ├── ProcessingProgress.tsx    # Upload progress indicator
│   └── UsageDashboard.tsx        # Usage stats display
│
├── contexts/                      # React Contexts
│   └── AuthContext.tsx           # Authentication state management
│
├── lib/                          # Utilities & Configuration
│   ├── sessionManager.ts         # Anonymous session tracking
│   ├── fingerprint.ts            # Browser fingerprinting
│   ├── conversationStorage.ts    # Conversation persistence
│   ├── i18n.ts                   # Internationalization config
│   └── supabase.ts               # Supabase client (optional)
│
├── public/                       # Static assets
│   └── locales/                  # Translation files
│       ├── en/
│       ├── fr/
│       ├── it/
│       └── es/
│
└── styles/                       # Global styles
    └── globals.css
```

### Key Frontend Components

#### 1. ModernHeader.tsx
- Shows login/signup button for anonymous users
- Displays user menu with account info for authenticated users
- Conversation history toggle (mobile)
- Pricing link
- Language selector
- Subscription status indicator

#### 2. VideoUpload.tsx
- Drag-and-drop file upload
- YouTube URL import
- Upload progress tracking
- Quota checking before upload
- SignupWall integration

#### 3. WanderMindViewer.tsx
**The core Q&A interface** - Split-panel layout:
- **Left:** Video player with transcript overlay
- **Right:** Chat interface for asking questions
- Real-time Q&A interaction
- Clickable timestamp citations
- Conversation switching
- Topic navigation

#### 4. ConversationHistory.tsx
- List of user's conversations
- Thumbnail + title display
- New conversation button
- Persistent across sessions

---

## Backend Structure

```
backend/
├── server.js                     # Express app entry point
│
├── routes/                       # API Route Handlers
│   ├── upload.js                # Video file upload
│   ├── uploadYoutube.js         # YouTube import
│   ├── transcribe.js            # Transcription endpoint
│   ├── qa.js                    # Q&A endpoint (CORE FEATURE)
│   ├── topics.js                # Topic extraction
│   ├── projects.js              # Project CRUD
│   ├── conversations.js         # Conversation management
│   ├── user.js                  # User data & usage
│   ├── subscriptions.js         # Stripe integration
│   ├── export.js                # Transcript export
│   ├── health.js                # Health checks
│   └── test-helpers.js          # Dev-only test utilities
│
├── services/                     # Business Logic
│   ├── videoQAService.js        # Q&A processing with AI (CORE)
│   ├── videoAnalysisService.js  # Video analysis & topics
│   ├── transcriptionService.js  # Transcription logic
│   ├── userService.js           # User management & quotas
│   ├── userMemoryService.js     # Conversation memory
│   └── ffmpegService.js         # Video processing (thumbnails)
│
├── utils/                        # Helper Functions
│   ├── mockStorage.js           # In-memory storage for dev
│   └── validators.js            # Input validation
│
├── uploads/                      # Temporary upload directory
├── processed/                    # Processed files directory
└── temp/                         # Temporary files
```

### Key Backend Services

#### 1. videoQAService.js (CORE)
**This is the heart of Lurnia.**

- Processes user questions about video content
- Integrates with AI models (Gemini, Claude, GPT)
- Manages conversation context
- Extracts timestamp references
- Generates answers with citations

#### 2. userService.js
- User CRUD operations
- **Quota checking** (`checkUploadQuota`, `checkQuestionQuota`)
- Usage tracking
- Monthly reset logic
- Tier management

#### 3. transcriptionService.js
- Google Cloud Speech-to-Text integration
- AssemblyAI fallback
- Language detection
- Timestamp extraction
- Error handling

#### 4. userMemoryService.js
- Conversation history management
- Context retrieval for Q&A
- Memory pruning for token limits

---

## Database Schema

### Firestore Collections

#### `users`
```javascript
{
  userId: string,                 // Primary key
  email: string | null,
  tier: 'anonymous' | 'free' | 'pro',

  // Usage counters
  uploadsThisMonth: number,
  questionsThisMonth: number,
  lastUploadDate: Timestamp,
  lastQuestionDate: Timestamp,

  // Stripe
  stripeCustomerId: string | null,
  subscriptionId: string | null,

  // Metadata
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `projects`
```javascript
{
  id: string,                     // Primary key (UUID)
  userId: string,                 // Foreign key to users

  // File info
  title: string,
  originalFileName: string,
  filePath: string,               // GCS path or local path
  fileSize: number,               // Bytes
  duration: number,               // Seconds

  // Processing
  status: 'uploading' | 'processing' | 'ready' | 'failed',
  transcription: string | null,
  transcriptionLanguage: string,
  topics: Array<Topic>,
  thumbnail: string,              // URL or path
  thumbnails: Array<{url, timestamp}>,

  // Metadata
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `conversations`
```javascript
{
  id: string,                     // Primary key (UUID)
  userId: string,                 // Foreign key to users
  projectId: string,              // Foreign key to projects

  // Conversation data (Q&A exchanges)
  messages: Array<{
    role: 'user' | 'assistant',
    content: string,
    timestamp: Timestamp,
    citations: Array<{timestamp, text}>  // For assistant messages
  }>,

  // Metadata
  title: string,                  // Auto-generated or custom
  videoTitle: string,
  videoThumbnail: string,
  lastMessageAt: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### LocalStorage (Frontend)

#### Session & User ID
```javascript
// Key: 'wandercut_session_id'
// Value: 'session_abc123_fp8d7f9s'

// Key: 'wandercut_user_id'
// Value: 'uuid-from-supabase' or null
```

#### Current Project
```javascript
// Key: 'currentProject_{userId}' or 'currentProject'
// Value: 'project-uuid'
```

#### Conversations
```javascript
// Key: 'conversations_{userId}'
// Value: JSON array of conversation metadata
[
  {
    id: 'uuid',
    projectId: 'uuid',
    title: 'Video Title',
    videoThumbnail: 'url',
    lastMessageAt: 'timestamp',
    createdAt: 'timestamp'
  }
]
```

---

## Deployment Infrastructure

### Frontend: Vercel

**URL:** `https://lurnia.app` (production)

**Configuration:**
- Framework Preset: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
- Node Version: 18.x

**Environment Variables:**
```
NEXT_PUBLIC_API_URL=https://wandercut-backend.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

**Deployment:**
- Auto-deploy on push to `main` branch
- Preview deployments for pull requests
- Build time: ~2-3 minutes

### Backend: Railway

**URL:** `https://wandercut-backend.up.railway.app`

**Configuration:**
- Start Command: `npm start`
- Health Check: `GET /api/health`
- Port: Auto-assigned by Railway (read from `process.env.PORT`)
- Region: US-West (or configured)

**Environment Variables:**
```
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://lurnia.app

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=lurnia-prod
GOOGLE_CLOUD_STORAGE_BUCKET=lurnia-videos
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}

# AI APIs
GEMINI_API_KEY=AIzaSyxxx...
ANTHROPIC_API_KEY=sk-ant-xxx...
OPENAI_API_KEY=sk-xxx...

# Transcription
ASSEMBLYAI_API_KEY=xxx...

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx...
STRIPE_WEBHOOK_SECRET=whsec_xxx...

# Optional: Supabase (if using auth)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

**Deployment:**
- Auto-deploy on push to `main` branch
- Health checks every 30 seconds
- Automatic restarts on failure
- Build time: ~3-5 minutes

**Recent Fixes:**
- ✅ Removed explicit host binding (let Railway auto-configure)
- ✅ Trust proxy configured for rate limiting
- ✅ CORS trailing slash fix
- ✅ Health check endpoints before middleware

---

## Environment Configuration

### Backend `.env`

```bash
# Server
PORT=3001
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Google Cloud (Required for production)
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_STORAGE_BUCKET=your_bucket_name
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}

# AI Services (At least one required)
GEMINI_API_KEY=AIzaSy...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Transcription (At least one required)
GOOGLE_CLOUD_SPEECH_API_KEY=xxx    # Or use credentials JSON above
ASSEMBLYAI_API_KEY=xxx

# Stripe (Required for payments)
STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Supabase (for authentication)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Frontend `.env.local`

```bash
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001

# Optional: Supabase (for authentication)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Stripe (for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_...
```

---

## Recent Improvements

### November 21, 2025

#### 1. Dual Authentication System Fix
**Problem:** Users authenticated with Supabase couldn't see their account menu after session expired, even though backend still recognized them via sessionManager.

**Solution:**
- Updated `ModernHeader.tsx` to check BOTH Supabase user AND sessionManager
- Added `hasValidSession = user || (sessionInfo && !isAnonymous())`
- Fixed all menu visibility conditions
- **Commit:** `d58b6e5`

#### 2. Conversation Access Fix
**Problem:** Users could see conversation list but couldn't click to access them due to localStorage key mismatch.

**Solution:**
- Fixed all localStorage operations in `page.tsx` to use consistent userId-based keys
- Updated 5 locations: project restoration, URL params, navigation, creation
- Pattern: `currentProject_{userId}` for authenticated, `currentProject` for truly anonymous
- **Commit:** `fc9d16e`

#### 3. Login Button for Anonymous Users
**Problem:** No clear path for anonymous users to sign up/login.

**Solution:**
- Added prominent login/signup button in header for desktop
- Added login button in mobile menu
- Buttons only show when `!hasValidSession`
- Gradient blue-to-purple design matching app style
- **Commit:** `4cf84f3`

#### 4. Stripe Invalid Customer Error Fix
**Problem:** Old test data had invalid Stripe customer IDs causing repeated error logs and app inconsistency.

**Solution:**
- Detect `resource_missing` errors for invalid customers
- Auto-clear invalid `stripeCustomerId` from database
- Return graceful fallback to free tier
- Applied to both subscription status and portal session endpoints
- Self-healing: removes bad data permanently on first encounter
- **Commit:** `b14a25e`

#### 5. Railway Deployment Stability
**Problem:** Backend containers killed after 3-6 seconds on Railway.

**Solution:**
- Removed explicit host binding (`0.0.0.0` and `::`), let Railway auto-configure
- Added `app.set('trust proxy', 1)` for correct IP detection behind reverse proxy
- Moved health check endpoints BEFORE all middleware
- **Commit:** `2a63981`

#### 6. CORS Trailing Slash Fix
**Problem:** CORS origin had trailing slash but browser sent without, causing mismatch.

**Solution:**
- Strip trailing slashes from `FRONTEND_URL` in server.js
- Pattern: `corsOrigin.replace(/\/$/, '')`
- **Commit:** `7b2ac8b` (from previous session)

---

## Development Workflow

### Local Development

1. **Install dependencies:**
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. **Configure environment:**
   - Copy `.env.example` to `.env` in both frontend and backend
   - Fill in API keys and configuration

3. **Start development servers:**
   ```bash
   # Terminal 1: Frontend
   cd frontend && npm run dev

   # Terminal 2: Backend
   cd backend && npm run dev
   ```

4. **Access app:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

### Testing

**Manual Testing Checklist:**
- [ ] Upload video (check quota)
- [ ] YouTube import
- [ ] Transcription completion
- [ ] **Ask questions about video content** (core feature)
- [ ] **Verify timestamp citations work**
- [ ] Check question quota enforcement
- [ ] Signup wall appears at limits
- [ ] Authentication flow (if Supabase configured)
- [ ] Conversation persistence
- [ ] Conversation switching
- [ ] Stripe checkout flow
- [ ] Subscription upgrade/downgrade

### Deployment

**Frontend (Vercel):**
```bash
git push origin main
# Vercel auto-deploys
```

**Backend (Railway):**
```bash
git push origin main
# Railway auto-deploys
```

**Post-Deployment Checks:**
- [ ] Health check responds: `curl https://backend-url/api/health`
- [ ] Frontend loads: Visit frontend URL
- [ ] CORS working: Check browser console for errors
- [ ] Database connectivity: Try uploading a video
- [ ] Q&A works: Ask a question about uploaded video
- [ ] Stripe webhooks: Check webhook logs in Stripe dashboard

---

## Troubleshooting

### Common Issues

#### 1. "CORS Error" in Browser Console
**Cause:** CORS origin mismatch
**Fix:** Ensure `FRONTEND_URL` in backend matches exact frontend URL (no trailing slash)

#### 2. "Question limit reached" but I'm Pro
**Cause:** Stripe webhook didn't fire or subscription not synced
**Fix:**
- Check Stripe webhook logs
- Manually update user tier in Firestore
- Re-trigger webhook by updating subscription in Stripe dashboard

#### 3. Conversations not loading
**Cause:** localStorage key mismatch
**Fix:**
- Check browser localStorage keys
- Should be `currentProject_{userId}` format
- Clear localStorage and re-login if needed

#### 4. Railway container keeps restarting
**Cause:** Health check failures or port binding issues
**Fix:**
- Check Railway logs for exact error
- Ensure no explicit host binding in server.js
- Verify health check endpoint returns 200 OK

#### 5. Transcription not starting
**Cause:** Missing API keys or GCS credentials
**Fix:**
- Verify `GEMINI_API_KEY` or `ASSEMBLYAI_API_KEY` is set
- Check `GOOGLE_APPLICATION_CREDENTIALS_JSON` is valid JSON
- Check backend logs for specific transcription errors

#### 6. Q&A responses are slow or fail
**Cause:** AI API issues or rate limiting
**Fix:**
- Check AI API keys are valid
- Monitor AI API quotas/limits
- Check backend logs for specific AI errors
- Consider switching AI providers (Gemini → Claude → GPT)

---

## Security Considerations

### Implemented Security Measures

1. **Helmet.js** - Security headers configured
2. **Rate Limiting** - Per-IP rate limits on all API endpoints
3. **CORS** - Restricted to frontend origin only
4. **Trust Proxy** - Correct IP detection behind reverse proxies
5. **Input Validation** - All user inputs validated before processing
6. **Stripe Webhook Verification** - Signature verification for webhook events
7. **Fingerprinting** - Prevents VPN/cookie bypass for anonymous users

### Best Practices

- Never commit `.env` files
- Rotate API keys regularly
- Monitor Stripe webhook logs
- Set up error tracking (Sentry recommended)
- Enable Firestore security rules in production
- Use Stripe test mode for development

---

## Future Enhancements

### Planned Features

- [ ] **Advanced search in conversation history** - Full-text search across all Q&A
- [ ] **Export transcript with timestamps** - Download full transcript as PDF/TXT
- [ ] **Share conversations** - Public links to Q&A sessions
- [ ] **Video highlights** - Auto-generate clips based on Q&A insights
- [ ] **Batch upload** - Process multiple videos at once
- [ ] **API access for Pro users** - Programmatic access to Q&A
- [ ] **Mobile app** - React Native version
- [ ] **Collaborative Q&A** - Team workspaces for shared videos
- [ ] **Advanced analytics** - Track most-asked questions, popular topics

### Technical Improvements

- [ ] Add comprehensive unit tests
- [ ] Add E2E tests (Playwright/Cypress)
- [ ] Implement proper logging system (Winston/Pino)
- [ ] Add monitoring (Datadog/New Relic)
- [ ] Optimize transcription pipeline
- [ ] Implement caching layer (Redis) for frequently-asked questions
- [ ] Database query optimization
- [ ] WebSocket support for real-time Q&A updates

---

## Resources & Documentation

### Official Docs
- [Next.js Documentation](https://nextjs.org/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Google Cloud Firestore](https://cloud.google.com/firestore/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Railway Documentation](https://docs.railway.app)
- [Vercel Documentation](https://vercel.com/docs)

### AI Model Documentation
- [Google Gemini API](https://ai.google.dev/docs)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)

### Internal Docs
- `README.md` - Quick start guide
- `TECHNICAL_OVERVIEW.md` - This document
- Individual component comments in source code

---

**App Name:** Lurnia
**Tagline:** Turn video content into searchable knowledge
**Document Version:** 1.0
**Last Updated:** November 21, 2025
**Maintained By:** Development Team
