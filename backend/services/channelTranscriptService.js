const { YoutubeTranscript } = require('youtube-transcript');
const { google } = require('googleapis');

/**
 * Channel Transcript Service
 * Fetches YouTube captions directly (NotebookLM method)
 * ONLY used for channel imports - NOT for single video uploads
 *
 * Key advantages:
 * - FREE (no transcription costs)
 * - Fast (0.3s per video vs 2-4 minutes)
 * - No video downloads needed
 *
 * Bot detection mitigation:
 * - Uses youtube-transcript (mimics browser better than yt-dlp)
 * - Rate limiting between requests
 * - Exponential backoff on failures
 * - User agent rotation
 */
class ChannelTranscriptService {
  constructor() {
    this.youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });

    // Rate limiting: delay between requests to avoid bot detection
    this.requestDelay = 500; // 500ms between requests
    this.lastRequestTime = 0;

    // User agents to rotate (mimic real browsers)
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];
  }

  /**
   * Fetch transcript for a single YouTube video using captions
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Transcript data with segments
   */
  async fetchTranscript(videoId) {
    try {
      // Rate limiting to avoid bot detection
      await this.respectRateLimit();

      console.log(`[ChannelTranscript] Fetching captions for: ${videoId}`);

      // Fetch transcript using youtube-transcript (better bot detection bypass)
      const transcript = await this.fetchWithRetry(videoId, 3);

      // Format the response to match our existing transcript structure
      const segments = transcript.map(segment => ({
        text: segment.text,
        start: segment.offset / 1000, // Convert ms to seconds
        duration: segment.duration / 1000
      }));

      const fullText = segments.map(s => s.text).join(' ');

      console.log(`[ChannelTranscript] ✓ Success: ${segments.length} segments (${fullText.length} chars)`);

      return {
        available: true,
        text: fullText,
        segments: segments,
        words: [], // Caption-based transcripts don't have word-level timestamps
        source: 'youtube_captions',
        language: 'auto-detected'
      };

    } catch (error) {
      console.error(`[ChannelTranscript] ✗ Failed for ${videoId}:`, error.message);

      // Check if it's a bot detection error
      if (error.message.includes('Too Many Requests') ||
          error.message.includes('403') ||
          error.message.includes('blocked')) {
        console.error(`[ChannelTranscript] ⚠️ Bot detection triggered for ${videoId}`);
      }

      return {
        available: false,
        error: error.message,
        source: 'youtube_captions'
      };
    }
  }

  /**
   * Fetch transcript with retry logic and exponential backoff
   * @param {string} videoId
   * @param {number} maxRetries
   * @returns {Promise<Array>}
   */
  async fetchWithRetry(videoId, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use different user agent for each attempt
        const userAgent = this.userAgents[attempt % this.userAgents.length];

        const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
          lang: 'en,fr,es,de,it,pt,ar', // Support multiple languages
          headers: {
            'User-Agent': userAgent,
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });

        return transcript;

      } catch (error) {
        // Don't retry if transcript is explicitly disabled/unavailable
        const errorMsg = error.message || '';
        if (errorMsg.includes('Transcript is disabled') ||
            errorMsg.includes('No transcripts available') ||
            errorMsg.includes('Subtitles are disabled') ||
            errorMsg.includes('disabled on this video')) {
          // Fail fast for videos without captions - don't waste time retrying
          throw error;
        }

        if (attempt === maxRetries) {
          throw error;
        }

        // Only retry for network/temporary errors
        // Reduced backoff: 1s, 2s (faster failure for unavailable videos)
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[ChannelTranscript] Retry ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Fetch transcripts for multiple videos in parallel (with batching)
   * @param {Array<string>} videoIds - Array of YouTube video IDs
   * @param {number} concurrency - Max parallel requests (default: 5 to avoid bot detection)
   * @returns {Promise<Array>} Array of transcript results
   */
  async fetchMultipleTranscripts(videoIds, concurrency = 5) {
    console.log(`[ChannelTranscript] Fetching ${videoIds.length} transcripts (concurrency: ${concurrency})`);

    const results = [];
    const chunks = this.chunkArray(videoIds, concurrency);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[ChannelTranscript] Processing batch ${i + 1}/${chunks.length} (${chunk.length} videos)`);

      const promises = chunk.map(videoId =>
        this.fetchTranscript(videoId)
      );

      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);

      // Add delay between batches to avoid bot detection
      if (i < chunks.length - 1) {
        const batchDelay = 2000; // 2 second delay between batches
        console.log(`[ChannelTranscript] Waiting ${batchDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }

    const successful = results.filter(r => r.available).length;
    const failureRate = ((videoIds.length - successful) / videoIds.length * 100).toFixed(1);

    console.log(`[ChannelTranscript] ✓ Complete: ${successful}/${videoIds.length} successful (${failureRate}% failed)`);

    return results;
  }

  /**
   * Get all video IDs from a YouTube channel
   * @param {string} channelId - YouTube channel ID (or handle/username)
   * @returns {Promise<Array>} Array of video metadata
   */
  async getChannelVideos(channelId) {
    console.log(`[ChannelTranscript] Fetching videos for channel: ${channelId}`);

    try {
      // Handle different channel URL formats (@username, channel ID, etc.)
      const resolvedChannelId = await this.resolveChannelId(channelId);

      // Get uploads playlist ID
      const channelResponse = await this.youtube.channels.list({
        part: 'contentDetails,snippet',
        id: resolvedChannelId
      });

      if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
        throw new Error('Channel not found');
      }

      const channel = channelResponse.data.items[0];
      const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;
      const channelTitle = channel.snippet.title;

      console.log(`[ChannelTranscript] Channel: ${channelTitle}`);

      // Fetch all videos from uploads playlist
      const videos = [];
      let pageToken = null;

      do {
        const response = await this.youtube.playlistItems.list({
          part: 'snippet,contentDetails',
          playlistId: uploadsPlaylistId,
          maxResults: 50,
          pageToken: pageToken
        });

        const videoIds = response.data.items
          .map(item => item.contentDetails.videoId);

        // Get detailed video info
        const videoDetails = await this.youtube.videos.list({
          part: 'snippet,contentDetails,statistics',
          id: videoIds.join(',')
        });

        videos.push(...videoDetails.data.items.map(v => ({
          id: v.id,
          title: v.snippet.title,
          description: v.snippet.description,
          publishedAt: v.snippet.publishedAt,
          thumbnailUrl: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.default?.url,
          duration: this.parseDuration(v.contentDetails.duration),
          viewCount: parseInt(v.statistics.viewCount) || 0,
          likeCount: parseInt(v.statistics.likeCount) || 0
        })));

        pageToken = response.data.nextPageToken;

        console.log(`[ChannelTranscript] Fetched ${videos.length} videos so far...`);

      } while (pageToken);

      console.log(`[ChannelTranscript] ✓ Found ${videos.length} total videos`);

      return {
        channelId: resolvedChannelId,
        channelTitle,
        videos
      };

    } catch (error) {
      console.error(`[ChannelTranscript] Error fetching channel videos:`, error.message);
      throw error;
    }
  }

  /**
   * Resolve channel ID from various formats (@username, channel URL, etc.)
   */
  async resolveChannelId(input) {
    // If it's already a channel ID (starts with UC), return it
    if (input.startsWith('UC') && input.length === 24) {
      return input;
    }

    // If it's a handle (@username), search for it
    if (input.startsWith('@')) {
      const response = await this.youtube.search.list({
        part: 'snippet',
        q: input,
        type: 'channel',
        maxResults: 1
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0].snippet.channelId;
      }
    }

    // If it's a custom URL, try to find it
    const response = await this.youtube.search.list({
      part: 'snippet',
      q: input,
      type: 'channel',
      maxResults: 1
    });

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].snippet.channelId;
    }

    throw new Error('Could not resolve channel ID from input: ' + input);
  }

  /**
   * Import entire channel with transcripts
   * Main entry point for channel imports
   * @param {string} channelId - YouTube channel ID or handle
   * @returns {Promise<Object>} Channel data with transcripts
   */
  async importChannel(channelId) {
    const startTime = Date.now();
    console.log(`[ChannelTranscript] ========================================`);
    console.log(`[ChannelTranscript] Starting channel import: ${channelId}`);
    console.log(`[ChannelTranscript] ========================================`);

    try {
      // 1. Get all videos from channel
      const channelData = await this.getChannelVideos(channelId);

      // 2. Fetch transcripts for all videos (with optimized concurrency)
      const transcripts = await this.fetchMultipleTranscripts(
        channelData.videos.map(v => v.id),
        10 // Increased: 10 videos at a time (fail-fast for videos without captions)
      );

      // 3. Combine video metadata with transcripts
      const videosWithTranscripts = channelData.videos.map((video, index) => ({
        ...video,
        transcript: transcripts[index]
      }));

      // 4. Separate videos with/without transcripts
      const videosWithCaptions = videosWithTranscripts.filter(v => v.transcript.available);
      const videosWithoutCaptions = videosWithTranscripts.filter(v => !v.transcript.available);

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`[ChannelTranscript] ========================================`);
      console.log(`[ChannelTranscript] ✓ Import complete in ${elapsedTime}s`);
      console.log(`[ChannelTranscript] Total videos: ${channelData.videos.length}`);
      console.log(`[ChannelTranscript] With captions: ${videosWithCaptions.length} (${(videosWithCaptions.length / channelData.videos.length * 100).toFixed(1)}%)`);
      console.log(`[ChannelTranscript] Without captions: ${videosWithoutCaptions.length} (metadata only)`);
      console.log(`[ChannelTranscript] ========================================`);

      // Success if we got at least 1 video or if we have metadata for all videos
      if (videosWithCaptions.length === 0 && channelData.videos.length > 0) {
        console.warn(`[ChannelTranscript] ⚠️  No videos with captions found, but proceeding with metadata-only`);
      }

      return {
        channelId: channelData.channelId,
        channelTitle: channelData.channelTitle,
        totalVideos: channelData.videos.length,
        successfulVideos: videosWithCaptions.length,
        failedVideos: videosWithoutCaptions.length,
        videos: videosWithTranscripts, // Return ALL videos (with metadata, transcripts when available)
        videosWithCaptions: videosWithCaptions.length,
        processingTime: elapsedTime,
        method: 'youtube_captions',
        cost: 0 // FREE!
      };

    } catch (error) {
      console.error(`[ChannelTranscript] ✗ Import failed:`, error.message);
      throw error;
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
   * Chunk array into smaller arrays
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Rate limiting helper
   */
  async respectRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.requestDelay) {
      const waitTime = this.requestDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

module.exports = new ChannelTranscriptService();
