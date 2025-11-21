const { google } = require('googleapis');
const youtube = google.youtube('v3');
const { YoutubeTranscript } = require('youtube-transcript');

/**
 * Service for fetching YouTube video captions
 * Uses official YouTube Data API v3 (primary) with youtube-transcript as fallback
 */
class CaptionService {

  /**
   * Fetch captions from YouTube using official API (primary) with scraping fallback
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Caption data with segments
   */
  async fetchYouTubeCaptions(videoId) {
    console.log(`[CaptionService] Fetching captions for video: ${videoId}`);

    // Try official YouTube Data API v3 first (most reliable, like NotebookLM)
    if (process.env.YOUTUBE_API_KEY) {
      try {
        const captionData = await this.fetchOfficialCaptions(videoId);
        if (captionData.available) {
          console.log(`[CaptionService] ✓ Official API captions: ${captionData.segments.length} segments`);
          return captionData;
        }
      } catch (apiError) {
        console.log(`[CaptionService] Official API failed, trying scraper fallback:`, apiError.message);
      }
    }

    // Fallback to youtube-transcript scraping (less reliable but no API key needed)
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);

      if (!transcript || transcript.length === 0) {
        console.log(`[CaptionService] No captions available for ${videoId}`);
        return {
          available: false,
          text: '',
          segments: []
        };
      }

      // Format captions (youtube-transcript returns: [{text, duration, offset}])
      const segments = transcript.map(item => ({
        start: item.offset / 1000, // Convert ms to seconds
        duration: item.duration / 1000,
        text: item.text.replace(/\n/g, ' ').trim()
      }));

      const fullText = segments.map(s => s.text).join(' ');

      console.log(`[CaptionService] ✓ Scraper captions: ${segments.length} segments`);

      return {
        available: true,
        text: fullText,
        segments: segments
      };

    } catch (error) {
      console.error(`[CaptionService] All caption methods failed for ${videoId}:`, error.message);
      return {
        available: false,
        text: '',
        segments: [],
        error: error.message
      };
    }
  }

  /**
   * Fetch captions using official YouTube Data API v3 (most reliable)
   * This is what NotebookLM likely uses
   */
  async fetchOfficialCaptions(videoId) {
    // 1. List available caption tracks
    const captionListResponse = await youtube.captions.list({
      part: 'snippet',
      videoId: videoId,
      key: process.env.YOUTUBE_API_KEY
    });

    const captions = captionListResponse.data.items;
    if (!captions || captions.length === 0) {
      return { available: false, text: '', segments: [] };
    }

    // 2. Prioritize tracks: English > Auto-generated English > any language
    const preferredTrack = captions.find(c => c.snippet.language === 'en' && c.snippet.trackKind !== 'asr') ||
                          captions.find(c => c.snippet.language === 'en') ||
                          captions[0];

    if (!preferredTrack) {
      return { available: false, text: '', segments: [] };
    }

    // 3. Download the caption track (requires timedtext format)
    const captionId = preferredTrack.id;
    const downloadResponse = await youtube.captions.download({
      id: captionId,
      tfmt: 'srt', // SRT format for easy parsing
      key: process.env.YOUTUBE_API_KEY
    });

    // 4. Parse SRT format
    const srtData = downloadResponse.data;
    const segments = this.parseSRT(srtData);

    const fullText = segments.map(s => s.text).join(' ');

    return {
      available: true,
      text: fullText,
      segments: segments
    };
  }

  /**
   * Parse SRT subtitle format
   */
  parseSRT(srtContent) {
    const segments = [];
    const blocks = srtContent.toString().split('\n\n');

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;

      // Line 1: sequence number (skip)
      // Line 2: timestamp (00:00:01,000 --> 00:00:03,000)
      // Line 3+: text

      const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      if (!timeMatch) continue;

      const startSeconds = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
      const endSeconds = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;

      const text = lines.slice(2).join(' ').replace(/<[^>]*>/g, '').trim();

      segments.push({
        start: startSeconds,
        duration: endSeconds - startSeconds,
        text: text
      });
    }

    return segments;
  }

  /**
   * Fetch captions with fallback (kept for backwards compatibility, just calls main method)
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Caption data
   */
  async fetchYouTubeCaptionsWithFallback(videoId) {
    // youtube-transcript already handles all fallbacks automatically
    return this.fetchYouTubeCaptions(videoId);
  }

  /**
   * Format caption data
   * @param {Array} transcript - Raw transcript data from youtube-transcript
   * @returns {Object} Formatted caption data
   */
  formatCaptions(transcript) {
    const segments = transcript.map(item => ({
      start: item.offset / 1000, // Convert ms to seconds
      duration: item.duration / 1000,
      text: item.text.replace(/\n/g, ' ').trim()
    }));

    const fullText = segments.map(s => s.text).join(' ');

    return {
      available: true,
      text: fullText,
      segments: segments
    };
  }
}

module.exports = new CaptionService();
