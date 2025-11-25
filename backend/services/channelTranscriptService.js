const axios = require('axios');
const { google } = require('googleapis');
const youtubedl = require('youtube-dl-exec');
const captionFetcher = require('./captionFetcher');
const puppeteerCaptionFetcher = require('./puppeteerCaptionFetcher');
const fs = require('fs');
const path = require('path');

/**
 * Channel Transcript Service
 * Fetches YouTube captions directly (NotebookLM method)
 * ONLY used for channel imports - NOT for single video uploads
 *
 * Key advantages:
 * - FREE (no transcription costs)
 * - Fast (2-3s per video vs 2-4 minutes)
 * - No video downloads needed
 * - NO COOKIES REQUIRED - uses real browser automation
 * - TRULY SCALABLE - no cookie maintenance/expiration
 *
 * Primary method: Puppeteer (real headless browser - undetectable)
 * Fallback 1: Python youtube-transcript-api
 * Fallback 2: yt-dlp with browser cookies (local only)
 * Fallback 3: axios scraping with headers
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

      return {
        available: false,
        error: error.message,
        source: 'youtube_captions_scraper'
      };
    }
  }

  /**
   * Get cookie options for yt-dlp based on environment
   * Production: Use cookies from environment variable or file
   * Development: Use browser cookies
   * @param {string} browser - Browser name (chrome, firefox, edge)
   * @returns {Object} Cookie options for yt-dlp
   */
  getCookieOptions(browser) {
    // PRODUCTION: Check for cookies in environment variable first
    if (process.env.YOUTUBE_COOKIES_BASE64) {
      console.log(`[ChannelTranscript] Using cookies from environment variable`);

      // Decode base64 cookies and write to temporary file
      const cookiesDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(cookiesDir)) {
        fs.mkdirSync(cookiesDir, { recursive: true });
      }

      const cookiesPath = path.join(cookiesDir, 'youtube-cookies.txt');
      const cookiesContent = Buffer.from(process.env.YOUTUBE_COOKIES_BASE64, 'base64').toString('utf-8');
      fs.writeFileSync(cookiesPath, cookiesContent);

      return { cookies: cookiesPath };
    }

    // PRODUCTION: Check for cookies.txt file
    const cookiesPath = path.join(__dirname, '../cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      console.log(`[ChannelTranscript] Using cookies from file: cookies.txt`);
      return { cookies: cookiesPath };
    }

    // DEVELOPMENT: Try to use browser cookies
    console.log(`[ChannelTranscript] Using ${browser} browser cookies (local development)`);
    return { cookiesFromBrowser: browser };
  }

  /**
   * Fetch captions using yt-dlp (most reliable method)
   * yt-dlp is the gold standard for YouTube content extraction
   * @param {string} videoId
   * @param {string} browser - Browser to extract cookies from (chrome, firefox, edge, safari)
   * @returns {Promise<Array>}
   */
  async fetchCaptionsWithYtDlp(videoId, browser = 'chrome') {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
      // Use yt-dlp to extract subtitles without downloading video
      // Using browser cookies to bypass YouTube bot detection

      // Determine cookie strategy based on environment
      const cookieOptions = this.getCookieOptions(browser);

      const output = await youtubedl(videoUrl, {
        dumpSingleJson: true,
        skipDownload: true,
        writeAutoSub: true,
        subLang: 'en,fr,es,de,it,pt,ar', // Try multiple languages
        noWarnings: true,
        ...cookieOptions
      });

      // Extract subtitles from output
      if (!output.subtitles && !output.automatic_captions) {
        throw new Error('No captions available');
      }

      // Get auto-generated captions or manual subtitles
      const captions = output.automatic_captions || output.subtitles;

      // Try to get English first, then any available language
      let captionData = null;
      for (const lang of ['en', 'fr', 'es', 'de', 'it', 'pt', 'ar']) {
        if (captions[lang]) {
          captionData = captions[lang];
          break;
        }
      }

      // If no specific language, get first available
      if (!captionData) {
        const firstLang = Object.keys(captions)[0];
        if (firstLang) {
          captionData = captions[firstLang];
        }
      }

      if (!captionData || captionData.length === 0) {
        throw new Error('No caption data found');
      }

      // Get JSON3 format (has text and timestamps)
      const json3Format = captionData.find(c => c.ext === 'json3');
      if (!json3Format) {
        throw new Error('No JSON3 caption format available');
      }

      // Fetch the actual caption content
      const { data: captionContent } = await axios.get(json3Format.url);

      // Parse JSON3 format captions
      const transcript = [];
      if (captionContent.events) {
        for (const event of captionContent.events) {
          if (event.segs) {
            const text = event.segs.map(seg => seg.utf8).join('');
            if (text.trim()) {
              transcript.push({
                text: text.trim(),
                offset: event.tStartMs || 0,
                duration: event.dDurationMs || 0
              });
            }
          }
        }
      }

      return transcript;

    } catch (error) {
      console.error(`[ChannelTranscript] yt-dlp error for ${videoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch captions directly from YouTube with proper browser headers
   * Fallback method if yt-dlp fails
   * @param {string} videoId
   * @returns {Promise<Array>}
   */
  async fetchCaptionsWithHeaders(videoId) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Fetch video page with realistic browser headers
    const { data } = await axios.get(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    // Extract ytInitialPlayerResponse from page HTML
    const match = data.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!match) {
      console.error(`[ChannelTranscript] Could not find ytInitialPlayerResponse for ${videoId}`);
      throw new Error('Could not find player response in page');
    }

    const playerResponse = JSON.parse(match[1]);
    console.log(`[ChannelTranscript] Player response captions:`, playerResponse?.captions ? 'Found' : 'Not found');

    // Get caption tracks
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    console.log(`[ChannelTranscript] Caption tracks for ${videoId}:`, captionTracks?.length || 0);

    if (!captionTracks || captionTracks.length === 0) {
      throw new Error('No captions available for this video');
    }

    // Get the first available caption track (usually auto-generated or English)
    const captionTrack = captionTracks[0];
    const captionUrl = captionTrack.baseUrl;

    // Fetch the actual captions
    const { data: captionsXml } = await axios.get(captionUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    // Parse XML captions (simplified XML parsing)
    const captionMatches = [...captionsXml.matchAll(/<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]+)<\/text>/g)];

    const transcript = captionMatches.map(match => ({
      text: this.decodeHtml(match[3]),
      offset: parseFloat(match[1]) * 1000, // Convert to milliseconds
      duration: parseFloat(match[2]) * 1000
    }));

    return transcript;
  }

  /**
   * Decode HTML entities in caption text
   */
  decodeHtml(html) {
    return html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]*>/g, ''); // Remove any remaining HTML tags
  }

  /**
   * Fetch transcript with retry logic and exponential backoff
   * Tries Puppeteer first (most reliable), then Python API, then yt-dlp, then axios
   * @param {string} videoId
   * @param {number} maxRetries
   * @returns {Promise<Array>}
   */
  async fetchWithRetry(videoId, maxRetries = 2) {
    // METHOD 1: Try Puppeteer (REAL BROWSER - most reliable, works everywhere!)
    try {
      console.log(`[ChannelTranscript] Using Puppeteer (real browser) for ${videoId}`);
      const result = await puppeteerCaptionFetcher.fetchCaptions(videoId);

      if (result.success && result.segments && result.segments.length > 0) {
        console.log(`[ChannelTranscript] ✓ Puppeteer: Successfully fetched ${result.segments.length} caption segments (${result.charCount} chars)`);
        return result.segments;
      } else {
        console.log(`[ChannelTranscript] Puppeteer returned no segments for ${videoId}: ${result.error || 'Unknown error'}`);
      }
    } catch (puppeteerError) {
      console.log(`[ChannelTranscript] Puppeteer failed for ${videoId}: ${puppeteerError.message}`);
    }

    // METHOD 2: Try Python youtube-transcript-api (lightweight fallback)
    try {
      console.log(`[ChannelTranscript] Using Python transcript-api for ${videoId}`);
      const result = await captionFetcher.fetchTranscript(videoId);

      if (result.success && result.segments && result.segments.length > 0) {
        console.log(`[ChannelTranscript] ✓ Python API: Successfully fetched ${result.segments.length} caption segments (${result.charCount} chars)`);
        return result.segments;
      } else {
        console.log(`[ChannelTranscript] Python API returned no segments for ${videoId}: ${result.error || 'Unknown error'}`);
      }
    } catch (pythonError) {
      console.log(`[ChannelTranscript] Python API failed for ${videoId}: ${pythonError.message}`);
    }

    // METHOD 3: Try yt-dlp with browser cookies (only works locally, not on Railway)
    const browsers = ['chrome', 'firefox', 'edge'];
    for (const browser of browsers) {
      try {
        console.log(`[ChannelTranscript] Using yt-dlp (${browser} cookies) for ${videoId}`);
        const transcript = await this.fetchCaptionsWithYtDlp(videoId, browser);

        if (transcript && transcript.length > 0) {
          console.log(`[ChannelTranscript] ✓ yt-dlp (${browser}): Successfully fetched ${transcript.length} caption segments`);
          return transcript;
        }
      } catch (ytdlpError) {
        console.log(`[ChannelTranscript] yt-dlp (${browser}) failed for ${videoId}: ${ytdlpError.message}`);
        // Try next browser
      }
    }

    // METHOD 3: Fallback to axios scraping with retries (last resort)
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ChannelTranscript] Fallback attempt ${attempt}/${maxRetries} for ${videoId}`);

        const transcript = await this.fetchCaptionsWithHeaders(videoId);

        if (transcript && transcript.length > 0) {
          console.log(`[ChannelTranscript] ✓ Fallback: Successfully fetched ${transcript.length} caption segments`);
          return transcript;
        }

      } catch (error) {
        const errorMsg = error.message || '';

        // Check if captions are genuinely unavailable
        if (errorMsg.includes('No captions available') ||
            errorMsg.includes('Could not find player response')) {
          console.log(`[ChannelTranscript] No captions available for ${videoId}`);
          throw new Error(`No captions available for this video`);
        }

        // For network/temporary errors, retry with exponential backoff
        if (attempt === maxRetries) {
          console.error(`[ChannelTranscript] Failed after ${maxRetries} attempts for ${videoId}: ${errorMsg}`);
          throw error;
        }

        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[ChannelTranscript] Retry ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('All caption fetching methods failed');
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
