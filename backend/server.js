const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());

// Stripe webhook needs raw body, so register it before json middleware
const subscriptionsRouter = require('./routes/subscriptions');
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }), subscriptionsRouter.webhookHandler);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Routes
app.use('/api/upload', require('./routes/upload'));
app.use('/api/upload-youtube', require('./routes/uploadYoutube'));
app.use('/api/transcribe', require('./routes/transcribe'));
app.use('/api/edit', require('./routes/edit'));
app.use('/api/qa', require('./routes/qa'));
app.use('/api/topics', require('./routes/topics')); // Topic clustering & table of contents
app.use('/api/projects', require('./routes/projects'));
app.use('/api/user', require('./routes/user'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/export', require('./routes/export'));
app.use('/api/subscriptions', subscriptionsRouter); // Stripe subscriptions (webhook is registered above with raw body)

// Test helpers (DEVELOPMENT ONLY - disable in production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/test', require('./routes/test-helpers'));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'WanderCut API is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 WanderCut Backend running on port ${PORT}`);
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

