const express = require('express');
const router = express.Router();
const channelService = require('../services/channelService');
const channelTranscriptService = require('../services/channelTranscriptService');
const videoQAService = require('../services/videoQAService');
const userService = require('../services/userService');
const { getFirestore } = require('../config/firestore');

/**
 * POST /api/channel/import
 * Import YouTube channel using caption extraction (cookie-free!)
 * - Uses youtube-transcript package (no cookies needed, no bot detection)
 * - No video downloads
 * - FREE (no transcription costs)
 * - Fast (45-60s for 200 videos)
 */
router.post('/import', async (req, res) => {
  try {
    const { channelUrl, userId } = req.body;

    console.log(`[API] Caption-based channel import requested by user ${userId}: ${channelUrl}`);

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

    // Check user exists
    const user = await userService.getUser(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Extract channel ID from URL
    let channelId = channelUrl;

    // Handle different URL formats
    if (channelUrl.includes('youtube.com')) {
      if (channelUrl.includes('/channel/')) {
        channelId = channelUrl.split('/channel/')[1].split('/')[0].split('?')[0];
      } else if (channelUrl.includes('/@')) {
        // Handle @username format - let channelTranscriptService resolve it
        channelId = channelUrl.split('/@')[1].split('/')[0].split('?')[0];
      }
    }

    console.log(`[API] Resolved channel ID: ${channelId}`);

    // Import channel using caption extraction (NO COOKIES, NO VIDEO DOWNLOADS!)
    const result = await channelTranscriptService.importChannel(channelId);

    // Store in Firestore
    const { firestore } = getFirestore();
    const channelRef = firestore.collection('channels').doc(result.channelId);

    await channelRef.set({
      channelId: result.channelId,
      channelTitle: result.channelTitle,
      userId,
      totalVideos: result.totalVideos,
      successfulVideos: result.successfulVideos,
      failedVideos: result.failedVideos,
      method: 'youtube_captions',
      status: 'ready',
      createdAt: new Date(),
      processingTime: result.processingTime
    });

    // Store each video with transcript
    const batch = firestore.batch();
    for (const video of result.videos) {
      const videoRef = channelRef.collection('videos').doc(video.id);
      batch.set(videoRef, {
        ...video,
        channelId: result.channelId,
        status: 'ready',
        processedAt: new Date()
      });
    }
    await batch.commit();

    console.log(`[API] ✓ Channel import complete: ${result.successfulVideos}/${result.totalVideos} videos`);

    res.json({
      success: true,
      data: result
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
 * Import YouTube channel using caption extraction (NotebookLM method)
 * - No video downloads
 * - FREE (no transcription costs)
 * - Fast (45-60s for 200 videos)
 * - Bot detection bypass strategies
 */
router.post('/import-captions', async (req, res) => {
  try {
    const { channelId, userId } = req.body;

    console.log(`[API] Caption-based channel import requested by user ${userId}: ${channelId}`);

    if (!channelId) {
      return res.status(400).json({
        success: false,
        error: 'Channel ID or URL is required'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Check user quota
    const user = await userService.getUser(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Import channel using caption extraction
    const result = await channelTranscriptService.importChannel(channelId);

    // Store in Firestore
    const { firestore } = getFirestore();
    const channelRef = firestore.collection('channels').doc(result.channelId);

    await channelRef.set({
      channelId: result.channelId,
      channelTitle: result.channelTitle,
      userId,
      totalVideos: result.totalVideos,
      successfulVideos: result.successfulVideos,
      failedVideos: result.failedVideos,
      method: 'youtube_captions',
      status: 'ready',
      createdAt: new Date(),
      processingTime: result.processingTime
    });

    // Store each video with transcript
    const batch = firestore.batch();
    for (const video of result.videos) {
      const videoRef = channelRef.collection('videos').doc(video.id);
      batch.set(videoRef, {
        ...video,
        channelId: result.channelId,
        status: 'ready',
        processedAt: new Date()
      });
    }
    await batch.commit();

    console.log(`[API] ✓ Channel import complete: ${result.successfulVideos}/${result.totalVideos} videos`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[API] Caption-based channel import error:', error);

    // Check if it's a bot detection error
    if (error.message.includes('Too Many Requests') ||
        error.message.includes('403') ||
        error.message.includes('blocked')) {
      return res.status(429).json({
        success: false,
        error: 'YouTube bot detection triggered',
        message: 'Too many requests. Please try again in a few minutes.',
        retryAfter: 300 // 5 minutes
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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

    // Answer question using enhanced videoQAService
    const result = await videoQAService.answerQuestionForChannel(
      channelId,
      question,
      conversationHistory || []
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
