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

    // 6. Generate suggested chat starters (NotebookLM-style instant value)
    const chatStarters = await this.generateChatStarters(channelData, videos);

    // 7. Process videos (fetch captions for all) - async, don't wait
    this.processChannelVideos(channelId, videos, userId).catch(err => {
      console.error(`[ChannelService] Error processing videos:`, err);
    });

    // 8. Update user quota
    await this.incrementUserQuota(userId, 'channelImports');

    // 9. Create project for this channel (include chatStarters)
    const projectId = await this.createChannelProject(userId, channelId, channelData, {
      chatStarters,
      sourceCount: videos.length,
      videoCount: videos.length
    });

    // INSTANT RETURN with NotebookLM-style preview
    return {
      channelId,
      projectId,
      channelName: channelData.snippet.title,
      channelDescription: channelData.snippet.description || '',
      thumbnailUrl: channelData.snippet.thumbnails.high?.url || channelData.snippet.thumbnails.default?.url,
      videoCount: videos.length,
      processedCount: 0, // Processing starts in background
      sourceCount: videos.length, // NotebookLM shows "X sources"
      status: 'ready', // Instant ready state
      chatStarters, // Auto-generated suggested questions
      message: `Imported ${videos.length} videos. Enhancing quality with background transcription...`
    };
  }

  /**
   * Process all videos in channel (fetch captions)
   */
  async processChannelVideos(channelId, videos, userId = null) {
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

    // After caption processing, queue top videos for transcription
    await this.queueTopVideosForTranscription(channelId, userId);
  }

  /**
   * Generate NotebookLM-style chat starters from channel data
   * Creates 3-4 suggested questions based on video titles and channel description
   */
  async generateChatStarters(channelData, videos) {
    try {
      // Get most popular/recent video titles for context (top 10)
      const topVideos = videos
        .sort((a, b) => {
          const aViews = parseInt(a.statistics?.viewCount || 0);
          const bViews = parseInt(b.statistics?.viewCount || 0);
          return bViews - aViews;
        })
        .slice(0, 10)
        .map(v => v.snippet.title);

      // Use OpenAI to generate contextual questions
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `You are analyzing a YouTube channel to generate suggested starter questions for users.

Channel: ${channelData.snippet.title}
Description: ${channelData.snippet.description?.substring(0, 500) || 'No description'}

Top Video Titles:
${topVideos.map((title, i) => `${i + 1}. ${title}`).join('\n')}

Generate exactly 3 concise, insightful questions that users would want to ask about this channel's content. Questions should:
- Be specific to the channel's topic/niche
- Reference key themes or topics from the video titles
- Be actionable (ask "how", "what", "why")
- Be 8-15 words long

Return ONLY the 3 questions, one per line, no numbering or bullets.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 200
      });

      const response = completion.choices[0].message.content.trim();
      const questions = response
        .split('\n')
        .filter(q => q.trim().length > 0)
        .slice(0, 3);

      console.log(`[ChannelService] Generated ${questions.length} chat starters`);
      return questions;

    } catch (error) {
      console.error('[ChannelService] Error generating chat starters:', error.message);
      // Fallback generic questions
      return [
        'What are the main topics covered in this channel?',
        'What are the most popular videos and their key takeaways?',
        'How has this creator\'s content evolved over time?'
      ];
    }
  }

  /**
   * Select and queue top videos for transcription
   * Prioritizes recent, popular, long-form content
   */
  async queueTopVideosForTranscription(channelId, userId) {
    const { firestore, useMockMode } = getFirestore();

    try {
      // Get all videos that need transcription
      let videos;
      if (useMockMode || !firestore) {
        const channel = mockChannels.get(channelId);
        videos = channel?.videos ? Array.from(channel.videos.values()) : [];
      } else {
        const snapshot = await firestore.collection('channels')
          .doc(channelId)
          .collection('videos')
          .where('needsTranscription', '==', true)
          .get();
        videos = snapshot.docs.map(doc => doc.data());
      }

      // Sort by priority (highest first)
      videos.sort((a, b) => b.priority - a.priority);

      // Select top 20 videos
      const TOP_COUNT = 20;
      const topVideos = videos.slice(0, TOP_COUNT);

      console.log(`[ChannelService] Selected ${topVideos.length} videos for transcription (out of ${videos.length} total)`);

      // Queue each video for transcription (background job)
      const { queueVideoTranscription } = require('./transcriptionQueue');
      for (const video of topVideos) {
        // Queue transcription (non-blocking)
        queueVideoTranscription({
          channelId,
          videoId: video.videoId,
          title: video.title,
          duration: video.duration,
          priority: video.priority,
          userId
        }).catch(err => {
          console.error(`Failed to queue transcription for ${video.videoId}:`, err.message);
        });
      }

      return topVideos.length;
    } catch (error) {
      console.error('[ChannelService] Error queuing transcriptions:', error);
      return 0;
    }
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

      // 3. Store video document with rich metadata
      const videoDoc = {
        videoId: video.id,
        title: video.snippet.title,
        description: video.snippet.description || '',
        duration: this.parseDuration(video.contentDetails.duration),
        publishedAt: new Date(video.snippet.publishedAt),
        thumbnailUrl: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url,

        // Statistics for ranking
        viewCount: parseInt(video.statistics?.viewCount || 0),
        likeCount: parseInt(video.statistics?.likeCount || 0),
        commentCount: parseInt(video.statistics?.commentCount || 0),

        // Caption data (often unavailable)
        transcript: captionData.text,
        transcriptSegments: captionData.segments,
        transcriptSource: captionData.available ? 'youtube_captions' : 'none',
        transcriptQuality: quality.score,

        // Status and priority
        status: captionData.available ? 'ready' : 'no_captions',
        needsTranscription: !captionData.available && this.parseDuration(video.contentDetails.duration) >= 60, // Videos >= 1min
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
   * Calculate priority for video transcription
   * Higher priority = more likely to be asked about
   */
  calculatePriority(video) {
    let score = 0;

    // 1. Recency (most important - 40 points max)
    const recency = Date.now() - new Date(video.snippet.publishedAt).getTime();
    const recencyDays = recency / (1000 * 60 * 60 * 24);
    if (recencyDays < 30) score += 40; // Last month
    else if (recencyDays < 90) score += 30; // Last 3 months
    else if (recencyDays < 180) score += 20; // Last 6 months
    else if (recencyDays < 365) score += 10; // Last year

    // 2. View count relative to channel (30 points max)
    const views = parseInt(video.statistics?.viewCount || 0);
    if (views > 100000) score += 30;
    else if (views > 50000) score += 20;
    else if (views > 10000) score += 10;
    else if (views > 1000) score += 5;

    // 3. Engagement (likes + comments = 20 points max)
    const likes = parseInt(video.statistics?.likeCount || 0);
    const comments = parseInt(video.statistics?.commentCount || 0);
    const engagement = likes + comments * 2; // Comments worth 2x likes
    if (engagement > 5000) score += 20;
    else if (engagement > 1000) score += 15;
    else if (engagement > 100) score += 10;
    else if (engagement > 10) score += 5;

    // 4. Video length (10 points max - prefer long-form content)
    const duration = this.parseDuration(video.contentDetails.duration);
    if (duration >= 900) score += 10; // 15+ min
    else if (duration >= 600) score += 8; // 10+ min
    else if (duration >= 300) score += 5; // 5+ min
    else if (duration < 180) score -= 20; // Shorts penalty

    return score;
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
  async createChannelProject(userId, channelId, channelData, additionalData = {}) {
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
      status: 'ready',
      // Include NotebookLM-style data
      ...additionalData
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
