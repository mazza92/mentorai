const { YoutubeTranscript } = require('youtube-transcript');

/**
 * Service for fetching YouTube video captions
 * Now supports both manual AND auto-generated captions
 */
class CaptionService {

  /**
   * Fetch captions from YouTube (manual or auto-generated)
   * youtube-transcript automatically finds the best available captions
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Caption data with segments
   */
  async fetchYouTubeCaptions(videoId) {
    console.log(`[CaptionService] Fetching captions for video: ${videoId}`);

    try {
      // youtube-transcript automatically tries:
      // 1. Manual captions in requested language
      // 2. Auto-generated captions in requested language
      // 3. Available captions in other languages
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

      console.log(`[CaptionService] ✓ Captions fetched: ${segments.length} segments`);

      return {
        available: true,
        text: fullText,
        segments: segments
      };

    } catch (error) {
      console.error(`[CaptionService] Error fetching captions for ${videoId}:`, error.message);
      return {
        available: false,
        text: '',
        segments: [],
        error: error.message
      };
    }
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
