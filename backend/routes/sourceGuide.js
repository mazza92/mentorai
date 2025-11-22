const express = require('express');
const router = express.Router();
const { getFirestore } = require('../config/firestore');
const { FieldValue } = require('@google-cloud/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /api/source-guide
 * Generate a comprehensive source guide summary for a video
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

    // Generate summary using Claude
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `You are analyzing a video to create a "Source Guide" - a concise overview that helps viewers quickly understand the content and key concepts.

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

Return ONLY valid JSON, no additional text.`
        }
      ]
    });

    const responseText = message.content[0].text;
    console.log('[SourceGuide] Claude response:', responseText);

    // Parse the JSON response
    let sourceGuide;
    try {
      sourceGuide = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[SourceGuide] Failed to parse Claude response:', parseError);
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
