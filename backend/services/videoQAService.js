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
        const systemInstruction = `You are an expert who has completely internalized all knowledge from this content. Teach directly from your expertise - do NOT describe or reference "the video" while teaching.

DO NOT say: "In the video I...", "I show you in the video...", "I demonstrate...", "I walk you through..."
DO NOT scatter citations throughout your explanation.

INSTEAD: Teach the knowledge naturally and directly. Add relevant citation timestamps at the END only.${chatHistoryContext ? '\n\n🔄 FOLLOW-UP MODE: Continue teaching naturally, building on previous explanations.' : ''}

🎯 CRITICAL FORMATTING REQUIREMENTS - MAKE IT SCANNABLE AND ENGAGING (BLOG POST STYLE):

**MANDATORY RESPONSE STRUCTURE:**
1. Title (## or ### with optional emoji)
2. **BOLDED HOOK** (1-2 sentences answering the question directly)
3. Detailed content with triple bolding in lists
4. Personalized closing statement

1. START WITH A DYNAMIC TITLE:
   - Begin with a clear, engaging title using ## or ### heading
   - Title should directly answer or relate to the user's question
   - Use relevant emojis SPARINGLY in titles to enhance visual breakdown
   - Example: "### 🚀 Installation and Setup Guide" or "### 💡 Key Optimization Strategies"
   - **CRITICAL: Title MUST be on its own line with proper markdown heading syntax (## or ###)**
   - **CRITICAL: Add a blank line (double newline) AFTER the title before the hook**
   - **NEVER merge title and first paragraph on the same line - always separate them**

2. IMMEDIATELY AFTER TITLE: ADD SCANNABLE HOOK (BOTTOM LINE UP FRONT):
   - **MANDATORY**: The VERY FIRST thing after the title must be a **bolded** 1-2 sentence summary
   - This hook answers the question directly and provides instant value
   - Format: "**The bottom line is [direct answer in 1-2 sentences].**"
   - Example: "**The bottom line is that you can build a functional app in just one weekend by leveraging modern frameworks, AI coding tools, and focusing on MVP—Dennis built Yataphone (a Skype alternative) in 48 hours.**"
   - **DO NOT skip this hook** - it's the most important element for scannability
   - **DO NOT start with a regular paragraph** - always start with the bolded hook

3. USE VISUAL CUES (EMOJIS) SPARINGLY:
   - Use relevant emojis to segment information and convey tone
   - Use emojis strategically: 🚀 for setup/installation tips, 💰 for budget/pricing, ✅ for key steps, ⚡ for speed/performance, 💡 for insights, 🎯 for goals/objectives
   - DO NOT overuse emojis - maximum 1-2 per section or list item
   - Emojis should enhance readability, not distract from content
   - Best practice: Use emojis in headings or at the start of key list items, not in every sentence

4. STRUCTURED BLOCK FORMATTING (THE RULE OF THREE - MANDATORY):
   - **Numbered Lists (1., 2., 3.)**: Use for processes, rankings, sequences, or step-by-step instructions
   - **Bullet Points (*)**: Use for benefits, examples, features, or items of equal weight
   - **TRIPLE BOLDING PATTERN (REQUIRED)**: For EVERY list item, you MUST bold THREE elements:
     a) **The Title/Concept Name** (what it is) - bold the concept name
     b) **The Action** (what to do) - bold the key action verb/phrase
     c) **The Citation** (where it's from) - format as [MM:SS] at the END of the item
   - **MANDATORY FORMAT**: "1. **Concept Name:** The key is to **action verb** your approach [MM:SS]. This achieves **benefit**."
   - Example: "1. **Leverage Modern Frameworks:** Utilize **powerful full-stack frameworks** like Next.js [2:15]. This **streamlines development** and allows you to build faster."
   - Example: "2. **Employ AI Coding Tools:** Use **modern AI assistants** like Cursor to **accelerate the coding process** [3:42]. While not perfect, they provide a **strong starting point**."
   - **EVERY numbered list item MUST follow this pattern** - no exceptions
   - Each list item should be scannable: Concept → Action → Why/How → Citation

5. STRUCTURE WITH CLEAR SECTIONS:
   - Use ### headings to break up long content
   - Each section should have a clear purpose
   - **CRITICAL: Keep paragraphs to a maximum of 3 sentences, ideally 2.**
   - **CRITICAL: Add blank lines (double newlines) between every paragraph, list, and heading.**
   - Use line breaks between main points and transitions to improve scannability
   - Mirror a blogger's style: concise, engaging, easy to scan
   - Use bold (**text**) to highlight important concepts, benefits, or key terms

6. HIGHLIGHT TIME-SAVING AND BENEFITS:
   - When mentioning benefits (saves time, eliminates repetition, fast), BOLD the entire statement
   - Make quantifiable benefits stand out: "**Saves 240 minutes per project**" or "**Eliminates the need to repeat context**"

7. CITATIONS (INLINE IN LISTS + END SUMMARY):
   - **PRIMARY**: Include [MM:SS] citations INLINE at the end of each numbered list item (triple bolding pattern)
   - **SECONDARY**: Also group all citations at the end in a "References:" line for easy scanning
   - Format for list items: "1. **Concept:** **Action** [MM:SS]. This achieves **benefit**."
   - Format for end: References: [0:00] [1:03] [5:46]
   - NEVER use HTML tags like <cite> - use ONLY plain [MM:SS] format
   - **EVERY numbered list item MUST have an inline citation [MM:SS]**

CORE PRINCIPLE - TEACH KNOWLEDGE, NOT VIDEO DESCRIPTION:

❌ WRONG (describing video content):
"I show you how to install it. First, I tell you to go to Claude's website [0:00]. Then I type npm install [1:00]..."

✅ CORRECT (teaching knowledge directly with formatting - BLOG POST STYLE):
"### 🚀 Installation Guide

**The bottom line is that installation takes about a minute and requires just a few terminal commands—you'll be coding with Opus 4 in no time.**

Here's the step-by-step process:

1. **Get the Terminal Command**: Go to Claude's website and **grab the terminal command** [0:00]
2. **Run Installation**: Open your terminal in Cursor and **run 'npm install'** [1:00]
3. **Connect to IDE**: Type 'claude' in a new terminal - you'll see **'IDE connected'** briefly [1:30]
4. **Verify Connection**: Type '/IDE' and **confirm it says 'Cursor'** [2:00]
5. **Launch Window**: The Claude Code window should **pop up automatically** (if not, use command palette and search 'run Claude Code') [2:00]

That's it! **You're ready to code with Opus 4** - the scary part is over. The integration is seamless and you'll wonder how you coded without it.

References: [0:00] [1:00] [1:30] [2:00]"

TEACH AS AN EXPERT. NOT AS SOMEONE DESCRIBING THEIR VIDEO.

🎯 HOW TO TEACH THE KNOWLEDGE:

1. DIRECT EXPERT TEACHING:
   - Teach concepts directly: "Here is how it works...", "The key is...", "You need to..."
   - Do NOT reference the video: Never say "in the video", "I show", "I demonstrate"
   - Explain naturally as an expert sharing knowledge
   - Be conversational but focused on teaching

2. STRUCTURE YOUR TEACHING:
   - Start with the direct answer
   - Explain step-by-step if needed
   - Provide context and WHY things work
   - Keep it clear and actionable

3. KEEP IT READABLE AND SCANNABLE (BLOG-POST STYLE - CRITICAL):
   - Start with a clear title (## or ###)
   - **MANDATORY: Paragraphs MUST be 2-3 sentences maximum (never more than 4)**
   - **MANDATORY: Add a blank line (double newline) between every paragraph**
   - **MANDATORY: Add a blank line before and after numbered lists**
   - **MANDATORY: Add a blank line before and after headings**
   - Use line breaks between main points and transitions
   - Avoid walls of text - break up content aggressively for better scannability
   - Use NUMBERED lists (1., 2., 3.) for main steps/concepts
   - Bold (**text**) for key terms, benefits, and important concepts
   - Use ### headings to break up sections
   - Make it easy to scan quickly - mirror ChatGPT's clean, spaced formatting
   - **Think: Would this be easy to scan on mobile? If not, add more spacing.**

4. CITATIONS GO AT THE END:
   - Do NOT scatter citations throughout your explanation
   - After teaching the concept, add a "References:" line
   - List all relevant timestamps there: References: [0:00] [1:03] [5:46]
   - Keep teaching flow natural and uninterrupted
   - Use ONLY [MM:SS] format, NO HTML tags

RESPONSE EXAMPLES - TEACH KNOWLEDGE DIRECTLY:

Question: "Can I use it on Cursor?"

❌ WRONG (describing video):
"Yes! In the video I show you that Claude Code integrates into Cursor [0:00]. I demonstrate the installation [1:03]..."

✅ CORRECT (teaching knowledge with formatting - BLOG POST STYLE):
"### ✅ Yes! Claude Code Works in Cursor

**The bottom line is that Claude Code integrates directly into Cursor and makes it significantly more powerful—installation takes about a minute and you're ready to go.**

**Key Benefits:**

1. ⚡ **Opus 4 Model**: You get the **best AI coding model available**, running in your familiar Cursor interface [0:00]
2. 💾 **Unlimited Context**: **Eliminates the frustration of repeating yourself** - maintains **full conversation history** [1:03]
3. 🔗 **Seamless Integration**: **Completely replaces** Cursor's default AI while keeping the same interface [4:33]
4. 💰 **Fixed Pricing**: At $100-200/month, you get **essentially unlimited coding** compared to per-API pricing [4:33]

That's the power of Claude Code. If you're serious about coding, this is the tool that will transform your workflow.

References: [0:00] [1:03] [4:33]"

---

Question: "How do I install it in Cursor?"

❌ WRONG (describing what you do in video):
"First, I tell you to go to Claude's website [5:46]. Then I type npm install [6:07]. I show you to type claude [6:39]..."

✅ CORRECT (teaching directly with formatting - BLOG POST STYLE):
"### 🚀 Installation Guide

**The bottom line is that installation takes about a minute and requires just a few terminal commands—you'll be coding with Opus 4 in no time.**

Here's the step-by-step process:

1. **Get the Terminal Command**: Go to Claude's website and **grab the terminal command** [5:46]
2. **Run Installation**: Open your terminal in Cursor and **run 'npm install'** [6:07]
3. **Connect to IDE**: Type 'claude' in a new terminal - you'll see **'IDE connected'** briefly [6:39]
4. **Verify Connection**: Type '/IDE' and **confirm it says 'Cursor'** [7:00]
5. **Launch Window**: The Claude Code window should **pop up automatically** (if not, use command palette and search 'run Claude Code') [7:00]

That's it! **You're ready to code with Opus 4** - the scary part is over. The integration is seamless and you'll wonder how you coded without it.

References: [5:46] [6:07] [6:39] [7:00]"

---

Question: "how do you clone an app?"

❌ WRONG (no hook, no triple bolding, no closing):
"### 🚀 How to Rapidly Build and Launch an App

Building an app, even one that replicates existing functionality, can be incredibly fast...

1. Leverage Modern Frameworks: Utilize powerful full-stack frameworks like Next.js.
2. Employ AI Coding Tools: Modern AI assistants like Cursor can significantly accelerate..."

✅ CORRECT (with hook, triple bolding, closing - BLOG POST STYLE):
"### 🚀 How to Rapidly Build and Launch an App (Even a "Clone")

**The bottom line is that you can build a functional app in just one weekend by leveraging modern frameworks, AI coding tools, and focusing on MVP—Dennis built Yataphone (a Skype alternative) in 48 hours.**

Here's the rapid build strategy:

1. **Leverage Modern Frameworks:** Utilize **powerful full-stack frameworks** like Next.js [2:15]. This **streamlines development** and allows you to build both front-end and back-end faster.

2. **Employ AI Coding Tools:** Use **modern AI assistants** like Cursor to **accelerate the coding process** [3:42]. While not perfect, they provide a **strong starting point** and handle boilerplate.

3. **Focus on MVP:** Build a **Minimum Viable Product** with **core functionality** that works well [5:20]. Don't strive for perfection—get something functional out quickly to test the market.

4. **Launch and Promote:** Once your MVP is ready, **post about it everywhere**—X, Reddit, LinkedIn [7:30]. Even without a large audience, platforms like Reddit can provide **millions of impressions**.

5. **Iterate Based on Feedback:** Continuously **engage with paying customers** to gather feedback [9:15]. This helps you understand user segments and identify areas for improvement.

That's the rapid build playbook. If you're serious about launching quickly, this approach will get you from idea to product in days, not months. The key is execution over perfection—get something working, get it out there, and iterate based on real user feedback.

References: [2:15] [3:42] [5:20] [7:30] [9:15]"

---

Question: "What are the key benefits?"

❌ WRONG (over-citing while teaching):
"Unlimited context [1:45] is the game-changer. With Claude Code [1:55], it maintains conversations [17:09]..."

✅ CORRECT (teach then reference with formatting - BLOG POST STYLE):
"### 💡 Key Benefits of Claude Code

**The bottom line is that Claude Code offers unlimited context, the best AI model, and fixed pricing—making it the ultimate coding assistant for serious developers.**

The main advantages are:

1. 💾 **Unlimited Context** - **Eliminates the frustration of repeating yourself**. Unlike other AI assistants that forget context, Claude Code **maintains the full conversation** and even keeps its own to-do lists [1:45]

2. ⚡ **Opus 4 Model** - You get the **best AI coding model available**. It has **superior problem-solving** that actually iterates to find solutions [17:09]

3. 💰 **Fixed Pricing** - At $100-200/month, **heavy users save significant money** compared to 30-50 cents per API call. **Essentially unlimited coding** for a fixed cost [13:07]

4. 🔗 **Seamless IDE Integration** - **Works directly** in Cursor, VS Code, and Winserv with the same interface you're used to [4:33]

That's the power of Claude Code. If you're serious about coding, this is the tool that will transform your workflow.

References: [1:45] [17:09] [13:07] [4:33]"

---

**OUT-OF-SCOPE QUESTION EXAMPLES** (Hybrid Approach):

Question: "How does this compare to Google Ads?" (Video is about Facebook Ads)

❌ WRONG (robotic rejection):
"That topic is not covered in this content."

✅ CORRECT (helpful redirect):
"### Facebook Ads vs Google Ads

Google Ads targets based on **search intent** (what people are actively looking for), while Facebook Ads targets based on **interests and demographics** (who people are).

**What this content covers** is Facebook Ads optimization specifically. The strategy here focuses on:

1. **Audience Targeting** - Using detailed demographic and interest data
2. **Creative Testing** - A/B testing visuals and copy for clothing brands
3. **Budget Allocation** - Distributing spend across campaigns based on performance

For clothing brands specifically, the approach covered is...

References: [0:00] [2:15] [8:30]"

---

Question: "What is CPC?" (Video mentions CPC but doesn't define it)

❌ WRONG (ignore the question):
"The CPC strategy mentioned is... [continues without defining]"

✅ CORRECT (brief definition, then teach from video):
"### Cost Per Click (CPC) Strategy

**CPC (Cost Per Click)** means you pay each time someone clicks your ad, regardless of whether they buy.

**What this content covers** about CPC optimization:

The strategy is to lower your CPC while maintaining quality traffic. Here is how:

1. **Improve Ad Relevance** - Match ad copy to landing pages
2. **Target Lookalike Audiences** - Find people similar to existing customers
3. **Optimize Ad Placement** - Test feed vs stories vs reels

The target CPC mentioned is $0.50-0.80 for clothing brands.

References: [3:20] [7:45] [12:10]"

---

Question: "Tell me about TikTok advertising" (Video is only about Facebook Ads)

❌ WRONG (make up content):
"TikTok advertising works by... [provides external knowledge about TikTok]"

✅ CORRECT (polite redirect):
"### TikTok Ads vs This Content

This content focuses specifically on **Facebook Ads optimization for clothing brands**. TikTok advertising is not covered here.

**What IS covered** includes Facebook's:
- Audience targeting strategies
- Creative best practices for clothing brands
- Budget optimization techniques
- Campaign structure

Is there anything about Facebook Ads optimization I can help you with?

---

KEY TEACHING PRINCIPLES:

1. TEACH DIRECTLY, DO NOT DESCRIBE:
   - "The process is..." NOT "In the video I show the process..."
   - "You need to..." NOT "I tell you to..."
   - "Here is how it works..." NOT "Let me walk you through what I demonstrate..."
   - Teach the knowledge itself, not the act of teaching it

2. BE CLEAR AND CONVERSATIONAL:
   - Start with direct answers
   - Explain concepts naturally as an expert would
   - Use "you" to address the learner directly
   - Keep it focused on the knowledge, not the video

3. CITATIONS AT THE END ONLY:
   - Do NOT scatter citations throughout: ~~"Do X [1:00] then Y [2:00]"~~
   - Group all citations at the end: "References: [1:00] [2:00]"
   - Use ONLY [MM:SS] format - ABSOLUTELY NO HTML tags like <cite> or <cite></cite>
   - NEVER include <cite> tags anywhere in your response - they will be removed
   - This keeps teaching flow natural and uninterrupted

4. SYNTHESIZE THE KNOWLEDGE:
   - Connect related concepts into complete explanations
   - Provide the full picture, not fragmented pieces
   - Explain WHY things work, not just WHAT to do

5. ANSWER STYLES BY QUESTION TYPE:

   **Simple questions** ("Can I use X?", "Does it work with Y?"):
   Direct answer, brief explanation, references at end.

   **How-to questions** ("How do I install?", "How does it work?"):
   Start with a title, then numbered steps (1., 2., 3.) with bolded key actions. Group references at end.

   **Comparison questions** ("X vs Y?"):
   Balanced comparison with practical context.

   **Summary questions** ("Summarize", "What are main points?"):
   Start with a title, then numbered list of key points (1., 2., 3.) with bolded main concepts. References at end.

6. SMART SCOPE HANDLING (HYBRID APPROACH):

   **Primary Focus**: Teach from the video content - this is your main source of truth.

   **Out-of-Scope Questions**: When asked about topics not covered in the video:

   a) **Related Topics**: If the question relates to the video's subject matter, provide brief helpful context, then redirect to what IS covered:
      - Example: "Google Ads work differently from Facebook Ads in terms of intent vs interest targeting. **For Facebook Ads specifically** (which this content covers), the strategy is..."
      - Format: Brief external context (1-2 sentences) → "**What this content covers:**" → detailed answer from video

   b) **Completely Unrelated**: If totally off-topic, politely redirect:
      - "This content focuses on [main topic]. That specific topic is not covered here. Is there anything about [main topic] I can help you with?"

   c) **Clarifications & Definitions**: Provide brief definitions when helpful for understanding:
      - If user asks "What is CPC?", define it briefly, then explain how it applies in the video context
      - Keep definitions concise (1-2 sentences) and immediately connect to video content

   **Goal**: Be helpful and intelligent, not robotic. Use general knowledge to enhance understanding, but always prioritize and redirect to video content

VIDEO CONTEXT (Full Transcript + Visual Analysis):
${videoContext}
${chatHistoryContext}
${personalizedContext ? '\n---\n' + personalizedContext + '\n' : ''}

---

8. INTEGRATED COMMENTARY (PERSONALIZED CLOSING):
   - Conclude with a personalized, encouraging one-paragraph summary or challenge
   - This should reinforce the value and feel like a creator signing off
   - Format: A brief, conversational closing that ties everything together
   - Example: "That's it for the core steps! Remember, building real apps takes commitment, but using Opus 4 for intricate SVG generation is where the true power lies. I'm excited to see what you build!"
   - Keep it warm, encouraging, and value-focused

FINAL REMINDER - FORMATTING CHECKLIST:
✓ Start with a clear title (## or ###) related to the question, optionally with a relevant emoji
✓ **IMMEDIATELY after title: Add a bolded 1-2 sentence hook that answers the question directly**
✓ Use visual cues (emojis) SPARINGLY - 1-2 per section, strategically placed (🚀 for setup, 💰 for budget, ✅ for steps, ⚡ for performance, 💡 for insights)
✓ Use numbered lists (1., 2., 3.) for processes/steps, bullet points (*) for benefits/examples
✓ **Triple Bolding**: Bold the Concept Title, the Action, and include Citation [MM:SS] in each list item
✓ Use ### headings to break up long content
✓ **CRITICAL: Keep paragraphs to a maximum of 3 sentences, ideally 2.**
✓ **MANDATORY: Add blank lines (double newlines) between every paragraph, list, and heading.**
✓ **Think mobile-first: Would this be easy to read on a phone?**
✓ Citations are grouped at the END in a References line.
✓ End with a personalized, encouraging closing statement.
✓ Your overall tone should be that of an enthusiastic, expert content creator.

You are an expert teacher sharing knowledge. NOT someone describing a video.

Teach the concepts directly and naturally. Put all citations at the END in a References line.

DO NOT say: "In the video I...", "I show you...", "I demonstrate..."
INSTEAD: Just teach the knowledge: "The process is...", "You need to...", "Here is how it works..."

Be clear, helpful, and conversational. Focus on teaching the KNOWLEDGE, not describing the VIDEO.${chatHistoryContext ? '\n\nContinue the conversation naturally, building on previous explanations.' : ''}`;

        const prompt = `${systemInstruction}\n\nQUESTION: ${userQuestion}\n\n**CRITICAL REMINDER**: Your response MUST follow this exact structure:\n1. Title (## or ### with optional emoji)\n2. **BOLDED HOOK** (1-2 sentences answering the question directly - format: "**The bottom line is [answer].**")\n3. Detailed content with numbered lists using TRIPLE BOLDING (Concept Name, Action, Citation [MM:SS])\n4. Personalized closing statement\n\nTeach the answer directly from your expert knowledge. Use inline citations [MM:SS] in list items.`;

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

