const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Storage } = require('@google-cloud/storage');
const { Firestore } = require('@google-cloud/firestore');
const userService = require('../services/userService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|mkv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only video files (MP4, MOV, AVI, MKV) are allowed'));
    }
  },
});

// Initialize Google Cloud services with error handling
let firestore;
let gcsStorage;
let bucket;
let useMockMode = false;

try {
  if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id') {
    const firestoreConfig = {

      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,

    };


    // Handle credentials from Railway environment variable

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {

      try {

        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

        firestoreConfig.credentials = credentials;

      } catch (error) {

        console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON');

        throw error;

      }

    }


    firestore = new Firestore(firestoreConfig);
    gcsStorage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    if (process.env.GOOGLE_CLOUD_STORAGE_BUCKET && process.env.GOOGLE_CLOUD_STORAGE_BUCKET !== 'your_bucket_name') {
      bucket = gcsStorage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET);
    }
  } else {
    useMockMode = true;
    console.log('Google Cloud not configured, using local file storage for development');
  }
} catch (error) {
  useMockMode = true;
  console.log('Google Cloud initialization failed, using local file storage for development');
}

// Use shared mock storage
const { mockProjects } = require('../utils/mockStorage');

router.post('/', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const userId = req.body.userId || 'anonymous'; // In production, get from auth token

    // Check video upload quota
    try {
      const quota = await userService.checkVideoQuota(userId);

      if (!quota.canProcess) {
        // Delete the uploaded file since we're rejecting it
        const fs = require('fs');
        fs.unlinkSync(req.file.path);

        return res.status(403).json({
          error: 'Upload limit reached',
          message: quota.requiresSignup
            ? `You've used your ${quota.limit} free upload${quota.limit > 1 ? 's' : ''}. Sign up to get ${quota.tier === 'anonymous' ? '3' : 'more'} uploads per month!`
            : `You've reached your monthly upload limit. You've uploaded ${quota.videosThisMonth}/${quota.limit} videos this month.`,
          tier: quota.tier,
          videosThisMonth: quota.videosThisMonth,
          limit: quota.limit,
          requiresSignup: quota.requiresSignup, // Trigger signup wall
          upgradeRequired: !quota.requiresSignup
        });
      }

      console.log(`User ${userId} (${quota.tier}): ${quota.videosThisMonth + 1}/${quota.limit} uploads used`);
    } catch (quotaError) {
      console.error('Error checking upload quota:', quotaError.message);
      // Continue with upload if quota check fails (graceful degradation)
    }

    const projectId = uuidv4();
    const fileName = req.file.filename;
    const filePath = req.file.path;

    // Use mock mode if Google Cloud is not configured
    if (useMockMode || !bucket || !firestore) {
      // Store file locally, create full URL with backend host
      const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
      const publicUrl = `${backendUrl}/uploads/${fileName}`;
      
      const projectData = {
        projectId,
        userId,
        originalFileName: req.file.originalname,
        fileName,
        filePath: filePath,
        publicUrl,
        status: 'uploaded',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in memory for mock mode
      mockProjects.set(projectId, projectData);

      console.log('Project saved after upload. Project ID:', projectId);
      console.log('All projects in storage after upload:', Array.from(mockProjects.keys()));

      // Increment video count
      await userService.incrementVideoCount(userId);

      return res.json({
        success: true,
        projectId,
        fileName: req.file.originalname,
        publicUrl,
        message: 'Video uploaded successfully (development mode - using local storage)',
      });
    }

    // Upload to Google Cloud Storage
    const gcsFileName = `videos/${userId}/${projectId}/${fileName}`;
    await bucket.upload(filePath, {
      destination: gcsFileName,
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${gcsFileName}`;

    // Save project metadata to Firestore
    const projectData = {
      projectId,
      userId,
      originalFileName: req.file.originalname,
      fileName,
      gcsPath: gcsFileName,
      publicUrl,
      status: 'uploaded',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await firestore.collection('projects').doc(projectId).set(projectData);

    // Increment video count
    await userService.incrementVideoCount(userId);

    res.json({
      success: true,
      projectId,
      fileName: req.file.originalname,
      publicUrl,
      message: 'Video uploaded successfully',
    });
  } catch (error) {
    // Fallback to mock mode on error
    if (error.code === 'ENOTFOUND' || error.message.includes('credentials') || error.message.includes('Could not load the default credentials')) {
      console.log('Using local file storage for development');
      const userId = req.body.userId || 'anonymous';
      const projectId = uuidv4();
      const fileName = req.file.filename;
      const filePath = req.file.path;
      const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
      const publicUrl = `${backendUrl}/uploads/${fileName}`;
      
      const projectData = {
        projectId,
        userId,
        originalFileName: req.file.originalname,
        fileName,
        filePath: filePath,
        publicUrl,
        status: 'uploaded',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockProjects.set(projectId, projectData);

      return res.json({
        success: true,
        projectId,
        fileName: req.file.originalname,
        publicUrl,
        message: 'Video uploaded successfully (development mode)',
      });
    }
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload video', details: error.message });
  }
});

module.exports = router;

