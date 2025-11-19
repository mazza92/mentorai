const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { mockProjects } = require('../utils/mockStorage');
const { Firestore } = require('@google-cloud/firestore');

const router = express.Router();

// Initialize Firestore with error handling
let firestore;
let useMockMode = false;

try {
  if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id' && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'mock-project') {
    const firestoreConfig = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    };

    // Handle credentials from Railway environment variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        firestoreConfig.credentials = credentials;
      } catch (error) {
        console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON for topics service');
        throw error;
      }
    }

    firestore = new Firestore(firestoreConfig);
    console.log('✅ Firestore initialized for topics service');
  } else {
    useMockMode = true;
    console.log('Google Cloud not configured, using mock mode for topics service');
  }
} catch (error) {
  console.log('Firestore initialization failed, using mock mode for topics service');
  console.log('Error:', error.message);
  useMockMode = true;
}

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

    // Get project from mock storage or Firestore
    let project;
    if (useMockMode || !firestore) {
      project = mockProjects.get(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    } else {
      // Get from Firestore
      const projectDoc = await firestore.collection('projects').doc(projectId).get();
      if (!projectDoc.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }
      project = { id: projectId, ...projectDoc.data() };
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

    // Detect language from transcript
    const detectLanguage = (transcriptText) => {
      const text = transcriptText.toLowerCase();

      // French indicators
      const frenchContractions = /c'est|c'était|qu'est-ce|qu'il|qu'elle|qu'on|d'accord|d'ailleurs|j'ai|j'avais|l'on|l'autre|n'est|n'ont|s'il/gi;
      const frenchQuestionWords = /\b(quoi|pourquoi|comment|combien|où|quand)\b/gi;
      const frenchCommonWords = /\b(le|la|les|un|une|des|de|du|dans|sur|avec|pour|par|est|sont|être|avoir|faire|aller|venir|voir|savoir|pouvoir|vouloir|devoir)\b/gi;

      let frenchScore = 0;
      frenchScore += (text.match(frenchContractions) || []).length * 3;
      frenchScore += (text.match(frenchQuestionWords) || []).length * 2;
      frenchScore += (text.match(frenchCommonWords) || []).length;

      return frenchScore > 5 ? 'fr' : 'en';
    };

    const detectedLanguage = detectLanguage(transcript.text);
    console.log('Detected language for TOC:', detectedLanguage);

    // Language-specific prompts
    const prompts = {
      en: {
        instruction: `You are an expert at analyzing long-form video content and creating structured tables of contents.

TASK: Analyze this video transcript and create a comprehensive table of contents that helps viewers quickly navigate to specific topics.

REQUIREMENTS:
1. Identify 5-15 major topics/sections in the video
2. For each topic, provide:
   - A clear, descriptive title (3-8 words) IN ENGLISH
   - The start timestamp [MM:SS]
   - A brief 1-sentence description of what's covered IN ENGLISH
3. Topics should be ordered chronologically
4. Focus on substantive topic changes, not minor tangents
5. Use the timestamps from the transcript

IMPORTANT - JSON FORMAT:
- Return ONLY valid JSON, no additional text
- Do NOT use trailing commas
- All text must use double quotes (")

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
}`,
        closing: 'Generate ONLY the table of contents JSON (no text before or after):'
      },
      fr: {
        instruction: `Vous êtes un expert en analyse de contenu vidéo long format et en création de tables des matières structurées.

TÂCHE: Analysez cette transcription vidéo et créez une table des matières complète qui aide les spectateurs à naviguer rapidement vers des sujets spécifiques.

EXIGENCES:
1. Identifiez 5-15 sujets/sections majeurs dans la vidéo
2. Pour chaque sujet, fournissez:
   - Un titre clair et descriptif (3-8 mots) EN FRANÇAIS
   - L'horodatage de début [MM:SS]
   - Une brève description en 1 phrase de ce qui est couvert EN FRANÇAIS
3. Les sujets doivent être ordonnés chronologiquement
4. Concentrez-vous sur les changements de sujet substantiels, pas les digressions mineures
5. Utilisez les horodatages de la transcription

IMPORTANT - FORMAT JSON:
- Retournez UNIQUEMENT du JSON valide, sans texte supplémentaire
- N'utilisez PAS de virgules finales
- Tous les textes doivent utiliser des guillemets doubles (")
- Les apostrophes dans le texte français sont autorisées dans les chaînes

FORMAT DE SORTIE (JSON):
{
  "chapters": [
    {
      "title": "Introduction et Définition du Problème",
      "startTime": "0:00",
      "startTimeSeconds": 0,
      "description": "Aperçu des principaux défis et de ce que la vidéo va couvrir"
    },
    {
      "title": "Stratégie Principale 1: Optimisation du Budget",
      "startTime": "3:45",
      "startTimeSeconds": 225,
      "description": "Comment allouer efficacement votre budget entre les campagnes"
    }
  ]
}`,
        closing: 'Générez UNIQUEMENT le JSON de la table des matières (pas de texte avant ou après):'
      }
    };

    const promptConfig = prompts[detectedLanguage];
    const prompt = `${promptConfig.instruction}

VIDEO TRANSCRIPT:
${context}

${promptConfig.closing}`;

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

    // Extract JSON from response (handle markdown code blocks and clean formatting)
    console.log('Raw TOC response length:', tocText.length, 'characters');

    let jsonString;

    // Try to extract from markdown code block first
    const codeBlockMatch = tocText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
      console.log('Extracted JSON from markdown code block');
    } else {
      // Fallback to simple regex
      const jsonMatch = tocText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Failed to find JSON in response');
        throw new Error('Failed to parse TOC response - no JSON found');
      }
      jsonString = jsonMatch[0];
    }

    // Clean up common JSON issues
    // 1. Remove trailing commas before closing braces/brackets
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
    // 2. Fix single quotes to double quotes (only for property names)
    jsonString = jsonString.replace(/'([^']+)':/g, '"$1":');

    let tocData;
    try {
      tocData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('Attempted to parse:', jsonString.substring(0, 500) + '...');
      throw new Error(`Failed to parse TOC JSON: ${parseError.message}`);
    }

    console.log('TOC generated with', tocData.chapters.length, 'chapters');

    // Save TOC to project
    project.tableOfContents = tocData;
    project.updatedAt = new Date();
    
    if (useMockMode || !firestore) {
      mockProjects.set(projectId, project);
    } else {
      // Save to Firestore
      await firestore.collection('projects').doc(projectId).update({
        tableOfContents: tocData,
        updatedAt: new Date()
      });
    }

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

    // Get project from mock storage or Firestore
    let project;
    if (useMockMode || !firestore) {
      project = mockProjects.get(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    } else {
      // Get from Firestore
      try {
        const projectDoc = await firestore.collection('projects').doc(projectId).get();
        if (!projectDoc.exists) {
          return res.status(404).json({ error: 'Project not found' });
        }
        project = { id: projectId, ...projectDoc.data() };
      } catch (firestoreError) {
        console.error('Firestore error in TOC retrieval, falling back to mock mode:', firestoreError.message);
        // Fallback to mock mode
        project = mockProjects.get(projectId);
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }
      }
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
