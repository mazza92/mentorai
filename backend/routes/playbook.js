const express = require('express');
const router = express.Router();
const playbookService = require('../services/playbookService');
const userService = require('../services/userService');

function validVideoId(videoId) {
  return videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId);
}

router.get('/:videoId/warm', async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!validVideoId(videoId)) {
      return res.status(400).json({ error: 'Invalid video id' });
    }
    const language = req.query.lang === 'fr' ? 'fr' : 'en';
    playbookService.getOrGenerate(videoId, { language }).catch((err) => {
      console.warn('[Playbook] Warm failed:', err.message);
    });
    res.status(202).json({ success: true, warming: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!validVideoId(videoId)) {
      return res.status(400).json({ error: 'Invalid video id' });
    }

    const userId = req.query.userId || req.headers['x-user-id'] || 'anonymous';
    const quota = await userService.checkPlaybookQuota(userId, videoId);
    if (!quota.canOpen) {
      return res.status(402).json({
        error: quota.requiresSignup
          ? 'Sign up to open more playbooks.'
          : `Playbook limit reached (${quota.playbooksThisMonth}/${quota.limit} this month).`,
        code: quota.requiresSignup ? 'SIGNUP_REQUIRED' : 'PLAYBOOK_LIMIT',
        used: quota.playbooksThisMonth,
        limit: quota.limit,
        remaining: quota.remaining,
        tier: quota.tier
      });
    }

    const language = req.query.lang === 'fr' ? 'fr' : 'en';
    const data = await playbookService.getOrGenerate(videoId, { language });
    if (quota.isNew) {
      await userService.incrementPlaybookCount(userId, videoId);
    }
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('[Playbook] Error:', error.message);
    const status = error.code === 'VIDEO_NOT_FOUND' ? 404 : error.code === 'NO_SOURCE' ? 422 : 500;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
