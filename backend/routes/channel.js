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

    // Get channel metadata ONLY (instant, no transcript fetching)
    const channelData = await channelTranscriptService.getChannelVideos(channelId);

    // Store in Firestore immediately
    const { firestore } = getFirestore();
    const channelRef = firestore.collection('channels').doc(channelData.channelId);

    await channelRef.set({
      channelId: channelData.channelId,
      channelTitle: channelData.channelTitle,
      userId,
      totalVideos: channelData.videos.length,
      status: 'ready',
      createdAt: new Date(),
      method: 'metadata_only' // Transcripts fetched on-demand
    });

    // Store each video with metadata only (NO transcript fetching yet)
    const batch = firestore.batch();
    for (const video of channelData.videos) {
      const videoRef = channelRef.collection('videos').doc(video.id);
      batch.set(videoRef, {
        videoId: video.id,
        title: video.title,
        description: video.description,
        publishedAt: video.publishedAt,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        channelId: channelData.channelId,
        status: 'metadata_only', // Transcript not fetched yet
        transcript: null, // Fetch on first question
        processedAt: new Date()
      });
    }
    await batch.commit();

    console.log(`[API] ✓ Channel import complete (instant): ${channelData.videos.length} videos`);

    res.json({
      success: true,
      data: {
        channelId: channelData.channelId,
        channelTitle: channelData.channelTitle,
        totalVideos: channelData.videos.length,
        method: 'metadata_only',
        message: 'Channel imported instantly! Transcripts will be fetched as needed.'
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
