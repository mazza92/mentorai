const express = require('express');
const router = express.Router();
const channelService = require('../services/channelService');
const simpleChannelService = require('../services/simpleChannelService');
const videoQAService = require('../services/videoQAService');
const userService = require('../services/userService');
const { getFirestore } = require('../config/firestore');
const youtubeInnertubeService = require('../services/youtubeInnertubeService');
const { FieldValue } = require('@google-cloud/firestore');

/**
 * POST /api/channel/import
 * Import YouTube channel with Innertube caption scraping
 * - Fetches metadata + transcripts using Innertube API (fast, free)
 * - Falls back to audio transcription if captions unavailable
 * - 2-5 minutes for full channel with transcripts
 */
router.post('/import', async (req, res) => {
  try {
    const { channelUrl, userId } = req.body;

    console.log(`[API] Channel import requested by user ${userId}: ${channelUrl}`);

    if (!channelUrl) {
      return res.status(400).json({
        success: false,
        error: 'Channel URL is required'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Check channel import quota
    const quotaCheck = await userService.checkChannelQuota(userId);

    if (!quotaCheck.canImport) {
      return res.status(403).json({
        success: false,
        error: 'Channel import limit reached',
        message: `You have reached your monthly limit of ${quotaCheck.limit} channel imports. Upgrade to Pro for more!`,
        quota: {
          used: quotaCheck.channelsThisMonth,
          limit: quotaCheck.limit,
          remaining: quotaCheck.remaining,
          tier: quotaCheck.tier
        }
      });
    }

    // Extract channel ID from URL
    let channelId = channelUrl;

    // Handle different URL formats
    if (channelUrl.includes('youtube.com')) {
      if (channelUrl.includes('/channel/')) {
        channelId = channelUrl.split('/channel/')[1].split('/')[0].split('?')[0];
      } else if (channelUrl.includes('/@')) {
        channelId = channelUrl.split('/@')[1].split('/')[0].split('?')[0];
      }
    }

    console.log(`[API] Resolved channel ID: ${channelId}`);

    // Check channel size before importing (fetch metadata first)
    const channelInfo = await simpleChannelService.fetchChannelInfo(channelId);
    const MAX_VIDEOS = 500;

    if (channelInfo.videoCount > MAX_VIDEOS) {
      console.log(`[API] Channel too large: ${channelInfo.videoCount} videos (max: ${MAX_VIDEOS})`);
      return res.status(400).json({
        success: false,
        error: 'channel_too_large',
        message: `This channel has ${channelInfo.videoCount} videos, which exceeds our limit of ${MAX_VIDEOS} videos. For very large channels, please use the "Single Video" mode to import specific videos.`,
        channelName: channelInfo.title,
        videoCount: channelInfo.videoCount,
        limit: MAX_VIDEOS,
        suggestion: 'single_video'
      });
    }

    // Step 1: Quick import - get channel info and video list (no transcripts, returns in 1-2s)
    const quickImport = await simpleChannelService.importChannel(channelId, userId, {
      fetchTranscripts: false, // Don't fetch ANY transcripts - do it all in background
      maxVideosToTranscribe: null,
      concurrency: 3 // Reduced from 10 to avoid YouTube 429 rate limiting
    });

    if (!quickImport.success) {
      throw new Error(quickImport.error || 'Channel import failed');
    }

    // Sort videos by view count (most viewed first)
    const sortedVideos = (quickImport.videos || []).sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

    // Step 2: Create project as "ready" immediately (transcripts fetched on-demand)
    const { firestore } = getFirestore();
    const projectId = quickImport.channelId;
    const projectRef = firestore.collection('projects').doc(projectId);

    await projectRef.set({
      id: projectId,
      type: 'channel',
      channelId: quickImport.channelId,
      title: quickImport.channelName,
      author: quickImport.channelName,
      videoCount: quickImport.videoCount,
      status: 'ready', // Ready immediately - transcripts fetched on-demand when questions asked
      transcriptStats: {
        successful: 0,
        failed: 0,
        total: quickImport.videoCount,
        isPartial: false
      },
      lazyLoadTranscripts: true, // Flag indicating transcripts are fetched on-demand
      userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(`[API] ✓ Project created as ready - transcripts will be fetched on-demand when questions are asked`);

    // Increment channel count for quota tracking
    await userService.incrementChannelCount(userId);

    // Step 3: Return immediately - channel ready to use!
    res.json({
      success: true,
      data: {
        projectId,
        channelId: quickImport.channelId,
        channelName: quickImport.channelName,
        channelTitle: quickImport.channelName,
        videoCount: quickImport.videoCount,
        totalVideos: quickImport.videoCount,
        status: 'ready', // Ready immediately!
        lazyLoadTranscripts: true, // Transcripts fetched on-demand
        transcripts: {
          successful: 0,
          failed: 0,
          total: quickImport.videoCount
        }
      }
    });

    console.log(`[API] ✅ Channel import complete for ${channelId} (${quickImport.videoCount} videos) - ready for questions!`);

  } catch (error) {
    console.error('[API] Channel import error:', error);

    // Check if it's a transaction size error (Firestore limit)
    if (error.message.includes('Transaction too big') ||
        error.message.includes('INVALID_ARGUMENT') && error.message.includes('transaction')) {
      return res.status(400).json({
        success: false,
        error: 'channel_too_large',
        message: 'This channel has too many videos to process at once. Please use the "Single Video" mode to import specific videos instead.',
        suggestion: 'single_video'
      });
    }

    // Check if it's a bot detection error
    if (error.message.includes('Too Many Requests') ||
        error.message.includes('403') ||
        error.message.includes('blocked')) {
      return res.status(429).json({
        success: false,
        error: 'YouTube rate limit reached',
        message: 'Too many requests. Please try again in a few minutes.',
        retryAfter: 300
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/channel/import-progress/:projectId
 * Get real-time progress of channel import
 */
router.get('/import-progress/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const { firestore } = getFirestore();
    const projectRef = firestore.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const project = projectDoc.data();

    res.json({
      success: true,
      data: {
        status: project.status,
        progress: project.transcriptProgress || { fetched: 0, total: 0 },
        transcriptStats: project.transcriptStats,
        channelName: project.title,
        videoCount: project.videoCount
      }
    });

  } catch (error) {
    console.error('[API] Get import progress error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/channel/import-captions
 * DEPRECATED: Use /api/channel/import instead
 * Kept for backwards compatibility
 */
router.post('/import-captions', async (req, res) => {
  // Redirect to main import endpoint
  req.body.channelUrl = req.body.channelId; // Map channelId to channelUrl
  return router.handle(req, res);
});

/**
 * GET /api/channel/:channelId
 * Get channel details
 */
router.get('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;

    const channel = await channelService.getChannel(channelId);

    res.json({
      success: true,
      data: channel
    });

  } catch (error) {
    console.error('[API] Get channel error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/channel/:channelId/videos
 * Get all videos in channel
 */
router.get('/:channelId/videos', async (req, res) => {
  try {
    const { channelId } = req.params;

    const videos = await channelService.getChannelVideos(channelId);

    res.json({
      success: true,
      data: videos
    });

  } catch (error) {
    console.error('[API] Get videos error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/channel/:channelId/question
 * Ask question about channel content
 */
router.post('/:channelId/question', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { question, conversationHistory, userId } = req.body;

    console.log(`[API] Channel question from user ${userId}: "${question}"`);

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Check user quota
    const { canAsk, limit, remaining, questionsThisMonth, tier, requiresSignup } = await userService.checkQuestionQuota(userId);

    if (!canAsk) {
      return res.status(403).json({
        success: false,
        error: 'Question limit reached',
        message: requiresSignup
          ? `You've used your ${limit} free question${limit > 1 ? 's' : ''}. Sign up to get ${tier === 'anonymous' ? '15' : 'more'} questions per month!`
          : `You've reached your monthly question limit. You've asked ${questionsThisMonth}/${limit} questions this month.`,
        tier,
        questionsThisMonth,
        limit,
        requiresSignup
      });
    }

    // Get user's language preference
    let userLanguage = null;
    try {
      if (!userService.isAnonymousUser(userId)) {
        const { firestore } = getFirestore();
        if (firestore) {
          const userDoc = await firestore.collection('users').doc(userId).get();
          if (userDoc.exists) {
            userLanguage = userDoc.data().languagePreference || null;
          }
        }
      }
    } catch (error) {
      console.log('[API] Could not fetch user language preference:', error.message);
    }

    // Answer question using enhanced videoQAService
    const result = await videoQAService.answerQuestionForChannel(
      channelId,
      question,
      conversationHistory || [],
      userLanguage
    );

    // Increment quota
    await userService.incrementQuestionCount(userId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[API] Channel question error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/channel/:channelId/status
 * Get channel processing status
 */
router.get('/:channelId/status', async (req, res) => {
  try {
    const { channelId } = req.params;

    const { firestore, useMockMode } = getFirestore();
    const { mockChannels } = require('../services/channelService');

    let channelData;
    if (useMockMode || !firestore) {
      const channel = mockChannels.get(channelId);
      if (!channel) {
        return res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      }
      channelData = channel;
    } else {
      const channelDoc = await firestore.collection('channels').doc(channelId).get();

      if (!channelDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      }
      channelData = channelDoc.data();
    }

    const progress = channelData.videoCount > 0
      ? (channelData.processedVideoCount / channelData.videoCount) * 100
      : 0;

    res.json({
      success: true,
      data: {
        status: channelData.status,
        progress: Math.round(progress),
        processedVideos: channelData.processedVideoCount,
        totalVideos: channelData.videoCount
      }
    });

  } catch (error) {
    console.error('[API] Channel status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/channel/status/:projectId
 * Get project transcript processing status (for polling during background fetch)
 */
router.get('/status/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const { firestore } = getFirestore();
    const projectRef = firestore.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const project = projectDoc.data();

    res.json({
      success: true,
      status: project.status || 'ready', // 'partial' | 'ready' | 'error'
      transcriptProgress: project.transcriptProgress || null,
      transcriptStats: project.transcriptStats || null,
      isPartial: project.transcriptStats?.isPartial || false
    });

  } catch (error) {
    console.error('[API] Project status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
