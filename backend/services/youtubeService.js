const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');

class YouTubeService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../uploads');
    this.tempDir = path.join(__dirname, '../temp');

    // Ensure directories exist
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    console.log('YouTube downloader initialized');
  }

  /**
   * Validate YouTube URL
   * @param {string} url - YouTube URL
   * @returns {boolean} - True if valid YouTube URL
   */
  isValidYouTubeUrl(url) {
    try {
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
      return youtubeRegex.test(url);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get video info from YouTube
   * @param {string} url - YouTube URL
   * @returns {Promise<Object>} - Video info (title, duration, etc.)
   */
  async getVideoInfo(url) {
    try {
      // Get video info using youtube-dl-exec
      // Add options to bypass YouTube bot detection
      const info = await youtubedl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        // Bypass bot detection
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        referer: 'https://www.youtube.com/',
        // Add retry options
        retries: 3,
        fragmentRetries: 3,
        // Additional options to avoid detection
        noPlaylist: true,
        extractFlat: false,
      });

      // Extract thumbnail - handle multiple possible formats
      let thumbnail = '';
      if (info.thumbnail) {
        thumbnail = info.thumbnail;
      } else if (info.thumbnails && Array.isArray(info.thumbnails) && info.thumbnails.length > 0) {
        // Get the highest quality thumbnail (usually the last one)
        const sortedThumbnails = info.thumbnails.sort((a, b) => (b.width || 0) - (a.width || 0));
        thumbnail = sortedThumbnails[0].url || sortedThumbnails[0];
      } else if (info.videoId) {
        // Fallback: construct YouTube thumbnail URL from video ID
        thumbnail = `https://img.youtube.com/vi/${info.videoId}/maxresdefault.jpg`;
      }
      
      console.log('Extracted thumbnail URL:', thumbnail);
      
      return {
        title: info.title,
        duration: info.duration,
        description: info.description || '',
        thumbnail: thumbnail,
        author: info.uploader || info.channel || '',
        videoId: info.id,
        views: info.view_count || info.views || null,
        likes: info.like_count || info.likes || null,
        subscribers: info.channel_follower_count || info.subscriber_count || null,
      };
    } catch (error) {
      console.error('Error getting YouTube video info:', error);
      
      // Check for bot detection error
      if (error.stderr && (error.stderr.includes('Sign in to confirm') || error.stderr.includes('bot'))) {
        console.error('YouTube bot detection triggered. This is a known issue with yt-dlp.');
        console.error('Possible solutions:');
        console.error('1. Wait a few minutes and try again');
        console.error('2. Use cookies (requires manual setup)');
        console.error('3. YouTube may be rate-limiting this IP');
        throw new Error('YouTube is blocking automated access. Please try again in a few minutes or contact support if the issue persists.');
      }
      
      throw new Error('Failed to fetch video information from YouTube');
    }
  }

  /**
   * Download YouTube video
   * @param {string} url - YouTube URL
   * @param {Function} progressCallback - Callback for download progress (optional)
   * @returns {Promise<Object>} - Object with video path, audio path, and metadata
   */
  async downloadVideo(url, progressCallback = null) {
    try {
      // Validate URL
      if (!this.isValidYouTubeUrl(url)) {
        throw new Error('Invalid YouTube URL');
      }

      // Get video info first
      const videoInfo = await this.getVideoInfo(url);
      console.log(`Processing YouTube video: ${videoInfo.title} (${videoInfo.duration}s)`);

      if (progressCallback) {
        progressCallback({
          stage: 'downloading',
          progress: 10,
        });
      }

      // Generate unique filenames
      const videoId = uuidv4();
      const videoPath = path.join(this.uploadsDir, `${videoId}.mp4`);
      const audioPath = path.join(this.uploadsDir, `${videoId}.mp3`);

      console.log('Downloading video from YouTube...');

      // Download video using youtube-dl-exec
      // This automatically handles binary downloads and updates
      // Add options to bypass YouTube bot detection
      await youtubedl(url, {
        output: videoPath,
        format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        noPlaylist: true,
        noWarnings: true,
        noCheckCertificates: true,
        // Bypass bot detection
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        referer: 'https://www.youtube.com/',
        // Add retry options
        retries: 3,
        fragmentRetries: 3,
      });

      console.log('Video download complete');

      if (progressCallback) {
        progressCallback({
          stage: 'extracting_audio',
          progress: 70,
        });
      }

      // Extract audio for transcription
      console.log('Extracting audio...');
      try {
        await this.extractAudio(videoPath, audioPath, (progress) => {
          if (progressCallback) {
            progressCallback({
              stage: 'extracting_audio',
              progress: 70 + Math.floor(progress * 0.3), // 70-100%
            });
          }
        });

        console.log('Audio extraction complete');

        if (progressCallback) {
          progressCallback({
            stage: 'complete',
            progress: 100,
          });
        }

        return {
          videoPath,
          audioPath,
          metadata: {
            title: videoInfo.title,
            duration: videoInfo.duration,
            description: videoInfo.description,
            thumbnail: videoInfo.thumbnail,
            author: videoInfo.author,
            youtubeUrl: url,
            videoId: videoInfo.videoId,
            views: videoInfo.views,
            likes: videoInfo.likes,
            subscribers: videoInfo.subscribers,
          },
        };
      } catch (audioError) {
        console.error('Audio extraction error:', audioError);
        // Even if audio extraction fails, we have the video
        return {
          videoPath,
          audioPath: null,
          metadata: {
            title: videoInfo.title,
            duration: videoInfo.duration,
            description: videoInfo.description,
            thumbnail: videoInfo.thumbnail,
            author: videoInfo.author,
            youtubeUrl: url,
            videoId: videoInfo.videoId,
            views: videoInfo.views,
            likes: videoInfo.likes,
            subscribers: videoInfo.subscribers,
          },
        };
      }
    } catch (error) {
      console.error('Download video error:', error);
      throw error;
    }
  }

  /**
   * Extract audio from video file
   * @param {string} videoPath - Path to video file
   * @param {string} audioPath - Output path for audio file
   * @param {Function} progressCallback - Progress callback (optional)
   * @returns {Promise<string>} - Audio file path
   */
  extractAudio(videoPath, audioPath, progressCallback = null) {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .format('mp3')
        .on('progress', (progress) => {
          if (progressCallback && progress.percent) {
            progressCallback(Math.round(progress.percent));
          }
        })
        .on('end', () => {
          resolve(audioPath);
        })
        .on('error', (error) => {
          console.error('FFmpeg audio extraction error:', error);
          reject(error);
        })
        .save(audioPath);
    });
  }

  /**
   * Clean up downloaded files
   * @param {string} videoPath - Path to video file
   * @param {string} audioPath - Path to audio file
   */
  cleanup(videoPath, audioPath = null) {
    try {
      if (videoPath && fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
        console.log('Cleaned up video file:', videoPath);
      }
      if (audioPath && fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
        console.log('Cleaned up audio file:', audioPath);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

module.exports = new YouTubeService();
