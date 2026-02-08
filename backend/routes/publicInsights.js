/**
 * Public Insights API Routes
 * Handles generation, retrieval, and management of public SEO pages
 */

const express = require('express');
const router = express.Router();
const { getFirestore } = require('../config/firestore');
const seoContentService = require('../services/seoContentService');
const { FieldValue } = require('@google-cloud/firestore');

/**
 * Generate one public insight for a video (shared by single and batch).
 * @param {Firestore} firestore
 * @param {string} videoId
 * @param {string} channelId
 * @returns {Promise<{ insightId, slug, videoTitle, channelName, thumbnail, status }>}
 * @throws if video missing or no transcript
 */
async function generateOneInsight(firestore, videoId, channelId) {
  const videoRef = firestore.collection('channels').doc(channelId).collection('videos').doc(videoId);
  const videoDoc = await videoRef.get();

  if (!videoDoc.exists) {
    const err = new Error('Video not found');
    err.code = 'VIDEO_NOT_FOUND';
    throw err;
  }

  const video = videoDoc.data();

  const channelRef = firestore.collection('channels').doc(channelId);
  const channelDoc = await channelRef.get();
  const channelName = channelDoc.exists ? channelDoc.data().channelName : 'Unknown Creator';

  if (!video.transcript) {
    const err = new Error('Video has no transcript. Import the video first.');
    err.code = 'NO_TRANSCRIPT';
    throw err;
  }

  const seoContent = await seoContentService.generateSEOContent(
    { ...video, videoId },
    video.transcript,
    channelName
  );

  const validation = seoContentService.validateContent(seoContent);
  if (!validation.valid) {
    console.warn('[PublicInsights] Validation warnings:', validation.errors);
  }

  const existingQuery = await firestore.collection('public_insights')
    .where('videoId', '==', videoId)
    .limit(1)
    .get();

  const insightData = {
    videoId,
    channelId,
    slug: seoContent.slug,
    videoTitle: video.title,
    channelName,
    thumbnail: video.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration: video.duration || 0,
    viewCount: video.viewCount || 0,
    publishedAt: video.publishedAt || null,
    seoTitle: seoContent.seoTitle,
    metaTitle: seoContent.metaTitle,
    metaDescription: seoContent.metaDescription,
    quickInsights: seoContent.quickInsights,
    deepLinks: seoContent.deepLinks,
    howToSteps: seoContent.howToSteps || [],
    semanticAnalysis: seoContent.semanticAnalysis,
    conversionQuestions: seoContent.conversionQuestions,
    faqs: seoContent.faqs,
    keywords: seoContent.keywords || [],
    status: 'draft',
    generatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  let insightId;
  if (!existingQuery.empty) {
    insightId = existingQuery.docs[0].id;
    await firestore.collection('public_insights').doc(insightId).update(insightData);
    console.log(`[PublicInsights] Updated existing insight ${insightId}`);
  } else {
    const newDoc = await firestore.collection('public_insights').add(insightData);
    insightId = newDoc.id;
    console.log(`[PublicInsights] Created new insight ${insightId}`);
  }

  return {
    insightId,
    slug: seoContent.slug,
    videoTitle: video.title,
    channelName,
    thumbnail: insightData.thumbnail,
    status: 'draft'
  };
}

/**
 * POST /api/public-insights/generate
 * Generate SEO content for a video
 * Body: { videoId, channelId }
 */
router.post('/generate', async (req, res) => {
  try {
    const { videoId, channelId } = req.body;

    if (!videoId || !channelId) {
      return res.status(400).json({
        success: false,
        error: 'videoId and channelId are required'
      });
    }

    console.log(`[PublicInsights] Generating SEO content for video ${videoId} in channel ${channelId}`);

    const { firestore } = getFirestore();
    const result = await generateOneInsight(firestore, videoId, channelId);

    res.json({
      success: true,
      data: {
        ...result,
        previewUrl: `/guides/${result.slug}`
      }
    });
  } catch (error) {
    if (error.code === 'VIDEO_NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.code === 'NO_TRANSCRIPT') {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('[PublicInsights] Generate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/public-insights/generate-batch
 * Generate insights for a channel (videos with transcripts).
 * Body: { channelId, count?: 10, publish?: false, skipExisting?: false }
 *
 * Options:
 *   - count: max number to process (default 10, max 200)
 *   - publish: auto-publish generated insights
 *   - skipExisting: skip videos that already have insights (recommended for efficiency)
 */
router.post('/generate-batch', async (req, res) => {
  try {
    const { channelId, count = 10, publish = false, skipExisting = false } = req.body;

    if (!channelId) {
      return res.status(400).json({
        success: false,
        error: 'channelId is required'
      });
    }

    // Increase max from 50 to 200 for larger batch operations
    const targetCount = Math.min(Math.max(Number(count) || 10, 1), 200);

    console.log(`[PublicInsights] Batch generate: channel ${channelId}, target ${targetCount}, publish=${publish}, skipExisting=${skipExisting}`);

    const { firestore } = getFirestore();

    const channelRef = firestore.collection('channels').doc(channelId);
    const channelDoc = await channelRef.get();
    if (!channelDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    const channelName = channelDoc.data().channelName || 'Unknown';

    // Get all videos with transcripts
    const videosSnap = await channelRef.collection('videos').get();
    const allWithTranscript = videosSnap.docs
      .filter(d => d.data().transcript)
      .sort((a, b) => (b.data().publishedAt?.toMillis?.() || 0) - (a.data().publishedAt?.toMillis?.() || 0));

    const totalWithTranscript = allWithTranscript.length;

    if (totalWithTranscript === 0) {
      return res.status(400).json({
        success: false,
        error: 'No videos with transcripts found for this channel. Import the channel and ensure transcripts are loaded.'
      });
    }

    // Always query existing insights for accurate stats
    const existingInsights = await firestore.collection('public_insights')
      .where('channelId', '==', channelId)
      .select('videoId')
      .get();
    const existingVideoIds = new Set(existingInsights.docs.map(d => d.data().videoId));

    // Filter out existing if skipExisting is true
    const videosToProcess = skipExisting
      ? allWithTranscript.filter(d => !existingVideoIds.has(d.id))
      : allWithTranscript;

    const candidateCount = videosToProcess.length;
    const withTranscript = videosToProcess.slice(0, targetCount);

    const newlyCreated = [];
    const updated = [];
    const existingSkipped = [];
    const errors = [];

    for (const doc of withTranscript) {
      const videoId = doc.id;
      try {
        // Check if insight already exists for this video
        const existingQuery = await firestore.collection('public_insights')
          .where('videoId', '==', videoId)
          .limit(1)
          .get();

        const alreadyExists = !existingQuery.empty;

        const result = await generateOneInsight(firestore, videoId, channelId);
        let status = result.status;

        if (publish) {
          await firestore.collection('public_insights').doc(result.insightId).update({
            status: 'published',
            publishedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
          status = 'published';
        }

        const entry = {
          videoId,
          insightId: result.insightId,
          slug: result.slug,
          videoTitle: result.videoTitle,
          status
        };

        if (alreadyExists) {
          updated.push(entry);
        } else {
          newlyCreated.push(entry);
        }
      } catch (e) {
        if (e.code === 'NO_TRANSCRIPT') {
          existingSkipped.push({ videoId, reason: e.message });
        } else {
          errors.push({ videoId, error: e.message });
        }
      }
    }

    // Calculate videos still needing insights (for --skip-existing hint)
    const videosStillNeedingInsights = allWithTranscript.filter(d => !existingVideoIds.has(d.id)).length;

    res.json({
      success: true,
      data: {
        channelId,
        channelName,
        // Summary stats
        totalVideosWithTranscript: totalWithTranscript,
        alreadyHaveInsights: existingVideoIds.size,
        candidatesProcessed: withTranscript.length,
        remainingAvailable: candidateCount - withTranscript.length,
        // How many videos still don't have insights (useful when skipExisting=false)
        videosStillNeedingInsights,
        skipExistingUsed: skipExisting,
        // Results
        newlyCreated: newlyCreated.length,
        updated: updated.length,
        errors: errors.length,
        // Details
        newlyCreatedList: newlyCreated,
        updatedList: updated,
        errorsList: errors,
        // Legacy compatibility
        generated: newlyCreated.length + updated.length,
        generatedList: [...newlyCreated, ...updated]
      }
    });
  } catch (error) {
    console.error('[PublicInsights] Generate-batch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/public-insights/channel-stats/:channelId
 * Get stats about a channel's videos and existing insights
 */
router.get('/channel-stats/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { firestore } = getFirestore();

    const channelRef = firestore.collection('channels').doc(channelId);
    const channelDoc = await channelRef.get();

    if (!channelDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    const channelData = channelDoc.data();

    // Count videos
    const videosSnap = await channelRef.collection('videos').get();
    const totalVideos = videosSnap.size;
    const videosWithTranscript = videosSnap.docs.filter(d => d.data().transcript).length;

    // Count existing insights
    const insightsSnap = await firestore.collection('public_insights')
      .where('channelId', '==', channelId)
      .get();

    const existingInsights = insightsSnap.size;
    const publishedInsights = insightsSnap.docs.filter(d => d.data().status === 'published').length;
    const draftInsights = insightsSnap.docs.filter(d => d.data().status === 'draft').length;

    res.json({
      success: true,
      data: {
        channelId,
        channelName: channelData.channelName || 'Unknown',
        totalVideos,
        videosWithTranscript,
        videosWithoutTranscript: totalVideos - videosWithTranscript,
        existingInsights,
        publishedInsights,
        draftInsights,
        availableForGeneration: videosWithTranscript - existingInsights
      }
    });
  } catch (error) {
    console.error('[PublicInsights] Channel stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/public-insights/by-slug/:slug
 * Fetch published insight by SEO slug (public, no auth)
 */
router.get('/by-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const { firestore } = getFirestore();

    const query = await firestore.collection('public_insights')
      .where('slug', '==', slug)
      .where('status', '==', 'published')
      .limit(1)
      .get();

    if (query.empty) {
      return res.status(404).json({
        success: false,
        error: 'Page not found'
      });
    }

    const doc = query.docs[0];
    const data = doc.data();

    // Increment page views (fire and forget)
    firestore.collection('public_insights').doc(doc.id).update({
      pageViews: FieldValue.increment(1)
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        id: doc.id,
        ...data,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
        generatedAt: data.generatedAt?.toDate?.()?.toISOString() || null
      }
    });

  } catch (error) {
    console.error('[PublicInsights] Fetch by slug error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/public-insights/list
 * List all published insights (for sitemap/directory)
 * Query params: ?limit=50&offset=0&channelId=optional
 */
router.get('/list', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const channelId = req.query.channelId;

    const { firestore } = getFirestore();

    // Simple query without orderBy to avoid needing composite index
    // Sorting done in memory - fine for small collections
    let query = firestore.collection('public_insights')
      .where('status', '==', 'published');

    if (channelId) {
      query = query.where('channelId', '==', channelId);
    }

    const snapshot = await query.get();

    let insights = snapshot.docs.map(doc => {
      const data = doc.data();
      const publishedAt = data.publishedAt?.toDate?.() || new Date(0);
      return {
        id: doc.id,
        slug: data.slug,
        videoId: data.videoId,
        channelId: data.channelId,
        videoTitle: data.videoTitle,
        channelName: data.channelName,
        thumbnail: data.thumbnail,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        publishedAt: publishedAt.toISOString(),
        publishedAtTimestamp: publishedAt.getTime(),
        pageViews: data.pageViews || 0
      };
    });

    // Sort by publishedAt descending (newest first)
    insights.sort((a, b) => b.publishedAtTimestamp - a.publishedAtTimestamp);

    // Apply limit after sorting
    insights = insights.slice(0, limit);

    // Remove the timestamp helper field
    insights = insights.map(({ publishedAtTimestamp, ...rest }) => rest);

    res.json({
      success: true,
      data: insights,
      count: insights.length
    });

  } catch (error) {
    console.error('[PublicInsights] List error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/public-insights/drafts
 * List all draft insights for admin review
 */
router.get('/drafts', async (req, res) => {
  try {
    const { firestore } = getFirestore();

    const snapshot = await firestore.collection('public_insights')
      .where('status', '==', 'draft')
      .orderBy('generatedAt', 'desc')
      .limit(50)
      .get();

    const insights = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        slug: data.slug,
        videoId: data.videoId,
        videoTitle: data.videoTitle,
        channelName: data.channelName,
        thumbnail: data.thumbnail,
        seoTitle: data.seoTitle,
        generatedAt: data.generatedAt?.toDate?.()?.toISOString() || null
      };
    });

    res.json({
      success: true,
      data: insights,
      count: insights.length
    });

  } catch (error) {
    console.error('[PublicInsights] Drafts error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/public-insights/publish/:id
 * Publish a draft insight
 */
router.post('/publish/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { firestore } = getFirestore();

    const docRef = firestore.collection('public_insights').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Insight not found'
      });
    }

    await docRef.update({
      status: 'published',
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    const data = doc.data();

    console.log(`[PublicInsights] Published insight ${id} - slug: ${data.slug}`);

    res.json({
      success: true,
      data: {
        id,
        slug: data.slug,
        status: 'published',
        publicUrl: `https://lurnia.app/guides/${data.slug}`
      }
    });

  } catch (error) {
    console.error('[PublicInsights] Publish error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/public-insights/:id
 * Delete an insight (or set to archived)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { firestore } = getFirestore();

    await firestore.collection('public_insights').doc(id).update({
      status: 'archived',
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(`[PublicInsights] Archived insight ${id}`);

    res.json({
      success: true,
      message: 'Insight archived'
    });

  } catch (error) {
    console.error('[PublicInsights] Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/public-insights/sitemap
 * Generate sitemap data for all published insights
 */
router.get('/sitemap', async (req, res) => {
  try {
    const { firestore } = getFirestore();

    const snapshot = await firestore.collection('public_insights')
      .where('status', '==', 'published')
      .select('slug', 'publishedAt', 'updatedAt')
      .get();

    const urls = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        loc: `https://lurnia.app/guides/${data.slug}`,
        lastmod: data.updatedAt?.toDate?.()?.toISOString()?.split('T')[0] ||
                 data.publishedAt?.toDate?.()?.toISOString()?.split('T')[0] ||
                 new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.8
      };
    });

    res.json({
      success: true,
      data: urls,
      count: urls.length
    });

  } catch (error) {
    console.error('[PublicInsights] Sitemap error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
