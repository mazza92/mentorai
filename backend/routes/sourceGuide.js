const express = require('express');
const router = express.Router();
const { getFirestore } = require('../config/firestore');
const { FieldValue } = require('@google-cloud/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini (same as rest of app)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/**
 * Detect if content is primarily in French
 */
function detectFrenchContent(text) {
  if (!text) return false;

  const lowerText = text.toLowerCase();

  // French-specific patterns
  const frenchPatterns = [
    /\b(le|la|les|un|une|des|de|du|dans|sur|avec|pour|par|est|sont|être|avoir)\b/gi,
    /\b(et|ou|mais|donc|car|parce|si|alors|comment|pourquoi|quand|où)\b/gi,
    /c'est|qu'|d'|l'|n'|s'|à|ça/gi
  ];

  let frenchScore = 0;
  frenchPatterns.forEach(pattern => {
    const matches = lowerText.match(pattern);
    if (matches) frenchScore += matches.length;
  });

  // If we find 10+ French words, it's French
  return frenchScore >= 10;
}

/**
 * Generate source guide for a channel
 */
async function generateChannelSourceGuide(projectDoc, project, firestore, res) {
  try {
    console.log('[SourceGuide] Generating channel source guide for:', project.channelId);

    // Get channel data from Firestore
    const channelDoc = await firestore.collection('channels').doc(project.channelId).get();

    if (!channelDoc.exists) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = channelDoc.data();

    // Get sample videos (first 20, with or without transcripts)
    const videosSnapshot = await firestore.collection('channels')
      .doc(project.channelId)
      .collection('videos')
      .limit(20)
      .get();

    const videos = videosSnapshot.docs.map(doc => doc.data());

    console.log('[SourceGuide] Analyzing channel with', videos.length, 'videos');

    if (videos.length === 0) {
      return res.status(400).json({
        error: 'No videos found',
        message: 'Channel has no videos to analyze'
      });
    }

    // Prepare content for analysis
    const channelTitle = channel.channelTitle || project.title || 'YouTube Channel';
    const videoCount = channel.totalVideos || videos.length;
    const videoTitles = videos.map(v => v.title).slice(0, 15).join('\n- ');

    // Get sample descriptions (always available)
    const descriptionSamples = videos
      .filter(v => v.description && v.description.length > 50)
      .slice(0, 10)
      .map(v => `"${v.title}": ${v.description.substring(0, 200)}...`)
      .join('\n\n');

    // Get sample transcript excerpts (if available)
    const transcriptSamples = videos
      .filter(v => v.transcript)
      .slice(0, 5)
      .map(v => {
        const transcriptText = typeof v.transcript === 'object' ? v.transcript.text : v.transcript;
        return `"${v.title}": ${transcriptText.substring(0, 300)}...`;
      })
      .join('\n\n');

    // Detect language from video titles and descriptions
    const sampleText = (videoTitles + ' ' + descriptionSamples).substring(0, 1000);
    const isFrench = detectFrenchContent(sampleText);

    // Language-specific instructions
    const languageInstruction = isFrench
      ? 'IMPORTANT: Générez le guide source EN FRANÇAIS. Le résumé et les sujets clés doivent être en français.'
      : 'Generate the source guide in English.';

    // Generate summary using Gemini
    const prompt = `You are analyzing a YouTube channel to create a "Source Guide" - a concise overview that helps viewers quickly understand the channel's content and key themes.

${languageInstruction}

Channel: ${channelTitle}
Total Videos: ${videoCount}

Sample Video Titles (first 15):
- ${videoTitles}

${descriptionSamples ? `Video Descriptions:\n${descriptionSamples}\n` : ''}

${transcriptSamples ? `Transcript Excerpts:\n${transcriptSamples}\n` : ''}

Generate a source guide in the following JSON format:
{
  "summary": "A comprehensive 2-3 sentence summary highlighting the channel's main focus, content themes, and what viewers can expect to learn. Use bold markdown (**text**) to emphasize key topics or specializations.",
  "keyTopics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5", "Topic 6"]
}

Guidelines:
- ${isFrench ? 'Écrivez le résumé et les sujets EN FRANÇAIS' : 'Write the summary and topics in English'}
- Summary should describe the overall channel theme and value proposition based on video titles and descriptions
- Use bold markdown to emphasize the channel's main areas of expertise or focus
- Key topics should represent recurring themes across videos (3-5 words max each)
- Generate 4-6 key topics that capture the channel's content diversity
- Topics should be specific enough to guide questions (e.g., "AI content production" not just "AI")
- Base your analysis on the video titles and descriptions provided above

Return ONLY valid JSON, no additional text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    console.log('[SourceGuide] Gemini response for channel:', responseText);

    // Parse the JSON response
    let sourceGuide;
    try {
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      sourceGuide = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[SourceGuide] Failed to parse Gemini response:', parseError);
      sourceGuide = {
        summary: `This channel "${channelTitle}" contains ${videoCount} videos covering various topics.`,
        keyTopics: ['Channel overview', 'Video topics', 'Key themes']
      };
    }

    // Generate intelligent suggested prompts based on actual available content
    let suggestedPrompts = [];
    const videosWithTranscripts = videos.filter(v => v.transcript);

    if (videosWithTranscripts.length > 0) {
      console.log('[SourceGuide] Generating suggested prompts from', videosWithTranscripts.length, 'videos with transcripts');

      // Get sample transcript content to understand what we can answer
      const transcriptContext = videosWithTranscripts
        .slice(0, 5)
        .map(v => {
          const transcriptText = typeof v.transcript === 'object' ? v.transcript.text : v.transcript;
          return `"${v.title}": ${transcriptText.substring(0, 400)}...`;
        })
        .join('\n\n');

      const promptsPrompt = `Based on the following YouTube channel content, generate 4 concise, intelligent questions that users would want to ask about this content.

${languageInstruction}

Channel: ${channelTitle}
Key Topics: ${sourceGuide.keyTopics.join(', ')}

Video Titles:
- ${videoTitles}

Sample Transcript Content:
${transcriptContext}

IMPORTANT: Questions must be:
- ${isFrench ? 'Courtes et directes (maximum 2 phrases courtes)' : 'Short and direct (max 2 short sentences)'}
- ${isFrench ? 'Spécifiques au contenu disponible (pas génériques)' : 'Specific to the available content (not generic)'}
- ${isFrench ? 'Actionnables et pratiques' : 'Actionable and practical'}
- ${isFrench ? 'Formulées comme NotebookLM : concises et engageantes' : 'Phrased like NotebookLM: concise and engaging'}

Example format: "How does [creator] approach [specific topic]?" or "What are the key insights about [specific topic]?"

Return ONLY a JSON array of 4 concise question strings, nothing else:
["Question 1?", "Question 2?", "Question 3?", "Question 4?"]`;

      try {
        const promptsResult = await model.generateContent(promptsPrompt);
        const promptsResponse = await promptsResult.response;
        const promptsText = promptsResponse.text();

        console.log('[SourceGuide] Generated prompts:', promptsText.substring(0, 200));

        // Parse JSON array
        let jsonText = promptsText;
        const jsonMatch = promptsText.match(/```json\s*([\s\S]*?)\s*```/) ||
                         promptsText.match(/```\s*([\s\S]*?)\s*```/) ||
                         promptsText.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          jsonText = jsonMatch[1] || jsonMatch[0];
        }

        suggestedPrompts = JSON.parse(jsonText);
        console.log('[SourceGuide] Parsed', suggestedPrompts.length, 'suggested prompts');
      } catch (error) {
        console.error('[SourceGuide] Failed to generate suggested prompts:', error);
        // Fallback prompts based on key topics
        suggestedPrompts = sourceGuide.keyTopics.slice(0, 4).map(topic =>
          isFrench
            ? `Comment puis-je en savoir plus sur ${topic.toLowerCase()} ?`
            : `How can I learn more about ${topic.toLowerCase()}?`
        );
      }
    } else {
      // No transcripts - guide user to understand why
      suggestedPrompts = isFrench
        ? ['Pourquoi les transcriptions ne sont-elles pas disponibles ?']
        : ['Why are transcripts not available?'];
    }

    // Save to project document for future requests
    await projectDoc.ref.update({
      sourceGuide,
      suggestedPrompts,
      sourceGuideGeneratedAt: FieldValue.serverTimestamp()
    });

    console.log('[SourceGuide] Channel source guide and suggested prompts generated and cached');

    return res.json({
      success: true,
      sourceGuide,
      suggestedPrompts
    });

  } catch (error) {
    console.error('[SourceGuide] Error generating channel source guide:', error);
    return res.status(500).json({
      error: 'Failed to generate channel source guide',
      message: error.message
    });
  }
}

/**
 * POST /api/source-guide
 * Generate a comprehensive source guide summary for a video or channel
 */
router.post('/', async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // Get project from Firestore
    const { firestore, useMockMode } = getFirestore();

    if (useMockMode) {
      return res.status(503).json({
        error: 'Firestore not configured',
        message: 'Source guide requires database access'
      });
    }

    const projectDoc = await firestore.collection('projects').doc(projectId).get();

    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectDoc.data();

    // Check if we already have a source guide
    if (project.sourceGuide) {
      console.log('[SourceGuide] Using cached source guide');
      return res.json({
        success: true,
        sourceGuide: project.sourceGuide
      });
    }

    // Handle channels differently from single videos
    if (project.type === 'channel') {
      return await generateChannelSourceGuide(projectDoc, project, firestore, res);
    }

    // Single video logic
    // Check if transcript is available
    if (!project.transcript || !project.transcript.text) {
      return res.status(400).json({
        error: 'Transcript not available',
        message: 'Video must be transcribed before generating source guide'
      });
    }

    // Prepare content for analysis
    const title = project.title || project.fileName || 'Video';
    const description = project.description || '';

    // Extract text from transcript object (transcript is {text, words, segments})
    const transcriptText = project.transcript.text;

    // Get first 3000 characters of transcript for analysis
    const transcriptPreview = transcriptText.substring(0, 3000);

    console.log('[SourceGuide] Generating summary for:', title);

    // Generate summary using Gemini
    const prompt = `You are analyzing a video to create a "Source Guide" - a concise overview that helps viewers quickly understand the content and key concepts.

Video Title: ${title}
${description ? `Description: ${description}` : ''}

Transcript Preview:
${transcriptPreview}

Generate a source guide in the following JSON format:
{
  "summary": "A comprehensive 2-3 sentence summary highlighting the main topic, key strategies/methods discussed, and the primary value proposition. Use bold markdown (**text**) to emphasize key concepts.",
  "keyTopics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"]
}

Guidelines:
- Summary should be factual and informative, highlighting what viewers will learn
- Use bold markdown to emphasize important concepts, methods, or results
- Key topics should be short phrases (3-5 words max) representing main themes
- Generate 4-6 key topics that viewers might want to ask about
- Topics should be specific enough to guide questions (e.g., "AI content production" not just "AI")

Return ONLY valid JSON, no additional text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    console.log('[SourceGuide] Gemini response:', responseText);

    // Parse the JSON response (handle both raw JSON and markdown code blocks)
    let sourceGuide;
    try {
      // Try to extract JSON from markdown code blocks (```json ... ```)
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      sourceGuide = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[SourceGuide] Failed to parse Gemini response:', parseError);
      console.error('[SourceGuide] Raw response:', responseText.substring(0, 500));
      // Fallback to basic summary
      sourceGuide = {
        summary: `This video titled "${title}" covers various topics and insights.`,
        keyTopics: ['Overview', 'Key concepts', 'Main takeaways']
      };
    }

    // Save to Firestore for future requests
    await projectDoc.ref.update({
      sourceGuide,
      sourceGuideGeneratedAt: FieldValue.serverTimestamp()
    });

    console.log('[SourceGuide] Generated and cached successfully');

    res.json({
      success: true,
      sourceGuide
    });

  } catch (error) {
    console.error('[SourceGuide] Error generating source guide:', error);
    res.status(500).json({
      error: 'Failed to generate source guide',
      message: error.message
    });
  }
});

module.exports = router;
