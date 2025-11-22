const express = require('express');
const router = express.Router();
const channelService = require('../services/channelService');
const videoQAService = require('../services/videoQAService');
const userService = require('../services/userService');
const { getFirestore } = require('../config/firestore');

/**
 * POST /api/channel/import
 * Import full YouTube channel
 */
router.post('/import', async (req, res) => {
  try {
    // Feature flag: Temporarily disable channel imports while fixing YouTube API issues
    if (process.env.DISABLE_CHANNEL_IMPORTS === 'true') {
      return res.status(503).json({
        success: false,
        error: 'Channel imports are temporarily unavailable',
        message: 'We\'re improving this feature. Single video uploads work great! Try uploading individual videos while we enhance channel imports.'
      });
    }

    const { channelUrl, userId } = req.body;

    console.log(`[API] Channel import requested by user ${userId}`);

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

    // Import channel (async process)
    const result = await channelService.importChannel(channelUrl, userId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[API] Channel import error:', error);
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
