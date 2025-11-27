const express = require('express');
const router = express.Router();
const channelService = require('../services/channelService');
const simpleChannelService = require('../services/simpleChannelService');
const videoQAService = require('../services/videoQAService');
const userService = require('../services/userService');
const { getFirestore } = require('../config/firestore');

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

    // Import channel with Innertube caption scraping
    const importResult = await simpleChannelService.importChannel(channelId, userId, {
      fetchTranscripts: true, // Enable Innertube scraping
      maxVideosToTranscribe: null, // Fetch all videos
      concurrency: 10 // 10 parallel requests
    });

    if (!importResult.success) {
      throw new Error(importResult.error || 'Channel import failed');
    }

    // Create a project for this channel so user can chat with it
    const { firestore } = getFirestore();
    const projectId = importResult.channelId;
    const projectRef = firestore.collection('projects').doc(projectId);

    await projectRef.set({
      id: projectId,
      type: 'channel',
      channelId: importResult.channelId,
      title: importResult.channelName,
      author: importResult.channelName,
      videoCount: importResult.videoCount,
      transcriptStats: importResult.transcripts,
      status: 'ready',
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`[API] ✓ Channel import complete: ${importResult.videoCount} videos, ${importResult.transcripts.successful} transcripts`);

    res.json({
      success: true,
      data: {
        projectId: projectId,
        channelId: importResult.channelId,
        channelName: importResult.channelName,
        channelTitle: importResult.channelName,
        videoCount: importResult.videoCount,
        totalVideos: importResult.videoCount,
        transcripts: importResult.transcripts,
        status: 'ready',
        method: importResult.strategy,
        importTime: importResult.importTime,
        message: importResult.message
      }
    });

  } catch (error) {
    console.error('[API] Channel import error:', error);

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

module.exports = router;
