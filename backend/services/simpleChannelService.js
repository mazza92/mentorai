const { google } = require('googleapis');
const audioOnlyTranscriptionService = require('./audioOnlyTranscriptionService');
const { getFirestore } = require('../config/firestore');

/**
 * Simple & Effective Channel Import Service
 *
 * STRATEGY:
 * 1. Use YouTube Data API to fetch ALL video metadata (titles, descriptions, tags, stats)
 * 2. Store metadata in Firestore + vector DB for semantic search
 * 3. When user asks question:
 *    - Search semantically across ALL video metadata
 *    - Find top 3 most relevant videos
 *    - If no transcript exists, transcribe on-demand with AssemblyAI
 *    - Answer with full transcript + metadata
 *
 * BENEFITS:
 * - Fast: Channel indexed in <1 minute
 * - Reliable: Official YouTube API only
 * - Smart: Transcribe only what's needed
 * - Cost-effective: ~$0.45 per query (3 videos), cached forever
 */
class SimpleChannelService {
  constructor() {
    this.youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });
  }

  /**
   * Import channel with metadata only (FAST)
   * @param {string} channelId - YouTube channel ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Channel data with metadata
   */
  async importChannel(channelId, userId) {
    console.log(`[SimpleChannel] 🚀 Importing channel: ${channelId}`);
    const startTime = Date.now();

    try {
      // 1. Get channel info
      const channelData = await this.fetchChannelInfo(channelId);
      console.log(`[SimpleChannel] ✓ Channel: ${channelData.title}`);

      // 2. Get ALL videos (metadata only)
      const videos = await this.fetchAllVideos(channelId);
      console.log(`[SimpleChannel] ✓ Found ${videos.length} videos`);

      // 3. Store in Firestore
      await this.storeChannelData(channelId, {
        channelData,
        videos,
        userId,
        importedAt: new Date().toISOString(),
        strategy: 'metadata-first-transcribe-on-demand'
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[SimpleChannel] ✅ Import complete in ${elapsed}s`);

      return {
        success: true,
        channelId,
        channelName: channelData.title,
        videoCount: videos.length,
        strategy: 'Metadata-first with on-demand transcription',
        estimatedCost: '$0.00 (metadata only)',
        message: 'Channel imported! Ask questions and we\'ll transcribe videos on-demand.'
      };

    } catch (error) {
      console.error(`[SimpleChannel] ✗ Error:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch channel information
   * @param {string} channelId
   * @returns {Promise<Object>}
   */
  async fetchChannelInfo(channelId) {
    const response = await this.youtube.channels.list({
      part: 'snippet,statistics,contentDetails',
      id: channelId
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Channel not found');
    }

    const channel = response.data.items[0];
    return {
      id: channelId,
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
          hasTranscript: false,
          transcriptSource: null, // Will be 'assemblyai' when transcribed
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
   * Get or transcribe video on-demand
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
      // Check if transcript already exists
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

      // Transcript doesn't exist - transcribe on-demand
      console.log(`[SimpleChannel] 📝 Transcribing ${videoId} on-demand with AssemblyAI...`);

      const transcriptResult = await audioOnlyTranscriptionService.processVideo(videoId);

      if (!transcriptResult.success) {
        throw new Error(transcriptResult.error || 'Transcription failed');
      }

      // Store transcript
      await videoRef.update({
        hasTranscript: true,
        transcript: transcriptResult.text,
        transcriptSource: 'assemblyai',
        transcribedAt: new Date().toISOString(),
        transcriptionDuration: transcriptResult.duration,
        transcriptionCost: transcriptResult.cost || 0
      });

      console.log(`[SimpleChannel] ✅ Transcribed & cached ${videoId} (${transcriptResult.text.length} chars)`);

      return {
        videoId,
        transcript: transcriptResult.text,
        source: 'assemblyai',
        cached: false,
        duration: transcriptResult.duration,
        cost: transcriptResult.cost
      };

    } catch (error) {
      console.error(`[SimpleChannel] ✗ Error transcribing ${videoId}:`, error.message);
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
