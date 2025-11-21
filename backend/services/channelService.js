const { google } = require('googleapis');
const youtube = google.youtube('v3');
const { getFirestore } = require('../config/firestore');
const captionService = require('./captionService');
const { mockProjects, mockUsers } = require('../utils/mockStorage');

// Add mock channel storage
const mockChannels = new Map();

/**
 * Service for importing and managing YouTube channels
 */
class ChannelService {

  /**
   * Import entire YouTube channel
   * @param {string} channelUrl - YouTube channel URL
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Channel metadata
   */
  async importChannel(channelUrl, userId) {
    console.log(`[ChannelService] Importing channel: ${channelUrl}`);

    // 1. Parse channel URL to get channel ID
    const channelId = await this.extractChannelId(channelUrl);
    if (!channelId) {
      throw new Error('Invalid YouTube channel URL');
    }

    // 2. Check if user has quota
    await this.checkUserQuota(userId);

    // 3. Fetch channel metadata from YouTube API
    const channelData = await this.fetchChannelMetadata(channelId);

    // 4. Fetch all video IDs from channel
    const videos = await this.fetchChannelVideos(channelId);

    console.log(`[ChannelService] Found ${videos.length} videos in channel`);

    // 5. Create channel document in Firestore/mock storage
    const channelDoc = {
      channelId,
      channelUrl,
      channelName: channelData.snippet.title,
      channelDescription: channelData.snippet.description || '',
      thumbnailUrl: channelData.snippet.thumbnails.high?.url || channelData.snippet.thumbnails.default?.url,
      videoCount: videos.length,
      processedVideoCount: 0,
      totalDuration: 0,
      userId,
      status: 'processing',
      mode: 'captions',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const { firestore, useMockMode } = getFirestore();

    if (useMockMode || !firestore) {
      mockChannels.set(channelId, channelDoc);
    } else {
      await firestore.collection('channels').doc(channelId).set(channelDoc);
    }

    // 6. Process videos (fetch captions for all) - async, don't wait
    this.processChannelVideos(channelId, videos).catch(err => {
      console.error(`[ChannelService] Error processing videos:`, err);
    });

    // 7. Update user quota
    await this.incrementUserQuota(userId, 'channelImports');

    // 8. Create project for this channel
    const projectId = await this.createChannelProject(userId, channelId, channelData);

    return {
      channelId,
      projectId,
      channelName: channelData.snippet.title,
      videoCount: videos.length,
      status: 'ready',
      message: 'Channel imported successfully. You can start asking questions!'
    };
  }

  /**
   * Process all videos in channel (fetch captions)
   */
  async processChannelVideos(channelId, videos) {
    console.log(`[ChannelService] Processing ${videos.length} videos...`);

    const { firestore, useMockMode } = getFirestore();

    // Process in batches to avoid overwhelming API
    const BATCH_SIZE = 10;
    const batches = this.chunkArray(videos, BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[ChannelService] Processing batch ${i + 1}/${batches.length}`);

      // Process batch in parallel
      await Promise.all(
        batch.map(video => this.processVideo(channelId, video))
      );

      // Update progress
      const processedCount = (i + 1) * BATCH_SIZE;
      if (useMockMode || !firestore) {
        const channel = mockChannels.get(channelId);
        if (channel) {
          channel.processedVideoCount = Math.min(processedCount, videos.length);
          channel.updatedAt = new Date();
        }
      } else {
        await firestore.collection('channels').doc(channelId).update({
          processedVideoCount: Math.min(processedCount, videos.length),
          updatedAt: new Date()
        });
      }
    }

    // Mark channel as ready
    if (useMockMode || !firestore) {
      const channel = mockChannels.get(channelId);
      if (channel) {
        channel.status = 'ready';
        channel.updatedAt = new Date();
      }
    } else {
      await firestore.collection('channels').doc(channelId).update({
        status: 'ready',
        updatedAt: new Date()
      });
    }

    console.log(`[ChannelService] All videos processed!`);
  }

  /**
   * Process single video (fetch captions)
   */
  async processVideo(channelId, video) {
    const { firestore, useMockMode } = getFirestore();

    try {
      console.log(`[ChannelService] Processing video: ${video.id}`);

      // 1. Fetch captions from YouTube
      const captionData = await captionService.fetchYouTubeCaptionsWithFallback(video.id);

      // 2. Assess caption quality
      const quality = this.assessCaptionQuality(captionData);

      // 3. Store video document
      const videoDoc = {
        videoId: video.id,
        title: video.snippet.title,
        description: video.snippet.description || '',
        duration: this.parseDuration(video.contentDetails.duration),
        publishedAt: new Date(video.snippet.publishedAt),
        thumbnailUrl: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url,
        viewCount: parseInt(video.statistics?.viewCount || 0),
        transcript: captionData.text,
        transcriptSegments: captionData.segments,
        transcriptSource: captionData.available ? 'youtube_captions' : 'none',
        transcriptQuality: quality.score,
        status: captionData.available ? 'ready' : 'no_captions',
        processedAt: new Date(),
        priority: this.calculatePriority(video)
      };

      if (useMockMode || !firestore) {
        // Store in mock storage
        if (!mockChannels.has(channelId)) {
          mockChannels.set(channelId, { videos: new Map() });
        }
        const channel = mockChannels.get(channelId);
        if (!channel.videos) channel.videos = new Map();
        channel.videos.set(video.id, videoDoc);
      } else {
        await firestore.collection('channels').doc(channelId)
          .collection('videos').doc(video.id)
          .set(videoDoc);
      }

      console.log(`[ChannelService] ✓ Video processed: ${video.snippet.title}`);

    } catch (error) {
      console.error(`[ChannelService] Error processing video ${video.id}:`, error.message);

      // Store error state
      const errorDoc = {
        videoId: video.id,
        title: video.snippet?.title || 'Unknown',
        status: 'error',
        error: error.message,
        processedAt: new Date()
      };

      if (useMockMode || !firestore) {
        const channel = mockChannels.get(channelId);
        if (channel && channel.videos) {
          channel.videos.set(video.id, errorDoc);
        }
      } else {
        await firestore.collection('channels').doc(channelId)
          .collection('videos').doc(video.id)
          .set(errorDoc);
      }
    }
  }

  /**
   * Fetch channel metadata from YouTube API
   */
  async fetchChannelMetadata(channelId) {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY not configured. Please add it to your environment variables.');
    }

    const response = await youtube.channels.list({
      key: process.env.YOUTUBE_API_KEY,
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
  async fetchChannelVideos(channelId) {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY not configured');
    }

    const videos = [];
    let pageToken = null;

    // Get uploads playlist ID
    const channelData = await this.fetchChannelMetadata(channelId);
    const uploadsPlaylistId = channelData.contentDetails.relatedPlaylists.uploads;

    do {
      const response = await youtube.playlistItems.list({
        key: process.env.YOUTUBE_API_KEY,
        part: 'snippet,contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: pageToken
      });

      // Fetch detailed info for each video
      const videoIds = response.data.items.map(item => item.contentDetails.videoId);
      const videoDetails = await youtube.videos.list({
        key: process.env.YOUTUBE_API_KEY,
        part: 'snippet,contentDetails,statistics',
        id: videoIds.join(',')
      });

      videos.push(...videoDetails.data.items);
      pageToken = response.data.nextPageToken;

    } while (pageToken && videos.length < 300); // Limit to 300 videos for MVP

    return videos;
  }

  /**
   * Extract channel ID from various URL formats
   */
  async extractChannelId(url) {
    // Handle different YouTube URL formats:
    // - youtube.com/@username
    // - youtube.com/channel/UC...
    // - youtube.com/c/CustomName

    // First, try to extract from URL patterns
    const patterns = [
      /youtube\.com\/channel\/(UC[\w-]+)/,
      /youtube\.com\/@([\w-]+)/,
      /youtube\.com\/c\/([\w-]+)/,
      /youtube\.com\/user\/([\w-]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const identifier = match[1];

        // If it's already a channel ID (starts with UC)
        if (/^UC[\w-]{22}$/.test(identifier)) {
          return identifier;
        }

        // Otherwise, need to resolve @username or custom URL to channel ID
        try {
          return await this.resolveChannelId(identifier);
        } catch (error) {
          console.error(`Failed to resolve channel ID from ${identifier}:`, error.message);
        }
      }
    }

    // If it's already a channel ID
    if (/^UC[\w-]{22}$/.test(url)) {
      return url;
    }

    throw new Error('Could not extract channel ID from URL');
  }

  /**
   * Resolve username/custom URL to channel ID
   */
  async resolveChannelId(identifier) {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY not configured');
    }

    // Try searching by username
    try {
      const response = await youtube.channels.list({
        key: process.env.YOUTUBE_API_KEY,
        part: 'id',
        forUsername: identifier
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0].id;
      }
    } catch (error) {
      console.log(`Could not find channel by username: ${identifier}`);
    }

    // Try searching by handle
    try {
      const response = await youtube.search.list({
        key: process.env.YOUTUBE_API_KEY,
        part: 'snippet',
        q: identifier,
        type: 'channel',
        maxResults: 1
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0].snippet.channelId;
      }
    } catch (error) {
      console.log(`Could not find channel by search: ${identifier}`);
    }

    throw new Error(`Could not resolve channel ID from: ${identifier}`);
  }

  /**
   * Calculate priority for video processing
   */
  calculatePriority(video) {
    const views = parseInt(video.statistics?.viewCount || 0);
    const recency = Date.now() - new Date(video.snippet.publishedAt).getTime();
    const recencyDays = recency / (1000 * 60 * 60 * 24);

    // Higher priority = more views + more recent
    return views / (recencyDays + 1);
  }

  /**
   * Assess caption quality
   */
  assessCaptionQuality(captionData) {
    if (!captionData.available || !captionData.text) {
      return { score: 0, recommendation: 'transcribe' };
    }

    const text = captionData.text;
    const checks = {
      hasPunctuation: /[.!?]/.test(text) ? 0.2 : 0,
      hasCapitalization: /[A-Z]/.test(text) ? 0.2 : 0,
      wordCount: text.split(' ').length > 100 ? 0.2 : 0,
      notAllCaps: text !== text.toUpperCase() ? 0.2 : 0,
      hasSegments: captionData.segments && captionData.segments.length > 0 ? 0.2 : 0
    };

    const score = Object.values(checks).reduce((a, b) => a + b, 0);

    return {
      score,
      recommendation: score > 0.6 ? 'use_captions' : 'transcribe'
    };
  }

  /**
   * Create project for channel
   */
  async createChannelProject(userId, channelId, channelData) {
    const projectId = `channel_${channelId}_${Date.now()}`;
    const { firestore, useMockMode } = getFirestore();

    const projectDoc = {
      id: projectId,
      userId,
      type: 'channel',
      channelId,
      title: channelData.snippet.title,
      description: `Full channel Q&A: ${channelData.snippet.title}`,
      thumbnail: channelData.snippet.thumbnails.high?.url || channelData.snippet.thumbnails.default?.url,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'ready'
    };

    if (useMockMode || !firestore) {
      mockProjects.set(projectId, projectDoc);
    } else {
      await firestore.collection('projects').doc(projectId).set(projectDoc);
    }

    return projectId;
  }

  /**
   * Check user quota for channel imports
   */
  async checkUserQuota(userId) {
    const { firestore, useMockMode } = getFirestore();

    let userData;
    if (useMockMode || !firestore) {
      userData = mockUsers.get(userId);
    } else {
      const userDoc = await firestore.collection('users').doc(userId).get();
      userData = userDoc.exists ? userDoc.data() : null;
    }

    if (!userData) {
      // User doesn't exist, create default limits
      return; // Allow first import
    }

    const channelImportsThisMonth = userData.channelImportsThisMonth || 0;
    const tier = userData.tier || 'free';

    // Define limits by tier
    const limits = {
      'anonymous': 0,
      'free': 1,
      'pro': -1 // unlimited
    };

    const maxChannelImports = limits[tier] || 1;

    if (maxChannelImports !== -1 && channelImportsThisMonth >= maxChannelImports) {
      throw new Error('Channel import limit reached. Please upgrade to Pro for unlimited channel imports.');
    }
  }

  /**
   * Increment user quota
   */
  async incrementUserQuota(userId, quotaType) {
    const { firestore, useMockMode } = getFirestore();

    if (useMockMode || !firestore) {
      const user = mockUsers.get(userId) || { userId };
      user[quotaType + 'ThisMonth'] = (user[quotaType + 'ThisMonth'] || 0) + 1;
      user.updatedAt = new Date();
      mockUsers.set(userId, user);
    } else {
      const userRef = firestore.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const current = userDoc.data()[quotaType + 'ThisMonth'] || 0;
        await userRef.update({
          [quotaType + 'ThisMonth']: current + 1,
          updatedAt: new Date()
        });
      } else {
        // Create user document
        await userRef.set({
          userId,
          [quotaType + 'ThisMonth']: 1,
          tier: 'free',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
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
   * Utility: Chunk array into smaller arrays
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get channel by ID
   */
  async getChannel(channelId) {
    const { firestore, useMockMode } = getFirestore();

    if (useMockMode || !firestore) {
      const channel = mockChannels.get(channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }
      return { id: channelId, ...channel };
    } else {
      const channelDoc = await firestore.collection('channels').doc(channelId).get();
      if (!channelDoc.exists) {
        throw new Error('Channel not found');
      }
      return { id: channelDoc.id, ...channelDoc.data() };
    }
  }

  /**
   * Get all videos in channel
   */
  async getChannelVideos(channelId) {
    const { firestore, useMockMode } = getFirestore();

    if (useMockMode || !firestore) {
      const channel = mockChannels.get(channelId);
      if (!channel || !channel.videos) {
        return [];
      }
      return Array.from(channel.videos.values());
    } else {
      // Get all videos (frontend handles filtering/sorting)
      // Simplified query to avoid composite index requirement
      const videosSnapshot = await firestore.collection('channels')
        .doc(channelId)
        .collection('videos')
        .orderBy('publishedAt', 'desc')
        .get();

      return videosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }
  }
}

module.exports = new ChannelService();
module.exports.mockChannels = mockChannels; // Export for testing
