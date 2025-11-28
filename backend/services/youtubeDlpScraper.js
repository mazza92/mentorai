const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * YouTube Transcript Scraper using yt-dlp
 *
 * This is the ONLY method that reliably works for fetching YouTube transcripts.
 * yt-dlp handles all of YouTube's anti-bot measures automatically.
 */
class YouTubeDlpScraper {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Fetch transcript using yt-dlp
   */
  async fetchTranscript(videoId) {
    const startTime = Date.now();

    // Check cache
    if (this.cache.has(videoId)) {
      console.log(`[DlpScraper] ✓ Cache hit for ${videoId}`);
      return this.cache.get(videoId);
    }

    try {
      console.log(`[DlpScraper] Fetching transcript for ${videoId} using yt-dlp...`);

      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      // Use yt-dlp to get auto-generated subtitles in JSON format
      const command = `yt-dlp --write-auto-subs --sub-lang en --sub-format json3 --skip-download --print-json "${videoUrl}"`;

      console.log(`[DlpScraper] DEBUG: Running command...`);

      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      if (stderr && stderr.includes('ERROR')) {
        throw new Error(stderr);
      }

      console.log(`[DlpScraper] DEBUG: Got yt-dlp output, parsing...`);

      // Parse the JSON output
      const videoInfo = JSON.parse(stdout);

      // Get auto-generated subtitles
      const autoSubs = videoInfo.automatic_captions;
      if (!autoSubs || Object.keys(autoSubs).length === 0) {
        throw new Error('No auto-generated subtitles available');
      }

      // Get English subtitles (or first available language)
      const langCode = autoSubs.en ? 'en' : Object.keys(autoSubs)[0];
      const subtitles = autoSubs[langCode];

      if (!subtitles || subtitles.length === 0) {
        throw new Error('No subtitle data found');
      }

      // Find JSON3 format
      const json3Sub = subtitles.find(s => s.ext === 'json3');
      if (!json3Sub) {
        throw new Error('JSON3 format not available');
      }

      // Download the subtitle content
      console.log(`[DlpScraper] DEBUG: Downloading subtitle from: ${json3Sub.url.substring(0, 100)}...`);

      const { stdout: subContent } = await execAsync(`curl -s "${json3Sub.url}"`, {
        timeout: 10000,
        maxBuffer: 5 * 1024 * 1024
      });

      const subData = JSON.parse(subContent);
      const events = subData.events || [];

      // Extract segments
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

      const result = {
        success: true,
        videoId,
        text: fullText.trim(),
        segments,
        wordCount: fullText.trim().split(/\s+/).length,
        charCount: fullText.trim().length,
        language: langCode,
        source: 'yt-dlp',
        fetchTime: ((Date.now() - startTime) / 1000).toFixed(2)
      };

      // Cache result
      this.cache.set(videoId, result);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[DlpScraper] ✓ Fetched transcript for ${videoId} in ${elapsed}s (${result.wordCount} words, ${segments.length} segments)`);

      return result;

    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[DlpScraper] ✗ Failed to fetch ${videoId} after ${elapsed}s:`, error.message);

      return {
        success: false,
        videoId,
        error: error.message,
        source: 'yt-dlp'
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[DlpScraper] Cache cleared');
  }
}

module.exports = new YouTubeDlpScraper();
