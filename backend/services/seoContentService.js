/**
 * SEO Content Service
 * Generates optimized content for public video summary pages (pSEO)
 * Uses Gemini AI to extract structured SEO content from video transcripts
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class SEOContentService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          topP: 0.95
        }
      });
    }
  }

  /**
   * Generate SEO content for a video
   * @param {Object} video - Video metadata (title, duration, viewCount, etc.)
   * @param {string} transcript - Full transcript text
   * @param {string} channelName - Creator/channel name
   * @returns {Object} Structured SEO content
   */
  async generateSEOContent(video, transcript, channelName) {
    if (!this.model) {
      throw new Error('Gemini API not configured');
    }

    const prompt = this.buildSEOPrompt(video, transcript, channelName);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const parsed = this.parseResponse(text);

      // Add slug generation
      parsed.slug = this.generateSlug(video.title, video.videoId);

      return parsed;
    } catch (error) {
      console.error('[SEOContentService] Generation error:', error);
      throw error;
    }
  }

  /**
   * Build the SEO extraction prompt
   */
  buildSEOPrompt(video, transcript, channelName) {
    const durationMinutes = Math.floor((video.duration || 0) / 60);
    const viewCountFormatted = (video.viewCount || 0).toLocaleString('fr-FR');

    // Truncate transcript if too long (keep first 15000 chars)
    const truncatedTranscript = transcript.length > 15000
      ? transcript.substring(0, 15000) + '\n\n[Transcription tronquée...]'
      : transcript;

    return `Tu es un expert SEO francophone spécialisé dans la création de pages de résumé IA optimisées pour le référencement Google.

CONTEXTE DE LA VIDÉO:
- Titre: ${video.title}
- Créateur: ${channelName}
- Durée: ${durationMinutes} minutes
- Vues: ${viewCountFormatted}
- ID YouTube: ${video.videoId}

TRANSCRIPTION COMPLÈTE:
${truncatedTranscript}

INSTRUCTIONS:
Génère un contenu SEO structuré en JSON pour créer une page de résumé IA de haute qualité qui va se positionner sur Google.

EXIGENCES CRITIQUES:
1. TOUT le contenu DOIT être en FRANÇAIS
2. Les timestamps DOIVENT correspondre à des moments réels mentionnés dans la transcription
3. Chaque insight doit être factuel et vérifiable dans la transcription
4. Le ton doit être professionnel mais accessible
5. Optimise pour les mots-clés: "résumé IA", "résumé vidéo YouTube", le nom du créateur, et les thèmes principaux

FORMAT JSON REQUIS (retourne UNIQUEMENT ce JSON, sans texte avant ou après):
{
  "seoTitle": "Résumé IA : [Titre accrocheur max 50 chars] | ${channelName}",
  "metaTitle": "[60 caractères max - incluant 'Résumé IA' et le sujet principal]",
  "metaDescription": "[155 caractères max - phrase d'accroche incitant au clic, mentionnant le créateur]",

  "quickInsights": [
    {
      "emoji": "💡",
      "text": "[20-30 mots - l'insight le plus impactant de la vidéo]"
    },
    {
      "emoji": "🎯",
      "text": "[20-30 mots - deuxième point clé à retenir]"
    },
    {
      "emoji": "⚡",
      "text": "[20-30 mots - troisième insight actionable]"
    }
  ],

  "deepLinks": [
    {
      "timestamp": [nombre de secondes depuis le début],
      "timestampFormatted": "[MM:SS]",
      "title": "[5-8 mots - titre du moment clé]",
      "description": "[25-35 mots - pourquoi ce moment est important]"
    },
    {
      "timestamp": [secondes],
      "timestampFormatted": "[MM:SS]",
      "title": "[titre]",
      "description": "[description]"
    },
    {
      "timestamp": [secondes],
      "timestampFormatted": "[MM:SS]",
      "title": "[titre]",
      "description": "[description]"
    },
    {
      "timestamp": [secondes],
      "timestampFormatted": "[MM:SS]",
      "title": "[titre]",
      "description": "[description]"
    }
  ],

  "howToSteps": [
    {
      "position": 1,
      "name": "[5-8 mots - titre de l'étape]",
      "text": "[25-40 mots - instruction actionnable basée sur le contenu de la vidéo]",
      "timestamp": [secondes correspondant à cette étape],
      "timestampFormatted": "[MM:SS]"
    },
    {
      "position": 2,
      "name": "[titre étape 2]",
      "text": "[instruction étape 2]",
      "timestamp": [secondes],
      "timestampFormatted": "[MM:SS]"
    },
    {
      "position": 3,
      "name": "[titre étape 3]",
      "text": "[instruction étape 3]",
      "timestamp": [secondes],
      "timestampFormatted": "[MM:SS]"
    },
    {
      "position": 4,
      "name": "[titre étape 4]",
      "text": "[instruction étape 4]",
      "timestamp": [secondes],
      "timestampFormatted": "[MM:SS]"
    }
  ],

  "semanticAnalysis": "[Paragraphe de 150 mots en markdown. Analyse approfondie du contenu: thèmes principaux, concepts clés, public cible, et valeur ajoutée de la vidéo. Utilise **gras** pour les mots-clés importants. Inclus naturellement les termes SEO pertinents.]",

  "conversionQuestions": [
    {
      "icon": "❓",
      "question": "[Question spécifique que l'utilisateur voudrait poser sur le contenu de la vidéo]"
    },
    {
      "icon": "💬",
      "question": "[Deuxième question engageante liée aux conseils donnés]"
    },
    {
      "icon": "🤔",
      "question": "[Troisième question incitant à approfondir avec l'IA]"
    }
  ],

  "faqs": [
    {
      "question": "De quoi parle cette vidéo de ${channelName} ?",
      "answer": "[Réponse concise de 60-80 mots résumant le contenu principal]"
    },
    {
      "question": "Quels sont les points clés à retenir ?",
      "answer": "[Liste de 3-4 points principaux en 60-80 mots]"
    },
    {
      "question": "À qui s'adresse cette vidéo ?",
      "answer": "[Description du public cible en 40-60 mots]"
    }
  ],

  "keywords": ["mot-clé-1", "mot-clé-2", "mot-clé-3", "mot-clé-4", "mot-clé-5"]
}`;
  }

  /**
   * Parse Gemini response to extract JSON
   */
  parseResponse(text) {
    // Try to extract JSON from potential markdown code blocks
    let jsonText = text;

    // Remove markdown code blocks if present
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                     text.match(/```\s*([\s\S]*?)\s*```/);

    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    // Try to find JSON object
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonText = objectMatch[0];
    }

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('[SEOContentService] Failed to parse JSON:', error);
      console.error('[SEOContentService] Raw response:', text.substring(0, 500));
      throw new Error('Failed to parse Gemini SEO response as JSON');
    }
  }

  /**
   * Generate URL-friendly slug from video title and ID
   * Format: {slugified-title-50chars}-{videoId-6chars}
   */
  generateSlug(videoTitle, videoId) {
    const slugifiedTitle = videoTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // Remove accents
      .replace(/[^a-z0-9]+/g, '-')       // Replace non-alphanumeric with dash
      .replace(/^-+|-+$/g, '')           // Trim leading/trailing dashes
      .substring(0, 50);                  // Max 50 chars

    const shortId = (videoId || '').substring(0, 6);

    return `${slugifiedTitle}-${shortId}`;
  }

  /**
   * Validate generated content meets requirements
   */
  validateContent(content) {
    const errors = [];

    if (!content.seoTitle || content.seoTitle.length < 20) {
      errors.push('seoTitle missing or too short');
    }

    if (!content.metaTitle || content.metaTitle.length > 65) {
      errors.push('metaTitle missing or exceeds 65 chars');
    }

    if (!content.metaDescription || content.metaDescription.length > 160) {
      errors.push('metaDescription missing or exceeds 160 chars');
    }

    if (!content.quickInsights || content.quickInsights.length !== 3) {
      errors.push('quickInsights must have exactly 3 items');
    }

    if (!content.deepLinks || content.deepLinks.length !== 4) {
      errors.push('deepLinks must have exactly 4 items');
    }

    if (!content.howToSteps || content.howToSteps.length < 3 || content.howToSteps.length > 5) {
      errors.push('howToSteps must have 3-5 items');
    }

    if (!content.conversionQuestions || content.conversionQuestions.length !== 3) {
      errors.push('conversionQuestions must have exactly 3 items');
    }

    if (!content.faqs || content.faqs.length < 3) {
      errors.push('faqs must have at least 3 items');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new SEOContentService();
