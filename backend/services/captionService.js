const { YoutubeTranscript } = require('youtube-transcript');

/**
 * Service for fetching YouTube video captions
 * Now supports both manual AND auto-generated captions
 */
class CaptionService {

  /**
   * Fetch captions from YouTube (manual or auto-generated)
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Caption data with segments
   */
  async fetchYouTubeCaptions(videoId) {
    console.log(`[CaptionService] Fetching captions for video: ${videoId}`);

    try {
      // youtube-transcript automatically tries manual captions first, then auto-generated
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'en'
      });

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
      console.error(`[CaptionService] Error fetching captions:`, error.message);
      return {
        available: false,
        text: '',
        segments: [],
        error: error.message
      };
    }
  }

  /**
   * Fetch captions with fallback languages
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Caption data
   */
  async fetchYouTubeCaptionsWithFallback(videoId) {
    const languages = ['en', 'en-US', 'en-GB'];

    for (const lang of languages) {
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
          lang: lang
        });

        if (transcript && transcript.length > 0) {
          console.log(`[CaptionService] ✓ Captions found in language: ${lang}`);
          return this.formatCaptions(transcript);
        }
      } catch (error) {
        console.log(`[CaptionService] No captions in ${lang}, trying next language...`);
        continue; // Try next language
      }
    }

    console.log(`[CaptionService] No captions available in any supported language`);
    return {
      available: false,
      text: '',
      segments: []
    };
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
