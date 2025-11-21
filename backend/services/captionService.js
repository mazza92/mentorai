const { getSubtitles } = require('youtube-captions-scraper');

/**
 * Service for fetching YouTube video captions
 */
class CaptionService {

  /**
   * Fetch captions from YouTube
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Caption data with segments
   */
  async fetchYouTubeCaptions(videoId) {
    console.log(`[CaptionService] Fetching captions for video: ${videoId}`);

    try {
      // Try to get English captions
      const captions = await getSubtitles({
        videoID: videoId,
        lang: 'en' // Default to English
      });

      if (!captions || captions.length === 0) {
        console.log(`[CaptionService] No captions available for ${videoId}`);
        return {
          available: false,
          text: '',
          segments: []
        };
      }

      // Format captions
      const segments = captions.map(caption => ({
        start: parseFloat(caption.start),
        duration: parseFloat(caption.dur),
        text: caption.text.replace(/\n/g, ' ').trim()
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
        const captions = await getSubtitles({
          videoID: videoId,
          lang: lang
        });

        if (captions && captions.length > 0) {
          console.log(`[CaptionService] ✓ Captions found in language: ${lang}`);
          return this.formatCaptions(captions);
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
   * @param {Array} captions - Raw caption data
   * @returns {Object} Formatted caption data
   */
  formatCaptions(captions) {
    const segments = captions.map(caption => ({
      start: parseFloat(caption.start),
      duration: parseFloat(caption.dur),
      text: caption.text.replace(/\n/g, ' ').trim()
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
