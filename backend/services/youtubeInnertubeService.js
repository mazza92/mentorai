const { fetchTranscript } = require('youtube-transcript-plus');

/**
 * YouTube Innertube Caption Scraper
 *
 * Uses YouTube's internal Innertube API to fetch existing captions/transcripts.
 *
 * Key advantages:
 * - 10-50x faster than audio transcription (just downloads existing captions)
 * - Free (no transcription costs)
 * - Works for 70-80% of videos (those with auto-captions)
 * - Bypasses YouTube restrictions by using internal API
 * - No authentication required
 *
 * How it works:
 * 1. Makes request to video page to get metadata
 * 2. Calls Innertube API to get caption track URLs
 * 3. Downloads caption XML files
 * 4. Parses into structured segments
 */
class YouTubeInnertubeService {
  constructor() {
    this.cache = new Map(); // In-memory cache for this session
  }

  /**
   * Fetch transcript for a single video
   * @param {string} videoId - YouTube video ID
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Transcript result
   */
  async fetchTranscript(videoId, options = {}) {
    const startTime = Date.now();

    // Check cache first
    if (this.cache.has(videoId)) {
      console.log(`[Innertube] ✓ Cache hit for ${videoId}`);
      return this.cache.get(videoId);
    }

    try {
      console.log(`[Innertube] Fetching transcript for ${videoId}...`);

      // Fetch using youtube-transcript-plus (Innertube API)
      const segments = await fetchTranscript(videoId, {
        lang: options.lang || 'en',
        ...options
      });

      if (!segments || segments.length === 0) {
        throw new Error('No captions available');
      }

      // Convert to our format
      const fullText = segments.map(seg => seg.text).join(' ');

      const result = {
        success: true,
        videoId,
        text: fullText,
        segments: segments.map(seg => ({
          text: seg.text,
          start: Math.floor(seg.offset / 1000), // Convert ms to seconds for timestamps
          offset: seg.offset, // Keep original ms offset
          duration: seg.duration
        })),
        wordCount: fullText.split(/\s+/).length,
        charCount: fullText.length,
        language: segments[0]?.lang || 'en',
        source: 'youtube-innertube',
        fetchTime: ((Date.now() - startTime) / 1000).toFixed(2)
      };

      // Cache the result
      this.cache.set(videoId, result);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Innertube] ✓ Fetched transcript for ${videoId} in ${elapsed}s (${result.wordCount} words)`);

      return result;

    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[Innertube] ✗ Failed to fetch ${videoId} after ${elapsed}s:`, error.message);

      return {
        success: false,
        videoId,
        error: error.message,
        source: 'youtube-innertube'
      };
    }
  }

  /**
   * Fetch transcripts for multiple videos with concurrency control
   * @param {Array<string>} videoIds - Array of video IDs
   * @param {number} concurrency - Max parallel requests
   * @returns {Promise<Object>} Batch result
   */
  async fetchBatch(videoIds, concurrency = 5) {
    const startTime = Date.now();
    console.log(`[Innertube] 📦 Fetching ${videoIds.length} transcripts (concurrency: ${concurrency})`);

    const results = {
      total: videoIds.length,
      successful: 0,
      failed: 0,
      cached: 0,
      transcripts: {}
    };

    // Process in batches for concurrency control
    const batches = this.chunkArray(videoIds, concurrency);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[Innertube] Processing batch ${i + 1}/${batches.length} (${batch.length} videos)`);

      const batchStart = Date.now();

      // Fetch all videos in this batch concurrently
      const promises = batch.map(videoId =>
        this.fetchTranscript(videoId)
          .catch(error => ({
            success: false,
            videoId,
            error: error.message
          }))
      );

      const batchResults = await Promise.all(promises);

      // Aggregate results
      for (const result of batchResults) {
        if (result.success) {
          results.successful++;
          results.transcripts[result.videoId] = result;
        } else {
          results.failed++;
        }
      }

      const batchTime = ((Date.now() - batchStart) / 1000).toFixed(1);
      const batchSuccess = batchResults.filter(r => r.success).length;
      console.log(`[Innertube] Batch ${i + 1} complete: ${batchSuccess}/${batch.length} successful in ${batchTime}s`);

      // Small delay between batches to avoid overwhelming YouTube
      if (i < batches.length - 1) {
        await this.sleep(500);
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const successRate = ((results.successful / results.total) * 100).toFixed(1);

    console.log(`[Innertube] ✅ Batch complete: ${results.successful}/${results.total} successful (${successRate}%) in ${totalTime}s`);
    console.log(`[Innertube] Average: ${(totalTime / results.total).toFixed(2)}s per video`);

    return results;
  }

  /**
   * Fetch transcripts for channel videos with intelligent prioritization
   * @param {Array<Object>} videos - Array of video objects with metadata
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Results
   */
  async fetchChannelTranscripts(videos, options = {}) {
    const {
      maxVideos = null, // null = fetch all
      concurrency = 10,
      prioritizeBy = 'views', // 'views', 'recency', or 'duration'
      stopOnLowSuccessRate = true, // Stop if success rate < 20% to avoid wasting time
      minSampleSize = 10 // Minimum videos to try before checking success rate
    } = options;

    console.log(`[Innertube] 🎬 Fetching transcripts for channel (${videos.length} videos)`);

    // Sort videos by priority
    const sortedVideos = this.prioritizeVideos(videos, prioritizeBy);

    // Limit if needed
    const videosToFetch = maxVideos
      ? sortedVideos.slice(0, maxVideos)
      : sortedVideos;

    console.log(`[Innertube] Processing ${videosToFetch.length} videos (prioritized by ${prioritizeBy})`);

    const videoIds = videosToFetch.map(v => v.videoId || v.id);

    // Smart early stopping: If first batch has very low success rate, channel likely has no captions
    if (stopOnLowSuccessRate && videoIds.length > minSampleSize) {
      console.log(`[Innertube] Testing ${minSampleSize} videos first to check caption availability...`);

      const sampleResults = await this.fetchBatch(videoIds.slice(0, minSampleSize), concurrency);
      const sampleSuccessRate = (sampleResults.successful / minSampleSize) * 100;

      console.log(`[Innertube] Sample success rate: ${sampleSuccessRate.toFixed(1)}%`);

      if (sampleSuccessRate < 20) {
        console.log(`[Innertube] ⚠️ Low caption availability detected. This channel likely doesn't have auto-captions enabled.`);
        console.log(`[Innertube] Skipping remaining ${videoIds.length - minSampleSize} videos to save time.`);

        return {
          ...sampleResults,
          total: videoIds.length,
          skipped: videoIds.length - minSampleSize,
          videos: videosToFetch,
          lowCaptionAvailability: true
        };
      }

      // Good success rate, continue with remaining videos
      if (videoIds.length > minSampleSize) {
        console.log(`[Innertube] Good caption availability! Continuing with remaining videos...`);
        const remainingResults = await this.fetchBatch(videoIds.slice(minSampleSize), concurrency);

        // Merge results
        const results = {
          total: sampleResults.total + remainingResults.total,
          successful: sampleResults.successful + remainingResults.successful,
          failed: sampleResults.failed + remainingResults.failed,
          cached: sampleResults.cached + remainingResults.cached,
          transcripts: { ...sampleResults.transcripts, ...remainingResults.transcripts }
        };

        // Attach transcripts to video objects
        for (const video of videosToFetch) {
          const videoId = video.videoId || video.id;
          if (results.transcripts[videoId]) {
            video.transcript = results.transcripts[videoId].text;
            video.transcriptSegments = results.transcripts[videoId].segments;
            video.transcriptSource = 'youtube-innertube';
            video.hasTranscript = true;
          }
        }

        return {
          ...results,
          videos: videosToFetch
        };
      }
    }

    // Regular batch processing (no smart stopping)
    const results = await this.fetchBatch(videoIds, concurrency);

    // Attach transcripts to video objects
    for (const video of videosToFetch) {
      const videoId = video.videoId || video.id;
      if (results.transcripts[videoId]) {
        video.transcript = results.transcripts[videoId].text;
        video.transcriptSegments = results.transcripts[videoId].segments;
        video.transcriptSource = 'youtube-innertube';
        video.hasTranscript = true;
      }
    }

    return {
      ...results,
      videos: videosToFetch
    };
  }

  /**
   * Prioritize videos for fetching
   */
  prioritizeVideos(videos, prioritizeBy) {
    const sorted = [...videos];

    switch (prioritizeBy) {
      case 'views':
        return sorted.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

      case 'recency':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.publishedAt || a.snippet?.publishedAt || 0);
          const dateB = new Date(b.publishedAt || b.snippet?.publishedAt || 0);
          return dateB - dateA;
        });

      case 'duration':
        // Prioritize medium-length videos (5-20 min) - usually most informative
        return sorted.sort((a, b) => {
          const scoreA = this.getDurationScore(a.duration);
          const scoreB = this.getDurationScore(b.duration);
          return scoreB - scoreA;
        });

      default:
        return sorted;
    }
  }

  /**
   * Score videos by duration (prefer medium-length videos)
   */
  getDurationScore(duration) {
    if (!duration) return 0;

    // Parse ISO 8601 duration (PT15M33S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    const totalMinutes = hours * 60 + minutes + seconds / 60;

    // Score curve: prefer 5-20 minute videos
    if (totalMinutes < 2) return 1; // Too short
    if (totalMinutes < 5) return 3;
    if (totalMinutes < 20) return 5; // Sweet spot
    if (totalMinutes < 40) return 3;
    return 1; // Too long
  }

  /**
   * Chunk array helper
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[Innertube] Cache cleared');
  }
}

module.exports = new YouTubeInnertubeService();
