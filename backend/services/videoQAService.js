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
   * This is a simple converter - frontend should handle most markdown rendering
   */
  markdownToHtml(markdown) {
    if (!markdown) return '';
    
    let html = markdown;

    // Remove any remaining cite tags first
    html = html.replace(/<cite[^>]*>[\s]*<\/cite>/gi, '');
    html = html.replace(/<cite[^>]*>/gi, '');
    html = html.replace(/<\/cite>/gi, '');

    // Convert headers (must be at start of line)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Convert bold text (**text**)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert numbered lists - handle multi-line items
    // First, identify numbered list blocks
    const lines = html.split('\n');
    const processedLines = [];
    let inNumberedList = false;
    let listItems = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const numberedMatch = line.match(/^(\d+\.\s+)(.+)$/);
      
      if (numberedMatch) {
        if (!inNumberedList) {
          inNumberedList = true;
          listItems = [];
        }
        listItems.push(`<li>${numberedMatch[2].trim()}</li>`);
      } else {
        if (inNumberedList) {
          processedLines.push(`<ol>${listItems.join('\n')}</ol>`);
          inNumberedList = false;
          listItems = [];
        }
        processedLines.push(line);
      }
    }
    
    if (inNumberedList && listItems.length > 0) {
      processedLines.push(`<ol>${listItems.join('\n')}</ol>`);
    }
    
    html = processedLines.join('\n');

    // Convert bullet points
    html = html.replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>');
    // Wrap consecutive bullet list items in <ul>
    html = html.replace(/(<li>.*?<\/li>\n?)+/g, (match) => {
      if (!match.includes('<ol>')) {
        return `<ul>${match}</ul>`;
      }
      return match;
    });

    // Convert paragraphs (double newlines)
    html = html.split(/\n\n+/).map(para => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      // Don't wrap if it's already an HTML tag
      if (trimmed.match(/^<(h[1-6]|ol|ul|li|p)/)) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    }).filter(p => p).join('\n');

    // Clean up extra newlines
    html = html.replace(/\n{3,}/g, '\n\n');

    return html;
  }

  /**
   * Post-process answer for better readability (AGGRESSIVE FORMATTING)
   */
  enhanceReadability(answer, userQuestion) {
    let enhanced = answer;

    // --- CRITICAL MANUAL POST-PROCESSING FIXES FOR SPACING ---
    
    // 1. Ensure a blank line before and after lists/headings
    enhanced = enhanced.replace(/([^\n])\n(#{1,3}\s+.+)/g, '$1\n\n$2'); // Blank line before heading
    enhanced = enhanced.replace(/(#{1,3}\s+.+)\n([^\n#])/g, '$1\n\n$2'); // Blank line after heading
    enhanced = enhanced.replace(/([^\n])\n(\d+\.\s+)/g, '$1\n\n$2'); // Blank line before numbered list
    enhanced = enhanced.replace(/([^\n])\n([-\*]\s+)/g, '$1\n\n$2'); // Blank line before bullet list

    // 2. Aggressive paragraph breaking (2 sentences max per paragraph block)
    // We fix single newlines within blocks that should be double newlines for separation.
    const paragraphs = enhanced.split(/\n\n+/); // Split by existing double newlines
    const processedParagraphs = paragraphs.map(para => {
      const trimmed = para.trim();
      
      // Skip if it's a structural element (heading, list, hook)
      if (!trimmed || 
          trimmed.match(/^#{1,3}\s+/) || 
          trimmed.match(/^\d+\.\s+/) || 
          trimmed.match(/^[-\*]\s+/) ||
          trimmed.match(/^References?:/i) ||
          trimmed.startsWith('**The bottom line is')) {
        return para;
      }
      
      // Split by sentence boundaries, including punctuation, then group by 2 sentences
      // This regex is slightly more reliable for finding sentence ends (followed by space or end of string)
      const sentences = trimmed.match(/([^\.!\?]+[\.!\?])(\s+|$)/g) || [trimmed + ' '];
      
      if (sentences.length > 2) {
        const chunks = [];
        for (let i = 0; i < sentences.length; i += 2) {
          // Join two sentences together, ensuring only one space between them
          let chunk = sentences.slice(i, i + 2).join('').trim();
          chunks.push(chunk);
        }
        // Join chunks with double newlines for proper paragraph breaks
        return chunks.filter(c => c).join('\n\n');
      }
      
      return para;
    });
    
    enhanced = processedParagraphs.join('\n\n');

    // 3. Final cleanup and safety
    enhanced = enhanced.replace(/\n{4,}/g, '\n\n'); // Max 2 newlines
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
   * Answer a question about the video using Gemini
   */
  async answerQuestion(userQuestion, videoAnalysis, transcript, chatHistory = null, personalizedContext = '') {
    this.ensureInitialized();

    // Build context from video analysis
    const videoContext = this.buildVideoContext(videoAnalysis, transcript);

    // Build chat history context for follow-ups
    const chatHistoryContext = this.buildChatHistoryContext(chatHistory);

    if (!videoContext.trim()) {
      return {
        answer: 'I need video analysis data to answer questions. Please analyze the video first.',
        citations: [],
        visualContext: {},
        insights: null
      };
    }

    // Use Gemini API if available
    if (this.model) {
      try {
        const systemInstruction = `You are a helpful expert who has internalized all the content from this video. Your goal is to help people understand and apply what they learned in a natural, conversational way.

CORE PRINCIPLES:
- Teach the knowledge directly and naturally
- Be concise and conversational - like explaining to a friend
- Don't reference "the video" or say "I show you..." - just teach the concepts
- Make your answer actually MORE useful than watching the video by being clear and actionable${chatHistoryContext ? '\n\n(This is a follow-up question - build on what we discussed before.)' : ''}

RESPONSE STYLE:

1. **Start with a clear, direct answer** (1-2 sentences)
   - Get straight to the point
   - Answer what they actually asked
   - No formulaic intros like "The bottom line is..." - just answer naturally
   - Example: "Yes, it works great with Cursor. Setup takes about a minute."

2. **Then provide helpful details**
   - Use numbered lists for steps or key points
   - Use bullet points for examples or options
   - Keep paragraphs SHORT (2-3 sentences max)
   - Add blank lines between sections for readability

3. **Make it scannable**
   - Bold important concepts or key actions
   - Use ### headings to break up longer answers
   - Add timestamps [MM:SS] at the end of relevant points
   - Example: "Install with 'npm install' in your terminal [2:15]"

4. **When to use emojis** (optional):
   - Use sparingly (1-2 per section max) - only if it helps clarity
   - Strategic use: 🚀 setup, 💰 pricing, ✅ steps, ⚡ performance, 💡 insights
   - In headings or key list items, not every sentence

5. **Add timestamps for reference**:
   - Include [MM:SS] at the end of relevant points
   - Group all timestamps at the very end: "References: [0:00] [1:03] [5:46]"
   - Keeps the teaching flow natural and uninterrupted
   - NEVER use HTML tags like <cite> - only plain [MM:SS] format

IMPORTANT - TEACH THE KNOWLEDGE, NOT THE VIDEO:

Don't describe what happens in the video:
❌ "I show you how to install it. First, I tell you to go to the website..."

Instead, teach the concept directly:
✅ "Installation takes about a minute. Go to the website, grab the terminal command, and run it in your editor."

EXAMPLE RESPONSES:

**Simple question**: "Can I use it on Cursor?"

"Yes, it integrates directly into Cursor and makes it way more powerful. Installation takes about a minute.

Key benefits:
- You get the Opus 4 model running in your familiar interface
- Unlimited context - no more repeating yourself
- Fixed pricing instead of per-API charges

References: [0:00] [1:03] [4:33]"

**How-to question**: "How do I install it?"

"### Installation

It takes about a minute - just a few terminal commands.

1. Go to Claude's website and grab the terminal command [5:46]
2. Open your terminal in Cursor and run the install command [6:07]
3. Type 'claude' in a new terminal - you'll see 'IDE connected' briefly [6:39]
4. Type '/IDE' to confirm it says 'Cursor' [7:00]
5. The Claude Code window should pop up automatically [7:00]

That's it - you're ready to code with Opus 4.

References: [5:46] [6:07] [6:39] [7:00]"

**Out-of-scope question**: "What is CPC?" (video mentions but doesn't define)

"**CPC (Cost Per Click)** means you pay each time someone clicks your ad.

The optimization strategy covered here focuses on lowering your CPC while maintaining quality traffic:

1. Improve ad relevance - match ad copy to landing pages
2. Target lookalike audiences - find people similar to existing customers
3. Optimize ad placement - test feed vs stories vs reels

Target CPC mentioned: $0.50-0.80 for clothing brands.

References: [3:20] [7:45] [12:10]"

CORE PRINCIPLES - FINAL REMINDERS:

✓ Teach concepts directly - don't reference "the video" or say "I show you..."
✓ Start with a clear, direct answer (1-2 sentences)
✓ Use numbered lists for steps, bullet points for examples/benefits
✓ Keep paragraphs SHORT (2-3 sentences max)
✓ Add blank lines between sections for readability
✓ Bold important concepts and key actions
✓ Add timestamps [MM:SS] at the end of relevant points
✓ Group all citations at the very end in a "References:" line
✓ Make it actually MORE useful than watching the video by being clear and actionable

VIDEO CONTEXT (Full Transcript + Visual Analysis):
${videoContext}
${chatHistoryContext}
${personalizedContext ? '\n---\n' + personalizedContext + '\n' : ''}

You are an expert teacher sharing knowledge, NOT someone describing a video.

Be clear, helpful, and conversational.${chatHistoryContext ? '\n\nContinue the conversation naturally, building on previous explanations.' : ''}`;

        const prompt = `${systemInstruction}\n\nQUESTION: ${userQuestion}\n\nAnswer naturally and conversationally. Start with a clear, direct answer to the question.`;

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
          return {
            answer: '⚠️ **Service Temporarily Unavailable**\n\nThe AI service is currently overloaded. Please try again in a few moments.\n\nIf this persists, the service may be experiencing high demand.',
            answerHtml: '<p><strong>⚠️ Service Temporarily Unavailable</strong></p><p>The AI service is currently overloaded. Please try again in a few moments.</p><p>If this persists, the service may be experiencing high demand.</p>',
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
        return {
          answer: `❌ **Unable to Process Request**\n\nWe encountered an error while processing your question. Please try again.\n\n**Error details:** ${error.message || 'Unknown error'}`,
          answerHtml: `<p><strong>❌ Unable to Process Request</strong></p><p>We encountered an error while processing your question. Please try again.</p><p><strong>Error details:</strong> ${error.message || 'Unknown error'}</p>`,
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

