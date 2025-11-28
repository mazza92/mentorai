const axios = require('axios');
const { parseStringPromise } = require('xml2js');

/**
 * YouTube Caption Scraper using Internal API
 *
 * This approach uses YouTube's internal Innertube API directly
 * instead of scraping HTML, which is more reliable and less likely to be blocked.
 */
class YouTubeApiScraper {
  constructor() {
    this.cache = new Map();

    // Innertube API configuration
    this.API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'; // Public web client API key
    this.CLIENT_VERSION = '2.20231219.04.00';
    this.CLIENT_NAME = 'WEB';
  }

  /**
   * Fetch transcript using Innertube API
   */
  async fetchTranscript(videoId) {
    const startTime = Date.now();

    // Check cache
    if (this.cache.has(videoId)) {
      console.log(`[ApiScraper] ✓ Cache hit for ${videoId}`);
      return this.cache.get(videoId);
    }

    try {
      console.log(`[ApiScraper] Fetching captions for ${videoId} via API...`);

      // Step 1: Get video info from Innertube API
      const playerResponse = await this.getPlayerResponse(videoId);

      if (!playerResponse) {
        throw new Error('Failed to get player response from API');
      }

      console.log(`[ApiScraper] DEBUG: Got player response`);

      // Step 2: Extract caption tracks
      const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (!captionTracks || captionTracks.length === 0) {
        console.log(`[ApiScraper] DEBUG: No caption tracks in API response`);
        throw new Error('No captions available for this video');
      }

      console.log(`[ApiScraper] Found ${captionTracks.length} caption tracks via API`);

      // Step 3: Select best track
      const selectedTrack = this.selectBestTrack(captionTracks);
      console.log(`[ApiScraper] Selected track: ${selectedTrack.languageCode} (${selectedTrack.kind || 'standard'})`);

      // Step 4: Fetch caption content
      const captions = await this.fetchCaptionContent(selectedTrack.baseUrl);

      // Step 5: Format result
      const result = {
        success: true,
        videoId,
        text: captions.text,
        segments: captions.segments,
        wordCount: captions.text.split(/\s+/).length,
        charCount: captions.text.length,
        language: selectedTrack.languageCode,
        source: 'youtube-api-scraper',
        fetchTime: ((Date.now() - startTime) / 1000).toFixed(2)
      };

      // Cache result
      this.cache.set(videoId, result);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[ApiScraper] ✓ Fetched captions for ${videoId} in ${elapsed}s (${result.wordCount} words, lang: ${result.language})`);

      return result;

    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[ApiScraper] ✗ Failed to fetch ${videoId} after ${elapsed}s:`, error.message);

      return {
        success: false,
        videoId,
        error: error.message,
        source: 'youtube-api-scraper'
      };
    }
  }

  /**
   * Get player response from Innertube API
   */
  async getPlayerResponse(videoId) {
    try {
      const url = `https://www.youtube.com/youtubei/v1/player?key=${this.API_KEY}`;

      const payload = {
        context: {
          client: {
            clientName: this.CLIENT_NAME,
            clientVersion: this.CLIENT_VERSION,
            hl: 'en',
            gl: 'US'
          }
        },
        videoId: videoId
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'X-YouTube-Client-Name': '1',
          'X-YouTube-Client-Version': this.CLIENT_VERSION
        },
        timeout: 10000
      });

      return response.data;

    } catch (error) {
      console.error(`[ApiScraper] Error fetching player response:`, error.message);
      return null;
    }
  }

  /**
   * Select best caption track
   */
  selectBestTrack(tracks) {
    // Prefer auto-generated (asr = automatic speech recognition)
    const autoTrack = tracks.find(t => t.kind === 'asr');
    if (autoTrack) return autoTrack;

    // Prefer English
    const englishTrack = tracks.find(t => t.languageCode === 'en' || t.languageCode.startsWith('en-'));
    if (englishTrack) return englishTrack;

    // Return first available
    return tracks[0];
  }

  /**
   * Fetch and parse caption content from URL
   */
  async fetchCaptionContent(baseUrl) {
    try {
      const response = await axios.get(baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });

      const xml = response.data;

      // Parse XML
      const parsed = await parseStringPromise(xml);
      const textElements = parsed?.transcript?.text || [];

      const segments = [];
      let fullText = '';

      for (const element of textElements) {
        const text = this.decodeHTMLEntities(element._ || '');
        const start = parseFloat(element.$.start || 0);
        const duration = parseFloat(element.$.dur || 0);

        if (text.trim()) {
          segments.push({
            text: text.trim(),
            start: Math.floor(start),
            offset: Math.floor(start * 1000),
            duration: Math.floor(duration * 1000)
          });

          fullText += text + ' ';
        }
      }

      return {
        text: fullText.trim(),
        segments
      };

    } catch (error) {
      console.error(`[ApiScraper] Error fetching caption content:`, error.message);
      throw new Error(`Failed to fetch captions: ${error.message}`);
    }
  }

  /**
   * Decode HTML entities
   */
  decodeHTMLEntities(text) {
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' '
    };

    return text.replace(/&[^;]+;/g, match => entities[match] || match);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[ApiScraper] Cache cleared');
  }
}

module.exports = new YouTubeApiScraper();
