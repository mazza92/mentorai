const { google } = require('googleapis');
const audioOnlyTranscriptionService = require('./audioOnlyTranscriptionService');
const puppeteerCaptionFetcher = require('./puppeteerCaptionFetcher');
const captionFetcher = require('./captionFetcher');
const { getFirestore } = require('../config/firestore');

/**
 * Triple-Layered Index Service
 *
 * Smart channel ingestion with cost optimization:
 *
 * TIER 1: Metadata (FREE, INSTANT)
 * - Title, description, tags from YouTube API
 * - 100% coverage immediately
 *
 * TIER 2: Captions (FREE, FAST)
 * - Auto-generated captions when available
 * - ~70% of videos have this
 *
 * TIER 3: Audio Transcription (PAID, ON-DEMAND)
 * - High-accuracy transcription via AssemblyAI
 * - Only process when:
 *   a) User asks deep question (on-demand)
 *   b) Background worker (idle time)
 * - Cost: ~$0.064/minute (~$1.50 per 10-min video)
 */
class TripleLayeredIndexService {
  constructor() {
    this.youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });
  }

  /**
   * PHASE 1: Immediate Ingestion (Synchronous)
   * Fetches Tier 1 (metadata) + Tier 2 (captions) for entire channel
   * Makes channel instantly searchable
   *
   * @param {string} channelId - YouTube channel ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Channel data with tier status
   */
  async ingestChannelImmediate(channelId, userId) {
    const startTime = Date.now();
    console.log(`[TripleIndex] 🚀 PHASE 1: Immediate ingestion for channel ${channelId}`);

    try {
      // 1. Fetch channel metadata
      const channelData = await this.fetchChannelMetadata(channelId);
      console.log(`[TripleIndex] ✓ Channel: ${channelData.snippet.title}`);

      // 2. Fetch all videos
      const videos = await this.fetchAllVideos(channelId);
      console.log(`[TripleIndex] ✓ Found ${videos.length} videos`);

      // 3. For each video, try to get Tier 1 + Tier 2 data
      // Process in batches to avoid overwhelming the system
      const videoDataWithTiers = await this.fetchVideoTiersInBatches(videos, 10);

      // 4. Calculate tier coverage
      const tierStats = this.calculateTierStats(videoDataWithTiers);

      // 5. Store in Firestore
      await this.storeChannelData(channelId, {
        channelData,
        videos: videoDataWithTiers,
        tierStats,
        userId
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`[TripleIndex] ✅ PHASE 1 Complete in ${elapsed}s`);
      console.log(`[TripleIndex] Tier 1 (Metadata): ${tierStats.tier1Count}/${videos.length} (100%)`);
      console.log(`[TripleIndex] Tier 2 (Captions): ${tierStats.tier2Count}/${videos.length} (${tierStats.tier2Percentage}%)`);
      console.log(`[TripleIndex] Tier 3 (Transcription): 0/${videos.length} (0% - on-demand)`);

      return {
        success: true,
        channelId,
        channelName: channelData.snippet.title,
        videoCount: videos.length,
        tierStats,
        estimatedSavings: this.calculateSavings(tierStats),
        processingTime: elapsed
      };

    } catch (error) {
      console.error(`[TripleIndex] ✗ PHASE 1 failed:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch video tiers in batches to avoid overwhelming the system
   * @param {Array} videos - Array of video metadata
   * @param {number} batchSize - Number of videos to process at once
   * @returns {Promise<Array>} Videos with tier data
   */
  async fetchVideoTiersInBatches(videos, batchSize = 10) {
    const results = [];
    const chunks = this.chunkArray(videos, batchSize);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[TripleIndex] Processing tier batch ${i + 1}/${chunks.length} (${chunk.length} videos)`);

      const chunkResults = await Promise.all(
        chunk.map(video => this.fetchVideoTiers(video))
      );

      results.push(...chunkResults);

      // Small delay between batches
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Fetch video with Tier 1 + Tier 2 data
   * @param {Object} video - Video metadata
   * @returns {Promise<Object>} Video with tier data
   */
  async fetchVideoTiers(video) {
    const videoData = {
      ...video,
      tiers: {
        tier1: { status: 'ready', data: null },
        tier2: { status: 'not_available', data: null },
        tier3: { status: 'not_started', data: null }
      }
    };

    // TIER 1: Always available (metadata)
    videoData.tiers.tier1 = {
      status: 'ready',
      data: {
        title: video.title,
        description: video.description,
        tags: video.tags || [],
        publishedAt: video.publishedAt,
        duration: video.duration,
        viewCount: video.viewCount
      },
      charCount: (video.title + video.description).length,
      source: 'youtube_api'
    };

    // TIER 2: Try to get captions (best effort)
    try {
      const captions = await this.fetchCaptionsBestEffort(video.id);

      if (captions && captions.length > 0) {
        const captionText = captions.map(c => c.text).join(' ');
        videoData.tiers.tier2 = {
          status: 'ready',
          data: captions,
          text: captionText,
          charCount: captionText.length,
          segmentCount: captions.length,
          source: 'youtube_captions'
        };
      }
    } catch (error) {
      console.log(`[TripleIndex] Tier 2 not available for ${video.id}: ${error.message}`);
    }

    return videoData;
  }

  /**
   * Best-effort caption fetching (don't let failures block channel import)
   * Uses multiple fallback methods to maximize success rate
   * @param {string} videoId
   * @returns {Promise<Array|null>}
   */
  async fetchCaptionsBestEffort(videoId) {
    // METHOD 1: Try Puppeteer (real browser - most reliable)
    try {
      console.log(`[TripleIndex] Trying Puppeteer for ${videoId}`);
      const result = await puppeteerCaptionFetcher.fetchCaptions(videoId);

      if (result.success && result.segments && result.segments.length > 0) {
        console.log(`[TripleIndex] ✓ Puppeteer: ${result.segments.length} segments`);
        return result.segments;
      }
    } catch (error) {
      console.log(`[TripleIndex] Puppeteer failed for ${videoId}: ${error.message}`);
    }

    // METHOD 2: Try Python youtube-transcript-api (lightweight fallback)
    try {
      console.log(`[TripleIndex] Trying Python API for ${videoId}`);
      const result = await captionFetcher.fetchTranscript(videoId);

      if (result.success && result.segments && result.segments.length > 0) {
        console.log(`[TripleIndex] ✓ Python API: ${result.segments.length} segments`);
        return result.segments;
      }
    } catch (error) {
      console.log(`[TripleIndex] Python API failed for ${videoId}: ${error.message}`);
    }

    // No captions available from any method
    console.log(`[TripleIndex] No captions available for ${videoId}`);
    return null;
  }

  /**
   * PHASE 2: On-Demand Processing
   * When user asks deep question and Tier 1/2 insufficient
   *
   * @param {string} videoId - Video ID to process
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Tier 3 data
   */
  async processVideoOnDemand(videoId, channelId, userId) {
    console.log(`[TripleIndex] 🎯 PHASE 2: On-demand processing for ${videoId}`);

    try {
      const { firestore } = getFirestore();

      // Check if already processed
      const videoRef = firestore.collection('channels').doc(channelId).collection('videos').doc(videoId);
      const videoDoc = await videoRef.get();

      if (!videoDoc.exists) {
        throw new Error('Video not found');
      }

      const videoData = videoDoc.data();

      // Check if Tier 3 already exists
      if (videoData.tiers?.tier3?.status === 'ready') {
        console.log(`[TripleIndex] ✓ Tier 3 already available for ${videoId}`);
        return videoData.tiers.tier3;
      }

      // Mark as processing
      await videoRef.update({
        'tiers.tier3.status': 'processing',
        'tiers.tier3.startedAt': new Date()
      });

      // Process audio transcription
      console.log(`[TripleIndex] 🎤 Starting Tier 3 transcription...`);
      const transcriptResult = await audioOnlyTranscriptionService.processVideo(videoId);

      if (!transcriptResult.success) {
        await videoRef.update({
          'tiers.tier3.status': 'failed',
          'tiers.tier3.error': transcriptResult.error,
          'tiers.tier3.failedAt': new Date()
        });
        throw new Error(transcriptResult.error);
      }

      // Store Tier 3 data
      const tier3Data = {
        status: 'ready',
        data: transcriptResult.segments,
        text: transcriptResult.text,
        words: transcriptResult.words,
        charCount: transcriptResult.charCount,
        wordCount: transcriptResult.wordCount,
        language: transcriptResult.language,
        confidence: transcriptResult.confidence,
        source: 'assemblyai',
        processedAt: new Date(),
        processingTime: transcriptResult.processingTime,
        cost: this.calculateTranscriptionCost(videoData.duration)
      };

      await videoRef.update({
        'tiers.tier3': tier3Data
      });

      // Update channel stats
      await this.updateChannelTierStats(channelId);

      console.log(`[TripleIndex] ✅ Tier 3 ready for ${videoId}`);

      return tier3Data;

    } catch (error) {
      console.error(`[TripleIndex] ✗ On-demand processing failed:`, error.message);
      throw error;
    }
  }

  /**
   * PHASE 3: Background Optimization
   * Process videos during idle time with smart prioritization
   *
   * @param {string} channelId - Channel ID
   * @param {Object} options - Priority options
   * @returns {Promise<Object>} Processing results
   */
  async processBackgroundQueue(channelId, options = {}) {
    const {
      maxVideos = 10,
      maxCost = 20, // $20 budget per run
      priorityStrategy = 'smart' // 'smart', 'newest', 'shortest'
    } = options;

    console.log(`[TripleIndex] 🌙 PHASE 3: Background processing for ${channelId}`);
    console.log(`[TripleIndex] Budget: $${maxCost}, Max videos: ${maxVideos}`);

    try {
      const { firestore } = getFirestore();

      // Get all videos that need Tier 3
      const videosRef = firestore.collection('channels').doc(channelId).collection('videos');
      const snapshot = await videosRef
        .where('tiers.tier3.status', 'in', ['not_started', 'failed'])
        .get();

      if (snapshot.empty) {
        console.log(`[TripleIndex] ✓ All videos already processed`);
        return { processed: 0, skipped: 0, cost: 0 };
      }

      const videosToProcess = [];
      snapshot.forEach(doc => videosToProcess.push({ id: doc.id, ...doc.data() }));

      console.log(`[TripleIndex] Found ${videosToProcess.length} videos needing Tier 3`);

      // Apply priority strategy
      const prioritizedVideos = this.prioritizeVideos(videosToProcess, priorityStrategy);

      // Process videos within budget
      const results = {
        processed: 0,
        failed: 0,
        skipped: 0,
        totalCost: 0,
        videos: []
      };

      for (const video of prioritizedVideos) {
        // Check budget
        const estimatedCost = this.calculateTranscriptionCost(video.duration);

        if (results.totalCost + estimatedCost > maxCost) {
          console.log(`[TripleIndex] ⚠️  Budget limit reached ($${maxCost})`);
          results.skipped = prioritizedVideos.length - results.processed - results.failed;
          break;
        }

        if (results.processed >= maxVideos) {
          console.log(`[TripleIndex] ⚠️  Video limit reached (${maxVideos})`);
          results.skipped = prioritizedVideos.length - results.processed - results.failed;
          break;
        }

        // Process video
        try {
          console.log(`[TripleIndex] Processing ${video.id} (${video.title.substring(0, 50)}...)`);

          const tier3Data = await this.processVideoOnDemand(video.id, channelId, null);

          results.processed++;
          results.totalCost += tier3Data.cost;
          results.videos.push({
            videoId: video.id,
            title: video.title,
            cost: tier3Data.cost,
            status: 'success'
          });

        } catch (error) {
          console.error(`[TripleIndex] ✗ Failed to process ${video.id}:`, error.message);
          results.failed++;
          results.videos.push({
            videoId: video.id,
            title: video.title,
            error: error.message,
            status: 'failed'
          });
        }

        // Small delay between videos
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`[TripleIndex] ✅ Background processing complete`);
      console.log(`[TripleIndex] Processed: ${results.processed}, Failed: ${results.failed}, Skipped: ${results.skipped}`);
      console.log(`[TripleIndex] Total cost: $${results.totalCost.toFixed(2)}`);

      return results;

    } catch (error) {
      console.error(`[TripleIndex] ✗ Background processing failed:`, error.message);
      throw error;
    }
  }

  /**
   * Prioritize videos based on strategy
   */
  prioritizeVideos(videos, strategy) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (strategy) {
      case 'newest':
        // Newest first (< 30 days)
        return videos
          .filter(v => new Date(v.publishedAt) > thirtyDaysAgo)
          .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

      case 'shortest':
        // Shortest first (cheapest)
        return videos.sort((a, b) => a.duration - b.duration);

      case 'smart':
      default:
        // Smart priority:
        // 1. Tier 2 failures (no captions)
        // 2. Newest (< 30 days)
        // 3. Shortest
        return videos.sort((a, b) => {
          // Priority 1: Tier 2 failed
          const aTier2Failed = a.tiers?.tier2?.status === 'not_available';
          const bTier2Failed = b.tiers?.tier2?.status === 'not_available';
          if (aTier2Failed !== bTier2Failed) return aTier2Failed ? -1 : 1;

          // Priority 2: Newest
          const aIsNew = new Date(a.publishedAt) > thirtyDaysAgo;
          const bIsNew = new Date(b.publishedAt) > thirtyDaysAgo;
          if (aIsNew !== bIsNew) return aIsNew ? -1 : 1;

          // Priority 3: Shortest
          return a.duration - b.duration;
        });
    }
  }

  /**
   * Calculate tier statistics
   */
  calculateTierStats(videos) {
    const tier1Count = videos.filter(v => v.tiers.tier1.status === 'ready').length;
    const tier2Count = videos.filter(v => v.tiers.tier2.status === 'ready').length;
    const tier3Count = videos.filter(v => v.tiers.tier3.status === 'ready').length;

    return {
      tier1Count,
      tier2Count,
      tier3Count,
      tier1Percentage: ((tier1Count / videos.length) * 100).toFixed(1),
      tier2Percentage: ((tier2Count / videos.length) * 100).toFixed(1),
      tier3Percentage: ((tier3Count / videos.length) * 100).toFixed(1),
      totalVideos: videos.length
    };
  }

  /**
   * Calculate cost savings from tier strategy
   */
  calculateSavings(tierStats) {
    const tier2Savings = tierStats.tier2Count * 1.50; // Avg $1.50 saved per video with captions
    const tier3Cost = tierStats.tier3Count * 1.50; // Avg $1.50 spent per transcribed video
    const potentialCost = tierStats.totalVideos * 1.50; // Cost if transcribing everything

    return {
      tier2Savings: `$${tier2Savings.toFixed(2)}`,
      tier3Cost: `$${tier3Cost.toFixed(2)}`,
      potentialCost: `$${potentialCost.toFixed(2)}`,
      actualSavings: `$${(potentialCost - tier3Cost).toFixed(2)}`,
      savingsPercentage: `${(((potentialCost - tier3Cost) / potentialCost) * 100).toFixed(1)}%`
    };
  }

  /**
   * Calculate transcription cost based on duration
   */
  calculateTranscriptionCost(durationSeconds) {
    const minutes = durationSeconds / 60;
    const costPerMinute = 0.15; // AssemblyAI pricing
    return parseFloat((minutes * costPerMinute).toFixed(2));
  }

  /**
   * Update channel tier statistics
   */
  async updateChannelTierStats(channelId) {
    const { firestore } = getFirestore();

    const videosRef = firestore.collection('channels').doc(channelId).collection('videos');
    const snapshot = await videosRef.get();

    const videos = [];
    snapshot.forEach(doc => videos.push({ id: doc.id, ...doc.data() }));

    const tierStats = this.calculateTierStats(videos);

    await firestore.collection('channels').doc(channelId).update({
      tierStats,
      updatedAt: new Date()
    });

    return tierStats;
  }

  /**
   * Fetch channel metadata from YouTube
   */
  async fetchChannelMetadata(channelId) {
    const response = await this.youtube.channels.list({
      part: 'snippet,contentDetails,statistics',
      id: channelId
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Channel not found');
    }

    return response.data.items[0];
  }

  /**
   * Fetch all videos from channel
   */
  async fetchAllVideos(channelId) {
    const channelData = await this.fetchChannelMetadata(channelId);
    const uploadsPlaylistId = channelData.contentDetails.relatedPlaylists.uploads;

    const videos = [];
    let pageToken = null;

    do {
      const response = await this.youtube.playlistItems.list({
        part: 'snippet,contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken
      });

      const videoIds = response.data.items.map(item => item.contentDetails.videoId);

      // Get detailed video info
      const videoDetails = await this.youtube.videos.list({
        part: 'snippet,contentDetails,statistics',
        id: videoIds.join(',')
      });

      videos.push(...videoDetails.data.items.map(v => ({
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        tags: v.snippet.tags || [],
        publishedAt: v.snippet.publishedAt,
        thumbnailUrl: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.default?.url,
        duration: this.parseDuration(v.contentDetails.duration),
        viewCount: parseInt(v.statistics.viewCount) || 0,
        likeCount: parseInt(v.statistics.likeCount) || 0
      })));

      pageToken = response.data.nextPageToken;

    } while (pageToken);

    return videos;
  }

  /**
   * Parse ISO 8601 duration to seconds
   */
  parseDuration(isoDuration) {
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Chunk array helper
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Store channel data in Firestore
   */
  async storeChannelData(channelId, data) {
    const { firestore } = getFirestore();
    const { channelData, videos, tierStats, userId } = data;
    const batch = firestore.batch();

    // Store channel document
    const channelRef = firestore.collection('channels').doc(channelId);
    batch.set(channelRef, {
      channelId,
      channelName: channelData.snippet.title,
      channelDescription: channelData.snippet.description,
      thumbnailUrl: channelData.snippet.thumbnails.high?.url,
      videoCount: videos.length,
      tierStats,
      userId,
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Store each video
    for (const video of videos) {
      const videoRef = channelRef.collection('videos').doc(video.id);
      batch.set(videoRef, {
        videoId: video.id,
        title: video.title,
        description: video.description,
        tags: video.tags,
        duration: video.duration,
        publishedAt: new Date(video.publishedAt),
        thumbnailUrl: video.thumbnailUrl,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        tiers: video.tiers,
        createdAt: new Date()
      });
    }

    await batch.commit();
    console.log(`[TripleIndex] 💾 Stored ${videos.length} videos in Firestore`);
  }
}

module.exports = new TripleLayeredIndexService();
