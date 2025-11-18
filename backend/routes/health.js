const express = require('express');
const router = express.Router();

// Health check endpoint with environment diagnostics
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasGoogleCloudProjectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
      hasGoogleCredentialsJson: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      googleProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentialsJsonLength: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.length || 0,
    },
  });
});

module.exports = router;
