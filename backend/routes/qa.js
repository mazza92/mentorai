const express = require('express');
const videoQAService = require('../services/videoQAService');
const videoAnalysisService = require('../services/videoAnalysisService');
const userMemoryService = require('../services/userMemoryService');
const userService = require('../services/userService');
const path = require('path');
const fs = require('fs');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');

const router = express.Router();

// Initialize Google Cloud services with error handling
let firestore;
let gcsStorage;
let bucket;
let useMockMode = false;

try {
  if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id') {
    const firestoreConfig = {

      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,

    };


    // Handle credentials from Railway environment variable

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {

      try {

        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

        firestoreConfig.credentials = credentials;

      } catch (error) {

        console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON');

        throw error;

      }

    }


    firestore = new Firestore(firestoreConfig);
    gcsStorage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    if (process.env.GOOGLE_CLOUD_STORAGE_BUCKET && process.env.GOOGLE_CLOUD_STORAGE_BUCKET !== 'your_bucket_name') {
      bucket = gcsStorage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET);
    } else {
      useMockMode = true;
    }
  } else {
    useMockMode = true;
  }
} catch (error) {
  useMockMode = true;
  console.log('Google Cloud not configured, using local file storage for development');
}

// Use shared mock storage
const { mockProjects } = require('../utils/mockStorage');

/**
 * POST /api/qa
 * Answer a question about a video project
 */
router.post('/', async (req, res) => {
  try {
    const { projectId, question, userId, chatHistory, language } = req.body;

    if (!projectId || !question) {
      return res.status(400).json({ error: 'Project ID and question are required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('Q&A request for project:', projectId);
    console.log('Question:', question);
    console.log('Chat history length:', chatHistory ? chatHistory.length : 0);

    // Check question quota before processing
    try {
      const { canAsk, limit, remaining, questionsThisMonth, tier, requiresSignup } = await userService.checkQuestionQuota(userId);

      if (!canAsk) {
        return res.status(403).json({
          error: 'Question limit reached',
          message: requiresSignup
            ? `You've used your ${limit} free question${limit > 1 ? 's' : ''}. Sign up to get ${tier === 'anonymous' ? '15' : 'more'} questions per month!`
            : `You've reached your monthly question limit. You've asked ${questionsThisMonth}/${limit} questions this month.`,
          tier,
          questionsThisMonth,
          limit,
          requiresSignup, // Trigger signup wall for anonymous users
          upgradeRequired: !requiresSignup
        });
      }

      console.log(`User ${userId} (${tier}) has ${remaining} questions remaining this month`);
    } catch (quotaError) {
      console.error('Error checking question quota:', quotaError.message);
      // Continue even if quota check fails (graceful degradation)
    }

    // Track question in user memory for personalization
    const isFollowUp = chatHistory && chatHistory.length > 0;
    userMemoryService.trackQuestion(userId, projectId, question, isFollowUp);

    // Build personalized context based on user learning style and interests
    const personalizedContext = userMemoryService.buildPersonalizedContext(userId);
    console.log('Personalized context generated for user:', userId);

    let project;

    // Get project from mock storage or Firestore
    if (useMockMode || !firestore) {
      project = mockProjects.get(projectId);
      if (!project) {
        console.error('Project not found in mock storage. Available IDs:', Array.from(mockProjects.keys()));
        return res.status(404).json({
          error: 'Project not found',
          debug: {
            requestedId: projectId,
            availableIds: Array.from(mockProjects.keys())
          }
        });
      }
      console.log('Found project:', project.projectId);
    } else {
      // Get from Firestore
      const projectDoc = await firestore.collection('projects').doc(projectId).get();
      if (!projectDoc.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }
      project = { id: projectId, ...projectDoc.data() };
    }

    // IMPORTANT: Channel projects need different Q&A handling
    // They search across multiple videos, not a single video
    if (project.type === 'channel') {
      console.log('Detected channel project, using multi-video Q&A');

      try {
        const channelId = project.channelId;
        const qaResult = await videoQAService.answerQuestionForChannel(
          channelId,
          question,
          chatHistory || []
        );

        // Increment question count
        await userService.incrementQuestionCount(userId);
        console.log(`Question count incremented for user ${userId}`);

        // Get remaining questions
        const remainingInfo = await userService.getRemainingQuestions(userId);

        return res.json({
          success: true,
          answer: qaResult.answer,
          answerHtml: qaResult.answerHtml,
          citations: qaResult.sources || [], // Channel Q&A returns 'sources' not 'citations'
          videosAnalyzed: qaResult.videosAnalyzed,
          projectId: projectId,
          questionsRemaining: remainingInfo.remaining
        });
      } catch (channelQAError) {
        console.error('Channel Q&A error:', channelQAError);
        return res.status(500).json({
          error: 'Failed to answer channel question',
          details: process.env.NODE_ENV === 'development' ? channelQAError.message : undefined
        });
      }
    }

    // Get video analysis (or analyze if not available)
    let videoAnalysis = project.videoAnalysis;

    if (!videoAnalysis) {
      // Analyze video if analysis not available
      try {
        // Support both YouTube downloads (localVideoPath) and direct uploads (filePath/fileName)
        let inputPath;

        if (project.processedPath && fs.existsSync(project.processedPath)) {
          inputPath = project.processedPath;
        } else if (project.localVideoPath && fs.existsSync(project.localVideoPath)) {
          inputPath = project.localVideoPath; // YouTube download
        } else if (project.filePath && fs.existsSync(project.filePath)) {
          inputPath = project.filePath; // Direct upload
        } else if (project.fileName) {
          inputPath = path.join(__dirname, '../uploads', project.fileName); // Fallback
        }

        if (inputPath && fs.existsSync(inputPath)) {
          console.log('Analyzing video for Q&A...', inputPath);
          videoAnalysis = await videoAnalysisService.analyzeVideo(inputPath, 'Analyze this video for Q&A purposes');

          // Save analysis to project
          project.videoAnalysis = videoAnalysis;
          if (useMockMode || !firestore) {
            mockProjects.set(projectId, project);
          } else {
            await firestore.collection('projects').doc(projectId).update({ videoAnalysis });
          }
        } else {
          console.warn('Video file not found for analysis');
        }
      } catch (analysisError) {
        console.warn('Video analysis failed, continuing without analysis:', analysisError);
      }
    }

    // Get transcript (or use mock if missing - transcription requires async processing)
    let transcript = project.transcript || null;
    
    if (!transcript) {
      console.warn('No transcript available for Q&A. For best results, transcribe the video first via /api/transcribe');
      console.warn('Q&A will use visual analysis only, which may not answer knowledge-based questions well.');
      
      // In mock mode, provide a basic mock transcript
      if (useMockMode || !firestore) {
        transcript = {
          text: 'No transcript available. Please transcribe the video for knowledge-based Q&A.',
          words: []
        };
      }
    }

    // Log what we have for debugging
    console.log('Q&A Context Available:');
    console.log('- Transcript:', transcript ? (transcript.words ? `${transcript.words.length} words` : 'text only') : 'MISSING');
    console.log('- Video Analysis:', videoAnalysis ? 'Available' : 'MISSING');
    console.log('- Personalized Context:', personalizedContext ? 'Available' : 'None');

    // Answer the question with chat history for follow-up context and personalized learning
    const qaResult = await videoQAService.answerQuestion(
      question,
      videoAnalysis,
      transcript,
      chatHistory,
      personalizedContext, // NEW: Add personalized context
      language // NEW: Add language preference
    );

    console.log('Q&A response generated');
    console.log('Citations:', qaResult.citations);

    // Store conversation in project if chat history management is enabled
    if (chatHistory) {
      if (!project.conversations) {
        project.conversations = [];
      }
      project.conversations.push({
        question,
        answer: qaResult.answer,
        citations: qaResult.citations,
        timestamp: new Date().toISOString()
      });

      // Save updated project
      if (useMockMode || !firestore) {
        mockProjects.set(projectId, project);
      } else {
        await firestore.collection('projects').doc(projectId).update({
          conversations: project.conversations,
          updatedAt: new Date()
        });
      }
    }

    // Increment question count on successful response
    let questionsRemaining = null;

    try {
      await userService.incrementQuestionCount(userId);
      console.log(`Question count incremented for user ${userId}`);
    } catch (error) {
      console.error('Error incrementing question count:', error.message);
    }

    // Get remaining questions for response
    try {
      const remainingInfo = await userService.getRemainingQuestions(userId);
      questionsRemaining = remainingInfo.remaining;
    } catch (error) {
      console.error('Error fetching remaining questions:', error.message);
    }

    res.json({
      success: true,
      answer: qaResult.answer, // Markdown format
      answerHtml: qaResult.answerHtml, // HTML format (if available)
      citations: qaResult.citations,
      visualContext: qaResult.visualContext, // New: visual context for citations
      insights: qaResult.insights, // New: actionable insights score
      projectId: projectId,
      questionsRemaining: questionsRemaining
    });

  } catch (error) {
    console.error('Q&A error:', error);
    res.status(500).json({
      error: 'Failed to answer question',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/qa/suggested-prompts/:projectId
 * Get or generate smart suggested prompts for a project
 */
router.get('/suggested-prompts/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    console.log('Getting suggested prompts for project:', projectId);

    let project;

    // Get project from mock storage or Firestore
    if (useMockMode || !firestore) {
      project = mockProjects.get(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    } else {
      const projectDoc = await firestore.collection('projects').doc(projectId).get();
      if (!projectDoc.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }
      project = { id: projectId, ...projectDoc.data() };
    }

    // Return cached prompts if available
    if (project.suggestedPrompts && Array.isArray(project.suggestedPrompts) && project.suggestedPrompts.length > 0) {
      console.log('Returning cached suggested prompts');
      return res.json({
        success: true,
        prompts: project.suggestedPrompts,
        cached: true
      });
    }

    // Generate new prompts
    const videoAnalysis = project.videoAnalysis;
    const transcript = project.transcript;

    if (!videoAnalysis && !transcript) {
      return res.json({
        success: true,
        prompts: [
          "What are the key points covered?",
          "How do I get started?",
          "What are the main takeaways?"
        ],
        message: 'Using default prompts - transcript and analysis not available yet'
      });
    }

    console.log('Generating new suggested prompts...');
    const suggestedPrompts = await videoQAService.generateSuggestedPrompts(videoAnalysis, transcript);

    // Cache the prompts in the project
    project.suggestedPrompts = suggestedPrompts;
    if (useMockMode || !firestore) {
      mockProjects.set(projectId, project);
    } else {
      await firestore.collection('projects').doc(projectId).update({
        suggestedPrompts,
        updatedAt: new Date()
      });
    }

    console.log('Generated', suggestedPrompts.length, 'suggested prompts');

    res.json({
      success: true,
      prompts: suggestedPrompts,
      cached: false
    });

  } catch (error) {
    console.error('Suggested prompts error:', error);
    res.status(500).json({
      error: 'Failed to generate suggested prompts',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

