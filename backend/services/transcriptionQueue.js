const videoDownloadService = require('./videoDownloadService');
const transcriptionService = require('./transcriptionService');
const { getFirestore } = require('../config/firebase');

/**
 * Simple in-memory transcription queue for channel videos
 * Processes videos in background without blocking the main thread
 */
class TranscriptionQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = 2; // Process 2 videos at a time
    this.activeJobs = new Set();
  }

  /**
   * Add video to transcription queue
   */
  async queueVideoTranscription(videoData) {
    const job = {
      id: `${videoData.channelId}_${videoData.videoId}`,
      ...videoData,
      status: 'queued',
      queuedAt: new Date(),
      attempts: 0,
      maxAttempts: 2
    };

    // Avoid duplicates
    if (this.queue.find(j => j.id === job.id) || this.activeJobs.has(job.id)) {
      console.log(`[TranscriptionQueue] Job already queued: ${job.id}`);
      return;
    }

    this.queue.push(job);
    console.log(`[TranscriptionQueue] Queued: ${videoData.title} (${videoData.videoId})`);
    console.log(`[TranscriptionQueue] Queue size: ${this.queue.length}`);

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process videos from queue
   */
  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    console.log(`[TranscriptionQueue] Starting queue processor...`);

    while (this.queue.length > 0 || this.activeJobs.size > 0) {
      // Start new jobs up to maxConcurrent
      while (this.activeJobs.size < this.maxConcurrent && this.queue.length > 0) {
        const job = this.queue.shift();
        this.activeJobs.add(job.id);

        // Process job (don't await - run in background)
        this.processJob(job)
          .then(() => this.activeJobs.delete(job.id))
          .catch(err => {
            console.error(`[TranscriptionQueue] Job failed: ${job.id}`, err);
            this.activeJobs.delete(job.id);
          });
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.processing = false;
    console.log(`[TranscriptionQueue] Queue processor stopped (queue empty)`);
  }

  /**
   * Process single transcription job
   */
  async processJob(job) {
    const startTime = Date.now();
    console.log(`[TranscriptionQueue] Processing: ${job.title}`);

    try {
      // 1. Download YouTube video audio
      const videoUrl = `https://www.youtube.com/watch?v=${job.videoId}`;
      const downloadResult = await videoDownloadService.downloadYouTubeVideo(videoUrl, job.userId);

      if (!downloadResult.success || !downloadResult.localAudioPath) {
        throw new Error('Failed to download video audio');
      }

      // 2. Transcribe using AssemblyAI (fastest)
      const transcriptResult = await transcriptionService.transcribe(
        downloadResult.localAudioPath,
        'assemblyai' // Use AssemblyAI for speed
      );

      if (!transcriptResult.success || !transcriptResult.transcript) {
        throw new Error('Transcription failed');
      }

      // 3. Update video in Firestore with transcript
      await this.updateVideoTranscript(job.channelId, job.videoId, {
        transcript: transcriptResult.transcript.text,
        transcriptSegments: transcriptResult.transcript.words || [],
        transcriptSource: 'assemblyai',
        transcriptQuality: 100, // Full transcription
        status: 'ready',
        transcribedAt: new Date()
      });

      // 4. Cleanup downloaded file
      try {
        const fs = require('fs');
        if (fs.existsSync(downloadResult.localAudioPath)) {
          fs.unlinkSync(downloadResult.localAudioPath);
        }
        if (downloadResult.localVideoPath && fs.existsSync(downloadResult.localVideoPath)) {
          fs.unlinkSync(downloadResult.localVideoPath);
        }
      } catch (cleanupErr) {
        console.warn(`[TranscriptionQueue] Cleanup failed for ${job.videoId}:`, cleanupErr.message);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[TranscriptionQueue] ✓ Completed: ${job.title} (${duration}s)`);

    } catch (error) {
      job.attempts++;
      console.error(`[TranscriptionQueue] Error processing ${job.videoId} (attempt ${job.attempts}/${job.maxAttempts}):`, error.message);

      // Retry if not exceeded max attempts
      if (job.attempts < job.maxAttempts) {
        console.log(`[TranscriptionQueue] Requeuing ${job.videoId} for retry...`);
        this.queue.push(job);
      } else {
        // Mark as failed in database
        await this.updateVideoTranscript(job.channelId, job.videoId, {
          status: 'error',
          error: error.message,
          transcriptSource: 'failed',
          failedAt: new Date()
        });
      }
    }
  }

  /**
   * Update video transcript in Firestore
   */
  async updateVideoTranscript(channelId, videoId, data) {
    const { firestore, useMockMode } = getFirestore();

    if (useMockMode || !firestore) {
      // Mock mode - update in memory
      const { mockChannels } = require('./channelService');
      const channel = mockChannels.get(channelId);
      if (channel && channel.videos && channel.videos.has(videoId)) {
        const video = channel.videos.get(videoId);
        Object.assign(video, data);
      }
    } else {
      // Firestore mode
      await firestore.collection('channels')
        .doc(channelId)
        .collection('videos')
        .doc(videoId)
        .update(data);
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queued: this.queue.length,
      processing: this.activeJobs.size,
      isActive: this.processing
    };
  }
}

// Singleton instance
const transcriptionQueue = new TranscriptionQueue();

module.exports = {
  queueVideoTranscription: (videoData) => transcriptionQueue.queueVideoTranscription(videoData),
  getStatus: () => transcriptionQueue.getStatus(),
  queue: transcriptionQueue
};
