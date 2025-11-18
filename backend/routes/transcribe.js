const express = require('express');
const { SpeechClient } = require('@google-cloud/speech');
const { Firestore } = require('@google-cloud/firestore');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { mockProjects } = require('../utils/mockStorage');
const videoQAService = require('../services/videoQAService');

// Polyfill for Node < 20 to support OpenAI file uploads
if (typeof globalThis.File === 'undefined') {
  const { File } = require('node:buffer');
  globalThis.File = File;
}

const router = express.Router();

// Initialize transcription services with error handling
let speechClient;
let firestore;
let openai;
let geminiAI;
let useMockMode = false;
let useOpenAI = false;
let useGemini = false;

// Check environment configuration flags (USE_OPENAI_WHISPER, USE_GEMINI)
const useOpenAIFlag = process.env.USE_OPENAI_WHISPER !== 'false'; // Default to true if not set
// Enable Gemini transcription by default if GEMINI_API_KEY is available (since it's used for Q&A anyway)
const useGeminiFlag = process.env.USE_GEMINI !== 'false'; // Default to true if GEMINI_API_KEY exists

// Initialize Gemini if API key is available
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
  try {
    geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    if (useGeminiFlag) {
      useGemini = true;
      console.log('✅ Gemini API enabled for transcription');
    } else {
      console.log('ℹ️  Gemini API key found but transcription disabled (set USE_GEMINI=false to disable)');
    }
  } catch (error) {
    console.error('❌ Gemini initialization failed:', error.message);
  }
}

try {
  if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id') {
    speechClient = new SpeechClient({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    firestore = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    console.log('✅ Google Cloud Speech-to-Text enabled for transcription');
  } else if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' && useOpenAIFlag) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    useOpenAI = true;
    console.log('✅ OpenAI Whisper enabled for transcription');
  } else if (useGemini && geminiAI) {
    console.log('✅ Using Gemini-only mode for transcription');
  } else {
    useMockMode = true;
    console.log('⚠️  No transcription service configured, using mock transcription for development');
    console.log('⚠️  To enable transcription, set one of: OPENAI_API_KEY, GEMINI_API_KEY, or GOOGLE_CLOUD_PROJECT_ID');
  }
} catch (error) {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' && useOpenAIFlag) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    useOpenAI = true;
    console.log('⚠️  Google Cloud initialization failed, using OpenAI Whisper for transcription');
  } else if (useGemini && geminiAI) {
    console.log('⚠️  Google Cloud initialization failed, using Gemini for transcription');
  } else {
    useMockMode = true;
    console.log('⚠️  Google Cloud initialization failed, using mock transcription for development');
    console.log('⚠️  To enable transcription, set one of: OPENAI_API_KEY, GEMINI_API_KEY, or GOOGLE_CLOUD_PROJECT_ID');
  }
}

// Helper function to transcribe with Gemini
async function transcribeWithGemini(audioFilePath) {
  console.log('Using Gemini for audio transcription...');

  // Read audio file
  const audioData = fs.readFileSync(audioFilePath);
  const audioBase64 = audioData.toString('base64');

  // Get file extension and set MIME type
  const ext = path.extname(audioFilePath).toLowerCase();
  const mimeTypes = {
    '.mp3': 'audio/mp3',
    '.wav': 'audio/wav',
    '.m4a': 'audio/m4a',
    '.aac': 'audio/aac',
  };
  const mimeType = mimeTypes[ext] || 'audio/mp3';

  // Use Gemini 2.5 Flash (same as rest of codebase - videoQAService, topics, etc.)
  const model = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Retry logic for Gemini transcription (VERY long delays due to infrastructure overload)
  const maxRetries = 6; // Increased to 6 attempts
  let retryCount = 0;
  let lastError;

  while (retryCount < maxRetries) {
    try {
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: audioBase64,
          },
        },
        {
          text: 'Please transcribe this audio file. Provide the complete transcription with as much detail as possible. Include all spoken words accurately.',
        },
      ]);

      const response = await result.response;
      const transcriptionText = response.text();

      // Success! Break out of retry loop
      console.log('Gemini transcription complete');
      console.log('Transcript length:', transcriptionText.length, 'characters');

      // Note: Gemini doesn't provide word-level timestamps
      // We'll create estimated timestamps based on word count
      const words = transcriptionText.split(/\s+/).filter(w => w.length > 0);
      const transcript = {
        text: transcriptionText,
        words: words.map((word, index) => ({
          word: word,
          startTime: index * 0.5, // Estimate ~0.5 seconds per word
          endTime: (index + 1) * 0.5,
          confidence: 0.85,
        })),
        segments: [],
      };

      return transcript;
    } catch (error) {
      lastError = error;

      // Check if we should retry (503 Service Unavailable or rate limit errors)
      const shouldRetry = (
        error.message?.includes('503') ||
        error.message?.includes('overloaded') ||
        error.message?.includes('rate limit') ||
        error.message?.includes('429')
      );

      if (shouldRetry && retryCount < maxRetries - 1) {
        retryCount++;
        // MUCH longer delays for audio transcription to avoid infrastructure overload
        // Delays: 15s, 30s, 60s, 120s, 240s (up to 4 minutes)
        const baseDelay = Math.pow(2, retryCount) * 7500;
        const jitter = Math.random() * 5000;
        const waitTime = baseDelay + jitter;

        console.log(`Gemini transcription failed (${error.message.includes('503') ? '503 overloaded' : 'rate limit'}). Retrying in ${Math.floor(waitTime/1000)}s... (attempt ${retryCount}/${maxRetries})`);
        console.log(`⏳ This is a Gemini infrastructure issue, not your quota. Waiting for API to recover...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // Max retries reached or non-retryable error
      throw error;
    }
  }

  // If we get here, all retries failed
  throw lastError;
}

// Helper function to generate suggested prompts asynchronously
async function generateSuggestedPromptsAsync(projectId, project, useFirestore = false) {
  try {
    // Add 5-second delay to stagger Gemini API calls and give priority to TOC generation
    // This prevents overwhelming the API with simultaneous requests
    console.log('Scheduling suggested prompts generation (5s delay to avoid API overload)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Generating suggested prompts for project:', projectId);

    // Skip if prompts already exist
    if (project.suggestedPrompts && project.suggestedPrompts.length > 0) {
      console.log('Suggested prompts already exist, skipping generation');
      return;
    }

    const videoAnalysis = project.videoAnalysis;
    const transcript = project.transcript;

    if (!videoAnalysis && !transcript) {
      console.log('No video analysis or transcript available yet, skipping prompt generation');
      return;
    }

    const suggestedPrompts = await videoQAService.generateSuggestedPrompts(videoAnalysis, transcript);

    // Update project with suggested prompts
    if (useFirestore && firestore) {
      await firestore.collection('projects').doc(projectId).update({
        suggestedPrompts,
        updatedAt: new Date()
      });
    } else {
      project.suggestedPrompts = suggestedPrompts;
      project.updatedAt = new Date();
      mockProjects.set(projectId, project);
    }

    console.log('Successfully generated', suggestedPrompts.length, 'suggested prompts');
  } catch (error) {
    console.error('Error generating suggested prompts:', error.message);
    // Don't throw - this is a background operation
  }
}

router.post('/', async (req, res) => {
  try {
    const { projectId, audioUrl } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    let project;

    // Try OpenAI Whisper first if configured
    if (useOpenAI && openai) {
      // Get project from mock storage
      project = mockProjects.get(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Use local audio file
      if (!project.localAudioPath || !fs.existsSync(project.localAudioPath)) {
        return res.status(400).json({ error: 'No audio file found for transcription' });
      }

      console.log('Starting OpenAI Whisper transcription for project:', projectId);
      console.log('Audio file:', project.localAudioPath);

      try {
        // Transcribe with OpenAI Whisper (using verbose_json for timestamps)
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(project.localAudioPath),
          model: 'whisper-1',
          response_format: 'verbose_json',
          timestamp_granularities: ['word', 'segment'],
        });

        console.log('OpenAI Whisper transcription complete');
        console.log('Transcript length:', transcription.text.length, 'characters');

        // Format transcript with word-level timestamps
        const transcript = {
          text: transcription.text,
          words: [],
          segments: transcription.segments || [],
        };

        // Add word-level timestamps if available
        if (transcription.words && Array.isArray(transcription.words)) {
          transcript.words = transcription.words.map(wordInfo => ({
            word: wordInfo.word,
            startTime: wordInfo.start,
            endTime: wordInfo.end,
            confidence: 0.95, // Whisper doesn't provide confidence, using high default
          }));
          console.log('Word count:', transcript.words.length);
        }

        // Update project in mock storage
        project.transcript = transcript;
        project.transcriptionStatus = 'completed';
        project.updatedAt = new Date();
        mockProjects.set(projectId, project);

        // Generate suggested prompts in background (don't block response)
        generateSuggestedPromptsAsync(projectId, project).catch(err => {
          console.error('Failed to generate suggested prompts:', err);
        });

        return res.json({
          success: true,
          transcript,
          message: 'Transcription completed with OpenAI Whisper',
        });
      } catch (whisperError) {
        console.error('OpenAI Whisper error:', whisperError.message);

        // Try Gemini fallback if available
        if (useGemini && geminiAI && (whisperError.status === 429 || whisperError.code === 'insufficient_quota')) {
          console.log('OpenAI quota exceeded, falling back to Gemini transcription...');
          console.log('Waiting 5 seconds before starting Gemini transcription to avoid API overload...');

          // Wait 5 seconds to give API time to recover and avoid overwhelming it
          await new Promise(resolve => setTimeout(resolve, 5000));

          try {
            const transcript = await transcribeWithGemini(project.localAudioPath);

            // Update project in mock storage
            project.transcript = transcript;
            project.transcriptionStatus = 'completed';
            project.updatedAt = new Date();
            mockProjects.set(projectId, project);

            // Generate suggested prompts in background (don't block response)
            generateSuggestedPromptsAsync(projectId, project).catch(err => {
              console.error('Failed to generate suggested prompts:', err);
            });

            return res.json({
              success: true,
              transcript,
              message: 'Transcription completed with Gemini (OpenAI quota exceeded)',
            });
          } catch (geminiError) {
            console.error('Gemini fallback also failed:', geminiError.message);
            throw whisperError; // Throw original error
          }
        }

        throw whisperError;
      }
    }

    // Use Gemini if configured (either as primary or fallback)
    if (useGemini && geminiAI) {
      // Get project from mock storage
      project = mockProjects.get(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Use local audio file
      if (!project.localAudioPath || !fs.existsSync(project.localAudioPath)) {
        return res.status(400).json({ error: 'No audio file found for transcription' });
      }

      console.log('Starting Gemini transcription for project:', projectId);

      try {
        const transcript = await transcribeWithGemini(project.localAudioPath);

        // Update project in mock storage
        project.transcript = transcript;
        project.transcriptionStatus = 'completed';
        project.updatedAt = new Date();
        mockProjects.set(projectId, project);

        // Generate suggested prompts in background (don't block response)
        generateSuggestedPromptsAsync(projectId, project).catch(err => {
          console.error('Failed to generate suggested prompts:', err);
        });

        return res.json({
          success: true,
          transcript,
          message: 'Transcription completed with Gemini',
        });
      } catch (geminiError) {
        console.error('Gemini transcription error:', geminiError);
        throw geminiError;
      }
    }

    // Use mock mode if Google Cloud is not configured
    if (useMockMode || !firestore) {
      // Get project from mock storage
      project = mockProjects.get(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Return mock transcript with realistic content for testing
      const mockTranscript = {
        text: 'This is a sample transcript for development purposes. The actual transcription will work with proper Google Cloud credentials. In this mock video, we discuss Facebook Ads optimization strategies for clothing brands. First, you need to understand your target audience. Second, create compelling ad creatives that showcase your products. Third, use lookalike audiences to expand your reach. Fourth, optimize your landing pages for conversions. Fifth, track your metrics and adjust your campaigns accordingly.',
        words: [
          { word: 'This', startTime: 0.0, endTime: 0.5, confidence: 0.9 },
          { word: 'is', startTime: 0.5, endTime: 0.8, confidence: 0.9 },
          { word: 'a', startTime: 0.8, endTime: 1.0, confidence: 0.9 },
          { word: 'sample', startTime: 1.0, endTime: 1.5, confidence: 0.9 },
          { word: 'transcript', startTime: 1.5, endTime: 2.5, confidence: 0.9 },
          { word: 'for', startTime: 2.5, endTime: 2.8, confidence: 0.9 },
          { word: 'development', startTime: 2.8, endTime: 3.5, confidence: 0.9 },
        ],
      };

      // Update project in mock storage
      project.transcript = mockTranscript;
      project.transcriptionStatus = 'completed';
      project.updatedAt = new Date();
      mockProjects.set(projectId, project);

      // Generate suggested prompts in background (don't block response)
      generateSuggestedPromptsAsync(projectId, project).catch(err => {
        console.error('Failed to generate suggested prompts:', err);
      });

      return res.json({
        success: true,
        transcript: mockTranscript,
        message: 'Mock transcription (configure Google Cloud or OpenAI credentials for real transcription)',
      });
    }

    // Get project from Firestore
    const projectDoc = await firestore.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project = projectDoc.data();

    // Use local audio file if available (from YouTube download)
    let audioSource;
    if (project.localAudioPath && fs.existsSync(project.localAudioPath)) {
      // Read local audio file
      const audioBytes = fs.readFileSync(project.localAudioPath);
      audioSource = {
        content: audioBytes.toString('base64'),
      };
      console.log('Using local audio file for transcription:', project.localAudioPath);
    } else if (project.publicUrl || audioUrl) {
      // Use remote URL
      audioSource = {
        uri: project.publicUrl || audioUrl,
      };
      console.log('Using remote audio URL for transcription');
    } else {
      return res.status(400).json({ error: 'No audio source found for transcription' });
    }

    // Configure speech-to-text
    const config = {
      encoding: 'MP3',
      sampleRateHertz: 44100,
      languageCode: 'en-US',
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
      model: 'video', // Use video model for better accuracy with long-form content
    };

    const request = {
      config: config,
      audio: audioSource,
    };

    console.log('Starting transcription for project:', projectId);

    // Start transcription
    const [operation] = await speechClient.longRunningRecognize(request);
    const [response] = await operation.promise();

    // Format transcript with timestamps
    const transcript = {
      text: '',
      words: [],
    };

    response.results.forEach((result) => {
      const alternative = result.alternatives[0];
      transcript.text += alternative.transcript + ' ';

      if (alternative.words) {
        alternative.words.forEach((wordInfo) => {
          transcript.words.push({
            word: wordInfo.word,
            startTime: parseFloat(wordInfo.startTime.seconds) + wordInfo.startTime.nanos / 1e9,
            endTime: parseFloat(wordInfo.endTime.seconds) + wordInfo.endTime.nanos / 1e9,
            confidence: wordInfo.confidence,
          });
        });
      }
    });

    console.log('Transcription complete. Word count:', transcript.words.length);

    // Save transcript to Firestore
    await firestore.collection('projects').doc(projectId).update({
      transcript,
      transcriptionStatus: 'completed',
      updatedAt: new Date(),
    });

    // Generate suggested prompts in background (fetch updated project first)
    firestore.collection('projects').doc(projectId).get().then(doc => {
      if (doc.exists) {
        const updatedProject = { id: projectId, ...doc.data() };
        generateSuggestedPromptsAsync(projectId, updatedProject, true).catch(err => {
          console.error('Failed to generate suggested prompts:', err);
        });
      }
    }).catch(err => {
      console.error('Failed to fetch project for prompt generation:', err);
    });

    res.json({
      success: true,
      transcript,
      message: 'Transcription completed',
    });
  } catch (error) {
    console.error('Transcription error:', error);
    
    // Fallback to mock transcript if API fails
    if (error.code === 'ENOTFOUND' || error.message.includes('credentials') || error.message.includes('Could not load the default credentials')) {
      console.log('Using mock transcript for development');
      const { projectId } = req.body;
      
      // Try to get project from mock storage
      const project = mockProjects.get(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const mockTranscript = {
        text: 'This is a sample transcript for development purposes. The actual transcription will work with proper Google Cloud credentials.',
        words: [
          { word: 'This', startTime: 0.0, endTime: 0.5, confidence: 0.9 },
          { word: 'is', startTime: 0.5, endTime: 0.8, confidence: 0.9 },
          { word: 'a', startTime: 0.8, endTime: 1.0, confidence: 0.9 },
          { word: 'sample', startTime: 1.0, endTime: 1.5, confidence: 0.9 },
          { word: 'transcript', startTime: 1.5, endTime: 2.0, confidence: 0.9 },
        ],
      };

      // Update project in mock storage
      project.transcript = mockTranscript;
      project.transcriptionStatus = 'completed';
      project.updatedAt = new Date();
      mockProjects.set(projectId, project);

      // Generate suggested prompts in background (don't block response)
      generateSuggestedPromptsAsync(projectId, project).catch(err => {
        console.error('Failed to generate suggested prompts:', err);
      });

      return res.json({
        success: true,
        transcript: mockTranscript,
        message: 'Mock transcription (configure Google Cloud or OpenAI credentials for real transcription)',
      });
    }

    res.status(500).json({ error: 'Failed to transcribe video', details: error.message });
  }
});

module.exports = router;

