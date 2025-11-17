const { GoogleGenerativeAI } = require('@google/generative-ai');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class VideoAnalysisService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.tempDir = path.join(__dirname, '../temp');
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      // Use gemini-2.5-flash (modern, generally available version with vision support)
      this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      console.log('Video Analysis Service: Gemini Vision API enabled');
    } else {
      console.log('Video Analysis Service: Gemini API key not found, will use mock analysis');
    }
  }

  /**
   * Extract key frames from video for analysis
   * @param {string} videoPath - Path to video file
   * @param {number} numFrames - Number of frames to extract (default: 10)
   * @returns {Promise<Array<{path: string, timestamp: number}>>}
   */
  async extractFrames(videoPath, numFrames = 10) {
    return new Promise((resolve, reject) => {
      // Ensure temp directory exists
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }

      // Get video duration first
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          return reject(err);
        }

        const duration = metadata.format.duration || 10; // Default to 10s if unknown
        const interval = duration / (numFrames + 1); // Space frames evenly
        const frames = [];
        let extracted = 0;
        let errors = 0;

        if (numFrames === 0) {
          return resolve([]);
        }

        // Extract frames at intervals
        for (let i = 1; i <= numFrames; i++) {
          const timestamp = interval * i;
          const framePath = path.join(this.tempDir, `frame-${uuidv4()}.jpg`);
          
          ffmpeg(videoPath)
            .seekInput(timestamp)
            .frames(1)
            .outputOptions('-q:v 2') // High quality JPEG
            .output(framePath)
            .on('end', () => {
              if (fs.existsSync(framePath)) {
                frames.push({ path: framePath, timestamp });
              }
              extracted++;
              if (extracted === numFrames) {
                resolve(frames.sort((a, b) => a.timestamp - b.timestamp));
              }
            })
            .on('error', (err) => {
              console.error(`Error extracting frame at ${timestamp}s:`, err.message);
              errors++;
              extracted++;
              if (extracted === numFrames) {
                // Return what we have, even if some failed
                resolve(frames.sort((a, b) => a.timestamp - b.timestamp));
              }
            })
            .run();
        }
      });
    });
  }

  /**
   * Analyze video frames using Gemini Vision API
   * @param {Array<{path: string, timestamp: number}>} frames - Array of frame paths and timestamps
   * @param {string} userPrompt - User's editing request for context
   * @returns {Promise<Object>} Video analysis with scenes, objects, and temporal information
   */
  async analyzeFrames(frames, userPrompt = '') {
    // Re-check API key in case it was set after constructor
    if (!this.apiKey) {
      this.apiKey = process.env.GEMINI_API_KEY;
      if (this.apiKey && !this.genAI) {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      }
    }

    if (!this.apiKey || !this.visionModel) {
      console.log('Gemini API not configured, using mock video analysis');
      return this.getMockVideoAnalysis();
    }

    try {
      // Convert frames to base64 for Gemini Vision
      const imageParts = [];
      const timestamps = [];

      for (const frame of frames) {
        if (fs.existsSync(frame.path)) {
          const imageData = fs.readFileSync(frame.path);
          const base64Image = imageData.toString('base64');
          
          imageParts.push({
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg',
            },
          });
          timestamps.push(frame.timestamp);
        }
      }

      if (imageParts.length === 0) {
        return this.getMockVideoAnalysis();
      }

      // Create prompt for video analysis
      const analysisPrompt = `Analyze these video frames extracted at different timestamps. 
For each frame, identify:
1. What objects, people, or items are visible
2. What actions or activities are happening
3. The scene composition and key visual elements
4. Any notable moments or highlights

Timestamps: ${timestamps.map((t, i) => `Frame ${i + 1}: ${t.toFixed(1)}s`).join(', ')}

${userPrompt ? `User wants to: ${userPrompt}` : ''}

Provide a structured analysis with:
- Scene descriptions for each timestamp
- Objects/people detected
- Key moments or highlights
- Temporal information (when things happen)

Format as JSON with this structure:
{
  "scenes": [
    {
      "timestamp": 5.2,
      "description": "Person showing makeup product",
      "objects": ["makeup", "person", "hands"],
      "actions": ["showing", "demonstrating"],
      "keyMoment": true
    }
  ],
  "summary": "Overall video content summary",
  "keyMoments": [{"timestamp": 5.2, "description": "Makeup reveal"}]
}`;

      // Retry logic for 503 errors (service overloaded)
      let result;
      let response;
      let text;
      const maxRetries = 3;
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        try {
          result = await this.visionModel.generateContent([
            analysisPrompt,
            ...imageParts,
          ]);
          response = await result.response;
          text = response.text();
          if (text && text.trim()) {
            break; // Success, exit retry loop
          } else {
            throw new Error('Empty response from Gemini Vision');
          }
        } catch (error) {
          // Check if it's a 503 error (service overloaded) or rate limit
          const isRetryable = (error.message && (
            error.message.includes('503') || 
            error.message.includes('429') ||
            error.message.includes('overloaded') ||
            error.message.includes('rate limit')
          ));
          
          if (isRetryable && retryCount < maxRetries - 1) {
            retryCount++;
            // More conservative exponential backoff with jitter: 3-4s, 6-7s, 12-13s
            const baseDelay = Math.pow(2, retryCount) * 1500;
            const jitter = Math.random() * 1000; // 0-1s random jitter to avoid thundering herd
            const waitTime = baseDelay + jitter;
            console.log(`Gemini Vision API overloaded (${error.message.includes('503') ? '503' : 'rate limit'}). Retrying in ${Math.floor(waitTime/1000)}s... (attempt ${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          // If not retryable or max retries reached, throw the error
          throw error;
        }
      }

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        // Clean up frame files
        frames.forEach(frame => {
          try {
            if (fs.existsSync(frame.path)) {
              fs.unlinkSync(frame.path);
            }
          } catch (err) {
            console.warn('Error cleaning up frame:', err);
          }
        });

        return analysis;
      }

      // Fallback: return structured data from text
      return {
        summary: text,
        scenes: timestamps.map((t, i) => ({
          timestamp: t,
          description: `Frame at ${t.toFixed(1)}s`,
        })),
        keyMoments: [],
      };
    } catch (error) {
      console.error('Video analysis error:', error);
      
      // Clean up frame files on error
      frames.forEach(frame => {
        try {
          if (fs.existsSync(frame.path)) {
            fs.unlinkSync(frame.path);
          }
        } catch (err) {
          // Ignore cleanup errors
        }
      });

      return this.getMockVideoAnalysis();
    }
  }

  /**
   * Calculate optimal number of frames based on video duration
   * @param {number} duration - Video duration in seconds
   * @returns {number} - Number of frames to extract
   */
  calculateOptimalFrames(duration) {
    // Optimized for Q&A - we only need a few representative frames
    // Visual analysis is secondary to transcript for Q&A purposes
    if (duration <= 600) { // <= 10 minutes
      return 3; // Reduced from 10 - faster processing
    } else if (duration <= 1800) { // <= 30 minutes
      return 5; // Reduced from 30 - significant speed improvement
    } else if (duration <= 3600) { // <= 60 minutes
      return 7; // Reduced from 60
    } else { // > 60 minutes
      return 10; // Reduced from 180 - max 10 frames regardless of length
    }
  }

  /**
   * Analyze video and provide context for editing commands
   * @param {string} videoPath - Path to video file
   * @param {string} userPrompt - User's editing request
   * @returns {Promise<Object>} Video analysis with temporal information
   */
  async analyzeVideo(videoPath, userPrompt = '') {
    return new Promise((resolve, reject) => {
      // First, get video duration to determine optimal frame count
      ffmpeg.ffprobe(videoPath, async (err, metadata) => {
        if (err) {
          console.error('Error getting video metadata:', err);
          return reject(err);
        }

        const duration = metadata.format.duration || 10;
        const optimalFrames = this.calculateOptimalFrames(duration);

        console.log(`Video duration: ${Math.floor(duration)}s (${Math.floor(duration / 60)}min)`);
        console.log(`Extracting ${optimalFrames} frames for analysis...`);

        try {
          const frames = await this.extractFrames(videoPath, optimalFrames);

          console.log(`Analyzing ${frames.length} frames with Gemini Vision...`);
          const analysis = await this.analyzeFrames(frames, userPrompt);

          // Add duration to analysis
          analysis.duration = duration;

          console.log('Video analysis complete:', {
            duration: `${Math.floor(duration / 60)}min ${Math.floor(duration % 60)}s`,
            scenes: analysis.scenes?.length || 0,
            keyMoments: analysis.keyMoments?.length || 0,
          });

          resolve(analysis);
        } catch (error) {
          console.error('Video analysis failed:', error);
          resolve(this.getMockVideoAnalysis());
        }
      });
    });
  }

  /**
   * Find timestamps where specific content appears
   * @param {Object} analysis - Video analysis result
   * @param {string} searchTerm - What to search for (e.g., "makeup", "person showing")
   * @returns {Array<{timestamp: number, description: string}>}
   */
  findContentTimestamps(analysis, searchTerm) {
    const lowerSearch = searchTerm.toLowerCase();
    const matches = [];

    if (analysis.scenes) {
      analysis.scenes.forEach(scene => {
        const sceneText = `${scene.description} ${scene.objects?.join(' ') || ''} ${scene.actions?.join(' ') || ''}`.toLowerCase();
        if (sceneText.includes(lowerSearch)) {
          matches.push({
            timestamp: scene.timestamp,
            description: scene.description,
            confidence: scene.keyMoment ? 0.9 : 0.7,
          });
        }
      });
    }

    // Also check key moments
    if (analysis.keyMoments) {
      analysis.keyMoments.forEach(moment => {
        const momentText = moment.description.toLowerCase();
        if (momentText.includes(lowerSearch)) {
          matches.push({
            timestamp: moment.timestamp,
            description: moment.description,
            confidence: 0.95,
          });
        }
      });
    }

    return matches.sort((a, b) => a.timestamp - b.timestamp);
  }

  getMockVideoAnalysis() {
    return {
      summary: 'Mock video analysis - configure Gemini API for real analysis',
      scenes: [
        { timestamp: 2.0, description: 'Scene 1', objects: [], actions: [] },
        { timestamp: 5.0, description: 'Scene 2', objects: [], actions: [] },
      ],
      keyMoments: [],
    };
  }
}

videoAnalysisServiceInstance = new VideoAnalysisService();
module.exports = videoAnalysisServiceInstance;

