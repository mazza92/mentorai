const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const videoProcessor = require('../services/videoProcessor');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Initialize Google Cloud services with error handling
let firestore;
let gcsStorage;
let bucket;
let useMockMode = false;

try {
  if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id') {
    firestore = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    gcsStorage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    if (process.env.GOOGLE_CLOUD_STORAGE_BUCKET && process.env.GOOGLE_CLOUD_STORAGE_BUCKET !== 'your_bucket_name') {
      bucket = gcsStorage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET);
    } else {
      useMockMode = true;
    }
  } else {
    useMockMode = true;
  }
} catch (error) {
  useMockMode = true;
  console.log('Google Cloud not configured, using local file storage for development');
}

router.post('/', async (req, res) => {
  try {
    const { projectId, userId } = req.body;

    if (!projectId || !userId) {
      return res.status(400).json({ error: 'Project ID and User ID are required' });
    }

    // Get user info
    const userDoc = await firestore.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userDoc.data();
    const tier = user.tier || 'free';
    const exportsThisMonth = user.exportsThisMonth || 0;

    // Check export limits
    const limits = {
      free: 3,
      creator: Infinity,
    };
    const limit = limits[tier] || 3;

    if (exportsThisMonth >= limit) {
      return res.status(403).json({
        error: 'Export limit reached',
        tier,
        exportsThisMonth,
        limit,
      });
    }

    // Get project
    const projectDoc = await firestore.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectDoc.data();
    const processedVideoPath = project.processedGcsPath || project.gcsPath;

    // Download processed video
    const tempInputPath = path.join(__dirname, '../temp', `export-input-${projectId}.mp4`);
    await bucket.file(processedVideoPath).download({ destination: tempInputPath });

    // Apply tier-based processing
    let finalOutputPath = tempInputPath;
    const tempFiles = [tempInputPath];

    // For free tier: add watermark and reduce resolution to 720p
    if (tier === 'free') {
      const watermarkedPath = path.join(__dirname, '../temp', `watermarked-${projectId}.mp4`);
      tempFiles.push(watermarkedPath);
      await videoProcessor.addWatermark(tempInputPath, watermarkedPath, 'WanderCut');
      
      // Resize to 720p
      const resizedPath = path.join(__dirname, '../temp', `resized-${projectId}.mp4`);
      tempFiles.push(resizedPath);
      const ffmpeg = require('fluent-ffmpeg');
      await new Promise((resolve, reject) => {
        ffmpeg(watermarkedPath)
          .size('1280x720')
          .output(resizedPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      
      finalOutputPath = resizedPath;
    }

    // Upload final export to GCS
    const exportGcsPath = `exports/${userId}/${projectId}/export-${Date.now()}.mp4`;
    await bucket.upload(finalOutputPath, {
      destination: exportGcsPath,
      metadata: {
        contentType: 'video/mp4',
      },
    });

    const exportUrl = `https://storage.googleapis.com/${bucket.name}/${exportGcsPath}`;

    // Increment export count
    await firestore.collection('users').doc(userId).update({
      exportsThisMonth: exportsThisMonth + 1,
      updatedAt: new Date(),
    });

    // Clean up temp files
    tempFiles.forEach(file => {
      if (fs.existsSync(file) && file !== tempInputPath) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          console.warn(`Failed to delete temp file ${file}:`, err);
        }
      }
    });

    res.json({
      success: true,
      exportUrl,
      tier,
      exportsThisMonth: exportsThisMonth + 1,
      limit,
    });
  } catch (error) {
    console.error('Export error:', error);
    
    // Clean up temp files on error
    const tempFiles = [
      path.join(__dirname, '../temp', `export-input-${req.body?.projectId}.mp4`),
      path.join(__dirname, '../temp', `watermarked-${req.body?.projectId}.mp4`),
      path.join(__dirname, '../temp', `resized-${req.body?.projectId}.mp4`),
    ];
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    });
    
    res.status(500).json({ error: 'Failed to export video', details: error.message });
  }
});

module.exports = router;

