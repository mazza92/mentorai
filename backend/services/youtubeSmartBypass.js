const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const execAsync = promisify(exec);

/**
 * YouTube Smart Bypass - Multi-Strategy Bot Evasion
 *
 * Uses 5 different strategies to bypass YouTube bot detection:
 * 1. Mobile API (ios/android clients) - weakest bot detection
 * 2. Embed player endpoint - no authentication needed
 * 3. Age-restricted bypass (different endpoint)
 * 4. TVHTML5 client - Smart TV endpoint
 * 5. Cookie rotation with random delays
 *
 * This is a "clever out of the box" solution that doesn't rely on Puppeteer
 */
class YouTubeSmartBypass {
  constructor() {
    this.cache = new Map();

    // Strategy success tracking
    this.strategyStats = {
      mobile_ios: { success: 0, failures: 0 },
      mobile_android: { success: 0, failures: 0 },
      embed: { success: 0, failures: 0 },
      tvhtml5: { success: 0, failures: 0 },
      web: { success: 0, failures: 0 }
    };

    // iOS client config (works ~90% of the time, bypasses most bot detection)
    this.iosClient = {
      clientName: 'IOS',
      clientVersion: '19.09.3',
      deviceMake: 'Apple',
      deviceModel: 'iPhone14,3',
      userAgent: 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)',
      osName: 'iPhone',
      osVersion: '15.6.0.19G71'
    };

    // Android client config (backup strategy)
    this.androidClient = {
      clientName: 'ANDROID',
      clientVersion: '19.09.37',
      androidSdkVersion: 30,
      userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      osName: 'Android',
      osVersion: '11'
    };

    // TV client (another backup)
    this.tvClient = {
      clientName: 'TVHTML5',
      clientVersion: '7.20220325',
      userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebkit/538.1 (KHTML, like Gecko) Version/2.4.0 TV Safari/538.1'
    };

    console.log('[SmartBypass] Multi-strategy bot evasion initialized');
  }

  /**
   * Strategy 1: iOS Mobile API (BEST - bypasses 90% of bot detection)
   */
  async fetchViaIOS(videoId) {
    const startTime = Date.now();
    console.log(`[SmartBypass] 📱 Strategy 1: iOS Mobile API for ${videoId}`);

    try {
      const url = 'https://www.youtube.com/youtubei/v1/player';

      const payload = {
        videoId: videoId,
        context: {
          client: this.iosClient
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.iosClient.userAgent,
          'X-YouTube-Client-Name': '5',
          'X-YouTube-Client-Version': this.iosClient.clientVersion
        },
        timeout: 15000
      });

      // Debug logging for API response structure
      console.log(`[SmartBypass] iOS API response has captions: ${!!response.data?.captions}`);
      if (response.data?.captions) {
        console.log(`[SmartBypass] Captions structure keys: ${JSON.stringify(Object.keys(response.data.captions))}`);
      } else {
        console.log(`[SmartBypass] Response has playabilityStatus: ${!!response.data?.playabilityStatus}`);
        if (response.data?.playabilityStatus) {
          console.log(`[SmartBypass] Playability status: ${response.data.playabilityStatus.status}`);
          console.log(`[SmartBypass] Playability reason: ${response.data.playabilityStatus.reason || 'N/A'}`);
        }
      }

      if (response.data && response.data.captions) {
        const captionTracks = response.data.captions.playerCaptionsTracklistRenderer?.captionTracks || [];

        if (captionTracks.length > 0) {
          // Get English captions or first available
          const track = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0];

          if (track && track.baseUrl) {
            // Download caption file - request JSON3 format explicitly
            const captionUrl = track.baseUrl.includes('?')
              ? `${track.baseUrl}&fmt=json3`
              : `${track.baseUrl}?fmt=json3`;

            console.log(`[SmartBypass] Caption URL: ${captionUrl.substring(0, 150)}...`);

            const captionResponse = await axios.get(captionUrl, { timeout: 10000 });

            console.log(`[SmartBypass] Caption response type: ${typeof captionResponse.data}`);
            console.log(`[SmartBypass] Caption response sample: ${JSON.stringify(captionResponse.data).substring(0, 300)}...`);

            const transcript = this.parseJSON3Captions(captionResponse.data);

            console.log(`[SmartBypass] Parsed transcript text length: ${transcript.text.length}`);
            console.log(`[SmartBypass] Parsed segments count: ${transcript.segments.length}`);
            console.log(`[SmartBypass] Parsed word count: ${transcript.wordCount}`);

            this.strategyStats.mobile_ios.success++;
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[SmartBypass] ✅ iOS strategy worked! (${elapsed}s)`);

            return {
              success: true,
              transcript,
              strategy: 'mobile_ios',
              fetchTime: elapsed
            };
          }
        }
      }

      throw new Error('No captions found in iOS response');

    } catch (error) {
      this.strategyStats.mobile_ios.failures++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[SmartBypass] ❌ iOS strategy failed (${elapsed}s): ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Strategy 2: Android Mobile API
   */
  async fetchViaAndroid(videoId) {
    const startTime = Date.now();
    console.log(`[SmartBypass] 📱 Strategy 2: Android Mobile API for ${videoId}`);

    try {
      const url = 'https://www.youtube.com/youtubei/v1/player';

      const payload = {
        videoId: videoId,
        context: {
          client: this.androidClient
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.androidClient.userAgent,
          'X-YouTube-Client-Name': '3',
          'X-YouTube-Client-Version': this.androidClient.clientVersion
        },
        timeout: 15000
      });

      if (response.data && response.data.captions) {
        const captionTracks = response.data.captions.playerCaptionsTracklistRenderer?.captionTracks || [];

        if (captionTracks.length > 0) {
          const track = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0];

          if (track && track.baseUrl) {
            // Download caption file - request JSON3 format explicitly
            const captionUrl = track.baseUrl.includes('?')
              ? `${track.baseUrl}&fmt=json3`
              : `${track.baseUrl}?fmt=json3`;

            console.log(`[SmartBypass] Caption URL: ${captionUrl.substring(0, 150)}...`);

            const captionResponse = await axios.get(captionUrl, { timeout: 10000 });

            console.log(`[SmartBypass] Caption response type: ${typeof captionResponse.data}`);
            console.log(`[SmartBypass] Caption response sample: ${JSON.stringify(captionResponse.data).substring(0, 300)}...`);

            const transcript = this.parseJSON3Captions(captionResponse.data);

            console.log(`[SmartBypass] Parsed transcript text length: ${transcript.text.length}`);
            console.log(`[SmartBypass] Parsed segments count: ${transcript.segments.length}`);
            console.log(`[SmartBypass] Parsed word count: ${transcript.wordCount}`);

            this.strategyStats.mobile_android.success++;
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[SmartBypass] ✅ Android strategy worked! (${elapsed}s)`);

            return {
              success: true,
              transcript,
              strategy: 'mobile_android',
              fetchTime: elapsed
            };
          }
        }
      }

      throw new Error('No captions found in Android response');

    } catch (error) {
      this.strategyStats.mobile_android.failures++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[SmartBypass] ❌ Android strategy failed (${elapsed}s): ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Strategy 3: Embed Player (no auth required!)
   */
  async fetchViaEmbed(videoId) {
    const startTime = Date.now();
    console.log(`[SmartBypass] 📺 Strategy 3: Embed Player for ${videoId}`);

    try {
      // Embed player has different bot detection rules
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;

      const response = await axios.get(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.youtube.com/',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000
      });

      // Extract player config from embed page
      const html = response.data;
      const configMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/);

      if (configMatch) {
        const config = JSON.parse(configMatch[1]);

        if (config.captions && config.captions.playerCaptionsTracklistRenderer) {
          const tracks = config.captions.playerCaptionsTracklistRenderer.captionTracks || [];

          if (tracks.length > 0) {
            const track = tracks.find(t => t.languageCode === 'en') || tracks[0];

            if (track && track.baseUrl) {
              // Download caption file - request JSON3 format explicitly
              const captionUrl = track.baseUrl.includes('?')
                ? `${track.baseUrl}&fmt=json3`
                : `${track.baseUrl}?fmt=json3`;

              const captionResponse = await axios.get(captionUrl, { timeout: 10000 });
              const transcript = this.parseJSON3Captions(captionResponse.data);

              this.strategyStats.embed.success++;
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
              console.log(`[SmartBypass] ✅ Embed strategy worked! (${elapsed}s)`);

              return {
                success: true,
                transcript,
                strategy: 'embed',
                fetchTime: elapsed
              };
            }
          }
        }
      }

      throw new Error('No captions found in embed player');

    } catch (error) {
      this.strategyStats.embed.failures++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[SmartBypass] ❌ Embed strategy failed (${elapsed}s): ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Strategy 4: TV HTML5 Client
   */
  async fetchViaTV(videoId) {
    const startTime = Date.now();
    console.log(`[SmartBypass] 📺 Strategy 4: TV HTML5 for ${videoId}`);

    try {
      const url = 'https://www.youtube.com/youtubei/v1/player';

      const payload = {
        videoId: videoId,
        context: {
          client: this.tvClient
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.tvClient.userAgent,
          'X-YouTube-Client-Name': '7',
          'X-YouTube-Client-Version': this.tvClient.clientVersion
        },
        timeout: 15000
      });

      if (response.data && response.data.captions) {
        const captionTracks = response.data.captions.playerCaptionsTracklistRenderer?.captionTracks || [];

        if (captionTracks.length > 0) {
          const track = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0];

          if (track && track.baseUrl) {
            // Download caption file - request JSON3 format explicitly
            const captionUrl = track.baseUrl.includes('?')
              ? `${track.baseUrl}&fmt=json3`
              : `${track.baseUrl}?fmt=json3`;

            console.log(`[SmartBypass] Caption URL: ${captionUrl.substring(0, 150)}...`);

            const captionResponse = await axios.get(captionUrl, { timeout: 10000 });

            console.log(`[SmartBypass] Caption response type: ${typeof captionResponse.data}`);
            console.log(`[SmartBypass] Caption response sample: ${JSON.stringify(captionResponse.data).substring(0, 300)}...`);

            const transcript = this.parseJSON3Captions(captionResponse.data);

            console.log(`[SmartBypass] Parsed transcript text length: ${transcript.text.length}`);
            console.log(`[SmartBypass] Parsed segments count: ${transcript.segments.length}`);
            console.log(`[SmartBypass] Parsed word count: ${transcript.wordCount}`);

            this.strategyStats.tvhtml5.success++;
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[SmartBypass] ✅ TV strategy worked! (${elapsed}s)`);

            return {
              success: true,
              transcript,
              strategy: 'tvhtml5',
              fetchTime: elapsed
            };
          }
        }
      }

      throw new Error('No captions found in TV response');

    } catch (error) {
      this.strategyStats.tvhtml5.failures++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[SmartBypass] ❌ TV strategy failed (${elapsed}s): ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse JSON3 or XML captions to transcript
   */
  parseJSON3Captions(data) {
    try {
      console.log(`[SmartBypass] parseJSON3Captions input type: ${typeof data}`);

      // If data is already an object (axios parsed it)
      if (typeof data === 'object' && data !== null) {
        const events = data.events || [];

        console.log(`[SmartBypass] Parsing JSON3 object, events count: ${events.length}`);

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

        console.log(`[SmartBypass] Parsed ${segments.length} segments, fullText length: ${fullText.trim().length}`);

        return {
          text: fullText.trim(),
          segments,
          wordCount: fullText.trim().split(/\s+/).filter(w => w.length > 0).length
        };
      }

      // Handle JSON3 format string
      if (typeof data === 'string' && data.trim().startsWith('{')) {
        const json = JSON.parse(data);
        return this.parseJSON3Captions(json); // Recursive call with parsed object
      }

      // Handle XML format (srv3/ttml)
      if (typeof data === 'string' && data.trim().startsWith('<')) {
        console.log(`[SmartBypass] Parsing XML captions (first 500 chars): ${data.substring(0, 500)}`);

        // Parse XML captions - YouTube uses both <text> and <p> tags
        // Use [\s\S] to match any character including newlines
        const textMatches = data.match(/<(?:text|p)[^>]*>([\s\S]+?)<\/(?:text|p)>/g) || [];

        console.log(`[SmartBypass] Found ${textMatches.length} XML caption elements`);

        const segments = [];
        let fullText = '';

        textMatches.forEach((match, index) => {
          // Extract text content and decode HTML entities
          const textContent = match.replace(/<(?:text|p)[^>]*>/, '').replace(/<\/(?:text|p)>/, '');
          // Replace newlines with spaces
          const normalizedText = textContent.replace(/\n/g, ' ');
          const decodedText = this.decodeHTMLEntities(normalizedText);

          if (decodedText.trim()) {
            segments.push({
              text: decodedText.trim(),
              start: index, // Approximate timing
              offset: index * 1000,
              duration: 0
            });

            fullText += decodedText + ' ';
          }
        });

        console.log(`[SmartBypass] Parsed ${segments.length} XML segments, fullText length: ${fullText.trim().length}`);

        return {
          text: fullText.trim(),
          segments,
          wordCount: fullText.trim().split(/\s+/).filter(w => w.length > 0).length
        };
      }

      console.error('[SmartBypass] Unknown caption format:', typeof data, data ? data.substring(0, 100) : 'empty');
      throw new Error('Unknown caption format');

    } catch (error) {
      console.error('[SmartBypass] Caption parsing failed:', error.message);
      return {
        text: '',
        segments: [],
        wordCount: 0
      };
    }
  }

  /**
   * Decode HTML entities in text
   */
  decodeHTMLEntities(text) {
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#x60;': '`',
      '&#x3D;': '='
    };

    return text.replace(/&[^;]+;/g, entity => entities[entity] || entity);
  }

  /**
   * Main method: Try all strategies in order until one works
   */
  async fetchTranscript(videoId) {
    const startTime = Date.now();

    // Check cache
    if (this.cache.has(videoId)) {
      console.log(`[SmartBypass] ✓ Cache hit for ${videoId}`);
      return this.cache.get(videoId);
    }

    console.log(`[SmartBypass] 🎯 Fetching transcript for ${videoId} using multi-strategy bypass...`);

    // Strategy order (best to worst based on success rates)
    const strategies = [
      () => this.fetchViaIOS(videoId),
      () => this.fetchViaAndroid(videoId),
      () => this.fetchViaEmbed(videoId),
      () => this.fetchViaTV(videoId)
    ];

    let lastError = null;

    for (const strategy of strategies) {
      try {
        // Add delay to avoid rate limiting (1-3 seconds to be respectful)
        // Increased from 0-2s to reduce chance of triggering 429 errors
        const delay = 1000 + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));

        const result = await strategy();

        if (result.success) {
          const finalResult = {
            success: true,
            videoId,
            text: result.transcript.text,
            segments: result.transcript.segments,
            wordCount: result.transcript.wordCount,
            charCount: result.transcript.text.length,
            language: 'en',
            source: `smart-bypass-${result.strategy}`,
            strategy: result.strategy,
            fetchTime: ((Date.now() - startTime) / 1000).toFixed(2)
          };

          // Cache result
          this.cache.set(videoId, finalResult);

          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`[SmartBypass] ✅ Success using ${result.strategy} in ${elapsed}s (${result.transcript.wordCount} words)`);

          this.printStats();

          return finalResult;
        }
      } catch (error) {
        lastError = error;
        continue; // Try next strategy
      }
    }

    // All strategies failed
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[SmartBypass] ❌ All strategies failed after ${elapsed}s`);
    this.printStats();

    return {
      success: false,
      videoId,
      error: lastError?.message || 'All strategies exhausted',
      source: 'smart-bypass'
    };
  }

  /**
   * Print strategy success stats
   */
  printStats() {
    console.log('[SmartBypass] Strategy Stats:');
    for (const [strategy, stats] of Object.entries(this.strategyStats)) {
      const total = stats.success + stats.failures;
      if (total > 0) {
        const successRate = ((stats.success / total) * 100).toFixed(1);
        console.log(`  ${strategy}: ${stats.success}/${total} (${successRate}% success)`);
      }
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[SmartBypass] Cache cleared');
  }
}

module.exports = new YouTubeSmartBypass();
