const { GoogleGenerativeAI } = require('@google/generative-ai');

class TopicClusteringService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;
    
    if (this.apiKey && this.apiKey !== 'your_gemini_api_key') {
      try {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('TopicClusteringService initialized with Gemini API');
      } catch (error) {
        console.error('Error initializing TopicClusteringService:', error);
      }
    } else {
      console.log('TopicClusteringService initialized in mock mode (no GEMINI_API_KEY)');
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
          console.log('TopicClusteringService re-initialized with Gemini API');
        } catch (error) {
          console.error('Error re-initializing TopicClusteringService:', error);
        }
      }
    }
  }

  /**
   * Convert seconds to MM:SS format
   */
  secondsToTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Build context from video analysis and transcript for topic extraction
   */
  buildContextForTopics(videoAnalysis, transcript) {
    let context = '';

    // Add transcript with timestamps (primary source for topic detection)
    if (transcript && transcript.words && transcript.words.length > 0) {
      context += 'FULL VIDEO TRANSCRIPT (with timestamps):\n';
      
      // Group words into sentences/phrases with timestamps
      let currentSentence = '';
      let sentenceStartTime = transcript.words[0].startTime || 0;
      
      transcript.words.forEach((word, index) => {
        if (index === 0) {
          currentSentence = word.word;
          sentenceStartTime = word.startTime || 0;
        } else {
          const prevWord = transcript.words[index - 1];
          const timeDiff = (word.startTime || 0) - (prevWord.endTime || 0);
          
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
      
      if (currentSentence.trim()) {
        const timestamp = this.secondsToTime(sentenceStartTime);
        context += `[${timestamp}] ${currentSentence.trim()}\n`;
      }
      context += '\n';
    } else if (transcript && transcript.text) {
      context += `FULL VIDEO TRANSCRIPT:\n${transcript.text}\n\n`;
    }

    // Add key moments for additional context
    if (videoAnalysis && videoAnalysis.keyMoments && videoAnalysis.keyMoments.length > 0) {
      context += 'KEY MOMENTS:\n';
      videoAnalysis.keyMoments.forEach((moment) => {
        const timestamp = this.secondsToTime(moment.timestamp);
        context += `- [${timestamp}] ${moment.description}\n`;
      });
      context += '\n';
    }

    return context;
  }

  /**
   * Generate topic clusters/table of contents from video content
   */
  async generateTopics(videoAnalysis, transcript) {
    this.ensureInitialized();

    const context = this.buildContextForTopics(videoAnalysis, transcript);

    if (!context.trim()) {
      return {
        topics: [],
        message: 'No video content available for topic extraction'
      };
    }

    // Use Gemini API if available
    if (this.model) {
      try {
        const systemInstruction = `You are an expert at analyzing video content and identifying major topics, sections, and themes.

CRITICAL INSTRUCTIONS:

1. Analyze the provided video transcript and identify all major topics, sections, or themes discussed.

2. For each topic, identify:
   - A clear, descriptive title (3-8 words)
   - The start time (timestamp) where this topic begins
   - A brief description (1 sentence) of what is covered

3. Topics should be:
   - Distinct and non-overlapping
   - Ordered chronologically by start time
   - Meaningful sections (not just every sentence)
   - Representative of major content shifts or new concepts

4. Output ONLY a valid JSON array in this exact format:
[
  {
    "title": "Introduction & Problem",
    "startTime": 0,
    "description": "Overview of the problem being addressed"
  },
  {
    "title": "Three Key Optimization Steps",
    "startTime": 30,
    "description": "Detailed explanation of the three main optimization strategies"
  }
]

5. Start times must be in seconds (numbers, not strings).

6. Include at least 3 topics, but aim for 5-15 topics depending on video length.

7. The first topic should start at 0 (beginning of video).

VIDEO CONTEXT:
${context}

Now analyze this video and generate a structured table of contents:`;

        console.log('Generating topic clusters with Gemini...');
        const result = await this.model.generateContent(systemInstruction);
        const response = await result.response;
        const text = response.text();

        // Parse JSON from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const topics = JSON.parse(jsonMatch[0]);
          
          // Validate and format topics
          const formattedTopics = topics
            .filter(topic => topic.title && typeof topic.startTime === 'number')
            .map(topic => ({
              title: topic.title.trim(),
              startTime: Math.max(0, topic.startTime), // Ensure non-negative
              description: topic.description || '',
              timeFormatted: this.secondsToTime(topic.startTime)
            }))
            .sort((a, b) => a.startTime - b.startTime); // Ensure chronological order

          console.log('Generated', formattedTopics.length, 'topics');
          return {
            topics: formattedTopics,
            success: true
          };
        } else {
          console.warn('Failed to parse topics JSON from Gemini response');
          return this.getMockTopics();
        }
      } catch (error) {
        console.error('Error generating topics with Gemini:', error);
        return this.getMockTopics();
      }
    } else {
      // Mock mode
      return this.getMockTopics();
    }
  }

  /**
   * Mock topics for development/testing
   */
  getMockTopics() {
    return {
      topics: [
        {
          title: 'Introduction & Problem',
          startTime: 0,
          description: 'Overview of the problem being addressed',
          timeFormatted: '00:00'
        },
        {
          title: 'Three Key Optimization Steps',
          startTime: 30,
          description: 'Detailed explanation of the three main optimization strategies',
          timeFormatted: '00:30'
        },
        {
          title: 'Creative Fatigue Warning',
          startTime: 780, // 13:00
          description: 'Discussion of creative fatigue and how to avoid it',
          timeFormatted: '13:00'
        },
        {
          title: 'Understanding Usage Limits',
          startTime: 1102, // 18:22
          description: 'Explanation of usage limits and best practices',
          timeFormatted: '18:22'
        }
      ],
      success: true,
      message: 'Mock topics (configure GEMINI_API_KEY for intelligent topic extraction)'
    };
  }
}

module.exports = new TopicClusteringService();

