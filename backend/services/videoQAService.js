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

    // Add video metadata first (always available, provides instant context)
    if (videoAnalysis) {
      context += 'VIDEO METADATA:\n';
      if (videoAnalysis.title) context += `Title: ${videoAnalysis.title}\n`;
      if (videoAnalysis.author) context += `Creator: ${videoAnalysis.author}\n`;
      if (videoAnalysis.description) {
        const desc = videoAnalysis.description.length > 500
          ? videoAnalysis.description.substring(0, 500) + '...'
          : videoAnalysis.description;
        context += `Description: ${desc}\n`;
      }
      if (videoAnalysis.duration) context += `Duration: ${Math.floor(videoAnalysis.duration / 60)} minutes\n`;
      if (videoAnalysis.views) context += `Views: ${parseInt(videoAnalysis.views).toLocaleString()}\n`;
      if (videoAnalysis.likes) context += `Likes: ${parseInt(videoAnalysis.likes).toLocaleString()}\n`;
      context += '\n';
    }

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
      context += 'NOTE: Full transcript is being processed. Answers based on video metadata, description, and visual analysis.\n\n';
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

    // CRITICAL: Blank line before emoji section headers (with or without bold)
    // Matches: "text\n⚡ **Title**" OR "text\n⚡ Title"
    enhanced = enhanced.replace(/([^\n])\n([🎯⚡💰🚀⚠️✅❌💡🔥🚫]\s+)/g, '$1\n\n$2');

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
          trimmed.match(/^Références?:/i) ||
          trimmed.match(/^[🎯⚡💰🚀⚠️✅❌💡🔥🚫]\s+/)) {  // Skip emoji-prefixed sections (with or without bold)
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

    // Ensure blank line before "References:" or "Références:" if not already present
    enhanced = enhanced.replace(/([^\n])\n(Références?:)/gi, '$1\n\n$2');

    // Remove duplicate reference headers (Gemini sometimes adds both "Références:" and "References:")
    // Keep only the first one (French if present, otherwise English)
    const hasFrenchRef = /Références:/i.test(enhanced);
    const hasEnglishRef = /References:/i.test(enhanced);
    if (hasFrenchRef && hasEnglishRef) {
      // Remove ALL "References:" lines (keep "Références:" for French)
      enhanced = enhanced.replace(/\n+References:\s*/gi, '\n');
      // Clean up any double newlines created
      enhanced = enhanced.replace(/\n{3,}/g, '\n\n');
    }

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
   * CRITICAL: Prioritize user question over transcript for immediate language context
   */
  detectLanguage(transcript, userQuestion) {
    // Check if language is explicitly provided
    if (transcript && transcript.language) {
      return transcript.language;
    }

    // PRIORITY 1: Analyze user question FIRST (most immediate indicator)
    // If user asks in French, respond in French - regardless of transcript language
    if (userQuestion && userQuestion.trim()) {
      const questionLanguage = this._detectLanguageFromText(userQuestion);
      // If French is detected in question with reasonable confidence, use it
      if (questionLanguage === 'fr') {
        return 'fr';
      }
    }

    // PRIORITY 2: Fallback to transcript language if question is ambiguous/English
    // Use first 500 words of transcript for faster detection
    const transcriptSample = transcript?.text ? transcript.text.split(' ').slice(0, 500).join(' ') : '';
    const textToAnalyze = (transcriptSample || userQuestion || '').toLowerCase();

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
   * Helper: Detect language from a specific text string (used for user questions)
   * This is MORE AGGRESSIVE than the main detectLanguage to catch French questions
   */
  _detectLanguageFromText(text) {
    if (!text || !text.trim()) {
      return 'en';
    }

    const lowerText = text.toLowerCase().trim();

    // ULTRA-PRIORITY: French question inversion pattern (100% French-specific)
    // Patterns like "travaille-t-il", "est-ce", "a-t-il", etc.
    if (/\w+-t-(il|elle|on)\b/gi.test(lowerText) || /est-ce\b/gi.test(lowerText)) {
      return 'fr';
    }

    // CRITICAL: French-specific words that are NEVER used in English
    // These are ultra-high confidence indicators
    const frenchExclusiveWords = [
      // Question words
      /\b(quel|quelle|quels|quelles|où|combien|pourquoi)\b/gi,
      // Common verbs (conjugated forms that don't exist in English)
      /\b(sert|marche|démarrer|préféré|utiliser|dévoile|retirer|travaille|travaillé|commence|commencé|parle|parlé|donne|donné)\b/gi,
      // Possessives
      /\b(son|sa|ses|ton|ta|tes)\b/gi,
      // Articles with accents
      /\b(à|ça|là)\b/gi,
      // Common French adverbs
      /\b(actuellement|notamment|vraiment|surtout|également|particulièrement)\b/gi,
      // Common French nouns
      /\b(projet|travail|chose|monde|temps|fois|vie)\b/gi
    ];

    // Check for French-exclusive words (instant FR detection)
    for (const pattern of frenchExclusiveWords) {
      if (pattern.test(lowerText)) {
        return 'fr';
      }
    }

    // Check contractions (strong French indicator)
    const frenchContractions = /c'est|c'était|qu'est|qu'il|qu'elle|qu'on|d'accord|d'ailleurs|j'ai|j'avais|l'on|l'autre|n'est|n'ont|s'il|t'as|m'a/gi;
    if (frenchContractions.test(lowerText)) {
      return 'fr';
    }

    // For short texts (typical questions), check for ANY French indicators
    if (lowerText.length < 100) {
      const shortTextFrenchWords = /\b(le|la|les|un|une|des|est|sont|pour|dans|sur|avec|qui|que|quel|quoi|comment)\b/gi;
      const matches = lowerText.match(shortTextFrenchWords);
      // If we find 2+ French words in a short question, it's French
      if (matches && matches.length >= 2) {
        return 'fr';
      }
    }

    return 'en';
  }

  /**
   * Detect if the question is asking for a numbered list/enumeration
   */
  isEnumerationQuestion(question) {
    const lowerQuestion = question.toLowerCase();

    // English patterns
    const englishPatterns = [
      /\b(list|give me|show me|what are)\s+(the\s+)?(\d+|all|top|best)\s+/i,
      /\btop\s+\d+\b/i,
      /\ball\s+\d+\b/i,
      /\b\d+\s+(things|items|ways|steps|tips|strategies|businesses|ideas|points)\b/i,
    ];

    // French patterns
    const frenchPatterns = [
      /\b(donne|donnes|liste|montre|quels sont|quelles sont)\s+(moi\s+)?(les\s+)?(\d+|tous|toutes|meilleurs|meilleures)\s+/i,
      /\btop\s+\d+\b/i,
      /\b\d+\s+(choses|éléments|façons|étapes|conseils|stratégies|business|idées|points)\b/i,
      /\bà\s+lancer\b/i, // "businesses to launch"
    ];

    const allPatterns = [...englishPatterns, ...frenchPatterns];

    return allPatterns.some(pattern => pattern.test(lowerQuestion));
  }

  /**
   * Extract the number of items requested (if any)
   */
  extractItemCount(question) {
    const match = question.match(/\b(\d+)\s+/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Answer a question about the video using Gemini
   */
  async answerQuestion(userQuestion, videoAnalysis, transcript, chatHistory = null, personalizedContext = '', userLanguage = null) {
    this.ensureInitialized();

    // Detect language from transcript, user question, or use provided language
    const detectedLanguage = userLanguage || this.detectLanguage(transcript, userQuestion);
    console.log('Detected language for Q&A:', detectedLanguage);

    // Detect if this is an enumeration question
    const isEnumeration = this.isEnumerationQuestion(userQuestion);
    const itemCount = this.extractItemCount(userQuestion);
    console.log('Question type:', isEnumeration ? `Enumeration (${itemCount || 'multiple'} items)` : 'Explanation');

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

        // Build format-specific instructions based on question type
        const formatInstructions = isEnumeration ? `
🚨 ENUMERATION QUESTION DETECTED - CRITICAL NUMBERED LIST FORMATTING:

The user wants a NUMBERED LIST. You MUST number EVERY SINGLE ITEM from 1 to ${itemCount || 'N'}.

⚠️ ABSOLUTE RULES - FAILURE = REJECTED RESPONSE:

1. **EVERY ITEM MUST BE NUMBERED**
   - Item 1 starts with "1."
   - Item 2 starts with "2."
   - Item 3 starts with "3."
   - Continue until ${itemCount || 'last item'}
   - NEVER skip numbers or use bullet points

2. **EXACT FORMAT FOR EACH ITEM**
   Format: "NUMBER. **Title**: Description in 15-25 words."

   Example:
   1. **Agence d'automatisation**: Créer des agents IA pour automatiser...
   2. **AI Drop Servicing**: Vendre des services réalisés par IA...
   3. **E-commerce**: Développer une marque propre sur TikTok...

   ❌ WRONG: Bold title without number
   ❌ WRONG: Using bullets (-, *)
   ✅ CORRECT: "1. **Title**: Description"

3. **STRUCTURE**
   - Optional: 1-sentence intro
   - Then: Numbered list with ALL ${itemCount || ''} items (1., 2., 3., ...)
   - End: "Références: [timestamps]"

4. **TOTAL LENGTH**
   - ${itemCount ? itemCount * 25 : 250}-${itemCount ? itemCount * 40 : 400} words allowed
   - Descriptions: 15-25 words each
   - NO paragraphs between items` : `
🚨 EXPLANATION QUESTION - CONCISE FORMAT:

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
   - "Let me break this down..."`;

        // Build examples based on question type
        const exampleResponses = isEnumeration ? `
EXAMPLE ENUMERATION RESPONSES:

${isFrench ? `**Question**: "Donne moi les 10 business à lancer en 2026"

Voici les 10 meilleurs business à lancer en 2026 :

1. **Agence d'automatisation (AAA)**: Créer des agents IA pour automatiser les tâches répétitives des entreprises, en forte demande.

2. **AI Drop Servicing**: Vendre des services (sites web, logos, design) entièrement réalisés par des intelligences artificielles.

3. **E-commerce de niche**: Développer une marque propre sur des plateformes comme TikTok Shop ou Shopify avec des produits ciblés.

4. **Closer/Commercial**: Vendre pour d'autres entreprises en prenant des commissions élevées sur les ventes closes.

5. **Coaching et formation**: Monétiser son expertise en créant des programmes de formation en ligne pour débutants.

6. **Consultant indépendant**: Transformer son travail actuel en activité freelance avec des clients multiples pour plus de revenus.

7. **Application mobile SaaS**: Développer une app qui résout un problème spécifique et facture un abonnement mensuel.

8. **Création de contenu**: Monétiser une audience sur YouTube, TikTok ou Instagram via sponsorings et produits digitaux.

9. **Logiciel SaaS B2B**: Créer un outil logiciel pour entreprises avec un modèle d'abonnement récurrent.

10. **Business physique local**: Ouvrir un commerce de proximité (café, service, boutique) dans un quartier en croissance.

Références: [0:45] [3:12] [7:28] [11:50]` : `**Question**: "Give me the top 5 AI tools for content creation"

Here are the top 5 AI tools for content creation in 2026:

1. **Jasper AI**: Best for long-form blog content and SEO-optimized articles with brand voice customization.

2. **Midjourney v6**: Leading AI image generator for ultra-realistic visuals and creative artwork in seconds.

3. **Descript**: All-in-one video editor with AI transcription, voice cloning, and automatic filler word removal.

4. **ChatGPT Plus**: Most versatile for brainstorming, scripting, and research with real-time web access.

5. **Eleven Labs**: Industry-leading voice synthesis for podcasts, audiobooks, and video voiceovers with natural emotion.

References: [1:22] [4:15] [8:30] [12:45]`}

🚨 CRITICAL REQUIREMENTS FOR ENUMERATION:
- ✅ EVERY item MUST be numbered (1., 2., 3., ... ${itemCount || '10'})
- ✅ Format: "NUMBER. **Title**: Brief description"
- ✅ List ALL ${itemCount || ''} items - NO exceptions
- ✅ Each description: 15-25 words
- ✅ NO blank lines between numbered items
- ✅ End with "Références:" or "References:"

❌ ABSOLUTELY FORBIDDEN:
- Using bold titles WITHOUT numbers
- Skipping numbers (e.g., 1., 3., 5.)
- Using bullets (-, *) instead of numbers
- Listing only some items and saying "and others"` : `
EXAMPLE EXPLANATION RESPONSES (MAX 150 WORDS):

${isFrench ? `**Question**: "Quel logiciel utiliser ?"

Pour créer des agents IA sans coder, utilisez **N8N**. C'est la plateforme recommandée pour les débutants.

✅ **Configuration:**
- Organisez vos créations en projets
- Utilisez des flux visuels simples
- Intégrez des modèles comme OpenAI

💡 L'agent peut lire des données Airtable ou envoyer des emails via Gmail.

Références: [1:18] [2:40] [5:29]` : `**Question**: "What's the main strategy for cold emails?"

Cold emails aren't for selling - they're for starting conversations. Goal is a reply, not a sale.

⚡ **Quick wins:**
- Use soft CTAs like "Would this interest you?"
- Reply within 10 minutes when someone responds
- Keep emails under 100 words

🚫 Never put links in first email (spam trigger).

References: [2:15] [5:30] [8:45]`}

KEY FOR EXPLANATIONS:
- 100-150 words max
- 3-5 short paragraphs
- Use emojis for sections
- Bullets only for 3-5 key points`;

        const systemInstruction = `You are a helpful expert teaching directly from this content. Be CONCISE and SCANNABLE - people read on phones.
${languageInstruction}

${formatInstructions}

${exampleResponses}

CRITICAL FINAL REMINDERS:
✓ **ALWAYS INCLUDE CITATIONS** - Every answer MUST end with References/Références
✓ **BLANK LINES** - Add blank line before and after emoji sections
✓ **MOBILE-FIRST** - Keep it scannable

VIDEO CONTEXT (Full Transcript + Visual Analysis):
${videoContext}
${chatHistoryContext}
${personalizedContext ? '\n---\n' + personalizedContext + '\n' : ''}

You are an expert teacher sharing knowledge, NOT someone describing a video.

Be clear, helpful, and conversational.${chatHistoryContext ? (isFrench ? '\n\nContinuez la conversation naturellement, en développant les explications précédentes.' : '\n\nContinue the conversation naturally, building on previous explanations.') : ''}`;

        // Build prompt instruction based on question type
        const promptInstruction = isEnumeration
          ? (isFrench
              ? `🚨 CRITICAL: This is a NUMBERED LIST question. You MUST format like this:

Optional intro sentence.

1. **Premier business**: Description en 15-25 mots.
2. **Deuxième business**: Description en 15-25 mots.
3. **Troisième business**: Description en 15-25 mots.
...continue jusqu'à ${itemCount || 'N'}...

Références: [timestamps]

⚠️ EVERY item MUST start with its NUMBER (1., 2., 3., etc.). DO NOT skip numbers!`
              : `🚨 CRITICAL: This is a NUMBERED LIST question. You MUST format like this:

Optional intro sentence.

1. **First item**: Description in 15-25 words.
2. **Second item**: Description in 15-25 words.
3. **Third item**: Description in 15-25 words.
...continue to ${itemCount || 'N'}...

References: [timestamps]

⚠️ EVERY item MUST start with its NUMBER (1., 2., 3., etc.). DO NOT skip numbers!`)
          : (isFrench
              ? 'Répondez naturellement et de manière conversationnelle. FORMATAGE: Paragraphes COURTS (1-2 phrases) avec une LIGNE VIDE entre chaque. Utilisez des emojis pour les sections. Terminez par "Références: [timestamps]"'
              : 'Answer naturally and conversationally. FORMATTING: SHORT paragraphs (1-2 sentences) with a BLANK LINE between each. Use emojis for sections. End with "References: [timestamps]"');

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
        // Build context - use metadata, transcript, and analysis
        let context = '';

        // Add metadata first (always available for instant prompts)
        if (videoAnalysis) {
          if (videoAnalysis.title) context += `VIDEO TITLE: ${videoAnalysis.title}\n`;
          if (videoAnalysis.description) {
            context += `VIDEO DESCRIPTION: ${videoAnalysis.description.substring(0, 500)}\n`;
          }
        }

        if (transcript && transcript.text) {
          context += '\nVIDEO TRANSCRIPT (first 2000 characters):\n';
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

  /**
   * Answer question for full channel (NEW - for channel feature)
   * @param {string} channelId - Channel ID
   * @param {string} question - User question
   * @param {Array} conversationHistory - Previous Q&A exchanges
   * @returns {Promise<Object>} Answer with citations from multiple videos
   */
  async answerQuestionForChannel(channelId, question, conversationHistory = [], userLanguage = null) {
    console.log(`[VideoQAService] Answering channel question: "${question}"`);

    this.ensureInitialized();

    // 1. Search relevant videos in channel
    const relevantVideos = await this.searchRelevantVideos(channelId, question);

    if (relevantVideos.length === 0) {
      // Detect language for error message
      const detectedLanguage = userLanguage || this.detectLanguage('', question);
      const errorMessage = detectedLanguage === 'fr'
        ? "Je n'ai pas trouvé de vidéos dans cette chaîne qui traitent de ce sujet. Pourriez-vous reformuler votre question?"
        : "I couldn't find any videos in this channel that discuss that topic. Could you try rephrasing your question?";

      return {
        answer: errorMessage,
        sources: [],
        videosAnalyzed: 0
      };
    }

    console.log(`[VideoQAService] Found ${relevantVideos.length} relevant videos`);

    // 2. Fetch transcripts on-demand for videos that need them
    await this.fetchTranscriptsForVideos(channelId, relevantVideos);

    // 3. Detect language from videos and question
    const videoTranscripts = relevantVideos
      .filter(v => v.transcript)
      .map(v => {
        // Handle both transcript object and plain text
        if (typeof v.transcript === 'object' && v.transcript.text) {
          return v.transcript.text;
        }
        return v.transcript || '';
      })
      .join(' ')
      .substring(0, 1000); // Sample from transcripts

    const detectedLanguage = userLanguage || this.detectLanguage(videoTranscripts, question);
    console.log('Detected language for channel Q&A:', detectedLanguage);

    // 4. Build context from relevant videos
    const context = this.buildContextFromVideos(relevantVideos, question);

    // 5. Generate AI response
    const prompt = this.buildChannelPrompt(question, context, conversationHistory, detectedLanguage);

    try {
      if (!this.model) {
        return this.generateMockChannelResponse(question, relevantVideos);
      }

      // Use system instruction for more consistent formatting
      const modelWithSystem = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: `You are a professional content analyst who extracts actionable insights from YouTube videos.

YOUR GOAL: Provide detailed, comprehensive, actionable answers using the transcript content.

FORMATTING RULES (apply to your detailed content):
1. Use ## headings to organize main topics
2. Use **bold** for subcategories within topics
3. Use bullet points (-) for each specific tip or action item
4. Provide 3-5 bullet points under each subcategory
5. Each bullet should be a complete, detailed sentence with specific advice
6. Include concrete steps, techniques, and examples from the transcripts

IMPORTANT: Provide FULL detailed answers with ALL the actionable content. The formatting is to organize the content, NOT to limit it.

${detectedLanguage === 'fr' ? 'Répondez TOUJOURS en français avec des réponses détaillées et complètes.' : 'Always respond in English with detailed, complete answers.'}`,
        generationConfig: {
          temperature: 0.7, // Balanced creativity for detailed responses
          maxOutputTokens: 8192, // Allow long, comprehensive answers
          topP: 0.95,
          topK: 40
        }
      });

      const result = await modelWithSystem.generateContent(prompt);
      const response = await result.response;
      const answer = response.text();

      // 4. Build sources from relevant videos (all videos with transcripts contributed)
      const sources = relevantVideos
        .filter(v => v.transcript) // Only videos with transcripts
        .map(v => ({
          videoId: v.videoId,
          videoTitle: v.title,
          thumbnailUrl: v.thumbnailUrl,
          publishedAt: v.publishedAt,
          viewCount: v.viewCount,
          url: `https://www.youtube.com/watch?v=${v.videoId}`
        }));

      return {
        answer: answer,
        sources: sources,
        videosAnalyzed: relevantVideos.length
      };
    } catch (error) {
      console.error('[VideoQAService] Error generating channel answer:', error);
      throw error;
    }
  }

  /**
   * Fetch transcripts on-demand for videos that need them
   * Updates videos in place with fetched transcripts
   */
  async fetchTranscriptsForVideos(channelId, videos) {
    const channelTranscriptService = require('./channelTranscriptService');
    const { getFirestore } = require('../config/firestore');
    const { firestore, useMockMode } = getFirestore();

    // Find videos that need transcripts (status: 'metadata_only' or no transcript)
    const videosNeedingTranscripts = videos.filter(v =>
      v.status === 'metadata_only' || !v.transcript
    );

    if (videosNeedingTranscripts.length === 0) {
      console.log('[VideoQAService] All relevant videos already have transcripts');
      return;
    }

    // SIMPLE STRATEGY: Limit to max 3 videos per query for cost control
    // Users get fast, accurate answers without waiting for all videos
    const maxVideosToTranscribe = 3;
    const videosToTranscribe = videosNeedingTranscripts.slice(0, maxVideosToTranscribe);

    if (videosNeedingTranscripts.length > maxVideosToTranscribe) {
      console.log(`[VideoQAService] Limiting to top ${maxVideosToTranscribe} videos (out of ${videosNeedingTranscripts.length})`);
    }

    console.log(`[VideoQAService] 📝 Fetching transcripts for ${videosToTranscribe.length} videos (Innertube only)...`);

    // Use Innertube caption scraper (fast, free)
    const youtubeInnertubeService = require('./youtubeInnertubeService');

    // Circuit breaker: Stop trying audio transcription if it fails due to bot detection
    let audioTranscriptionBlocked = false;

    // Fetch transcripts one by one
    for (const video of videosToTranscribe) {
      try {
        console.log(`[VideoQAService] Fetching: ${video.title} (${video.videoId})`);

        // Try Innertube caption scraping (fast, free, works for 70-80% of videos)
        let transcriptResult = await youtubeInnertubeService.fetchTranscript(video.videoId);

        // DISABLED: Audio transcription fallback (causes YouTube bot detection)
        // If you need audio transcription, enable auto-captions in YouTube Studio
        // or contact support for alternative solutions
        if (!transcriptResult.success) {
          console.log(`[VideoQAService] ⚠️ No captions available for ${video.videoId}`);
          console.log(`[VideoQAService] Recommendation: Enable auto-captions in YouTube Studio for this video`);
        }

        if (transcriptResult.success) {
          const source = transcriptResult.source || 'youtube-innertube';
          console.log(`[VideoQAService] ✓ Transcript fetched via ${source} (${transcriptResult.text.length} chars)`);

          // Update video object in array (for immediate use)
          video.transcript = transcriptResult.text;
          video.transcriptSegments = transcriptResult.segments; // Include segments for timestamps
          video.status = 'ready';

          // Save to Firestore (cached forever - subsequent queries are FREE)
          if (!useMockMode && firestore) {
            const videoRef = firestore.collection('channels')
              .doc(channelId)
              .collection('videos')
              .doc(video.videoId);

            await videoRef.update({
              transcript: transcriptResult.text,
              transcriptSegments: transcriptResult.segments, // Store segments for future queries
              status: 'ready',
              transcriptSource: source,
              transcriptLanguage: transcriptResult.language || 'en',
              transcriptWordCount: transcriptResult.wordCount || 0,
              transcriptCost: source === 'youtube-innertube' ? 0 : 0.15,
              transcriptFetchedAt: new Date().toISOString()
            });

            console.log(`[VideoQAService] ✓ Transcript cached to Firestore for ${video.videoId}`);
          }
        } else {
          console.log(`[VideoQAService] ✗ Transcript fetch failed for ${video.videoId}: ${transcriptResult.error}`);
          video.status = 'transcription_failed';

          if (!useMockMode && firestore) {
            const videoRef = firestore.collection('channels')
              .doc(channelId)
              .collection('videos')
              .doc(video.videoId);

            await videoRef.update({
              status: 'transcription_failed',
              transcriptError: transcriptResult.error,
              transcriptAttemptedAt: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        console.error(`[VideoQAService] Error transcribing ${video.videoId}:`, error.message);
        video.status = 'error';
      }
    }

    const successCount = videosNeedingTranscripts.filter(v => v.status === 'ready').length;
    console.log(`[VideoQAService] ✓ Fetched ${successCount}/${videosNeedingTranscripts.length} transcripts successfully`);
  }

  /**
   * Search for relevant videos in channel
   */
  async searchRelevantVideos(channelId, question) {
    const { getFirestore } = require('../config/firestore');
    const { mockChannels } = require('./channelService');
    const { firestore, useMockMode } = getFirestore();

    console.log(`[VideoQAService] Searching videos for: "${question}"`);

    let videos = [];

    // Get all videos in channel (including those with metadata-only, no transcript yet)
    if (useMockMode || !firestore) {
      const channel = mockChannels.get(channelId);
      if (channel && channel.videos) {
        videos = Array.from(channel.videos.values());
      }
    } else {
      // Get ALL videos (not just status='ready') since we support metadata-based Q&A
      const videosSnapshot = await firestore.collection('channels')
        .doc(channelId)
        .collection('videos')
        .get();

      videos = videosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    // Filter out error videos
    videos = videos.filter(v => v.status !== 'error');

    // Simple keyword-based relevance scoring
    const scoredVideos = videos.map(video => ({
      ...video,
      relevanceScore: this.calculateVideoRelevance(video, question)
    }));

    // Sort by relevance and return top 10
    const topVideos = scoredVideos
      .filter(v => v.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);

    console.log(`[VideoQAService] Top videos:`,
      topVideos.map(v => `${v.title} (score: ${v.relevanceScore})`)
    );

    return topVideos;
  }

  /**
   * Calculate relevance score for video
   */
  calculateVideoRelevance(video, question) {
    const questionLower = question.toLowerCase();
    const questionWords = questionLower.split(/\s+/).filter(w => w.length > 3);

    let score = 0;

    // Check title (heavily weighted - metadata always available)
    const titleLower = (video.title || '').toLowerCase();
    questionWords.forEach(word => {
      if (titleLower.includes(word)) {
        score += 5; // Title matches are weighted heavily
      }
    });

    // Check description (medium weight - metadata always available)
    if (video.description) {
      const descriptionLower = video.description.toLowerCase();
      questionWords.forEach(word => {
        if (descriptionLower.includes(word)) {
          score += 2; // Description matches are moderately weighted
        }
      });
    }

    // Check transcript (if available - bonus points)
    if (video.transcript) {
      const transcriptLower = video.transcript.toLowerCase();
      questionWords.forEach(word => {
        const matches = (transcriptLower.match(new RegExp(word, 'g')) || []).length;
        score += Math.min(matches, 10); // Cap at 10 matches per word
      });
    }

    // Boost popular videos (views, likes, comments)
    if (video.viewCount) {
      const views = parseInt(video.viewCount) || 0;
      if (views > 100000) score += 2;
      else if (views > 50000) score += 1;
    }

    // Boost recent videos slightly
    if (video.publishedAt) {
      const publishDate = video.publishedAt.toDate ? video.publishedAt.toDate() : new Date(video.publishedAt);
      const ageInDays = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays < 90) {
        score *= 1.2; // 20% boost for videos < 3 months old
      }
    }

    return score;
  }

  /**
   * Build context from relevant videos
   */
  buildContextFromVideos(videos, question) {
    let videosWithTranscripts = 0;
    let videosWithoutTranscripts = 0;

    const contextParts = videos.map((video, index) => {
      const publishDate = video.publishedAt?.toDate ? video.publishedAt.toDate() : new Date(video.publishedAt);
      const stats = [];

      if (video.viewCount) stats.push(`${parseInt(video.viewCount).toLocaleString()} views`);
      if (video.likeCount) stats.push(`${parseInt(video.likeCount).toLocaleString()} likes`);
      if (video.commentCount) stats.push(`${parseInt(video.commentCount).toLocaleString()} comments`);

      let contextPart = `
VIDEO ${index + 1}: "${video.title}"
Video ID: ${video.videoId}
Published: ${publishDate.toLocaleDateString()}
Duration: ${Math.floor(video.duration / 60)} minutes
${stats.length > 0 ? `Stats: ${stats.join(', ')}` : ''}`;

      // Add description (always available metadata)
      if (video.description) {
        const descriptionPreview = video.description.length > 300
          ? video.description.substring(0, 300) + '...'
          : video.description;
        contextPart += `\nDescription: ${descriptionPreview}`;
      }

      // Add full transcript if available (on-demand fetched or previously cached)
      const hasTranscript = video.status === 'ready' && video.transcript;

      if (hasTranscript) {
        videosWithTranscripts++;

        // Get transcript text
        const transcriptText = typeof video.transcript === 'object' && video.transcript.text
          ? video.transcript.text
          : video.transcript;

        // Extract relevant segments from transcript
        const relevantSegments = this.extractRelevantSegments(
          transcriptText,
          video.transcriptSegments,
          question,
          15 // Increased: Max 15 segments per video for richer context
        );

        console.log(`[VideoQAService] Video "${video.title}": ${relevantSegments.length} relevant segments found`);

        if (relevantSegments.length > 0) {
          contextPart += `\n\nMost relevant transcript segments:\n${relevantSegments
            .filter(seg => seg && seg.text)
            .map(seg => `[${this.secondsToTime(seg.start)}] ${seg.text}`)
            .join('\n')}`;
        } else {
          // If no relevant segments found, include substantial portion of transcript
          const transcriptPreview = transcriptText.length > 2000
            ? transcriptText.substring(0, 2000) + '...'
            : transcriptText;
          contextPart += `\n\nFull transcript excerpt:\n${transcriptPreview}`;
          console.log(`[VideoQAService] Video "${video.title}": No specific segments, using ${transcriptPreview.length} chars of transcript`);
        }
      } else {
        videosWithoutTranscripts++;

        if (video.status === 'no_captions') {
          contextPart += `\n\n(Note: No captions available for this video. Insights based on title and description only)`;
        } else if (video.status === 'metadata_only') {
          contextPart += `\n\n(Note: Transcript not fetched yet. Insights based on metadata only)`;
        }
      }

      return contextPart;
    });

    console.log(`[VideoQAService] Context built: ${videosWithTranscripts} videos with transcripts, ${videosWithoutTranscripts} without`);

    return contextParts.join('\n---\n');
  }

  /**
   * Extract relevant segments from transcript
   */
  extractRelevantSegments(transcript, segments, question, maxSegments = 5) {
    if (!segments || segments.length === 0) {
      // Fallback: split transcript into chunks if no segments
      if (transcript) {
        const words = transcript.split(' ');
        const chunkSize = 50;
        const chunks = [];
        for (let i = 0; i < words.length; i += chunkSize) {
          chunks.push({
            start: i * 2, // Approximate timing
            text: words.slice(i, i + chunkSize).join(' ')
          });
        }
        segments = chunks;
      } else {
        return [];
      }
    }

    const questionLower = question.toLowerCase();
    const questionWords = questionLower.split(/\s+/).filter(w => w.length > 3);

    // Filter out invalid segments and score each segment
    const scoredSegments = segments
      .filter(segment => segment && segment.text && typeof segment.text === 'string')
      .map(segment => ({
        ...segment,
        score: this.calculateSegmentRelevance(segment.text, questionWords)
      }));

    // Return top segments
    return scoredSegments
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSegments);
  }

  /**
   * Calculate segment relevance
   */
  calculateSegmentRelevance(text, questionWords) {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    const textLower = text.toLowerCase();
    let score = 0;

    questionWords.forEach(word => {
      if (textLower.includes(word)) {
        score += 1;
      }
    });

    return score;
  }

  /**
   * Build prompt for channel Q&A
   */
  buildChannelPrompt(question, context, conversationHistory, language = 'en') {
    const historyContext = conversationHistory.length > 0
      ? `\nPrevious conversation:\n${conversationHistory.map(msg =>
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n')}`
      : '';

    // Language-specific instructions
    const isFrench = language === 'fr';
    const languageInstruction = isFrench
      ? `IMPORTANT: L'utilisateur parle français. Répondez TOUJOURS en français, même si le contenu des vidéos est en anglais. Traduisez les informations nécessaires.`
      : `IMPORTANT: Always respond in English.`;

    const formatExample = `
**REQUIRED FORMAT EXAMPLE** (provide THIS level of detail):

## Main Category

**Subcategory or Strategy**
- First concrete actionable tip with full explanation of how to implement it
- Second specific tip including details, context, and examples from the videos
- Third tip explaining the complete approach and why it works
- Fourth tip with step-by-step guidance
- Fifth tip with practical implementation advice

**Another Subcategory**
- Detailed actionable advice with context and reasoning
- Specific technique or method with implementation steps
- Clear guidance with real examples from the transcript
- Additional tips and variations mentioned in the content

## Another Main Category

**Specific Area**
- Concrete step-by-step guidance with full details
- Practical tips from the content with explanation
- Real examples and techniques mentioned in videos
- Additional strategies and approaches discussed`;

    const instructions = isFrench
      ? `⚠️ Instructions CRITIQUES - VOUS DEVEZ SUIVRE CES RÈGLES:

🚫 NE JAMAIS FAIRE CECI (réponse incomplète):
## Sujet Principal
**Sous-catégorie**

✅ TOUJOURS FAIRE CECI (réponse complète):
## Sujet Principal
**Sous-catégorie**
- Premier point détaillé expliquant la technique spécifique avec des exemples de la vidéo
- Deuxième point avec des étapes détaillées et des conseils d'implémentation pratiques
- Troisième point décrivant l'approche complète et pourquoi elle fonctionne
- Quatrième point avec des exemples concrets et des chiffres/données des transcriptions

RÈGLES OBLIGATOIRES:
1. PRIORITÉ ABSOLUE: Extrayez TOUS les insights, étapes, et conseils actionnables des transcriptions complètes
2. Fournissez des réponses COMPLÈTES et DÉTAILLÉES avec 4-6 PUCES COMPLÈTES par sous-catégorie
3. Chaque puce DOIT être une phrase complète avec des détails spécifiques du contenu
4. NE JAMAIS produire juste des titres - TOUJOURS inclure les puces détaillées
5. Si vous produisez seulement des titres sans puces, vous avez ÉCHOUÉ

FORMATAGE (pour organiser votre contenu détaillé):
- Utilisez ## pour les catégories principales
- Utilisez ** pour les sous-catégories
- 4-6 puces (-) détaillées sous CHAQUE sous-catégorie
- Chaque puce = phrase complète avec explication et exemples
${formatExample}

6. Synthétisez les informations de plusieurs vidéos pour des réponses complètes
7. Votre réponse DOIT faire 500+ mots avec tous les détails actionnables`
      : `⚠️ CRITICAL Instructions - YOU MUST FOLLOW THESE RULES:

🚫 NEVER DO THIS (incomplete response):
## Main Topic
**Subcategory**

✅ ALWAYS DO THIS (complete response):
## Main Topic
**Subcategory**
- First detailed point explaining the specific technique with examples from the video
- Second point with step-by-step guidance and practical implementation advice
- Third point describing the complete approach and why it works
- Fourth point with real-world examples and specific numbers/data from transcripts

MANDATORY RULES:
1. TOP PRIORITY: Extract ALL insights, steps, and actionable advice from the full transcripts
2. Provide COMPLETE, DETAILED answers with 4-6 FULL BULLET POINTS per subcategory
3. Each bullet point MUST be a complete sentence with specific details from the content
4. NEVER output just headings - ALWAYS include the detailed bullet points
5. If you only output headings without bullet points, you have FAILED

FORMATTING (to organize your detailed content):
- Use ## for main categories
- Use ** for subcategories
- 4-6 detailed bullet points (-) under EVERY subcategory
- Each bullet = complete sentence with explanation and examples
${formatExample}

6. Synthesize information across multiple videos for comprehensive answers
7. Your response MUST be 500+ words with full actionable details`;

    const finalPrompt = isFrench
      ? `Réponse en français:`
      : `Answer:`;

    return `You are an AI assistant helping users understand content from a YouTube channel. You have access to video metadata (titles, descriptions, statistics) and transcripts when available.

${languageInstruction}

${historyContext}

Here are the most relevant videos for the current question:

${context}

User question: ${question}

${instructions}

${finalPrompt}`;
  }

  /**
   * Extract citations from AI answer
   */
  extractChannelCitations(answer, videos) {
    const citations = [];

    // Look for timestamp patterns like [12:34] or (12:34)
    const timestampPattern = /[\[\(](\d{1,2}):(\d{2})[\]\)]/g;
    const matches = Array.from(answer.matchAll(timestampPattern));

    for (const match of matches) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const timestamp = minutes * 60 + seconds;

      // Use first video as default (improve this with better matching)
      const video = videos[0];

      citations.push({
        videoId: video.videoId,
        videoTitle: video.title,
        timestamp: timestamp,
        formattedTimestamp: `${minutes}:${seconds.toString().padStart(2, '0')}`
      });
    }

    return citations;
  }

  /**
   * Generate mock response for channel Q&A (when no API key)
   */
  generateMockChannelResponse(question, relevantVideos) {
    let answer = `Based on ${relevantVideos.length} videos in this channel, here's what I found:\n\n`;

    relevantVideos.slice(0, 3).forEach((video, index) => {
      answer += `${index + 1}. **${video.title}**\n`;
      if (video.transcript) {
        const snippet = video.transcript.substring(0, 150);
        answer += `   ${snippet}...\n\n`;
      }
    });

    answer += '\n(Note: This is a mock response. Configure GEMINI_API_KEY for intelligent multi-video Q&A.)';

    return {
      answer: answer,
      sources: relevantVideos.slice(0, 3).map(v => ({
        videoId: v.videoId,
        videoTitle: v.title,
        timestamp: 0,
        formattedTimestamp: '0:00'
      })),
      videosAnalyzed: relevantVideos.length
    };
  }
}



module.exports = new VideoQAService();

