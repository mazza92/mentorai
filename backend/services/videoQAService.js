const { GoogleGenerativeAI } = require('@google/generative-ai');
const { marked } = require('marked');
const { generateText } = require('./llmClient');

// Configure marked for better HTML output
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
  headerIds: false, // Don't add IDs to headers
  mangle: false // Don't escape HTML
});

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
   * Retry mechanism with exponential backoff for API calls
   * Handles 503 Service Unavailable and 429 Rate Limit errors
   * @param {Function} apiCall - Async function to call
   * @param {number} maxRetries - Maximum number of retry attempts (default: 5)
   * @param {number} initialDelay - Initial delay in ms (default: 1000)
   * @returns {Promise<any>} Result from successful API call
   */
  async retryWithBackoff(apiCall, maxRetries = 5, initialDelay = 1000) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Attempt the API call
        const result = await apiCall();

        // If successful, log and return
        if (attempt > 0) {
          console.log(`[VideoQAService] API call succeeded on attempt ${attempt + 1}`);
        }
        return result;

      } catch (error) {
        lastError = error;

        // Check if error is retryable (503 Service Unavailable or 429 Rate Limit)
        const isRetryable = error.message?.includes('503') ||
                           error.message?.includes('overloaded') ||
                           error.message?.includes('429') ||
                           error.message?.includes('rate limit');

        // If not retryable or last attempt, throw immediately
        if (!isRetryable || attempt === maxRetries) {
          console.error(`[VideoQAService] API call failed after ${attempt + 1} attempts:`, error.message);
          throw error;
        }

        // Calculate delay with exponential backoff + jitter
        const baseDelay = initialDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000; // Random jitter 0-1000ms
        const delay = baseDelay + jitter;

        console.log(`[VideoQAService] API overloaded (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${Math.round(delay)}ms...`);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached due to throw above, but just in case
    throw lastError;
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
        const desc = videoAnalysis.description.length > 8000
          ? videoAnalysis.description.substring(0, 8000) + '...'
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
    } else if (transcript && String(transcript.text || '').trim()) {
      // Fallback: use plain text transcript (may already include [M:SS] timestamps)
      context += 'FULL VIDEO TRANSCRIPT:\n';
      context += 'This is the PRIMARY source of information.\n\n';
      context += `${transcript.text}\n\n`;
    } else {
      context += 'SOURCE NOTE (internal, do not mention to the user): No spoken captions. Answer from title, description chapters, and comments. Do not invent spoken quotes or timestamps. Never mention missing captions. Never tell them to try another video.\n\n';
    }

    if (videoAnalysis && videoAnalysis.description) {
      const chapters = this.parseDescriptionChapters(videoAnalysis.description);
      if (chapters.length) {
        context += 'CHAPTER TIMESTAMPS FROM DESCRIPTION (real times — cite these, do not invent others):\n';
        chapters.forEach((chapter) => {
          context += `[${chapter.clock}] ${chapter.title}\n`;
        });
        context += '\n';
      }
    }

    if (videoAnalysis && Array.isArray(videoAnalysis.comments) && videoAnalysis.comments.length > 0) {
      context += 'TOP VIDEO COMMENTS (viewer discussion — use for FAQs, popular reactions, and timestamps viewers mention):\n';
      videoAnalysis.comments.slice(0, 40).forEach((comment, index) => {
        const likes = comment.likes ? ` (${comment.likes} likes)` : '';
        const author = comment.author || 'Viewer';
        context += `${index + 1}. @${author}${likes}: ${comment.text}\n`;
      });
      context += '\n';
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

    // --- PHASE 4: FIX BROKEN NUMBERED LISTS ---
    // Handles AI output like:
    // "Intro text: 1. First item\n1. Second item\n1. Third item"
    // Converts to: "Intro text:\n\n1. First item\n\n2. Second item\n\n3. Third item"

    // Pre-process: Split lines where numbered item is embedded mid-line
    // Pattern: "text: 1. Item" or "text. 1. Item" -> split before the number
    enhanced = enhanced.replace(/([.:!?])\s*(1\.?\s+)/g, '$1\n\n$2');

    // Also handle "1." without space: "text: 1.Item" -> "text:\n\n1. Item"
    enhanced = enhanced.replace(/([.:!?])\s*(1\.)([A-ZÀ-Ö])/g, '$1\n\n$2 $3');

    // Check if we have a numbered list that might be broken
    if (/1\.\s*/m.test(enhanced)) {
      // Split the text to process numbered list sections
      let currentNumber = 0;
      let result = '';
      let inList = false;
      let listBuffer = '';

      // Process line by line
      const lines = enhanced.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Check for numbered item (e.g., "1. Title: text" or "1.Title: text")
        const numberedMatch = trimmedLine.match(/^(\d+)\.?\s*(.+)/);
        const startsWithNumber = numberedMatch && /^\d+\./.test(trimmedLine);

        if (startsWithNumber && numberedMatch) {
          // Found a numbered item
          if (listBuffer) {
            result += listBuffer + '\n\n';
            listBuffer = '';
          }

          const matchedNumber = parseInt(numberedMatch[1]);
          const itemContent = numberedMatch[2];

          // Determine the correct number for this item
          if (!inList) {
            // Starting a new list - use the number as-is (usually 1)
            currentNumber = matchedNumber;
            inList = true;
          } else if (matchedNumber === 1 && currentNumber >= 1) {
            // AI repeated "1." - this is a broken list, auto-increment
            currentNumber++;
          } else if (matchedNumber === currentNumber + 1) {
            // AI correctly numbered - use its number
            currentNumber = matchedNumber;
          } else {
            // Some other number - auto-increment for consistency
            currentNumber++;
          }

          listBuffer = `${currentNumber}. ${itemContent}`;
          continue;
        }

        // Check for unnumbered item that should be numbered
        // Pattern: "Title with Words: description" (2+ words before colon, starts with capital)
        const unnumberedMatch = trimmedLine.match(/^([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿéèêëàâäùûüôöîïçÉÈÊËÀÂÄÙÛÜÔÖÎÏÇ'']+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿéèêëàâäùûüôöîïçÉÈÊËÀÂÄÙÛÜÔÖÎÏÇ'']+)+)\s*:\s*(.+)/);

        if (inList && unnumberedMatch && !trimmedLine.match(/^Références?:/i) && !trimmedLine.match(/^References?:/i)) {
          // This should be a numbered item
          if (listBuffer) {
            result += listBuffer + '\n\n';
            listBuffer = '';
          }
          currentNumber++;
          listBuffer = `${currentNumber}. ${trimmedLine}`;
          continue;
        }

        // Check for bold item that should be numbered: "**Title**: description"
        const boldMatch = trimmedLine.match(/^\*\*([^*]+)\*\*\s*:\s*(.+)/);
        if (inList && boldMatch && !trimmedLine.match(/^\d+\./)) {
          if (listBuffer) {
            result += listBuffer + '\n\n';
            listBuffer = '';
          }
          currentNumber++;
          listBuffer = `${currentNumber}. ${trimmedLine}`;
          continue;
        }

        // Empty line - flush buffer but DON'T reset inList
        // (empty lines are spacing between list items, not list terminators)
        if (!trimmedLine) {
          if (listBuffer) {
            result += listBuffer + '\n';
            listBuffer = '';
          }
          // Keep inList = true so next "1." gets auto-incremented
          result += '\n';
          continue;
        }

        // References section ends the list
        if (trimmedLine.match(/^Références?:/i) || trimmedLine.match(/^References?:/i)) {
          if (listBuffer) {
            result += listBuffer + '\n\n';
            listBuffer = '';
          }
          inList = false;
          result += line + '\n';
          continue;
        }

        // Regular line - append to buffer if in list, otherwise add to result
        if (inList && listBuffer) {
          // This is continuation of current list item
          listBuffer += '\n' + line;
        } else {
          result += line + '\n';
        }
      }

      // Don't forget remaining buffer
      if (listBuffer) {
        result += listBuffer;
      }

      enhanced = result;
    }

    // Ensure blank line between numbered items for readability
    enhanced = enhanced.replace(/(\d+\.\s+[^\n]+)\n(\d+\.)/g, '$1\n\n$2');

    // Clean up excessive newlines
    enhanced = enhanced.replace(/\n{3,}/g, '\n\n');

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
   * Pull timestamped chapters out of a YouTube description.
   */
  parseDescriptionChapters(description) {
    const chapters = [];
    const re = /^[\s>*•\-]*((?:\d{1,2}:)?\d{1,2}:\d{2})\s+[-–—.]?\s*(.+)$/gm;
    let match;
    while ((match = re.exec(description || ''))) {
      const title = match[2].replace(/\s+/g, ' ').trim();
      if (title) chapters.push({ clock: match[1], title });
    }
    return chapters;
  }

  /**
   * Steal-the-playbook / key points questions need numbered actions, not a summary.
   */
  isPlaybookQuestion(question) {
    const q = String(question || '').toLowerCase();
    return /\b(playbook|takeaways?|actionable|actionnable|key points?|what (can|should) i (skip|do)|steal|next steps?|setup steps?|how (do i|to) (set ?up|install|deploy))\b/i.test(q)
      || /\b(points?\s+cl[eé]s?|a retenir|à retenir|vole le playbook)\b/i.test(q);
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
      /\b\d+\s+(choses|éléments|façons|étapes|conseils|stratégies|business|idées|points|astuces|clés|techniques|méthodes|outils|exemples|raisons|avantages)\b/i,
      /\bà\s+lancer\b/i, // "businesses to launch"
      /\b(quels|quelles)\s+sont\s+les\s+\d+\s+/i, // "quelles sont les 3 astuces"
      /\bles\s+\d+\s+(meilleures?|principales?|premières?)\s+/i, // "les 3 meilleures..."
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
    const isPlaybook = this.isPlaybookQuestion(userQuestion);
    const itemCount = this.extractItemCount(userQuestion);
    console.log('Question type:', isPlaybook ? 'Playbook' : isEnumeration ? `Enumeration (${itemCount || 'multiple'} items)` : 'Explanation');

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

        const hasSpokenTranscript = !!(transcript && (
          String(transcript.text || '').trim()
          || (transcript.words && transcript.words.length)
        ));
        const noCaptionRule = hasSpokenTranscript ? '' : (isFrench ? `
IMPORTANT - PAS DE SOUS-TITRES PARLÉS:
- Tu as le titre, les chapitres de la description, et les commentaires. C'est assez.
- N'écris JAMAIS que les captions manquent. Pas de préambule. Réponds directement.
- N'invente pas de citations parlées ni de timestamps hors chapitres/commentaires.
- Si on demande un playbook ou des points clés: liste d'actions volables, pas un résumé.
` : `
CRITICAL - NO SPOKEN CAPTIONS:
- You have the title, description chapters, and comments. That is enough.
- NEVER mention missing captions or "from the description". No preamble. Answer directly.
- Do not invent spoken quotes or timestamps that are not in the chapters or comments.
- If they asked for a playbook or key points: numbered stealable actions, not a summary.
`);

        // Build format-specific instructions based on question type
        const formatInstructions = isPlaybook ? `
🚨 PLAYBOOK / KEY POINTS — STEALABLE STEPS ONLY:

The user wants actions they can do today. Not a recap. Not a paragraph.

1. Start with the first action. No intro. No "I don't have captions".
2. Numbered list of 5-8 steps (or ${itemCount || 'the count they asked for'}).
3. Each item:
   N. **Verb-led move** [MM:SS if a chapter/comment has it]
   What to do. The number, setting, or command if the source has one. Caveat if there is one.
4. Last line: 🎯 **Next 10 min:** one concrete first click.
5. Only cite timestamps that appear in chapters or comments. Never invent times.
6. Forbidden: "the video explains", "from the description", "spoken captions", fluff recap.
` : isEnumeration ? `
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
        const exampleResponses = isPlaybook ? `
EXAMPLE PLAYBOOK RESPONSE:

1. **Deploy the one-click VPS template** [0:45]
   Launch the Hostinger Hermes image from the dashboard. Caveat: finish DNS and SSH keys before you open the agent UI.

2. **Connect the model with an OpenRouter key** [4:10]
   Paste the key in the web dashboard. Caveat: set a spend cap so cron jobs cannot burn quota overnight.

3. **Link the Telegram bot** [8:22]
   Create the bot, drop the token in Hermes, then send /start from your own account first.

🎯 **Next 10 min:** open the Hostinger template page and deploy. Do not start with the desktop app.
` : isEnumeration ? `
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
${noCaptionRule}

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

Be clear, helpful, and conversational.${chatHistoryContext ? (isFrench ? '\n\n⚠️ CONVERSATION EN COURS - NE PAS SALUER:\n- ❌ NE DITES PAS "Bonjour", "Salut", "Hello" ou autre salutation\n- ❌ NE DITES PAS "Bien sûr!", "Certainement!", "Voici..."\n- ✅ Répondez DIRECTEMENT à la question, comme dans une conversation fluide\n- ✅ Continuez naturellement en développant les explications précédentes' : '\n\n⚠️ ONGOING CONVERSATION - DO NOT GREET:\n- ❌ DO NOT say "Hello", "Hi", "Hey" or any greeting\n- ❌ DO NOT say "Sure!", "Of course!", "Here is..."\n- ✅ Answer DIRECTLY, like in a flowing conversation\n- ✅ Continue naturally, building on previous explanations') : ''}`;

        // Build prompt instruction based on question type
        const promptInstruction = isPlaybook
          ? (isFrench
              ? `Liste numérotée d'actions volables. Chaque ligne: "N. **Action** [MM:SS si connu]: ce qu'il faut faire + le caveat." Interdit: dire que les captions manquent. Termine par "🎯 Prochaines 10 min:" puis "Références: [timestamps]".`
              : `Numbered stealable actions. Each line: "N. **Action** [MM:SS if known]: what to do + the caveat." Forbidden: mentioning missing captions. End with "🎯 Next 10 min:" then "References: [timestamps]".`)
          : isEnumeration
          ? (isFrench
              ? `🚨🚨🚨 LISTE NUMÉROTÉE OBLIGATOIRE - RÈGLE ABSOLUE 🚨🚨🚨

FORMAT EXACT À SUIVRE (copier ce format EXACTEMENT):

1. **Premier élément**: Description en 15-25 mots.
2. **Deuxième élément**: Description en 15-25 mots.
3. **Troisième élément**: Description en 15-25 mots.
${itemCount ? `...continuer jusqu'à ${itemCount}...` : ''}

Références: [timestamps]

⛔ ERREURS INTERDITES (votre réponse sera REJETÉE si vous faites ces erreurs):
- ❌ INTERDIT: Écrire un élément SANS son numéro (ex: "Document de..." au lieu de "2. Document de...")
- ❌ INTERDIT: Utiliser des tirets (-) ou puces (•) au lieu de numéros
- ❌ INTERDIT: Oublier le numéro sur N'IMPORTE QUEL élément

✅ OBLIGATOIRE: CHAQUE ligne d'élément DOIT commencer par "1. ", "2. ", "3. ", etc.
✅ VÉRIFIEZ: Avant de répondre, comptez que CHAQUE élément a son numéro!`
              : `🚨🚨🚨 NUMBERED LIST REQUIRED - ABSOLUTE RULE 🚨🚨🚨

EXACT FORMAT TO FOLLOW (copy this format EXACTLY):

1. **First item**: Description in 15-25 words.
2. **Second item**: Description in 15-25 words.
3. **Third item**: Description in 15-25 words.
${itemCount ? `...continue to ${itemCount}...` : ''}

References: [timestamps]

⛔ FORBIDDEN ERRORS (your response will be REJECTED if you make these errors):
- ❌ FORBIDDEN: Writing an item WITHOUT its number (e.g., "Document..." instead of "2. Document...")
- ❌ FORBIDDEN: Using dashes (-) or bullets (•) instead of numbers
- ❌ FORBIDDEN: Forgetting the number on ANY item

✅ REQUIRED: EVERY item line MUST start with "1. ", "2. ", "3. ", etc.
✅ VERIFY: Before responding, count that EVERY item has its number!`)
          : (isFrench
              ? 'Répondez naturellement et de manière conversationnelle. FORMATAGE: Paragraphes COURTS (1-2 phrases) avec une LIGNE VIDE entre chaque. Utilisez des emojis pour les sections. Terminez par "Références: [timestamps]"'
              : 'Answer naturally and conversationally. FORMATTING: SHORT paragraphs (1-2 sentences) with a BLANK LINE between each. Use emojis for sections. End with "References: [timestamps]"');

        const prompt = `${systemInstruction}\n\nQUESTION: ${userQuestion}\n\n${promptInstruction}`;

        console.log('Sending Q&A query to Gemini...');

        // Use retry mechanism with exponential backoff to handle 503 overload errors
        const { answer } = await this.retryWithBackoff(async () => {
          const answer = await generateText(prompt, { temperature: 0.7, maxOutputTokens: 4096 });

          if (!answer || !answer.trim()) {
            throw new Error('Empty response from Gemini');
          }

          console.log('Q&A response received successfully');
          return { result: null, response: null, answer };
        });

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
        let cleanedAnswer = answer;
        for (let i = 0; i < 3; i++) {
          cleanedAnswer = cleanedAnswer.replace(/<cite[^>]*>[\s]*<\/cite>/gi, ''); // Empty cite tags
          cleanedAnswer = cleanedAnswer.replace(/<cite[^>]*>/gi, ''); // Opening cite tags
          cleanedAnswer = cleanedAnswer.replace(/<\/cite>/gi, ''); // Closing cite tags
        }
        // Clean up any extra whitespace left behind
        cleanedAnswer = cleanedAnswer.replace(/\s{2,}/g, ' '); // Multiple spaces to single space
        cleanedAnswer = cleanedAnswer.replace(/\s+([.,;:!?])/g, '$1'); // Remove space before punctuation
        cleanedAnswer = cleanedAnswer.replace(/([.,;:!?])\s{2,}/g, '$1 '); // Fix spaces after punctuation

        // Enhance readability with better formatting
        cleanedAnswer = this.enhanceReadability(cleanedAnswer, userQuestion);

        // Convert markdown to HTML for frontend rendering
        const htmlAnswer = this.markdownToHtml(cleanedAnswer);

        // Analyze answer for actionable insights
        const insights = this.analyzeInsights(cleanedAnswer, userQuestion);

        // Extract visual context for each citation
        const uniqueCitations = [...new Set(citations)];
        const visualContext = this.extractVisualContextForCitations(uniqueCitations, videoAnalysis);

        console.log('Insights:', insights.tipCount, 'actionable tips found');
        console.log('Visual context:', Object.keys(visualContext).length, 'timestamps with visual data');

        return {
          answer: cleanedAnswer.trim(), // Markdown format
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

        const prompt = `Based on this video content, generate 3-4 ultra-concise, actionable questions that would be most useful for someone who just watched this video.

CRITICAL REQUIREMENTS:
1. ULTRA-CONCISE: ONE sentence only, maximum 10-12 words per question
2. NO long questions or paragraph-style questions
3. SPECIFIC to the actual content (not generic like "what are the key topics")
4. ACTIONABLE and help the viewer learn or implement what was taught
5. Natural language - how real people would ask
6. Mix different types: how-to, explanation, benefits, comparisons
7. NotebookLM style: short, direct, engaging

EXAMPLES OF PERFECT PROMPTS (short and specific):
- "How do I install Claude Code in Cursor?"
- "What makes Opus 4 better than other models?"
- "Is the $100/month pricing worth it?"
- "What are the 3 Facebook ad strategies?"

EXAMPLES OF BAD PROMPTS:
- "What are the main points?" (too generic)
- "Can you explain in detail how the creator approaches content strategy and what specific steps they recommend for beginners?" (WAY too long - must be under 12 words)
- "Summarize the video" (not specific)

VIDEO CONTENT:
${context}

Generate 3-4 SHORT suggested questions (max 10-12 words each) as a JSON array. Output ONLY valid JSON:
["question 1", "question 2", "question 3"]`;

        console.log('Generating suggested prompts with Gemini...');

        // Use retry mechanism with exponential backoff to handle 503 overload errors
        const { promptsText } = await this.retryWithBackoff(async () => {
          const promptsText = await generateText(prompt, { json: true, temperature: 0.5, maxOutputTokens: 1024 });
          return { result: null, response: null, promptsText };
        }, 3); // Use 3 retries for prompts (less critical than Q&A)

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

    // Check if we have ANY transcripts available
    const videosWithTranscripts = relevantVideos.filter(v => {
      if (!v.transcript) return false;

      // Handle transcript object (from smart bypass)
      if (typeof v.transcript === 'object') {
        return v.transcript.text && v.transcript.text.length > 0;
      }

      // Handle plain string transcript
      return v.transcript.length > 0;
    });

    if (videosWithTranscripts.length === 0) {
      // No transcripts available - return helpful error message
      return {
        answer: `## No Transcripts Available

Unfortunately, none of the videos in this channel have transcripts available. This can happen when:

**Why Transcripts Are Missing**
- The creator hasn't enabled auto-captions in YouTube Studio
- The videos are too new (captions not yet generated)
- The videos are in a language without auto-caption support
- The videos are unlisted or have restricted caption access

**What You Can Do**
- Ask the channel creator to enable auto-generated captions in YouTube Studio
- Try asking about video metadata (titles, descriptions, view counts)
- Wait a few hours if the channel was just imported (YouTube may still be processing captions)

You can still browse video titles and statistics, but detailed content analysis requires transcript availability.`,
        answerHtml: `<h2>No Transcripts Available</h2>

<p>Unfortunately, none of the videos in this channel have transcripts available. This can happen when:</p>

<p><strong>Why Transcripts Are Missing</strong></p>
<ul>
<li>The creator hasn't enabled auto-captions in YouTube Studio</li>
<li>The videos are too new (captions not yet generated)</li>
<li>The videos are in a language without auto-caption support</li>
<li>The videos are unlisted or have restricted caption access</li>
</ul>

<p><strong>What You Can Do</strong></p>
<ul>
<li>Ask the channel creator to enable auto-generated captions in YouTube Studio</li>
<li>Try asking about video metadata (titles, descriptions, view counts)</li>
<li>Wait a few hours if the channel was just imported (YouTube may still be processing captions)</li>
</ul>

<p>You can still browse video titles and statistics, but detailed content analysis requires transcript availability.</p>`,
        sources: [],
        videosAnalyzed: 0
      };
    }

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

🔴 CRITICAL RULE #1 - CITATIONS ARE MANDATORY 🔴
YOU MUST ADD CITATIONS TO YOUR ANSWER. THIS IS NOT OPTIONAL.

After EVERY factual statement from a video, add: <cite video="X" time="MM:SS"></cite>
- X = video number (VIDEO 1, VIDEO 2, VIDEO 3, etc. from the context provided)
- MM:SS = timestamp from the [MM:SS] markers in the transcript segments

CITATION EXAMPLES (YOU MUST FOLLOW THIS EXACT FORMAT):
✅ CORRECT: "The creator recommends using GitHub for collaboration<cite video="2" time="5:30"></cite>."
✅ CORRECT: "Learning English is still important for developers<cite video="1" time="2:15"></cite>."
✅ CORRECT: "Freelancing requires strong communication skills<cite video="3" time="10:45"></cite>."

❌ WRONG: No citation at the end
❌ WRONG: (Video 2, 5:30) ← Wrong format!
❌ WRONG: [VIDEO 2, 5:30] ← Wrong format!

YOU MUST use <cite video="X" time="MM:SS"></cite> format ONLY.

CRITICAL MARKDOWN FORMATTING RULES:
1. Use ## headings to organize main topics (with blank line before and after)
2. Use **bold** for subcategories within topics
3. Use bullet points (-) for each specific tip or action item
4. Provide 4-6 bullet points under EVERY subcategory
5. Each bullet should be a complete, detailed sentence with specific advice
6. Include concrete steps, techniques, and examples from the transcripts
7. NEVER output just headings without bullet points
8. ADD CITATIONS AFTER EVERY STATEMENT (see examples above)

FORMATTING STRUCTURE (YOU MUST FOLLOW):
## Main Topic

**Subcategory Name**
- First detailed bullet point with complete explanation
- Second detailed bullet point with specific guidance
- Third detailed bullet point with examples from transcripts
- Fourth detailed bullet point with actionable steps

**Another Subcategory**
- Complete bullet point with full details
- Another complete bullet point with specifics
- Third bullet point with examples
- Fourth bullet point with action items

IMPORTANT: Provide FULL detailed answers with ALL actionable content. Your response MUST be 500+ words with comprehensive details.

${detectedLanguage === 'fr' ? `
🇫🇷 LANGUAGE REQUIREMENT - CRITICAL:
YOU MUST RESPOND IN FRENCH (FRANÇAIS) AT ALL TIMES.
NO MATTER WHAT, YOUR ENTIRE RESPONSE MUST BE IN FRENCH.
EVEN IF THE VIDEO CONTENT IS IN ENGLISH, TRANSLATE IT TO FRENCH.
NEVER SWITCH TO ENGLISH - STAY IN FRENCH FOR THE ENTIRE RESPONSE.
Répondez TOUJOURS en français avec des réponses détaillées et complètes.
` : 'Always respond in English with detailed, complete answers.'}`,
        generationConfig: {
          temperature: 0.7, // Balanced creativity for detailed responses
          maxOutputTokens: 8192, // Allow long, comprehensive answers
          topP: 0.95,
          topK: 40
        }
      });

      // Wrap API call with retry mechanism to handle 503 overload errors
      const { result, response, answer } = await this.retryWithBackoff(async () => {
        const result = await modelWithSystem.generateContent(prompt);
        const response = await result.response;
        const answer = response.text();
        return { result, response, answer };
      });

      // Parse citations from the answer BEFORE cleaning
      // Support both new format: <cite video="X" time="MM:SS"></cite>
      // AND old format: [Vidéo X, MM:SS] or [Video X, MM:SS] for backwards compatibility
      const citations = [];

      // New format: <cite video="1" time="12:34"></cite>
      const citeRegex = /<cite video="(\d+)" time="(\d+):(\d+)"><\/cite>/g;
      let match;

      while ((match = citeRegex.exec(answer)) !== null) {
        const videoIndex = parseInt(match[1], 10) - 1; // Convert to 0-indexed
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const timestamp = minutes * 60 + seconds;

        // Map to actual video
        if (videoIndex >= 0 && videoIndex < relevantVideos.length) {
          const video = relevantVideos[videoIndex];
          const videoId = video.videoId || video.id; // Fallback to id if videoId is missing
          citations.push({
            videoId: videoId,
            videoTitle: video.title,
            timestamp: timestamp,
            timestampFormatted: `${minutes}:${seconds.toString().padStart(2, '0')}`,
            url: `https://www.youtube.com/watch?v=${videoId}&t=${timestamp}s`
          });
        }
      }

      // Format with time range: [VIDEO 3, 1:04-1:08] (use start time)
      const rangeFormatRegex = /\[(?:Vidéo|Video|VIDEO)\s+(\d+),\s+(\d+):(\d+)-\d+:\d+\]/gi;

      while ((match = rangeFormatRegex.exec(answer)) !== null) {
        const videoIndex = parseInt(match[1], 10) - 1; // Convert to 0-indexed
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const timestamp = minutes * 60 + seconds;

        // Map to actual video
        if (videoIndex >= 0 && videoIndex < relevantVideos.length) {
          const video = relevantVideos[videoIndex];
          const videoId = video.videoId || video.id; // Fallback to id if videoId is missing
          // Check for duplicates before adding
          const exists = citations.some(c => c.videoId === videoId && c.timestamp === timestamp);
          if (!exists) {
            citations.push({
              videoId: videoId,
              videoTitle: video.title,
              timestamp: timestamp,
              timestampFormatted: `${minutes}:${seconds.toString().padStart(2, '0')}`,
              url: `https://www.youtube.com/watch?v=${videoId}&t=${timestamp}s`
            });
          }
        }
      }

      // Format without time range: [Vidéo 10, 21:42] or [Video 10, 21:42] with brackets
      const bracketFormatRegex = /\[(?:Vidéo|Video|VIDEO)\s+(\d+),\s+(\d+):(\d+)\]/gi;

      while ((match = bracketFormatRegex.exec(answer)) !== null) {
        const videoIndex = parseInt(match[1], 10) - 1; // Convert to 0-indexed
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const timestamp = minutes * 60 + seconds;

        // Map to actual video
        if (videoIndex >= 0 && videoIndex < relevantVideos.length) {
          const video = relevantVideos[videoIndex];
          const videoId = video.videoId || video.id; // Fallback to id if videoId is missing
          // Check for duplicates before adding
          const exists = citations.some(c => c.videoId === videoId && c.timestamp === timestamp);
          if (!exists) {
            citations.push({
              videoId: videoId,
              videoTitle: video.title,
              timestamp: timestamp,
              timestampFormatted: `${minutes}:${seconds.toString().padStart(2, '0')}`,
              url: `https://www.youtube.com/watch?v=${videoId}&t=${timestamp}s`
            });
          }
        }
      }

      // Old format fallback 2: (Vidéo 6, 1:28) or (Video 4, 2:56) with parentheses
      const parenFormatRegex = /\((?:Vidéo|Video)\s+(\d+),\s+(\d+):(\d+)\)/gi;

      while ((match = parenFormatRegex.exec(answer)) !== null) {
        const videoIndex = parseInt(match[1], 10) - 1; // Convert to 0-indexed
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const timestamp = minutes * 60 + seconds;

        // Map to actual video
        if (videoIndex >= 0 && videoIndex < relevantVideos.length) {
          const video = relevantVideos[videoIndex];
          const videoId = video.videoId || video.id; // Fallback to id if videoId is missing
          // Check for duplicates before adding
          const exists = citations.some(c => c.videoId === videoId && c.timestamp === timestamp);
          if (!exists) {
            citations.push({
              videoId: videoId,
              videoTitle: video.title,
              timestamp: timestamp,
              timestampFormatted: `${minutes}:${seconds.toString().padStart(2, '0')}`,
              url: `https://www.youtube.com/watch?v=${videoId}&t=${timestamp}s`
            });
          }
        }
      }

      console.log(`[VideoQAService] Parsed ${citations.length} citations from answer`);

      // Convert markdown to HTML for better frontend rendering
      let answerHtml;
      try {
        // Clean up the markdown before conversion
        let cleanedMarkdown = answer
          // DON'T remove time-range citations [VIDEO 3, 1:04-1:08] - convert them to links on frontend
          // DON'T remove bracket format citations [Vidéo 10, 21:42] - convert them to links on frontend
          // DON'T remove parentheses format citations (Vidéo 6, 1:28) - convert them to links on frontend
          // Remove old-style inline video references without timestamps like (Video 5, Video 4) and (Vidéo 1)
          .replace(/\(Vidéo\s+\d+(?:,\s*Vidéo\s+\d+)*\)/gi, '')
          .replace(/\(Video\s+\d+(?:,\s*Video\s+\d+)*\)/gi, '')
          // Remove <cite> tags from text (we'll show citations as chips below)
          .replace(/<cite[^>]*>[\s]*<\/cite>/gi, '')
          // Ensure proper spacing between sections
          .replace(/\n\n\n+/g, '\n\n')
          // Ensure headings have proper line breaks
          .replace(/([^\n])\n##\s/g, '$1\n\n## ')
          // Ensure bullet points have proper line breaks
          .replace(/([^\n])\n-\s/g, '$1\n\n- ');

        answerHtml = await marked(cleanedMarkdown);
      } catch (error) {
        console.error('[VideoQAService] Error converting markdown to HTML:', error);
        answerHtml = null; // Fallback to plain markdown
      }

      // 4. Build sources from relevant videos (all videos with transcripts contributed)
      const sources = relevantVideos
        .filter(v => v.transcript) // Only videos with transcripts
        .map(v => {
          const videoId = v.videoId || v.id; // Fallback to id if videoId is missing
          return {
            videoId: videoId,
            videoTitle: v.title,
            thumbnailUrl: v.thumbnailUrl,
            publishedAt: v.publishedAt,
            viewCount: v.viewCount,
            url: `https://www.youtube.com/watch?v=${videoId}`
          };
        });

      return {
        answer: answer, // Original markdown with <cite> tags
        answerHtml: answerHtml, // HTML version for frontend
        channelCitations: citations, // Structured citations with URLs and timestamps for channel mode
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
        console.log(`[VideoQAService] Fetching: ${video.title} (${video.id})`);

        // Try Innertube caption scraping (fast, free, works for 70-80% of videos)
        let transcriptResult = await youtubeInnertubeService.fetchTranscript(video.id);

        // DISABLED: Audio transcription fallback (causes YouTube bot detection)
        // If you need audio transcription, enable auto-captions in YouTube Studio
        // or contact support for alternative solutions
        if (!transcriptResult.success) {
          console.log(`[VideoQAService] ⚠️ No captions available for ${video.id}`);
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
              .doc(video.id);

            // Check if we need to store segments in subcollection due to size
            const segmentsSize = transcriptResult.segments ? Buffer.byteLength(JSON.stringify(transcriptResult.segments), 'utf8') : 0;
            const transcriptSize = transcriptResult.text ? Buffer.byteLength(transcriptResult.text, 'utf8') : 0;
            const storeSegmentsInSubcollection = segmentsSize > 700000; // 700KB threshold for safety

            if (storeSegmentsInSubcollection) {
              console.log(`[VideoQAService] ⚠️ TranscriptSegments for ${video.id} too large (${segmentsSize} bytes), storing in subcollection`);

              // Store segments in subcollection chunks
              const SEGMENTS_PER_CHUNK = 100;
              const segments = transcriptResult.segments || [];

              for (let j = 0; j < segments.length; j += SEGMENTS_PER_CHUNK) {
                const segmentChunk = segments.slice(j, j + SEGMENTS_PER_CHUNK);
                const chunkDoc = videoRef.collection('transcriptChunks').doc(`chunk_${j}`);
                await chunkDoc.set({
                  segments: segmentChunk,
                  startIndex: j,
                  endIndex: Math.min(j + SEGMENTS_PER_CHUNK - 1, segments.length - 1)
                });
              }
            }

            await videoRef.update({
              transcript: transcriptSize > 900000 ? null : { text: transcriptResult.text }, // Skip if too large
              transcriptSegments: storeSegmentsInSubcollection ? null : transcriptResult.segments, // Store segments inline if small enough
              transcriptSegmentsInSubcollection: storeSegmentsInSubcollection, // Flag for retrieval
              transcriptSegmentsCount: transcriptResult.segments?.length || 0, // Metadata
              status: 'ready',
              transcriptSource: source,
              transcriptLanguage: transcriptResult.language || 'en',
              transcriptWordCount: transcriptResult.wordCount || 0,
              transcriptCost: source === 'youtube-innertube' ? 0 : 0.15,
              transcriptFetchedAt: new Date().toISOString()
            });

            console.log(`[VideoQAService] ✓ Transcript cached to Firestore for ${video.id}`);
          }
        } else {
          console.log(`[VideoQAService] ✗ Transcript fetch failed for ${video.id}: ${transcriptResult.error}`);
          video.status = 'transcription_failed';

          if (!useMockMode && firestore) {
            const videoRef = firestore.collection('channels')
              .doc(channelId)
              .collection('videos')
              .doc(video.id);

            await videoRef.update({
              status: 'transcription_failed',
              transcriptError: transcriptResult.error,
              transcriptAttemptedAt: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        console.error(`[VideoQAService] Error transcribing ${video.id}:`, error.message);
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

      // Fetch transcriptSegments from subcollection for videos that have them there
      for (const video of videos) {
        if (video.transcriptSegmentsInSubcollection) {
          try {
            const segmentsSnapshot = await firestore.collection('channels')
              .doc(channelId)
              .collection('videos')
              .doc(video.id)
              .collection('transcriptChunks')
              .orderBy('startIndex')
              .get();

            const allSegments = [];
            segmentsSnapshot.docs.forEach(doc => {
              const chunk = doc.data();
              if (chunk.segments) {
                allSegments.push(...chunk.segments);
              }
            });

            video.transcriptSegments = allSegments;
            console.log(`[VideoQAService] ✓ Fetched ${allSegments.length} segments from subcollection for ${video.id}`);
          } catch (error) {
            console.error(`[VideoQAService] ✗ Failed to fetch segments from subcollection for ${video.id}:`, error);
          }
        }
      }
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
      // Handle both string transcripts and object transcripts with text field
      const transcriptText = typeof video.transcript === 'object' && video.transcript.text
        ? video.transcript.text
        : (typeof video.transcript === 'string' ? video.transcript : null);

      if (transcriptText) {
        const transcriptLower = transcriptText.toLowerCase();
        questionWords.forEach(word => {
          const matches = (transcriptLower.match(new RegExp(word, 'g')) || []).length;
          score += Math.min(matches, 10); // Cap at 10 matches per word
        });
      }
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
      ? `🇫🇷 LANGUE REQUISE: FRANÇAIS

ATTENTION CRITIQUE: L'utilisateur parle français. Vous DEVEZ répondre UNIQUEMENT en français.
- Répondez TOUJOURS et ENTIÈREMENT en français
- NE CHANGEZ JAMAIS vers l'anglais, même au milieu de la réponse
- Traduisez toutes les informations des vidéos en français
- Chaque mot, chaque phrase, chaque titre doit être en français
- RESTEZ EN FRANÇAIS du début à la fin de votre réponse

Cette règle est ABSOLUE et ne peut pas être ignorée.`
      : `LANGUAGE REQUIREMENT: ENGLISH

CRITICAL: The user speaks English. You MUST respond ONLY in English.
Always respond entirely in English for the complete response.`;

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

🔴 RÈGLE #1 ABSOLUE - CITATIONS OBLIGATOIRES 🔴
Ajoutez <cite video="X" time="MM:SS"></cite> après CHAQUE fait tiré des vidéos.
Exemple: "Le créateur recommande GitHub pour collaborer<cite video="2" time="5:30"></cite>."

🚫 NE JAMAIS FAIRE CECI (réponse incomplète):
## Sujet Principal
**Sous-catégorie**

✅ TOUJOURS FAIRE CECI (réponse complète):
## Sujet Principal
**Sous-catégorie**
- Premier point détaillé expliquant la technique spécifique avec des exemples de la vidéo<cite video="1" time="2:15"></cite>
- Deuxième point avec des étapes détaillées et des conseils d'implémentation pratiques<cite video="2" time="5:30"></cite>
- Troisième point décrivant l'approche complète et pourquoi elle fonctionne<cite video="3" time="10:45"></cite>
- Quatrième point avec des exemples concrets et des chiffres/données des transcriptions<cite video="1" time="7:20"></cite>

RÈGLES OBLIGATOIRES:
1. PRIORITÉ ABSOLUE: Ajoutez des citations <cite video="X" time="MM:SS"></cite> après CHAQUE affirmation
2. Extrayez TOUS les insights, étapes, et conseils actionnables des transcriptions complètes
3. Fournissez des réponses COMPLÈTES et DÉTAILLÉES avec 4-6 PUCES COMPLÈTES par sous-catégorie
4. Chaque puce DOIT être une phrase complète avec des détails spécifiques du contenu
5. NE JAMAIS produire juste des titres - TOUJOURS inclure les puces détaillées
6. Si vous produisez seulement des titres sans puces, vous avez ÉCHOUÉ

FORMATAGE (pour organiser votre contenu détaillé):
- Utilisez ## pour les catégories principales
- Utilisez ** pour les sous-catégories
- 4-6 puces (-) détaillées sous CHAQUE sous-catégorie
- Chaque puce = phrase complète avec explication et exemples
${formatExample}

6. Synthétisez les informations de plusieurs vidéos pour des réponses complètes
7. Votre réponse DOIT faire 500+ mots avec tous les détails actionnables`
      : `⚠️ CRITICAL Instructions - YOU MUST FOLLOW THESE RULES:

🔴 RULE #1 ABSOLUTE - CITATIONS MANDATORY 🔴
Add <cite video="X" time="MM:SS"></cite> after EVERY factual statement from videos.
Example: "The creator recommends using GitHub for collaboration<cite video="2" time="5:30"></cite>."

🚫 NEVER DO THIS (incomplete response):
## Main Topic
**Subcategory**

✅ ALWAYS DO THIS (complete response):
## Main Topic
**Subcategory**
- First detailed point explaining the specific technique with examples from the video<cite video="1" time="2:15"></cite>
- Second point with step-by-step guidance and practical implementation advice<cite video="2" time="5:30"></cite>
- Third point describing the complete approach and why it works<cite video="3" time="10:45"></cite>
- Fourth point with real-world examples and specific numbers/data from transcripts<cite video="1" time="7:20"></cite>

MANDATORY RULES:
1. TOP PRIORITY: Add citations <cite video="X" time="MM:SS"></cite> after EVERY statement
2. Extract ALL insights, steps, and actionable advice from the full transcripts
3. Provide COMPLETE, DETAILED answers with 4-6 FULL BULLET POINTS per subcategory
4. Each bullet point MUST be a complete sentence with specific details from the content
5. NEVER output just headings - ALWAYS include the detailed bullet points
6. If you only output headings without bullet points, you have FAILED

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

