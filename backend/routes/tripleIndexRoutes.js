const express = require('express');
const router = express.Router();
const tripleIndexService = require('../services/tripleLayeredIndexService');

/**
 * PHASE 1: Immediate Channel Ingestion
 * POST /api/triple-index/channel/import
 *
 * Imports channel with Tier 1 (metadata) + Tier 2 (captions)
 * Makes channel instantly searchable
 */
router.post('/channel/import', async (req, res) => {
  try {
    const { channelUrl, userId } = req.body;

    if (!channelUrl) {
      return res.status(400).json({
        success: false,
        error: 'channelUrl is required'
      });
    }

    console.log(`[API] PHASE 1: Importing channel ${channelUrl}`);

    // Extract channel ID from URL
    const channelId = extractChannelId(channelUrl);

    // Ingest channel immediately (Tier 1 + Tier 2)
    const result = await tripleIndexService.ingestChannelImmediate(channelId, userId);

    res.json({
      success: true,
      message: 'Channel indexed instantly with metadata + captions',
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
 * PHASE 2: On-Demand Video Processing
 * POST /api/triple-index/video/process
 *
 * Process specific video with Tier 3 (audio transcription)
 * Triggered when user asks deep question
 */
router.post('/video/process', async (req, res) => {
  try {
    const { videoId, channelId, userId } = req.body;

    if (!videoId || !channelId) {
      return res.status(400).json({
        success: false,
        error: 'videoId and channelId are required'
      });
    }

    console.log(`[API] PHASE 2: On-demand processing for ${videoId}`);

    // Process video on-demand
    const result = await tripleIndexService.processVideoOnDemand(videoId, channelId, userId);

    res.json({
      success: true,
      message: 'Video processed with high-accuracy transcription',
      data: result
    });

  } catch (error) {
    console.error('[API] Video processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PHASE 3: Background Queue Processing
 * POST /api/triple-index/channel/background-process
 *
 * Process videos in background with smart prioritization
 * Should be called during idle times (e.g., 2 AM)
 */
router.post('/channel/background-process', async (req, res) => {
  try {
    const { channelId, maxVideos = 10, maxCost = 20, priorityStrategy = 'smart' } = req.body;

    if (!channelId) {
      return res.status(400).json({
        success: false,
        error: 'channelId is required'
      });
    }

    console.log(`[API] PHASE 3: Background processing for ${channelId}`);
    console.log(`[API] Budget: $${maxCost}, Max videos: ${maxVideos}, Strategy: ${priorityStrategy}`);

    // Process in background
    const result = await tripleIndexService.processBackgroundQueue(channelId, {
      maxVideos,
      maxCost,
      priorityStrategy
    });

    res.json({
      success: true,
      message: 'Background processing complete',
      data: result
    });

  } catch (error) {
    console.error('[API] Background processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get channel tier statistics
 * GET /api/triple-index/channel/:channelId/stats
 */
router.get('/channel/:channelId/stats', async (req, res) => {
  try {
    const { channelId } = req.params;

    const tierStats = await tripleIndexService.updateChannelTierStats(channelId);

    res.json({
      success: true,
      data: tierStats
    });

  } catch (error) {
    console.error('[API] Stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper: Extract channel ID from various URL formats
 */
function extractChannelId(url) {
  // Handle different formats:
  // - https://youtube.com/@username
  // - https://youtube.com/channel/UCxxxxx
  // - UCxxxxx (direct ID)

  if (url.startsWith('UC') && url.length === 24) {
    return url; // Already a channel ID
  }

  if (url.includes('/channel/')) {
    const match = url.match(/\/channel\/([^\/\?]+)/);
    return match ? match[1] : url;
  }

  if (url.includes('/@')) {
    const match = url.match(/\/@([^\/\?]+)/);
    return match ? `@${match[1]}` : url;
  }

  return url;
}

module.exports = router;
