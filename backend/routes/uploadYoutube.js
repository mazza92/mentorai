const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const { v4: uuidv4 } = require('uuid');
const youtubeService = require('../services/youtubeService');
const videoAnalysisService = require('../services/videoAnalysisService');
const { mockProjects } = require('../utils/mockStorage');
const axios = require('axios');

const router = express.Router();

// Initialize Firestore with error handling
let firestore;
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
        console.log('✅ Using Google Cloud credentials from environment variable');
      } catch (error) {
        console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', error.message);
        throw error;
      }
    }

    firestore = new Firestore(firestoreConfig);
  } else {
    useMockMode = true;
    console.log('Google Cloud not configured, using mock storage for development');
  }
} catch (error) {
  useMockMode = true;
  console.log('Google Cloud initialization failed, using mock storage for development');
  console.log('Error:', error.message);
}

/**
 * POST /api/upload-youtube
 * Download video from YouTube URL and create project
 */
router.post('/', async (req, res) => {
  try {
    const { youtubeUrl, userId } = req.body;

    if (!youtubeUrl) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Validate YouTube URL
    if (!youtubeService.isValidYouTubeUrl(youtubeUrl)) {
      return res.status(400).json({ error: 'Invalid YouTube URL. Please provide a valid YouTube link.' });
    }

    // Check video quota before processing
    try {
      const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
      const quotaResponse = await axios.post(`${baseUrl}/api/user/${userId}/check-video`);
      const { canProcess, limit, remaining, videosThisMonth } = quotaResponse.data;

      if (!canProcess) {
        return res.status(403).json({
          error: 'Video limit reached',
          message: `You've reached your monthly video limit. You've processed ${videosThisMonth}/${limit} videos this month.`,
          limit,
          videosThisMonth,
          upgradeRequired: true
        });
      }

      console.log(`User ${userId} has ${remaining} videos remaining this month`);
    } catch (quotaError) {
      console.error('Error checking video quota:', quotaError.message);
      // Continue even if quota check fails (graceful degradation)
    }

    console.log('Starting YouTube video download:', youtubeUrl);

    // Download video and extract audio
    const { videoPath, audioPath, metadata } = await youtubeService.downloadVideo(youtubeUrl);

    console.log('YouTube download complete:', metadata.title);

    // Create project
    const projectId = uuidv4();
    const project = {
      id: projectId,
      userId,
      title: metadata.title,
      description: metadata.description,
      duration: metadata.duration,
      thumbnail: metadata.thumbnail,
      author: metadata.author,
      youtubeUrl: metadata.youtubeUrl,
      youtubeVideoId: metadata.videoId,
      views: metadata.views,
      likes: metadata.likes,
      subscribers: metadata.subscribers,
      localVideoPath: videoPath,
      localAudioPath: audioPath,
      status: 'uploaded',
      transcriptionStatus: 'pending',
      analysisStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store project
    if (useMockMode || !firestore) {
      mockProjects.set(projectId, project);
      console.log('Project created in mock storage:', projectId);
    } else {
      await firestore.collection('projects').doc(projectId).set(project);
      console.log('Project created in Firestore:', projectId);
    }

    // Increment video count for user (don't block response)
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    axios.post(`${baseUrl}/api/user/${userId}/increment-video`)
      .then(response => {
        console.log(`Video count incremented for user ${userId}:`, response.data.videosThisMonth);
      })
      .catch(error => {
        console.error('Error incrementing video count:', error.message);
      });

    // Start transcription in background (don't wait for it)
    console.log('Starting background transcription...');
    setTimeout(async () => {
      try {
        const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
        await axios.post(`${baseUrl}/api/transcribe`, {
          projectId,
        });
        console.log('Background transcription complete for project:', projectId);
      } catch (error) {
        console.error('Background transcription failed:', error.message);
      }
    }, 10000); // 10-second delay to avoid overwhelming Gemini API immediately

    // Start video analysis with delay to avoid competing with transcription
    const videoDuration = metadata.duration || 0;
    if (videoDuration <= 1800) { // Only for videos <= 30 minutes
      // Delay video analysis by 60 seconds to give transcription a head start
      setTimeout(() => {
        console.log('Starting background video analysis (after 60s delay)...');
        videoAnalysisService.analyzeVideo(videoPath, '').then(async (analysis) => {
          console.log('Video analysis complete for project:', projectId);

          // Update project with analysis
          if (useMockMode || !firestore) {
            const existingProject = mockProjects.get(projectId);
            if (existingProject) {
              existingProject.videoAnalysis = analysis;
              existingProject.analysisStatus = 'completed';
              existingProject.updatedAt = new Date();
              mockProjects.set(projectId, existingProject);
            }
          } else {
            await firestore.collection('projects').doc(projectId).update({
              videoAnalysis: analysis,
              analysisStatus: 'completed',
              updatedAt: new Date(),
            });
          }
        }).catch(error => {
          console.error('Background video analysis failed:', error);
          // Mark as failed instead of leaving as pending
          if (useMockMode || !firestore) {
            const existingProject = mockProjects.get(projectId);
            if (existingProject) {
              existingProject.analysisStatus = 'failed';
              existingProject.updatedAt = new Date();
              mockProjects.set(projectId, existingProject);
            }
          } else {
            firestore.collection('projects').doc(projectId).update({
              analysisStatus: 'failed',
              updatedAt: new Date(),
            });
          }
        });
      }, 60000); // 60-second delay (transcription starts after 10s, so this is 50s after that)
    } else {
      // For long videos (>30 min), skip video analysis
      console.log('Skipping video analysis (video > 30 minutes)');
      if (useMockMode || !firestore) {
        const existingProject = mockProjects.get(projectId);
        if (existingProject) {
          existingProject.analysisStatus = 'skipped';
          existingProject.updatedAt = new Date();
          mockProjects.set(projectId, existingProject);
        }
      } else {
        await firestore.collection('projects').doc(projectId).update({
          analysisStatus: 'skipped',
          updatedAt: new Date(),
        });
      }
    }

    res.json({
      success: true,
      projectId,
      project: {
        id: projectId,
        title: metadata.title,
        duration: metadata.duration,
        thumbnail: metadata.thumbnail,
        author: metadata.author,
        youtubeUrl: metadata.youtubeUrl,
      },
      message: 'YouTube video downloaded successfully. Starting transcription and analysis...',
    });
  } catch (error) {
    console.error('YouTube upload error:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to download YouTube video';
    let errorDetails = error.message;
    
    // Check for specific error types
    if (error.message && error.message.includes('python3')) {
      errorMessage = 'Server configuration error: Python 3 is required for YouTube downloads';
      errorDetails = 'The server is missing Python 3. Please contact support.';
    } else if (error.message && error.message.includes('yt-dlp')) {
      errorMessage = 'YouTube downloader error';
      errorDetails = error.message;
    } else if (error.message && error.message.includes('FFmpeg')) {
      errorMessage = 'Video processing error: FFmpeg is required';
      errorDetails = 'The server is missing FFmpeg. Please contact support.';
    }
    
    res.status(500).json({
      error: errorMessage,
      details: errorDetails,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /api/upload-youtube/status/:projectId
 * Get processing status for a YouTube video
 */
router.get('/status/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    let project;
    if (useMockMode || !firestore) {
      project = mockProjects.get(projectId);
    } else {
      const doc = await firestore.collection('projects').doc(projectId).get();
      if (doc.exists) {
        project = doc.data();
      }
    }

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      success: true,
      status: {
        transcription: project.transcriptionStatus || 'pending',
        analysis: project.analysisStatus || 'pending',
        hasTranscript: !!project.transcript,
        hasAnalysis: !!project.videoAnalysis,
      },
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to get project status' });
  }
});

module.exports = router;
