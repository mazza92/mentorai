const { mockProjects } = require('../utils/mockStorage');

/**
 * User Memory Service - Tracks user context, preferences, and learning patterns
 * This enables ChatGPT-like memory across sessions and videos
 */
class UserMemoryService {
  constructor() {
    // In-memory storage for user memories (would use database in production)
    this.userMemories = new Map();
  }

  /**
   * Get or create user memory profile
   */
  getUserMemory(userId) {
    if (!this.userMemories.has(userId)) {
      this.userMemories.set(userId, {
        userId,
        preferences: {
          learningStyle: null, // 'detailed', 'concise', 'visual', 'step-by-step'
          responseLength: null, // 'short', 'medium', 'long'
          usesEmojis: null, // true/false - inferred from reactions
          prefersExamples: null, // true/false
        },
        interests: {
          topics: [], // Topics user has asked about
          keywords: new Map(), // Keyword frequency
        },
        context: {
          recentQuestions: [], // Last 20 questions across all videos
          videoHistory: [], // Videos watched
          commonPatterns: [], // Question patterns
        },
        interactions: {
          totalQuestions: 0,
          averageQuestionLength: 0,
          followUpRate: 0, // How often user asks follow-ups
          sessionCount: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return this.userMemories.get(userId);
  }

  /**
   * Track a new question and learn from it
   */
  trackQuestion(userId, projectId, question, isFollowUp = false) {
    const memory = this.getUserMemory(userId);

    // Update recent questions
    memory.context.recentQuestions.unshift({
      question,
      projectId,
      timestamp: new Date(),
      isFollowUp,
    });
    memory.context.recentQuestions = memory.context.recentQuestions.slice(0, 20);

    // Extract keywords and update interests
    this.extractAndTrackKeywords(memory, question);

    // Update interaction stats
    memory.interactions.totalQuestions++;
    const avgLen = memory.interactions.averageQuestionLength;
    memory.interactions.averageQuestionLength =
      (avgLen * (memory.interactions.totalQuestions - 1) + question.length) /
      memory.interactions.totalQuestions;

    if (isFollowUp) {
      memory.interactions.followUpRate =
        ((memory.interactions.followUpRate * (memory.interactions.totalQuestions - 1)) + 1) /
        memory.interactions.totalQuestions;
    }

    memory.updatedAt = new Date();
    return memory;
  }

  /**
   * Extract keywords and track interest topics
   */
  extractAndTrackKeywords(memory, text) {
    // Simple keyword extraction (in production, use NLP)
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3); // Filter short words

    // Update keyword frequency
    words.forEach(word => {
      const count = memory.interests.keywords.get(word) || 0;
      memory.interests.keywords.set(word, count + 1);
    });

    // Keep only top 100 keywords
    if (memory.interests.keywords.size > 100) {
      const sorted = Array.from(memory.interests.keywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100);
      memory.interests.keywords = new Map(sorted);
    }
  }

  /**
   * Infer learning style from user behavior
   */
  inferLearningStyle(userId) {
    const memory = this.getUserMemory(userId);
    const { recentQuestions } = memory.context;

    if (recentQuestions.length < 5) {
      return null; // Not enough data
    }

    // Analyze question patterns
    const avgLength = recentQuestions.reduce((sum, q) => sum + q.question.length, 0) / recentQuestions.length;
    const hasHowTo = recentQuestions.filter(q => q.question.toLowerCase().includes('how')).length;
    const hasExample = recentQuestions.filter(q =>
      q.question.toLowerCase().includes('example') ||
      q.question.toLowerCase().includes('show me')
    ).length;
    const hasSteps = recentQuestions.filter(q =>
      q.question.toLowerCase().includes('step') ||
      q.question.toLowerCase().includes('process')
    ).length;

    // Infer style
    if (hasSteps > recentQuestions.length * 0.4) {
      memory.preferences.learningStyle = 'step-by-step';
    } else if (hasExample > recentQuestions.length * 0.3) {
      memory.preferences.learningStyle = 'visual';
      memory.preferences.prefersExamples = true;
    } else if (avgLength < 30) {
      memory.preferences.learningStyle = 'concise';
      memory.preferences.responseLength = 'short';
    } else if (avgLength > 80) {
      memory.preferences.learningStyle = 'detailed';
      memory.preferences.responseLength = 'long';
    }

    return memory.preferences.learningStyle;
  }

  /**
   * Get top interests for a user
   */
  getTopInterests(userId, limit = 10) {
    const memory = this.getUserMemory(userId);
    const sorted = Array.from(memory.interests.keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return sorted.map(([keyword, count]) => ({ keyword, count }));
  }

  /**
   * Build personalized context for AI
   * This is what makes the AI remember and adapt to the user
   */
  buildPersonalizedContext(userId) {
    const memory = this.getUserMemory(userId);

    // Infer learning style if not set
    if (!memory.preferences.learningStyle) {
      this.inferLearningStyle(userId);
    }

    let context = '';

    // Add learning style context
    if (memory.preferences.learningStyle) {
      context += `\n🧠 USER LEARNING PREFERENCE:\n`;
      context += `This user prefers ${memory.preferences.learningStyle} explanations. `;

      if (memory.preferences.learningStyle === 'step-by-step') {
        context += `Break down concepts into clear, numbered steps.\n`;
      } else if (memory.preferences.learningStyle === 'concise') {
        context += `Keep answers brief and to the point.\n`;
      } else if (memory.preferences.learningStyle === 'detailed') {
        context += `Provide comprehensive, in-depth explanations.\n`;
      } else if (memory.preferences.learningStyle === 'visual') {
        context += `Include concrete examples and visual descriptions.\n`;
      }
    }

    // Add user interests
    const topInterests = this.getTopInterests(userId, 5);
    if (topInterests.length > 0) {
      context += `\n📚 USER INTERESTS:\n`;
      context += `Topics user has shown interest in: ${topInterests.map(i => i.keyword).join(', ')}\n`;
      context += `When relevant, connect explanations to these topics.\n`;
    }

    // Add recent context (last 3 questions across all videos)
    const recentCrossVideo = memory.context.recentQuestions
      .slice(0, 3)
      .filter(q => q.projectId !== null);

    if (recentCrossVideo.length > 0) {
      context += `\n🔄 CROSS-VIDEO CONTEXT:\n`;
      context += `User's recent questions (across different videos):\n`;
      recentCrossVideo.forEach((q, index) => {
        context += `${index + 1}. "${q.question}"\n`;
      });
      context += `Use this to understand broader user interests and learning journey.\n`;
    }

    return context;
  }

  /**
   * Track video viewing
   */
  trackVideoView(userId, projectId, metadata) {
    const memory = this.getUserMemory(userId);

    // Add to video history
    memory.context.videoHistory.unshift({
      projectId,
      title: metadata?.title,
      timestamp: new Date(),
    });
    memory.context.videoHistory = memory.context.videoHistory.slice(0, 50); // Keep last 50

    memory.updatedAt = new Date();
  }

  /**
   * Track user session
   */
  trackSession(userId) {
    const memory = this.getUserMemory(userId);
    memory.interactions.sessionCount++;
    memory.updatedAt = new Date();
  }

  /**
   * Get user memory summary (for debugging)
   */
  getMemorySummary(userId) {
    const memory = this.getUserMemory(userId);
    return {
      userId,
      preferences: memory.preferences,
      topInterests: this.getTopInterests(userId, 10),
      recentQuestionsCount: memory.context.recentQuestions.length,
      videosWatched: memory.context.videoHistory.length,
      totalQuestions: memory.interactions.totalQuestions,
      sessionCount: memory.interactions.sessionCount,
    };
  }
}

module.exports = new UserMemoryService();
