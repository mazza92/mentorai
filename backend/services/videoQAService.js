const { GoogleGenerativeAI } = require('@google/generative-ai');

class VideoQAService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;
    
    if (this.apiKey && this.apiKey !== 'your_gemini_api_key') {
      try {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('VideoQAService initialized with Gemini API');
      } catch (error) {
        console.error('Error initializing VideoQAService:', error);
      }
    } else {
      console.log('VideoQAService initialized in mock mode (no GEMINI_API_KEY)');
    }
  }

  /**
   * Re-check API key at runtime and re-initialize if needed
   */
  ensureInitialized() {
    if (!this.genAI || !this.model) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== 'your_gemini_api_key') {
        try {
          this.genAI = new GoogleGenerativeAI(apiKey);
          this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
          this.apiKey = apiKey;
          console.log('VideoQAService re-initialized with Gemini API');
        } catch (error) {
          console.error('Error re-initializing VideoQAService:', error);
        }
      }
    }
  }

  /**
   * Build context from video analysis for RAG-style retrieval
   * PRIORITIZES TRANSCRIPT for knowledge questions, uses visual analysis as supplementary
   */
  buildVideoContext(videoAnalysis, transcript) {
    let context = '';

    // PRIORITY 1: Full transcript with timestamps (most important for knowledge Q&A)
    if (transcript && transcript.words && transcript.words.length > 0) {
      context += 'FULL VIDEO TRANSCRIPT (with timestamps):\n';
      context += 'This is the PRIMARY source of information. Use this to answer questions about what was said, concepts discussed, instructions given, etc.\n\n';
      
      // Group words into sentences/phrases with timestamps for better readability
      let currentSentence = '';
      let sentenceStartTime = transcript.words[0].startTime || 0;
      
      transcript.words.forEach((word, index) => {
        if (index === 0) {
          currentSentence = word.word;
          sentenceStartTime = word.startTime || 0;
        } else {
          const prevWord = transcript.words[index - 1];
          const timeDiff = (word.startTime || 0) - (prevWord.endTime || 0);
          
          // Start new line if pause > 0.5s or sentence getting long (better for parsing)
          if (timeDiff > 0.5 || currentSentence.split(' ').length > 20) {
            const timestamp = this.secondsToTime(sentenceStartTime);
            context += `[${timestamp}] ${currentSentence.trim()}\n`;
            currentSentence = word.word;
            sentenceStartTime = word.startTime || 0;
          } else {
            currentSentence += ' ' + word.word;
          }
        }
      });
      
      // Add last sentence
      if (currentSentence.trim()) {
        const timestamp = this.secondsToTime(sentenceStartTime);
        context += `[${timestamp}] ${currentSentence.trim()}\n`;
      }
      context += '\n';
    } else if (transcript && transcript.text) {
      // Fallback: use plain text transcript
      context += 'FULL VIDEO TRANSCRIPT:\n';
      context += 'This is the PRIMARY source of information.\n\n';
      context += `${transcript.text}\n\n`;
    } else {
      context += 'NOTE: No transcript available. Answers will be limited to visual analysis only.\n\n';
    }

    // PRIORITY 2: Video summary (if available, provides high-level context)
    if (videoAnalysis && videoAnalysis.summary) {
      context += 'VIDEO SUMMARY (high-level overview):\n';
      context += `${videoAnalysis.summary}\n\n`;
    }

    // PRIORITY 3: Key moments (supplementary - helps with temporal context)
    if (videoAnalysis && videoAnalysis.keyMoments && videoAnalysis.keyMoments.length > 0) {
      context += 'KEY MOMENTS (visual highlights - use for temporal context):\n';
      videoAnalysis.keyMoments.forEach((moment) => {
        const timestamp = this.secondsToTime(moment.timestamp);
        context += `- [${timestamp}] ${moment.description}\n`;
      });
      context += '\n';
    }

    // PRIORITY 4: Scene descriptions (supplementary - visual context only)
    if (videoAnalysis && videoAnalysis.scenes && videoAnalysis.scenes.length > 0) {
      context += 'VISUAL SCENE DESCRIPTIONS (supplementary context - use only if question is about visual elements):\n';
      videoAnalysis.scenes.forEach((scene) => {
        const timestamp = this.secondsToTime(scene.timestamp);
        context += `[${timestamp}] ${scene.description}`;
        if (scene.objects && scene.objects.length > 0) {
          context += ` (Objects: ${scene.objects.join(', ')})`;
        }
        if (scene.actions && scene.actions.length > 0) {
          context += ` (Actions: ${scene.actions.join(', ')})`;
        }
        context += '\n';
      });
      context += '\n';
    }

    return context;
  }

  /**
   * Convert seconds to MM:SS format
   */
  secondsToTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Build chat history context for follow-up questions
   */
  buildChatHistoryContext(chatHistory) {
    if (!chatHistory || chatHistory.length === 0) {
      return '';
    }

    let context = '\n\nPREVIOUS CONVERSATION HISTORY (for follow-up context):\n';
    context += 'Use this to understand follow-up questions like "tell me more about that" or "what about the second one".\n\n';

    // Include last 5 exchanges (or fewer if less than 5)
    const recentHistory = chatHistory.slice(-5);
    recentHistory.forEach((exchange, index) => {
      context += `[Q${index + 1}] User: ${exchange.question}\n`;
      context += `[A${index + 1}] Assistant: ${exchange.answer.substring(0, 300)}...\n\n`;
    });

    return context;
  }

  /**
   * Extract visual context for citation timestamps
   */
  extractVisualContextForCitations(citations, videoAnalysis) {
    if (!videoAnalysis || !citations || citations.length === 0) {
      return {};
    }

    const visualContext = {};

    citations.forEach(timestamp => {
      // Find the scene/moment closest to this timestamp
      let closestScene = null;
      let minDiff = Infinity;

      if (videoAnalysis.scenes) {
        videoAnalysis.scenes.forEach(scene => {
          const diff = Math.abs(scene.timestamp - timestamp);
          if (diff < minDiff && diff < 10) { // Within 10 seconds
            minDiff = diff;
            closestScene = scene;
          }
        });
      }

      if (closestScene) {
        visualContext[timestamp] = {
          description: closestScene.description,
          objects: closestScene.objects || [],
          actions: closestScene.actions || [],
          timestamp: closestScene.timestamp
        };
      }
    });

    return visualContext;
  }

  /**
   * Extract key takeaways for long answers
   */
  extractKeyTakeaways(answer) {
    const takeaways = [];

    // Look for important statements (contains keywords like "key", "important", "critical", "must", "essential")
    const sentences = answer.split(/[.!?]\s+/);
    const importantKeywords = ['key', 'important', 'critical', 'must', 'essential', 'crucial', 'vital', 'revolutionary', 'best'];

    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      if (importantKeywords.some(kw => lowerSentence.includes(kw)) && sentence.length < 200) {
        // Clean up any markdown formatting for takeaways
        const cleanSentence = sentence.replace(/\*\*/g, '').replace(/\*/g, '').replace(/<cite>.*?<\/cite>/g, '').trim();
        if (cleanSentence.length > 20 && !cleanSentence.startsWith('#')) {
          takeaways.push(cleanSentence);
        }
      }
    });

    return takeaways.slice(0, 3); // Max 3 takeaways
  }

  /**
   * Convert markdown to HTML for easy frontend rendering
   * CRITICAL: Must properly handle bullets, paragraphs, and formatting
   */
  markdownToHtml(markdown) {
    if (!markdown) return '';

    let html = markdown;

    // Remove any remaining cite tags first
    html = html.replace(/<cite[^>]*>[\s]*<\/cite>/gi, '');
    html = html.replace(/<cite[^>]*>/gi, '');
    html = html.replace(/<\/cite>/gi, '');

    // Convert bold text BEFORE processing structure (**text**)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert headers (must be at start of line)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Process line by line to handle lists properly
    const lines = html.split('\n');
    const processedLines = [];
    let inBulletList = false;
    let inNumberedList = false;
    let bulletItems = [];
    let numberedItems = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check for numbered list item (e.g., "1. Item")
      const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
      // Check for bullet list item (e.g., "- Item" or "* Item")
      const bulletMatch = trimmedLine.match(/^[-\*]\s+(.+)$/);

      if (numberedMatch) {
        // Close bullet list if we were in one
        if (inBulletList) {
          processedLines.push(`<ul>${bulletItems.join('')}</ul>`);
          inBulletList = false;
          bulletItems = [];
        }

        // Start or continue numbered list
        if (!inNumberedList) {
          inNumberedList = true;
          numberedItems = [];
        }
        numberedItems.push(`<li>${numberedMatch[2]}</li>`);
      } else if (bulletMatch) {
        // Close numbered list if we were in one
        if (inNumberedList) {
          processedLines.push(`<ol>${numberedItems.join('')}</ol>`);
          inNumberedList = false;
          numberedItems = [];
        }

        // Start or continue bullet list
        if (!inBulletList) {
          inBulletList = true;
          bulletItems = [];
        }
        bulletItems.push(`<li>${bulletMatch[1]}</li>`);
      } else {
        // Not a list item - close any open lists
        if (inBulletList) {
          processedLines.push(`<ul>${bulletItems.join('')}</ul>`);
          inBulletList = false;
          bulletItems = [];
        }
        if (inNumberedList) {
          processedLines.push(`<ol>${numberedItems.join('')}</ol>`);
          inNumberedList = false;
          numberedItems = [];
        }

        // Add the regular line
        processedLines.push(line);
      }
    }

    // Close any remaining open lists
    if (inBulletList) {
      processedLines.push(`<ul>${bulletItems.join('')}</ul>`);
    }
    if (inNumberedList) {
      processedLines.push(`<ol>${numberedItems.join('')}</ol>`);
    }

    html = processedLines.join('\n');

    // Convert paragraphs (double newlines) - but NOT inside lists or headers
    html = html.split(/\n\n+/).map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';

      // Don't wrap if it's already an HTML tag or empty
      if (trimmed.match(/^<(h[1-6]|ol|ul|li|p|div)/i)) {
        return trimmed;
      }

      // Don't wrap single newlines (they're list items)
      if (trimmed.includes('\n') && !trimmed.match(/<\/li>/)) {
        // Multiple lines without list markup - keep as-is
        return trimmed;
      }

      return `<p>${trimmed}</p>`;
    }).filter(p => p).join('\n\n');

    // Clean up extra newlines but keep double newlines between blocks
    html = html.replace(/\n{3,}/g, '\n\n');

    return html;
  }

  /**
   * Post-process answer for better readability (ULTRA-AGGRESSIVE FORMATTING FOR DIGESTIBILITY)
   */
  enhanceReadability(answer, userQuestion) {
    let enhanced = answer;

    // --- PHASE 0: NORMALIZE SPACING ---
    // Remove spaces before punctuation (Gemini sometimes adds " ." instead of ".")
    enhanced = enhanced.replace(/\s+([\.!?,;:])/g, '$1');

    // REMOVE BLANK LINES BETWEEN CONSECUTIVE BULLETS
    // Gemini sometimes adds blank lines between bullets - remove them to keep bullets grouped
    enhanced = enhanced.replace(/([-\*]\s+.+)\n\n+([-\*]\s+)/g, '$1\n$2');
    enhanced = enhanced.replace(/(\d+\.\s+.+)\n\n+(\d+\.\s+)/g, '$1\n$2');

    // --- PHASE 1: ENSURE SPACING AROUND STRUCTURAL ELEMENTS ---

    // Blank line before and after headings
    enhanced = enhanced.replace(/([^\n])\n(#{1,3}\s+.+)/g, '$1\n\n$2');
    enhanced = enhanced.replace(/(#{1,3}\s+.+)\n([^\n#])/g, '$1\n\n$2');

    // Blank line before numbered and bullet lists (but ONLY before first item)
    enhanced = enhanced.replace(/([^\n])\n(\d+\.\s+)/g, '$1\n\n$2');
    enhanced = enhanced.replace(/([^\n-\*])\n([-\*]\s+)/g, '$1\n\n$2');

    // Blank line after lists (before regular text) - but ONLY after last item
    enhanced = enhanced.replace(/(\d+\.\s+.+)\n([^\d\n])/g, '$1\n\n$2');
    enhanced = enhanced.replace(/([-\*]\s+.+)\n([^\-\*\n#])/g, '$1\n\n$2');

    // --- PHASE 2: SMART PARAGRAPH BREAKING ---
    // Only break up VERY long paragraphs (more than 3 sentences)
    // This is less aggressive to avoid weird line breaks mid-thought

    const paragraphs = enhanced.split(/\n\n+/);
    const processedParagraphs = paragraphs.map(para => {
      const trimmed = para.trim();

      // Skip structural elements (headings, lists, references)
      if (!trimmed ||
          trimmed.match(/^#{1,3}\s+/) ||
          trimmed.match(/^\d+\.\s+/) ||
          trimmed.match(/^[-\*]\s+/) ||
          trimmed.match(/^References?:/i) ||
          trimmed.match(/^[🎯⚡💰🚀⚠️✅❌💡🔥]\s*\*\*/)) {  // Skip emoji-prefixed headings
        return para;
      }

      // Check if this paragraph contains list items (keep them together!)
      const lines = trimmed.split('\n');
      const hasListItems = lines.some(line => line.match(/^[-\*\d+\.]\s+/));
      if (hasListItems) {
        // Don't break up paragraphs that contain lists
        return para;
      }

      // Only split VERY long paragraphs (4+ sentences)
      const sentences = trimmed.match(/[^\.!\?]+[\.!\?]+/g) || [trimmed];

      // Only break if there are 4+ sentences (less aggressive)
      if (sentences.length >= 4) {
        // Group into 2-sentence chunks instead of 1-sentence
        const chunks = [];
        for (let i = 0; i < sentences.length; i += 2) {
          const chunk = sentences.slice(i, i + 2).map(s => s.trim()).join(' ');
          if (chunk) chunks.push(chunk);
        }
        return chunks.join('\n\n');
      }

      return para;
    });

    enhanced = processedParagraphs.join('\n\n');

    // --- PHASE 3: CLEANUP ---

    // Remove excessive newlines (max 2)
    enhanced = enhanced.replace(/\n{3,}/g, '\n\n');

    // Ensure blank line before "References:" if not already present
    enhanced = enhanced.replace(/([^\n])\n(References?:)/gi, '$1\n\n$2');

    // Final trim
    enhanced = enhanced.trim();

    return enhanced;
  }

  /**
   * Analyze answer for actionable insights and score them
   */
  analyzeInsights(answer, userQuestion) {
    const insights = {
      hasActionableContent: false,
      tipCount: 0,
      tips: [],
      complexity: 'medium'
    };

    // Detect if question is asking for actionable content
    const actionKeywords = ['how', 'tips', 'strategies', 'steps', 'actionable', 'do', 'implement', 'best practices'];
    const isActionableQuestion = actionKeywords.some(keyword =>
      userQuestion.toLowerCase().includes(keyword)
    );

    insights.hasActionableContent = isActionableQuestion;

    // Extract numbered tips or bullet points from answer
    const tipPatterns = [
      /(?:^|\n)\d+\.\s*([^\n]+)/g,  // Numbered lists
      /(?:^|\n)[-•]\s*([^\n]+)/g,    // Bullet points
    ];

    tipPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(answer)) !== null) {
        insights.tips.push({
          content: match[1].trim(),
          impact: this.scoreTipImpact(match[1])
        });
      }
    });

    insights.tipCount = insights.tips.length;

    // Determine complexity based on answer length and structure
    if (answer.length > 1000 || insights.tipCount > 5) {
      insights.complexity = 'high';
    } else if (answer.length < 300 || insights.tipCount <= 2) {
      insights.complexity = 'low';
    }

    return insights;
  }

  /**
   * Score individual tips for impact (1-5)
   */
  scoreTipImpact(tip) {
    const highImpactKeywords = ['critical', 'essential', 'must', 'always', 'never', 'most important', 'key'];
    const mediumImpactKeywords = ['should', 'recommend', 'important', 'consider', 'helpful'];
    const costIndicators = ['free', 'no cost', 'low cost', 'expensive', 'requires investment'];

    const tipLower = tip.toLowerCase();
    let score = 3; // Default medium impact

    // High impact indicators
    if (highImpactKeywords.some(kw => tipLower.includes(kw))) {
      score = 5;
    } else if (mediumImpactKeywords.some(kw => tipLower.includes(kw))) {
      score = 4;
    }

    // Bonus for free/low-cost tips
    if (tipLower.includes('free') || tipLower.includes('no cost')) {
      score = Math.min(5, score + 1);
    }

    return {
      score,
      label: score >= 5 ? 'HIGH IMPACT' : score >= 4 ? 'MEDIUM IMPACT' : 'LOW IMPACT',
      hasCostInfo: costIndicators.some(kw => tipLower.includes(kw))
    };
  }

  /**
   * Detect language from transcript or user question
   */
  detectLanguage(transcript, userQuestion) {
    // Check if language is explicitly provided
    if (transcript && transcript.language) {
      return transcript.language;
    }

    // Simple language detection based on common French words/patterns
    const textToAnalyze = (transcript?.text || userQuestion || '').toLowerCase();

    // French contractions (very strong indicators)
    const frenchContractions = [
      /c'est|c'était|qu'est-ce|qu'il|qu'elle|qu'on|d'accord|d'ailleurs|j'ai|j'avais|l'on|l'autre|n'est|n'ont|s'il/gi
    ];

    // French question words and common short phrases (strong indicators for short queries)
    const frenchQuestionWords = [
      /\b(quoi|pourquoi|comment|combien|où|quand)\b/gi
    ];

    // French indicators (general words)
    const frenchIndicators = [
      /\b(le|la|les|un|une|des|de|du|dans|sur|avec|pour|par|est|sont|être|avoir|faire|aller|venir|voir|savoir|pouvoir|vouloir|devoir|il|elle|nous|vous|ils|elles|ce|que|qui)\b/gi,
      /\b(et|ou|mais|donc|car|parce|si|alors|cependant|toutefois|ainsi|aussi|même|très|plus|moins|beaucoup|peu|tout|tous|toutes|chaque|aucun|aucune|rien|personne)\b/gi,
      /\b(je|tu|il|elle|nous|vous|ils|elles|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|votre|leur|leurs)\b/gi
    ];

    let frenchScore = 0;

    // Check contractions (worth 3 points each - very strong signal)
    frenchContractions.forEach(pattern => {
      const matches = textToAnalyze.match(pattern);
      if (matches) {
        frenchScore += matches.length * 3;
      }
    });

    // Check question words (worth 2 points each - strong signal for short queries)
    frenchQuestionWords.forEach(pattern => {
      const matches = textToAnalyze.match(pattern);
      if (matches) {
        frenchScore += matches.length * 2;
      }
    });

    // Check general French words (worth 1 point each)
    frenchIndicators.forEach(pattern => {
      const matches = textToAnalyze.match(pattern);
      if (matches) {
        frenchScore += matches.length;
      }
    });

    // Adjusted thresholds for better detection:
    // - Long text (>= 100 chars): needs score > 5 (multiple French words)
    // - Short text (< 100 chars): needs score >= 2 (just one French question word or contraction)
    if (frenchScore > 5 || (textToAnalyze.length < 100 && frenchScore >= 2)) {
      return 'fr';
    }

    // Default to English
    return 'en';
  }

  /**
   * Answer a question about the video using Gemini
   */
  async answerQuestion(userQuestion, videoAnalysis, transcript, chatHistory = null, personalizedContext = '', userLanguage = null) {
    this.ensureInitialized();

    // Detect language from transcript, user question, or use provided language
    const detectedLanguage = userLanguage || this.detectLanguage(transcript, userQuestion);
    console.log('Detected language for Q&A:', detectedLanguage);

    // Build context from video analysis
    const videoContext = this.buildVideoContext(videoAnalysis, transcript);

    // Build chat history context for follow-ups
    const chatHistoryContext = this.buildChatHistoryContext(chatHistory);

    if (!videoContext.trim()) {
      const errorMessage = detectedLanguage === 'fr' 
        ? 'J\'ai besoin des données d\'analyse vidéo pour répondre aux questions. Veuillez d\'abord analyser la vidéo.'
        : 'I need video analysis data to answer questions. Please analyze the video first.';
      
      return {
        answer: errorMessage,
        citations: [],
        visualContext: {},
        insights: null
      };
    }

    // Use Gemini API if available
    if (this.model) {
      try {
        // Build language-specific system instruction
        const isFrench = detectedLanguage === 'fr';
        const languageInstruction = isFrench ? `
IMPORTANT - RÉPONDEZ EN FRANÇAIS:
- Répondez toujours en français naturel et conversationnel
- Utilisez le vouvoiement (vous) pour être poli
- Adaptez votre style à la langue française
- Utilisez la ponctuation française correcte (espaces avant : ; ! ?)
- Les exemples et citations doivent être en français` : `
IMPORTANT - RESPOND IN ENGLISH:
- Always respond in natural, conversational English
- Use a friendly, helpful tone
- Adapt your style to English conventions`;

        const systemInstruction = `You are a helpful expert teaching directly from this content. Be CONCISE and SCANNABLE - people read on phones.
${languageInstruction}

🚨 CRITICAL RULES - YOU WILL BE PENALIZED FOR BREAKING THESE:

1. **ANSWER IN 3-5 SHORT PARAGRAPHS MAX**
   - Most answers should be 100-150 words total
   - Each paragraph = 1-2 sentences ONLY
   - If you write more than 200 words, you're doing it wrong

2. **BE RUTHLESSLY CONCISE**
   - Get to the point immediately
   - Cut ALL fluff: "basically", "here's the thing", "the thing is"
   - No introductions like "When it comes to..." or "The main thing to remember..."
   - Just answer the damn question

3. **SCANNABLE FORMAT WITH VISUAL HIERARCHY**
   - Use bullets for lists (3-5 items MAX)
   - Use bold for **key terms** only (2-3 per answer MAX)
   - Add 1-2 emoji section headers to help scanning:
     ⚡ Quick wins | 🎯 Strategy | ✅ Setup | 💡 Examples | 🚫 Avoid
   - Timestamps [MM:SS] only at the end as "References:"

4. **FORBIDDEN PHRASES** (never use these):
   - "When it comes to..."
   - "The main thing to remember..."
   - "Here's the thing..."
   - "Basically..."
   - "The video explains..."
   - "Let me break this down..."

EXAMPLE RESPONSES (MAX 150 WORDS, VISUALLY SCANNABLE):

**Question**: "What's the main strategy for cold emails?"

"Cold emails aren't for selling - they're for starting conversations. Goal is a reply, not a sale.

⚡ **Quick wins:**
- Use soft CTAs like "Would this interest you?"
- Reply within 10 minutes when someone responds
- Keep emails under 100 words

🚫 Never put links in first email (spam trigger).

References: [2:15] [5:30] [8:45]"

**Question**: "How do I optimize my offer?"

"Your offer determines results. Email is just delivery.

🎯 **The approach:**
Test different versions for 2-3 weeks each. Most people quit too early.

Strong offer = less personalization needed. "Hey [Name], saw you're looking for [topic]" works if the offer's good.

References: [12:10] [15:20]"

**Question**: "What about deliverability?"

"Send plain text only. Turn off open tracking - it kills deliverability.

✅ **Winning setup:**
- 3-5 inboxes per domain
- 20-30 emails/day max per inbox
- Verify all addresses first

Judge by reply rate, not opens.

References: [18:30] [22:45]"

**Question**: "What's a lead magnet?"

"Free valuable content you offer to get replies.

💡 **Examples:**
- Custom cold email script
- Headline variations for their site
- Keyword list for their niche

Ask "Mind if I send this over?" like it's already prepared. Works great when your main offer isn't converting.

References: [16:35] [17:08] [17:51]"

CRITICAL REMINDERS:

✓ **100-150 WORDS MAX** - Anything longer fails
✓ **3-5 PARAGRAPHS** - Each 1-2 sentences
✓ **NO FLUFF** - Cut intros, cut filler, get to the point
✓ **BULLETS = 3-5 ITEMS** - More is overwhelming
✓ **STRATEGIC EMOJIS** - Use to mark sections for visual scanning:
  - ⚡ Quick wins / Action items
  - 🎯 Main strategy / Approach
  - ✅ Setup / Checklist
  - 💡 Examples / Ideas
  - 🚫 Don't do this / Warnings
  - ⚠️ Important caveats
✓ **TIMESTAMPS AT END** - Group as "References: [MM:SS] [MM:SS]"
✓ **MOBILE-FIRST** - People read on phones

VIDEO CONTEXT (Full Transcript + Visual Analysis):
${videoContext}
${chatHistoryContext}
${personalizedContext ? '\n---\n' + personalizedContext + '\n' : ''}

You are an expert teacher sharing knowledge, NOT someone describing a video.

Be clear, helpful, and conversational.${chatHistoryContext ? (isFrench ? '\n\nContinuez la conversation naturellement, en développant les explications précédentes.' : '\n\nContinue the conversation naturally, building on previous explanations.') : ''}`;

        const promptInstruction = isFrench
          ? 'Répondez naturellement et de manière conversationnelle. Commencez par une réponse claire et directe à la question. IMPORTANT: Ajoutez une ligne vide entre chaque paragraphe et liste.'
          : 'Answer naturally and conversationally. Start with a clear, direct answer to the question. CRITICAL FORMATTING: Write SHORT paragraphs (1-2 sentences each) with a BLANK LINE between each paragraph. Example:\n\nParagraph one is short.\n\nParagraph two is also short.\n\nUse this format!';

        const prompt = `${systemInstruction}\n\nQUESTION: ${userQuestion}\n\n${promptInstruction}`;

        console.log('Sending Q&A query to Gemini...');
        
        // Retry logic for 503 errors (service overloaded)
        let result;
        let response;
        let answer;
        const maxRetries = 5; // Increased from 3 to 5 for better reliability
        let retryCount = 0;
        let lastError;
        
        while (retryCount < maxRetries) {
          try {
            result = await this.model.generateContent(prompt);
            response = await result.response;
            answer = response.text();
            if (answer && answer.trim()) {
              console.log('Q&A response received successfully');
              break; // Success, exit retry loop
            } else {
              throw new Error('Empty response from Gemini');
            }
          } catch (error) {
            lastError = error;
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
              console.log(`Gemini API overloaded (${error.message.includes('503') ? '503' : 'rate limit'}). Retrying in ${Math.floor(waitTime/1000)}s... (attempt ${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            // If not retryable or max retries reached, throw the error
            throw error;
          }
        }

        // Extract citations (timestamps) from the answer BEFORE enhancing readability
        const citationRegex = /\[(\d+):(\d+)\]/g;
        const citations = [];
        let match;
        while ((match = citationRegex.exec(answer)) !== null) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          citations.push(minutes * 60 + seconds);
        }

        console.log('Q&A response generated with', citations.length, 'citations');

        // Remove ALL <cite> tags (including empty ones, with attributes, etc.)
        // This regex matches: <cite>, </cite>, <cite></cite>, <cite> </cite>, <cite ...>, etc.
        // Do this multiple times to catch nested or adjacent tags
        for (let i = 0; i < 3; i++) {
          answer = answer.replace(/<cite[^>]*>[\s]*<\/cite>/gi, ''); // Empty cite tags
          answer = answer.replace(/<cite[^>]*>/gi, ''); // Opening cite tags
          answer = answer.replace(/<\/cite>/gi, ''); // Closing cite tags
        }
        // Clean up any extra whitespace left behind
        answer = answer.replace(/\s{2,}/g, ' '); // Multiple spaces to single space
        answer = answer.replace(/\s+([.,;:!?])/g, '$1'); // Remove space before punctuation
        answer = answer.replace(/([.,;:!?])\s{2,}/g, '$1 '); // Fix spaces after punctuation

        // Enhance readability with better formatting
        answer = this.enhanceReadability(answer, userQuestion);

        // Convert markdown to HTML for frontend rendering
        const htmlAnswer = this.markdownToHtml(answer);

        // Analyze answer for actionable insights
        const insights = this.analyzeInsights(answer, userQuestion);

        // Extract visual context for each citation
        const uniqueCitations = [...new Set(citations)];
        const visualContext = this.extractVisualContextForCitations(uniqueCitations, videoAnalysis);

        console.log('Insights:', insights.tipCount, 'actionable tips found');
        console.log('Visual context:', Object.keys(visualContext).length, 'timestamps with visual data');

        return {
          answer: answer.trim(), // Markdown format
          answerHtml: htmlAnswer, // HTML format for easy rendering
          citations: uniqueCitations,
          visualContext: visualContext, // New: visual context for each citation
          insights: insights, // New: actionable insights analysis
          videoContext: videoContext.substring(0, 500) + '...' // Preview for debugging
        };
      } catch (error) {
        console.error('Error querying Gemini for Q&A:', error);
        
        // Check if it's a 503 error (service overloaded) after all retries
        if (error.message && error.message.includes('503')) {
          const errorMsg = detectedLanguage === 'fr'
            ? '⚠️ **Service temporairement indisponible**\n\nLe service IA est actuellement surchargé. Veuillez réessayer dans quelques instants.\n\nSi cela persiste, le service peut connaître une forte demande.'
            : '⚠️ **Service Temporarily Unavailable**\n\nThe AI service is currently overloaded. Please try again in a few moments.\n\nIf this persists, the service may be experiencing high demand.';
          
          const errorHtml = detectedLanguage === 'fr'
            ? '<p><strong>⚠️ Service temporairement indisponible</strong></p><p>Le service IA est actuellement surchargé. Veuillez réessayer dans quelques instants.</p><p>Si cela persiste, le service peut connaître une forte demande.</p>'
            : '<p><strong>⚠️ Service Temporarily Unavailable</strong></p><p>The AI service is currently overloaded. Please try again in a few moments.</p><p>If this persists, the service may be experiencing high demand.</p>';
          
          return {
            answer: errorMsg,
            answerHtml: errorHtml,
            citations: [],
            visualContext: {},
            insights: {
              hasActionableContent: false,
              tipCount: 0,
              tips: [],
              complexity: 'low'
            },
            videoContext: 'Error: Service unavailable',
            error: true,
            errorType: 'service_unavailable'
          };
        }
        
        // For other errors, return a user-friendly error message
        const errorMsg = detectedLanguage === 'fr'
          ? `❌ **Impossible de traiter la demande**\n\nUne erreur s'est produite lors du traitement de votre question. Veuillez réessayer.\n\n**Détails de l'erreur :** ${error.message || 'Erreur inconnue'}`
          : `❌ **Unable to Process Request**\n\nWe encountered an error while processing your question. Please try again.\n\n**Error details:** ${error.message || 'Unknown error'}`;
        
        const errorHtml = detectedLanguage === 'fr'
          ? `<p><strong>❌ Impossible de traiter la demande</strong></p><p>Une erreur s'est produite lors du traitement de votre question. Veuillez réessayer.</p><p><strong>Détails de l'erreur :</strong> ${error.message || 'Erreur inconnue'}</p>`
          : `<p><strong>❌ Unable to Process Request</strong></p><p>We encountered an error while processing your question. Please try again.</p><p><strong>Error details:</strong> ${error.message || 'Unknown error'}</p>`;
        
        return {
          answer: errorMsg,
          answerHtml: errorHtml,
          citations: [],
          visualContext: {},
          insights: {
            hasActionableContent: false,
            tipCount: 0,
            tips: [],
            complexity: 'low'
          },
          videoContext: `Error: ${error.message}`,
          error: true,
          errorType: 'api_error'
        };
      }
    } else {
      // Mock mode
      return this.getMockAnswer(userQuestion, videoAnalysis, transcript);
    }
  }

  /**
   * Generate smart suggested prompts based on video content
   */
  async generateSuggestedPrompts(videoAnalysis, transcript) {
    this.ensureInitialized();

    // Use Gemini API if available
    if (this.model) {
      try {
        // Build context - use first part of transcript for speed
        let context = '';

        if (transcript && transcript.text) {
          context += 'VIDEO TRANSCRIPT (first 2000 characters):\n';
          context += transcript.text.substring(0, 2000);
        }

        if (videoAnalysis && videoAnalysis.summary) {
          context += '\n\nVIDEO SUMMARY:\n' + videoAnalysis.summary;
        }

        if (videoAnalysis && videoAnalysis.keyMoments && videoAnalysis.keyMoments.length > 0) {
          context += '\n\nKEY MOMENTS:\n';
          videoAnalysis.keyMoments.slice(0, 5).forEach(moment => {
            context += `- ${moment.description}\n`;
          });
        }

        if (!context.trim()) {
          return this.getDefaultPrompts();
        }

        const prompt = `Based on this video content, generate 3-4 smart, specific suggested questions that would be most useful for someone who just watched this video.

REQUIREMENTS:
1. Questions should be SPECIFIC to the actual content (not generic like "what are the key topics")
2. Questions should be ACTIONABLE and help the viewer learn or implement what was taught
3. Use natural language - how real people would ask
4. Mix different types: how-to, explanation, benefits, comparisons
5. Make them concise (5-12 words each)
6. Focus on the most important or interesting parts

EXAMPLES OF GOOD PROMPTS (specific to content):
- "How do I install Claude Code in Cursor?"
- "What makes Opus 4 better than other models?"
- "Is the $100/month pricing worth it?"
- "What are the 3 Facebook ad strategies you mentioned?"

EXAMPLES OF BAD PROMPTS (too generic):
- "What are the main points?"
- "Summarize the video"
- "What should I know?"

VIDEO CONTENT:
${context}

Generate 3-4 suggested questions as a JSON array. Output ONLY valid JSON:
["question 1", "question 2", "question 3"]`;

        console.log('Generating suggested prompts with Gemini...');

        // Retry logic for 503 errors (service overloaded)
        let result;
        let response;
        let promptsText;
        const maxRetries = 3;
        let retryCount = 0;

        while (retryCount < maxRetries) {
          try {
            result = await this.model.generateContent(prompt);
            response = await result.response;
            promptsText = response.text();
            break; // Success, exit retry loop
          } catch (error) {
            // Check if it's a 503 error (service overloaded)
            if (error.message && error.message.includes('503') && retryCount < maxRetries - 1) {
              retryCount++;
              // More conservative exponential backoff with jitter: 3-4s, 6-7s, 12-13s
              const baseDelay = Math.pow(2, retryCount) * 1500;
              const jitter = Math.random() * 1000; // 0-1s random jitter to avoid thundering herd
              const waitTime = baseDelay + jitter;
              console.log(`Gemini API overloaded (503) for prompts. Retrying in ${Math.floor(waitTime/1000)}s... (attempt ${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            // If not 503 or max retries reached, throw the error
            throw error;
          }
        }

        // Extract JSON from response
        const jsonMatch = promptsText.match(/\[[\s\S]*?\]/);
        if (!jsonMatch) {
          console.warn('Failed to parse suggested prompts, using defaults');
          return this.getDefaultPrompts();
        }

        const suggestedPrompts = JSON.parse(jsonMatch[0]);

        if (!Array.isArray(suggestedPrompts) || suggestedPrompts.length === 0) {
          return this.getDefaultPrompts();
        }

        console.log('Generated', suggestedPrompts.length, 'suggested prompts');
        return suggestedPrompts.slice(0, 4); // Max 4 prompts

      } catch (error) {
        console.error('Error generating suggested prompts:', error);
        return this.getDefaultPrompts();
      }
    }

    return this.getDefaultPrompts();
  }

  /**
   * Get default suggested prompts (fallback)
   */
  getDefaultPrompts() {
    return [
      "What are the key points covered?",
      "How do I get started?",
      "What are the main takeaways?"
    ];
  }

  /**
   * Mock answer for development/testing
   */
  getMockAnswer(userQuestion, videoAnalysis, transcript) {
    const lowerQuestion = userQuestion.toLowerCase();
    
    // Try to find relevant information in video analysis
    let answer = 'Based on the video analysis:\n\n';
    let citations = [];

    if (videoAnalysis && videoAnalysis.keyMoments && videoAnalysis.keyMoments.length > 0) {
      const relevantMoment = videoAnalysis.keyMoments.find(m => 
        m.description.toLowerCase().includes(lowerQuestion.split(' ')[0]) ||
        lowerQuestion.includes('key') || lowerQuestion.includes('important')
      );
      
      if (relevantMoment) {
        answer += `Key moment: ${relevantMoment.description} at [${this.secondsToTime(relevantMoment.timestamp)}].\n\n`;
        citations.push(relevantMoment.timestamp);
      }
    }

    if (videoAnalysis && videoAnalysis.summary) {
      answer += `Summary: ${videoAnalysis.summary.substring(0, 200)}...\n\n`;
    }

    if (citations.length === 0 && videoAnalysis && videoAnalysis.keyMoments && videoAnalysis.keyMoments.length > 0) {
      citations.push(videoAnalysis.keyMoments[0].timestamp);
    }

    answer += '\n(Note: This is a mock response. Configure GEMINI_API_KEY for intelligent Q&A.)';

    // Mock insights
    const insights = {
      hasActionableContent: false,
      tipCount: 0,
      tips: [],
      complexity: 'low'
    };

    // Mock visual context
    const visualContext = {};

    // Convert to HTML
    const htmlAnswer = this.markdownToHtml(answer);

    return {
      answer: answer.trim(),
      answerHtml: htmlAnswer,
      citations: citations,
      visualContext: visualContext,
      insights: insights,
      videoContext: 'Mock mode - no real context available'
    };
  }
}



module.exports = new VideoQAService();

