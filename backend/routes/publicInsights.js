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

    // Fetch video data from Firestore
    const videoRef = firestore.collection('channels').doc(channelId).collection('videos').doc(videoId);
    const videoDoc = await videoRef.get();

    if (!videoDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    const video = videoDoc.data();

    // Fetch channel data for creator name
    const channelRef = firestore.collection('channels').doc(channelId);
    const channelDoc = await channelRef.get();
    const channelName = channelDoc.exists ? channelDoc.data().channelName : 'Unknown Creator';

    // Check if transcript exists
    if (!video.transcript) {
      return res.status(400).json({
        success: false,
        error: 'Video has no transcript. Import the video first.'
      });
    }

    // Generate SEO content
    const seoContent = await seoContentService.generateSEOContent(
      { ...video, videoId },
      video.transcript,
      channelName
    );

    // Validate content
    const validation = seoContentService.validateContent(seoContent);
    if (!validation.valid) {
      console.warn('[PublicInsights] Validation warnings:', validation.errors);
    }

    // Check if insight already exists for this video
    const existingQuery = await firestore.collection('public_insights')
      .where('videoId', '==', videoId)
      .limit(1)
      .get();

    let insightId;
    const insightData = {
      videoId,
      channelId,
      slug: seoContent.slug,

      // Video metadata (denormalized)
      videoTitle: video.title,
      channelName,
      thumbnail: video.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: video.duration || 0,
      viewCount: video.viewCount || 0,
      publishedAt: video.publishedAt || null,

      // SEO content
      seoTitle: seoContent.seoTitle,
      metaTitle: seoContent.metaTitle,
      metaDescription: seoContent.metaDescription,
      quickInsights: seoContent.quickInsights,
      deepLinks: seoContent.deepLinks,
      semanticAnalysis: seoContent.semanticAnalysis,
      conversionQuestions: seoContent.conversionQuestions,
      faqs: seoContent.faqs,
      keywords: seoContent.keywords || [],

      // Management
      status: 'draft',
      generatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    if (!existingQuery.empty) {
      // Update existing
      insightId = existingQuery.docs[0].id;
      await firestore.collection('public_insights').doc(insightId).update(insightData);
      console.log(`[PublicInsights] Updated existing insight ${insightId}`);
    } else {
      // Create new
      const newDoc = await firestore.collection('public_insights').add(insightData);
      insightId = newDoc.id;
      console.log(`[PublicInsights] Created new insight ${insightId}`);
    }

    res.json({
      success: true,
      data: {
        id: insightId,
        slug: seoContent.slug,
        ...seoContent,
        videoTitle: video.title,
        channelName,
        thumbnail: insightData.thumbnail,
        status: 'draft',
        previewUrl: `/resume/${seoContent.slug}`
      }
    });

  } catch (error) {
    console.error('[PublicInsights] Generate error:', error);
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
        publicUrl: `https://lurnia.app/resume/${data.slug}`
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
        loc: `https://lurnia.app/resume/${data.slug}`,
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
