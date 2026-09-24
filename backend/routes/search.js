const express = require('express');
const router = express.Router();
const valueSearchService = require('../services/valueSearchService');

/**
 * POST /api/search/value
 * Rank YouTube results by comments/likes vs views instead of popularity.
 */
router.post('/value', async (req, res) => {
  try {
    const { query, includeShorts, limit, language } = req.body || {};
    if (!query || String(query).trim().length < 2) {
      return res.status(400).json({ error: 'A search query is required' });
    }

    const videos = await valueSearchService.search(query, {
      includeShorts: !!includeShorts,
      limit,
      language
    });

    res.json({
      success: true,
      query: String(query).trim(),
      count: videos.length,
      videos
    });
  } catch (error) {
    console.error('[Search] Value search failed:', error.message);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

/**
 * GET /api/search/value?q=...
 * Same ranking, cacheable for programmatic /learn pages and crawlers.
 */
router.get('/value', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || String(query).trim().length < 2) {
      return res.status(400).json({ error: 'A search query is required' });
    }

    const videos = await valueSearchService.search(query, {
      includeShorts: req.query.includeShorts === '1' || req.query.includeShorts === 'true',
      limit: req.query.limit,
      language: req.query.language
    });

    res.set('Cache-Control', 'public, max-age=300, s-maxage=21600');
    res.json({
      success: true,
      query: String(query).trim(),
      count: videos.length,
      videos
    });
  } catch (error) {
    console.error('[Search] Value search failed:', error.message);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

module.exports = router;
