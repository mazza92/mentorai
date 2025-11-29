const { google } = require('googleapis');
const youtubeInnertubeService = require('./youtubeInnertubeService');
const audioOnlyTranscriptionService = require('./audioOnlyTranscriptionService');
const { getFirestore } = require('../config/firestore');

/**
 * Fast Channel Import with Innertube Caption Scraping
 *
 * NEW STRATEGY (BREAKTHROUGH):
 * 1. Fetch all video metadata via YouTube Data API (< 1 min)
 * 2. Scrape existing YouTube captions using Innertube API (1-3 min for 100+ videos)
 * 3. Store everything in Firestore
 * 4. Questions answered instantly with full context
 *
 * KEY INSIGHT:
 * - Don't TRANSCRIBE audio (slow, expensive: 3+ min for 3 videos)
 * - SCRAPE existing YouTube captions (fast, free: 10-30s for 50+ videos)
 * - 70-80% of videos already have auto-generated captions
 * - Fallback to audio transcription only if captions unavailable
 *
 * BENEFITS:
 * - Fast import: 2-5 minutes for full channel with transcripts
 * - Instant Q&A: All transcripts already available
 * - Free: No transcription costs for most videos
 * - Reliable: Innertube API bypasses YouTube restrictions
 */
class SimpleChannelService {
  constructor() {
    this.youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });
  }

  /**
   * Import channel with metadata + transcripts (FAST with Innertube)
   * @param {string} channelId - YouTube channel ID
   * @param {string} userId - User ID
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Channel data with transcripts
   */
  async importChannel(channelId, userId, options = {}) {
    console.log(`[SimpleChannel] 🚀 Importing channel: ${channelId}`);
    const startTime = Date.now();

    const {
      fetchTranscripts = true, // Enable Innertube caption scraping
      maxVideosToTranscribe = null, // null = all videos, or limit for testing
      concurrency = 10 // Parallel caption fetches
    } = options;

    try {
      // 1. Get channel info (this resolves @handle to channel ID)
      const channelData = await this.fetchChannelInfo(channelId);
      const resolvedChannelId = channelData.id; // Use resolved ID throughout
      console.log(`[SimpleChannel] ✓ Channel: ${channelData.title}`);

      // 2. Get ALL videos (metadata only - fast)
      const videos = await this.fetchAllVideos(resolvedChannelId);
      console.log(`[SimpleChannel] ✓ Found ${videos.length} videos`);

      let transcriptStats = {
        total: 0,
        successful: 0,
        failed: 0,
        skipped: videos.length
      };

      // 3. Fetch transcripts using Innertube API (fast caption scraping)
      if (fetchTranscripts && videos.length > 0) {
        console.log(`[SimpleChannel] 📝 Fetching transcripts with Innertube API...`);

        const videosToProcess = maxVideosToTranscribe
          ? videos.slice(0, maxVideosToTranscribe)
          : videos;

        const transcriptResults = await youtubeInnertubeService.fetchChannelTranscripts(
          videosToProcess,
          {
            maxVideos: maxVideosToTranscribe,
            concurrency,
            prioritizeBy: 'views', // Fetch most popular videos first
            stopOnLowSuccessRate: true, // Stop early if channel has no captions
            minSampleSize: 10
          }
        );

        transcriptStats = {
          total: transcriptResults.total,
          successful: transcriptResults.successful,
          failed: transcriptResults.failed,
          skipped: (transcriptResults.skipped || 0) + (videos.length - videosToProcess.length),
          lowCaptionAvailability: transcriptResults.lowCaptionAvailability || false
        };

        const successRate = transcriptStats.total > 0
          ? ((transcriptStats.successful / transcriptStats.total) * 100).toFixed(1)
          : 0;

        console.log(`[SimpleChannel] ✓ Transcripts: ${transcriptStats.successful}/${transcriptStats.total} successful (${successRate}%)`);

        if (transcriptStats.lowCaptionAvailability) {
          console.log(`[SimpleChannel] ⚠️ This channel has low caption availability (${successRate}% success rate)`);
          console.log(`[SimpleChannel] Recommendation: Creator should enable auto-captions in YouTube Studio`);
        }

        // Update videos array with transcript data
        for (const video of videos) {
          const videoId = video.id;
          if (transcriptResults.transcripts[videoId]) {
            const transcript = transcriptResults.transcripts[videoId];
            video.status = 'ready'; // CRITICAL: videoQAService checks for this
            video.hasTranscript = true;
            video.transcript = transcript.text;
            video.transcriptSegments = transcript.segments; // Include for timestamps
            video.transcriptSource = 'youtube-innertube';
            video.transcriptLanguage = transcript.language;
            video.transcriptWordCount = transcript.wordCount;
            video.transcriptFetchedAt = new Date().toISOString();
          }
        }
      }

      // 4. Store in Firestore
      await this.storeChannelData(resolvedChannelId, {
        channelData,
        videos,
        userId,
        importedAt: new Date().toISOString(),
        strategy: 'innertube-caption-scraping',
        transcriptStats
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const elapsedMin = (elapsed / 60).toFixed(1);

      console.log(`[SimpleChannel] ✅ Import complete in ${elapsedMin} min`);

      return {
        success: true,
        channelId: resolvedChannelId, // Return resolved ID
        channelName: channelData.title,
        videoCount: videos.length,
        videos: videos, // Return videos array for background processing
        transcripts: transcriptStats,
        strategy: 'Innertube caption scraping (fast & free)',
        estimatedCost: '$0.00 (caption scraping)',
        importTime: `${elapsedMin} min`,
        message: `Channel imported with ${transcriptStats.successful} transcripts! Ready for instant Q&A.`
      };

    } catch (error) {
      console.error(`[SimpleChannel] ✗ Error:`, error.message);
      throw error;
    }
  }

  /**
   * Resolve @handle or username to channel ID
   * @param {string} handleOrId - Can be @handle, username, or UC...channelId
   * @returns {Promise<string>} Channel ID (UC...)
   */
  async resolveChannelId(handleOrId) {
    // If already a channel ID (starts with UC), return as-is
    if (handleOrId.startsWith('UC')) {
      return handleOrId;
    }

    console.log(`[SimpleChannel] Resolving handle/username: ${handleOrId}`);

    // Try search API to find channel by handle
    try {
      const searchResponse = await this.youtube.search.list({
        part: 'snippet',
        q: handleOrId,
        type: 'channel',
        maxResults: 1
      });

      if (searchResponse.data.items && searchResponse.data.items.length > 0) {
        const channelId = searchResponse.data.items[0].snippet.channelId;
        console.log(`[SimpleChannel] ✓ Resolved ${handleOrId} → ${channelId}`);
        return channelId;
      }
    } catch (searchError) {
      console.log(`[SimpleChannel] Search API failed: ${searchError.message}`);
    }

    // Fallback: Try forUsername (works for old-style usernames)
    try {
      const response = await this.youtube.channels.list({
        part: 'id',
        forUsername: handleOrId
      });

      if (response.data.items && response.data.items.length > 0) {
        const channelId = response.data.items[0].id;
        console.log(`[SimpleChannel] ✓ Resolved ${handleOrId} → ${channelId} (via forUsername)`);
        return channelId;
      }
    } catch (usernameError) {
      console.log(`[SimpleChannel] forUsername failed: ${usernameError.message}`);
    }

    throw new Error(`Could not resolve channel: ${handleOrId}. Please use the full channel URL.`);
  }

  /**
   * Fetch channel information
   * @param {string} channelId
   * @returns {Promise<Object>}
   */
  async fetchChannelInfo(channelId) {
    // Resolve handle/username to actual channel ID first
    const resolvedChannelId = await this.resolveChannelId(channelId);

    const response = await this.youtube.channels.list({
      part: 'snippet,statistics,contentDetails',
      id: resolvedChannelId
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Channel not found');
    }

    const channel = response.data.items[0];
    return {
      id: resolvedChannelId,
      title: channel.snippet.title,
      description: channel.snippet.description,
      thumbnailUrl: channel.snippet.thumbnails.high?.url,
      subscriberCount: parseInt(channel.statistics.subscriberCount) || 0,
      videoCount: parseInt(channel.statistics.videoCount) || 0,
      viewCount: parseInt(channel.statistics.viewCount) || 0,
      uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads
    };
  }

  /**
   * Fetch ALL videos from channel (metadata only - FAST)
   * @param {string} channelId
   * @returns {Promise<Array>}
   */
  async fetchAllVideos(channelId) {
    const videos = [];
    let pageToken = null;

    // First, get the uploads playlist ID
    const channelResponse = await this.youtube.channels.list({
      part: 'contentDetails',
      id: channelId
    });

    const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

    // Fetch all videos from uploads playlist
    do {
      const response = await this.youtube.playlistItems.list({
        part: 'snippet,contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: pageToken
      });

      const videoIds = response.data.items.map(item => item.contentDetails.videoId);

      // Get detailed video information
      const videoDetails = await this.youtube.videos.list({
        part: 'snippet,contentDetails,statistics',
        id: videoIds.join(',')
      });

      // Extract and format video data
      videoDetails.data.items.forEach(video => {
        videos.push({
          id: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          tags: video.snippet.tags || [],
          publishedAt: video.snippet.publishedAt,
          thumbnailUrl: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url,
          duration: this.parseDuration(video.contentDetails.duration),
          viewCount: parseInt(video.statistics.viewCount) || 0,
          likeCount: parseInt(video.statistics.likeCount) || 0,
          commentCount: parseInt(video.statistics.commentCount) || 0,
          // Track transcription status
          status: 'metadata_only', // Will be 'ready' when transcript fetched
          hasTranscript: false,
          transcriptSource: null,
          transcribedAt: null
        });
      });

      pageToken = response.data.nextPageToken;

      if (videos.length % 50 === 0) {
        console.log(`[SimpleChannel] Fetched ${videos.length} videos so far...`);
      }

    } while (pageToken);

    return videos;
  }

  /**
   * Parse ISO 8601 duration to seconds
   * @param {string} isoDuration - e.g. "PT1H2M30S"
   * @returns {number} Duration in seconds
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
   * Get or fetch video transcript with intelligent fallback
   * @param {string} channelId
   * @param {string} videoId
   * @returns {Promise<Object>} Transcript data
   */
  async getOrTranscribeVideo(channelId, videoId) {
    const { firestore, useMockMode } = getFirestore();

    if (useMockMode) {
      console.log(`[SimpleChannel] Mock mode - skipping transcript fetch`);
      return null;
    }

    try {
      // Check if transcript already exists in cache
      const videoRef = firestore.collection('channels').doc(channelId).collection('videos').doc(videoId);
      const videoDoc = await videoRef.get();

      if (videoDoc.exists && videoDoc.data().hasTranscript) {
        console.log(`[SimpleChannel] ✓ Using cached transcript for ${videoId}`);
        return {
          videoId,
          transcript: videoDoc.data().transcript,
          source: videoDoc.data().transcriptSource,
          cached: true
        };
      }

      // METHOD 1: Try Innertube caption scraping (fast, free, works for 70-80% of videos)
      console.log(`[SimpleChannel] 📝 Fetching captions for ${videoId} with Innertube...`);

      const innertubeResult = await youtubeInnertubeService.fetchTranscript(videoId);

      if (innertubeResult.success) {
        console.log(`[SimpleChannel] ✓ Captions fetched via Innertube (${innertubeResult.wordCount} words)`);

        // Store transcript
        await videoRef.update({
          status: 'ready',
          hasTranscript: true,
          transcript: innertubeResult.text,
          transcriptSegments: innertubeResult.segments,
          transcriptSource: 'youtube-innertube',
          transcriptLanguage: innertubeResult.language,
          transcriptWordCount: innertubeResult.wordCount,
          transcriptFetchedAt: new Date().toISOString(),
          transcriptCost: 0 // Free!
        });

        return {
          videoId,
          transcript: innertubeResult.text,
          source: 'youtube-innertube',
          cached: false,
          cost: 0
        };
      }

      // METHOD 2: Fallback to audio transcription (slower, costs $, but 100% success rate)
      console.log(`[SimpleChannel] ⚠️ Captions unavailable, falling back to audio transcription...`);

      const transcriptResult = await audioOnlyTranscriptionService.processVideo(videoId);

      if (!transcriptResult.success) {
        throw new Error(transcriptResult.error || 'Transcription failed');
      }

      // Store transcript
      await videoRef.update({
        status: 'ready',
        hasTranscript: true,
        transcript: transcriptResult.text,
        transcriptSource: 'assemblyai',
        transcribedAt: new Date().toISOString(),
        transcriptionDuration: transcriptResult.processingTime,
        transcriptionCost: 0.15 // Approximate cost per video
      });

      console.log(`[SimpleChannel] ✅ Transcribed & cached ${videoId} (${transcriptResult.text.length} chars)`);

      return {
        videoId,
        transcript: transcriptResult.text,
        source: 'assemblyai',
        cached: false,
        duration: transcriptResult.processingTime,
        cost: 0.15
      };

    } catch (error) {
      console.error(`[SimpleChannel] ✗ Error fetching transcript for ${videoId}:`, error.message);
      return null;
    }
  }

  /**
   * Store channel data in Firestore
   * @param {string} channelId
   * @param {Object} data
   */
  async storeChannelData(channelId, data) {
    const { firestore, useMockMode } = getFirestore();

    if (useMockMode) {
      console.log(`[SimpleChannel] Mock mode - skipping Firestore storage`);
      return;
    }

    const { channelData, videos, userId } = data;

    // Store channel document
    const channelRef = firestore.collection('channels').doc(channelId);
    await channelRef.set({
      channelId,
      channelName: channelData.title,
      channelDescription: channelData.description,
      subscriberCount: channelData.subscriberCount,
      totalVideos: videos.length,
      importedBy: userId,
      importedAt: data.importedAt,
      strategy: data.strategy,
      updatedAt: new Date().toISOString()
    });

    // Store videos (batch write for performance)
    const batch = firestore.batch();
    videos.forEach(video => {
      const videoRef = channelRef.collection('videos').doc(video.id);
      batch.set(videoRef, video);
    });

    await batch.commit();
    console.log(`[SimpleChannel] ✓ Stored ${videos.length} videos in Firestore`);
  }

  /**
   * Get channel statistics
   * @param {string} channelId
   * @returns {Promise<Object>}
   */
  async getChannelStats(channelId) {
    const { firestore, useMockMode } = getFirestore();

    if (useMockMode) {
      return {
        totalVideos: 0,
        transcribedVideos: 0,
        totalCost: 0
      };
    }

    const channelRef = firestore.collection('channels').doc(channelId);
    const videosSnapshot = await channelRef.collection('videos').get();

    const stats = {
      totalVideos: videosSnapshot.size,
      transcribedVideos: 0,
      totalCost: 0,
      transcribedPercentage: 0
    };

    videosSnapshot.forEach(doc => {
      const video = doc.data();
      if (video.hasTranscript) {
        stats.transcribedVideos++;
        stats.totalCost += video.transcriptionCost || 0;
      }
    });

    stats.transcribedPercentage = ((stats.transcribedVideos / stats.totalVideos) * 100).toFixed(1);

    return stats;
  }
}

module.exports = new SimpleChannelService();
