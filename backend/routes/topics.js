const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { mockProjects } = require('../utils/mockStorage');

const router = express.Router();

// Initialize Gemini
let geminiAI;
if (process.env.GEMINI_API_KEY) {
  geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

/**
 * Generate Table of Contents for a video
 * POST /api/toc
 */
router.post('/', async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    console.log('Generating Table of Contents for project:', projectId);

    // Get project
    const project = mockProjects.get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if video is long enough for TOC (>10 minutes)
    const videoDuration = project.duration || 0;
    if (videoDuration < 600) { // 10 minutes
      return res.json({
        success: true,
        toc: null,
        message: 'Video is shorter than 10 minutes. Table of contents not necessary.'
      });
    }

    // Get transcript and video analysis
    const transcript = project.transcript;
    const videoAnalysis = project.videoAnalysis;

    if (!transcript || !transcript.text) {
      return res.status(400).json({ error: 'Transcript not available. Please transcribe the video first.' });
    }

    // Use Gemini to generate structured table of contents
    if (!geminiAI) {
      return res.status(500).json({ error: 'Gemini API not configured' });
    }

    const model = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Build context - optimized to reduce API load
    let context = 'VIDEO TRANSCRIPT (optimized for TOC generation):\n';
    if (transcript.words && transcript.words.length > 0) {
      // Group into timestamped sections - sample every 100 words instead of 50 to reduce size
      let currentSection = '';
      let sectionStartTime = 0;
      let sectionCount = 0;
      const maxSections = 30; // Limit to ~30 sections for efficiency

      transcript.words.forEach((word, index) => {
        if (index % 100 === 0 && index > 0 && sectionCount < maxSections) { // Every 100 words
          const minutes = Math.floor(word.startTime / 60);
          const seconds = Math.floor(word.startTime % 60);
          context += `\n[${minutes}:${seconds.toString().padStart(2, '0')}] ${currentSection.substring(0, 200)}...\n`; // Limit section length
          currentSection = '';
          sectionStartTime = word.startTime;
          sectionCount++;
        }
        currentSection += ' ' + word.word;
      });

      if (currentSection.trim() && sectionCount < maxSections) {
        const minutes = Math.floor(sectionStartTime / 60);
        const seconds = Math.floor(sectionStartTime % 60);
        context += `\n[${minutes}:${seconds.toString().padStart(2, '0')}] ${currentSection.substring(0, 200)}...\n`;
      }
    } else {
      // Fallback to plain text, but limit size
      context += transcript.text.substring(0, 5000) + '...\n';
    }

    // Add video analysis if available
    if (videoAnalysis && videoAnalysis.keyMoments) {
      context += '\n\nKEY MOMENTS:\n';
      videoAnalysis.keyMoments.forEach(moment => {
        const minutes = Math.floor(moment.timestamp / 60);
        const seconds = Math.floor(moment.timestamp % 60);
        context += `[${minutes}:${seconds.toString().padStart(2, '0')}] ${moment.description}\n`;
      });
    }

    const prompt = `You are an expert at analyzing long-form video content and creating structured tables of contents.

TASK: Analyze this video transcript and create a comprehensive table of contents that helps viewers quickly navigate to specific topics.

REQUIREMENTS:
1. Identify 5-15 major topics/sections in the video
2. For each topic, provide:
   - A clear, descriptive title (3-8 words)
   - The start timestamp [MM:SS]
   - A brief 1-sentence description of what's covered
3. Topics should be ordered chronologically
4. Focus on substantive topic changes, not minor tangents
5. Use the timestamps from the transcript

OUTPUT FORMAT (JSON):
{
  "chapters": [
    {
      "title": "Introduction & Problem Definition",
      "startTime": "0:00",
      "startTimeSeconds": 0,
      "description": "Overview of the main challenges and what the video will cover"
    },
    {
      "title": "Core Strategy 1: Budget Optimization",
      "startTime": "3:45",
      "startTimeSeconds": 225,
      "description": "How to allocate your budget effectively across campaigns"
    }
  ]
}

VIDEO TRANSCRIPT:
${context}

Generate the table of contents as JSON:`;

    console.log('Generating TOC with Gemini...');
    
    // Retry logic for 503 errors (service overloaded)
    let result;
    let response;
    let tocText;
    const maxRetries = 3;
    let retryCount = 0;
    let lastError;
    
    while (retryCount < maxRetries) {
      try {
        result = await model.generateContent(prompt);
        response = await result.response;
        tocText = response.text();
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        // Check if it's a 503 error (service overloaded)
        if (error.message && error.message.includes('503') && retryCount < maxRetries - 1) {
          retryCount++;
          // More conservative exponential backoff with jitter: 3-4s, 6-7s, 12-13s
          const baseDelay = Math.pow(2, retryCount) * 1500;
          const jitter = Math.random() * 1000; // 0-1s random jitter to avoid thundering herd
          const waitTime = baseDelay + jitter;
          console.log(`Gemini API overloaded (503) for TOC generation. Retrying in ${Math.floor(waitTime/1000)}s... (attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        // If not 503 or max retries reached, throw the error
        throw error;
      }
    }

    // Extract JSON from response
    const jsonMatch = tocText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse TOC response');
    }

    const tocData = JSON.parse(jsonMatch[0]);

    console.log('TOC generated with', tocData.chapters.length, 'chapters');

    // Save TOC to project
    project.tableOfContents = tocData;
    project.updatedAt = new Date();
    mockProjects.set(projectId, project);

    res.json({
      success: true,
      toc: tocData,
      message: `Generated table of contents with ${tocData.chapters.length} chapters`
    });

  } catch (error) {
    console.error('TOC generation error:', error);
    
    // Check if it's a 503 error (service overloaded) after all retries
    if (error.message && error.message.includes('503')) {
      return res.status(503).json({
        success: false,
        error: 'Service Temporarily Unavailable',
        message: 'The AI service is currently overloaded. Please try again in a few moments.',
        details: 'The table of contents generation failed due to high demand. Please retry the request.'
      });
    }
    
    // For other errors, return a generic error message
    res.status(500).json({
      success: false,
      error: 'Failed to generate table of contents',
      details: error.message
    });
  }
});

/**
 * GET /api/toc/:projectId
 * Get existing table of contents for a project
 */
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = mockProjects.get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.tableOfContents) {
      return res.json({
        success: true,
        toc: null,
        message: 'Table of contents not generated yet'
      });
    }

    res.json({
      success: true,
      toc: project.tableOfContents
    });

  } catch (error) {
    console.error('TOC retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve table of contents',
      details: error.message
    });
  }
});

module.exports = router;
