const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - REQUIRED for Railway/Heroku/any cloud platform behind reverse proxy
// This allows express-rate-limit to correctly identify users by IP
app.set('trust proxy', 1);

// Health check endpoints - MUST be before all middleware to avoid being blocked
// Railway health checks need immediate 200 OK response with no processing
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

app.get('/api/health', (req, res) => {
  res.status(200).send('OK');
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API, configure if serving HTML
  crossOriginEmbedderPolicy: false,
}));

// Rate limiters
// General API rate limit - 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for expensive upload operations - 10 per hour
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Upload limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit for Q&A operations - 20 per minute
const qaLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Too many questions. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit for channel import operations - 5 per hour
const channelLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Channel import limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
// Strip trailing slashes from CORS origin to avoid mismatch issues
const corsOrigin = (process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

// Stripe webhook needs raw body, so register it before json middleware
const subscriptionsRouter = require('./routes/subscriptions');
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }), subscriptionsRouter.webhookHandler);

// JSON body parser with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve uploaded files in development mode
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve processed files
app.use('/processed', express.static(path.join(__dirname, 'processed')));

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
const processedDir = path.join(__dirname, 'processed');
const tempDir = path.join(__dirname, 'temp');

[uploadsDir, processedDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Apply general rate limiter to all API routes
app.use('/api/', apiLimiter);

// Routes with specific rate limits
app.use('/api/upload', uploadLimiter, require('./routes/upload'));
app.use('/api/upload-youtube', uploadLimiter, require('./routes/uploadYoutube'));
app.use('/api/qa', qaLimiter, require('./routes/qa'));

// Routes with general rate limiting only
app.use('/api/transcribe', require('./routes/transcribe'));
app.use('/api/edit', require('./routes/edit'));
app.use('/api/topics', require('./routes/topics')); // Topic clustering & table of contents
app.use('/api/projects', require('./routes/projects'));
app.use('/api/user', require('./routes/user'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/export', require('./routes/export'));
app.use('/api/subscriptions', subscriptionsRouter); // Stripe subscriptions (webhook is registered above with raw body)
app.use('/api/channel', channelLimiter, require('./routes/channel')); // YouTube channel import

// Test helpers (DEVELOPMENT ONLY - disable in production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/test', require('./routes/test-helpers'));
}

app.listen(PORT, () => {
  console.log(`🚀 WanderCut Backend running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 Google Cloud Project: ${process.env.GOOGLE_CLOUD_PROJECT_ID ? 'Configured' : 'Not configured'}`);
  console.log(`🔄 Deployment timestamp: ${new Date().toISOString()}`);
  console.log(`📝 Latest commit: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown'}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(`   Please either:`);
    console.error(`   1. Stop the process using port ${PORT}`);
    console.error(`   2. Set a different PORT in your .env file`);
    console.error(`   3. On Windows, run: netstat -ano | findstr :${PORT} to find the process`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

