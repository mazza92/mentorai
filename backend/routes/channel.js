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

    // Step 1: Quick import - get channel info and video list (no transcripts yet)
    const quickImport = await simpleChannelService.importChannel(channelId, userId, {
      fetchTranscripts: false, // Don't fetch transcripts yet
      maxVideosToTranscribe: null,
      concurrency: 3 // Reduced from 10 to avoid YouTube 429 rate limiting
    });

    if (!quickImport.success) {
      throw new Error(quickImport.error || 'Channel import failed');
    }

    // Sort videos by view count (most viewed first)
    const sortedVideos = (quickImport.videos || []).sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

    // Step 2: Fetch first 15 most viewed videos (15-30s wait)
    console.log(`[API] 📝 Fetching initial sample (15 most viewed videos)...`);
    const initialSampleSize = 15;
    const initialVideos = sortedVideos.slice(0, initialSampleSize);

    const initialTranscripts = await youtubeInnertubeService.fetchChannelTranscripts(
      initialVideos,
      { concurrency: 3, prioritizeBy: 'views' } // Reduced from 10 to avoid YouTube 429 rate limiting
    );

    // Save initial transcripts to channels collection in chunks to avoid 10MB batch limit
    const { firestore: firestoreForUpdate } = getFirestore();
    const channelRef = firestoreForUpdate.collection('channels').doc(quickImport.channelId);

    // Process in smaller chunks (2 videos per batch to stay well under 10MB limit)
    const BATCH_SIZE = 2;
    const videosWithTranscripts = initialVideos.filter(v => v.hasTranscript);

    for (let i = 0; i < videosWithTranscripts.length; i += BATCH_SIZE) {
      const chunk = videosWithTranscripts.slice(i, i + BATCH_SIZE);
      const batch = firestoreForUpdate.batch();

      for (const video of chunk) {
        const videoRef = channelRef.collection('videos').doc(video.id);

        // Extract transcript text safely (avoid Firestore 1MB document limit)
        let transcriptText = null;
        if (video.transcript) {
          // Handle transcript object (from smart bypass)
          if (typeof video.transcript === 'object' && video.transcript.text) {
            transcriptText = video.transcript.text;
          } else if (typeof video.transcript === 'string') {
            transcriptText = video.transcript;
          }

          // Check size - Firestore field limit is 1MB (1048576 bytes)
          // If transcript text is too large, don't store it (use segments instead)
          if (transcriptText && Buffer.byteLength(transcriptText, 'utf8') > 900000) {
            console.log(`[API] ⚠️ Transcript for ${video.id} too large (${Buffer.byteLength(transcriptText, 'utf8')} bytes), skipping text field`);
            transcriptText = null;
          }
        }

        // Check if transcriptSegments is too large to store in document
        // Firestore document limit is 1MB total
        const segmentsSize = video.transcriptSegments ? Buffer.byteLength(JSON.stringify(video.transcriptSegments), 'utf8') : 0;
        const storeSegmentsInSubcollection = segmentsSize > 700000; // 700KB threshold for safety

        if (storeSegmentsInSubcollection) {
          console.log(`[API] ⚠️ TranscriptSegments for ${video.id} too large (${segmentsSize} bytes), storing in subcollection`);

          // Store segments in subcollection chunks (commit separately to avoid batch size limit)
          const SEGMENTS_PER_CHUNK = 100;
          const segments = video.transcriptSegments || [];

          // Commit subcollection chunks in separate batches to avoid "Transaction too big" error
          for (let j = 0; j < segments.length; j += SEGMENTS_PER_CHUNK) {
            const segmentChunk = segments.slice(j, j + SEGMENTS_PER_CHUNK);
            const chunkDoc = videoRef.collection('transcriptChunks').doc(`chunk_${j}`);
            // Use individual set() instead of batch to avoid transaction size limit
            await chunkDoc.set({
              segments: segmentChunk,
              startIndex: j,
              endIndex: Math.min(j + SEGMENTS_PER_CHUNK - 1, segments.length - 1)
            });
          }
          console.log(`[API] ✓ Stored ${segments.length} segments in ${Math.ceil(segments.length / SEGMENTS_PER_CHUNK)} chunks for ${video.id}`);
        }

        batch.update(videoRef, {
          status: 'ready',
          hasTranscript: true,
          transcript: transcriptText ? { text: transcriptText } : null, // Store only text, not full object with words
          transcriptSegments: storeSegmentsInSubcollection ? null : video.transcriptSegments, // Only store if small enough
          transcriptSegmentsInSubcollection: storeSegmentsInSubcollection, // Flag for retrieval
          transcriptSegmentsCount: video.transcriptSegments?.length || 0, // Metadata
          transcriptSource: video.transcriptSource,
          transcriptFetchedAt: new Date().toISOString()
        });
      }

      await batch.commit();
      console.log(`[API] ✓ Saved chunk ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} transcripts)`);
    }

    console.log(`[API] ✓ Saved ${initialTranscripts.successful} transcripts to Firestore`);

    // Step 3: Create project with "partial" or "ready" status
    const { firestore } = getFirestore();
    const projectId = quickImport.channelId;
    const projectRef = firestore.collection('projects').doc(projectId);

    const isPartial = sortedVideos.length > initialSampleSize;

    await projectRef.set({
      id: projectId,
      type: 'channel',
      channelId: quickImport.channelId,
      title: quickImport.channelName,
      author: quickImport.channelName,
      videoCount: quickImport.videoCount,
      status: isPartial ? 'partial' : 'ready',
      transcriptProgress: {
        fetched: initialTranscripts.successful,
        total: quickImport.videoCount
      },
      // Don't store transcripts here - they're in channels/{channelId}/videos
      // This keeps document under 1MB Firestore limit
      transcriptStats: {
        successful: initialTranscripts.successful,
        failed: initialTranscripts.failed,
        total: initialTranscripts.total,
        isPartial
      },
      userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(`[API] ✓ Initial sample complete: ${initialTranscripts.successful}/${initialSampleSize} transcripts fetched`);

    // Step 4: Return immediately with initial transcripts
    res.json({
      success: true,
      data: {
        projectId,
        channelId: quickImport.channelId,
        channelName: quickImport.channelName,
        channelTitle: quickImport.channelName,
        videoCount: quickImport.videoCount,
        totalVideos: quickImport.videoCount,
        status: isPartial ? 'partial' : 'ready',
        transcriptsAvailable: initialTranscripts.successful,
        transcripts: {
          successful: initialTranscripts.successful,
          failed: initialTranscripts.failed,
          total: initialTranscripts.total
        }
      }
    });

    // Step 5: Continue fetching remaining videos in background (non-blocking)
    if (isPartial) {
      setImmediate(async () => {
        try {
          console.log(`[API] 📝 Starting background fetch for remaining ${sortedVideos.length - initialSampleSize} videos...`);

          const remainingVideos = sortedVideos.slice(initialSampleSize);

          const remainingTranscripts = await youtubeInnertubeService.fetchChannelTranscripts(
            remainingVideos,
            { concurrency: 3, prioritizeBy: 'views' } // Reduced from 10 to avoid YouTube 429 rate limiting
          );

          // Save remaining transcripts to channels collection in chunks to avoid 10MB batch limit
          const { firestore: firestoreBg } = getFirestore();
          const channelRefBg = firestoreBg.collection('channels').doc(quickImport.channelId);

          // Process in smaller chunks (2 videos per batch to stay well under 10MB limit)
          const BATCH_SIZE_BG = 2;
          const remainingWithTranscripts = remainingVideos.filter(v => v.hasTranscript);

          for (let i = 0; i < remainingWithTranscripts.length; i += BATCH_SIZE_BG) {
            const chunk = remainingWithTranscripts.slice(i, i + BATCH_SIZE_BG);
            const batchBg = firestoreBg.batch();

            for (const video of chunk) {
              const videoRef = channelRefBg.collection('videos').doc(video.id);

              // Extract transcript text safely (avoid Firestore 1MB document limit)
              let transcriptText = null;
              if (video.transcript) {
                // Handle transcript object (from smart bypass)
                if (typeof video.transcript === 'object' && video.transcript.text) {
                  transcriptText = video.transcript.text;
                } else if (typeof video.transcript === 'string') {
                  transcriptText = video.transcript;
                }

                // Check size - Firestore field limit is 1MB (1048576 bytes)
                // If transcript text is too large, don't store it (use segments instead)
                if (transcriptText && Buffer.byteLength(transcriptText, 'utf8') > 900000) {
                  console.log(`[API] ⚠️ Background: Transcript for ${video.id} too large (${Buffer.byteLength(transcriptText, 'utf8')} bytes), skipping text field`);
                  transcriptText = null;
                }
              }

              // Check if transcriptSegments is too large to store in document
              // Firestore document limit is 1MB total
              const segmentsSize = video.transcriptSegments ? Buffer.byteLength(JSON.stringify(video.transcriptSegments), 'utf8') : 0;
              const storeSegmentsInSubcollection = segmentsSize > 700000; // 700KB threshold for safety

              if (storeSegmentsInSubcollection) {
                console.log(`[API] ⚠️ Background: TranscriptSegments for ${video.id} too large (${segmentsSize} bytes), storing in subcollection`);

                // Store segments in subcollection chunks (commit separately to avoid batch size limit)
                const SEGMENTS_PER_CHUNK = 100;
                const segments = video.transcriptSegments || [];

                // Commit subcollection chunks in separate batches to avoid "Transaction too big" error
                for (let j = 0; j < segments.length; j += SEGMENTS_PER_CHUNK) {
                  const segmentChunk = segments.slice(j, j + SEGMENTS_PER_CHUNK);
                  const chunkDoc = videoRef.collection('transcriptChunks').doc(`chunk_${j}`);
                  // Use individual set() instead of batch to avoid transaction size limit
                  await chunkDoc.set({
                    segments: segmentChunk,
                    startIndex: j,
                    endIndex: Math.min(j + SEGMENTS_PER_CHUNK - 1, segments.length - 1)
                  });
                }
                console.log(`[API] ✓ Background: Stored ${segments.length} segments in ${Math.ceil(segments.length / SEGMENTS_PER_CHUNK)} chunks for ${video.id}`);
              }

              batchBg.update(videoRef, {
                status: 'ready',
                hasTranscript: true,
                transcript: transcriptText ? { text: transcriptText } : null, // Store only text, not full object with words
                transcriptSegments: storeSegmentsInSubcollection ? null : video.transcriptSegments, // Only store if small enough
                transcriptSegmentsInSubcollection: storeSegmentsInSubcollection, // Flag for retrieval
                transcriptSegmentsCount: video.transcriptSegments?.length || 0, // Metadata
                transcriptSource: video.transcriptSource,
                transcriptFetchedAt: new Date().toISOString()
              });
            }

            await batchBg.commit();
            console.log(`[API] ✓ Background: Saved chunk ${Math.floor(i / BATCH_SIZE_BG) + 1} (${chunk.length} transcripts)`);
          }

          console.log(`[API] ✓ Saved ${remainingTranscripts.successful} remaining transcripts to Firestore`);

          // Calculate final stats (transcripts already stored in channels collection)
          const totalStats = {
            successful: initialTranscripts.successful + remainingTranscripts.successful,
            failed: initialTranscripts.failed + remainingTranscripts.failed,
            total: initialTranscripts.total + remainingTranscripts.total,
            isPartial: false
          };

          // Update project status (transcripts are in channels/{channelId}/videos)
          await projectRef.update({
            status: 'ready',
            transcriptStats: totalStats,
            transcriptProgress: {
              fetched: totalStats.successful,
              total: quickImport.videoCount
            },
            updatedAt: FieldValue.serverTimestamp()
          });

          console.log(`[API] ✅ All transcripts complete for ${channelId} (${totalStats.successful}/${totalStats.total})`);
        } catch (error) {
          console.error(`[API] ❌ Background transcript fetch failed:`, error);
          await projectRef.update({
            status: 'error',
            error: error.message,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      });
    }

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
