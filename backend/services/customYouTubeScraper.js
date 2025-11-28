const axios = require('axios');
const { parseStringPromise } = require('xml2js');

/**
 * Custom YouTube Caption Scraper
 *
 * Why custom scraper needed:
 * - youtube-transcript-plus library is blocked by YouTube (0% success rate)
 * - Third-party libraries get rate-limited/detected
 * - Need to mimic actual browser behavior
 *
 * How it works:
 * 1. Fetch video page HTML (like a real browser)
 * 2. Extract ytInitialPlayerResponse from page
 * 3. Get caption track URLs from player response
 * 4. Fetch caption XML/JSON directly
 * 5. Parse into our format
 */
class CustomYouTubeScraper {
  constructor() {
    this.cache = new Map();

    // Browser-like headers to avoid detection
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    };
  }

  /**
   * Fetch transcript for a single video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Transcript result
   */
  async fetchTranscript(videoId) {
    const startTime = Date.now();

    // Check cache
    if (this.cache.has(videoId)) {
      console.log(`[CustomScraper] ✓ Cache hit for ${videoId}`);
      return this.cache.get(videoId);
    }

    try {
      console.log(`[CustomScraper] Fetching captions for ${videoId}...`);

      // Create axios instance with cookie jar for session persistence
      const axiosInstance = axios.create({
        headers: this.headers,
        timeout: 15000,
        withCredentials: true
      });

      // Step 1: Fetch video page HTML
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const pageResponse = await axiosInstance.get(videoUrl);

      const html = pageResponse.data;
      const cookies = pageResponse.headers['set-cookie'] || [];

      console.log(`[CustomScraper] DEBUG: Page fetched, size: ${html.length} chars, status: ${pageResponse.status}`);
      console.log(`[CustomScraper] DEBUG: Got ${cookies.length} cookies from response`);

      // Step 2: Extract ytInitialPlayerResponse from HTML
      const playerResponse = this.extractPlayerResponse(html);

      if (!playerResponse) {
        console.error(`[CustomScraper] DEBUG: Failed to extract playerResponse`);
        console.error(`[CustomScraper] DEBUG: HTML contains 'ytInitialPlayerResponse': ${html.includes('ytInitialPlayerResponse')}`);
        console.error(`[CustomScraper] DEBUG: HTML preview: ${html.substring(0, 500)}`);
        throw new Error('Could not extract player response from page');
      }

      console.log(`[CustomScraper] DEBUG: PlayerResponse extracted successfully`);

      // Step 3: Get caption tracks
      const captionTracks = this.extractCaptionTracks(playerResponse);

      console.log(`[CustomScraper] DEBUG: Caption tracks extracted, count: ${captionTracks?.length || 0}`);
      console.log(`[CustomScraper] DEBUG: Has captions object: ${!!playerResponse?.captions}`);
      console.log(`[CustomScraper] DEBUG: Has tracklistRenderer: ${!!playerResponse?.captions?.playerCaptionsTracklistRenderer}`);

      if (!captionTracks || captionTracks.length === 0) {
        throw new Error('No captions available for this video');
      }

      console.log(`[CustomScraper] Found ${captionTracks.length} caption tracks`);

      // Step 4: Select best caption track (prefer auto-generated, then any available)
      const selectedTrack = this.selectBestTrack(captionTracks);
      console.log(`[CustomScraper] Selected track: ${selectedTrack.languageCode} (${selectedTrack.kind || 'standard'})`);

      // Step 5: Fetch caption content using same axios instance with cookies
      console.log(`[CustomScraper] DEBUG: Full caption track object:`, JSON.stringify(selectedTrack).substring(0, 300));
      const captions = await this.fetchCaptionContent(selectedTrack.baseUrl, axiosInstance, cookies);

      // Step 6: Parse and format
      const result = {
        success: true,
        videoId,
        text: captions.text,
        segments: captions.segments,
        wordCount: captions.text.split(/\s+/).length,
        charCount: captions.text.length,
        language: selectedTrack.languageCode,
        source: 'custom-youtube-scraper',
        fetchTime: ((Date.now() - startTime) / 1000).toFixed(2)
      };

      // Cache result
      this.cache.set(videoId, result);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[CustomScraper] ✓ Fetched captions for ${videoId} in ${elapsed}s (${result.wordCount} words, lang: ${result.language})`);

      return result;

    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[CustomScraper] ✗ Failed to fetch ${videoId} after ${elapsed}s:`, error.message);

      // Log additional error details
      if (error.response) {
        console.error(`[CustomScraper] DEBUG: HTTP ${error.response.status} - ${error.response.statusText}`);
        console.error(`[CustomScraper] DEBUG: Response preview: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      } else if (error.code) {
        console.error(`[CustomScraper] DEBUG: Error code: ${error.code}`);
      }

      return {
        success: false,
        videoId,
        error: error.message,
        source: 'custom-youtube-scraper'
      };
    }
  }

  /**
   * Extract ytInitialPlayerResponse from HTML
   * Uses brace-counting to properly extract the complete JSON object
   */
  extractPlayerResponse(html) {
    try {
      // Find the start of ytInitialPlayerResponse
      const patterns = [
        'var ytInitialPlayerResponse = ',
        'ytInitialPlayerResponse = '
      ];

      for (const pattern of patterns) {
        const startIndex = html.indexOf(pattern);
        if (startIndex === -1) continue;

        // Start parsing from the opening brace
        const jsonStart = startIndex + pattern.length;

        // Extract complete JSON by counting braces
        const jsonStr = this.extractCompleteJSON(html, jsonStart);

        if (jsonStr) {
          try {
            const parsed = JSON.parse(jsonStr);
            console.log('[CustomScraper] DEBUG: Successfully parsed playerResponse JSON');
            return parsed;
          } catch (parseError) {
            console.error('[CustomScraper] DEBUG: Failed to parse extracted JSON:', parseError.message);
            continue;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[CustomScraper] Error extracting player response:', error.message);
      return null;
    }
  }

  /**
   * Extract complete JSON object by counting braces
   */
  extractCompleteJSON(str, startIndex) {
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;
    let jsonStart = -1;

    for (let i = startIndex; i < str.length; i++) {
      const char = str[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        if (jsonStart === -1) jsonStart = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && jsonStart !== -1) {
          // Found complete JSON object
          return str.substring(jsonStart, i + 1);
        }
      }
    }

    return null;
  }

  /**
   * Extract caption tracks from player response
   */
  extractCaptionTracks(playerResponse) {
    try {
      const captionsData = playerResponse?.captions?.playerCaptionsTracklistRenderer;

      if (!captionsData || !captionsData.captionTracks) {
        return [];
      }

      return captionsData.captionTracks;
    } catch (error) {
      console.error('[CustomScraper] Error extracting caption tracks:', error.message);
      return [];
    }
  }

  /**
   * Select best caption track
   * Priority: auto-generated in any language > manual captions > first available
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
  async fetchCaptionContent(baseUrl, axiosInstance, cookies) {
    try {
      // Add fmt=json3 to get JSON format instead of XML
      const url = baseUrl.includes('?') ? `${baseUrl}&fmt=json3` : `${baseUrl}?fmt=json3`;

      console.log(`[CustomScraper] DEBUG: Fetching caption URL: ${url.substring(0, 150)}...`);

      // Build cookie header from received cookies
      const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

      // Use same axios instance with session cookies
      const response = await axiosInstance.get(url, {
        headers: {
          'Referer': `https://www.youtube.com/`,
          'Accept': '*/*',
          'Cookie': cookieHeader
        }
      });

      const data = response.data;
      console.log(`[CustomScraper] DEBUG: Got caption response, type: ${typeof data}, size: ${JSON.stringify(data).length} chars`);

      // Parse JSON response
      const events = data?.events || [];
      console.log(`[CustomScraper] DEBUG: Found ${events.length} caption events`);

      const segments = [];
      let fullText = '';

      for (const event of events) {
        if (!event.segs) continue;

        const text = event.segs.map(seg => seg.utf8 || '').join('');
        const startMs = event.tStartMs || 0;
        const durationMs = event.dDurationMs || 0;

        if (text.trim()) {
          segments.push({
            text: text.trim(),
            start: Math.floor(startMs / 1000),
            offset: startMs,
            duration: durationMs
          });

          fullText += text + ' ';
        }
      }

      console.log(`[CustomScraper] DEBUG: Extracted ${segments.length} segments, ${fullText.trim().split(/\s+/).length} words`);

      return {
        text: fullText.trim(),
        segments
      };

    } catch (error) {
      console.error('[CustomScraper] Error fetching caption content:', error.message);
      if (error.response) {
        console.error(`[CustomScraper] DEBUG: Response status: ${error.response.status}`);
        console.error(`[CustomScraper] DEBUG: Response data:`, JSON.stringify(error.response.data).substring(0, 200));
      }
      throw new Error(`Failed to fetch captions: ${error.message}`);
    }
  }

  /**
   * Decode HTML entities in caption text
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
    console.log('[CustomScraper] Cache cleared');
  }

  /**
   * Batch fetch with concurrency control
   */
  async fetchBatch(videoIds, concurrency = 5) {
    const startTime = Date.now();
    console.log(`[CustomScraper] 📦 Fetching ${videoIds.length} videos (concurrency: ${concurrency})`);

    const results = {
      total: videoIds.length,
      successful: 0,
      failed: 0,
      transcripts: {}
    };

    // Process in batches
    const chunks = this.chunkArray(videoIds, concurrency);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[CustomScraper] Processing batch ${i + 1}/${chunks.length} (${chunk.length} videos)`);

      const promises = chunk.map(videoId =>
        this.fetchTranscript(videoId)
          .catch(error => ({
            success: false,
            videoId,
            error: error.message
          }))
      );

      const batchResults = await Promise.all(promises);

      for (const result of batchResults) {
        if (result.success) {
          results.successful++;
          results.transcripts[result.videoId] = result;
        } else {
          results.failed++;
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i < chunks.length - 1) {
        await this.sleep(1000);
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const successRate = ((results.successful / results.total) * 100).toFixed(1);

    console.log(`[CustomScraper] ✅ Batch complete: ${results.successful}/${results.total} successful (${successRate}%) in ${totalTime}s`);

    return results;
  }

  /**
   * Helper: chunk array
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Helper: sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new CustomYouTubeScraper();
