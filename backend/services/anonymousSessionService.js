/**
 * Anonymous Session Service
 *
 * Tracks usage for anonymous users (no signup) before showing signup wall.
 * Uses sessionId (from browser) to track:
 * - Video uploads (limit: 1)
 * - Questions asked (limit: 3)
 *
 * NOTE: In production, this should use Redis for distributed sessions.
 * Current implementation uses in-memory Map (resets on server restart).
 */

const { canProcessVideo, canAskQuestion } = require('../config/pricing');

// In-memory session store (replace with Redis in production)
const anonymousSessions = new Map();

// Session expiry: 7 days
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Get or create anonymous session
 * @param {string} sessionId - Browser session ID
 * @returns {object} Session data
 */
function getSession(sessionId) {
  if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
    return null;
  }

  let session = anonymousSessions.get(sessionId);

  if (!session) {
    session = {
      sessionId,
      tier: 'anonymous',
      videosUploaded: 0,
      questionsAsked: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    anonymousSessions.set(sessionId, session);
  } else {
    // Update last activity
    session.lastActivity = new Date();
  }

  // Check if session expired
  const now = new Date();
  const sessionAge = now - new Date(session.createdAt);
  if (sessionAge > SESSION_EXPIRY_MS) {
    // Reset session
    session.videosUploaded = 0;
    session.questionsAsked = 0;
    session.createdAt = new Date();
  }

  return session;
}

/**
 * Check if anonymous user can upload a video
 * @param {string} sessionId - Browser session ID
 * @returns {object} { canUpload, videosUsed, limit, remaining, requiresSignup }
 */
function checkVideoQuota(sessionId) {
  const session = getSession(sessionId);

  if (!session) {
    return {
      canUpload: false,
      videosUsed: 0,
      limit: 1,
      remaining: 1,
      requiresSignup: true,
      tier: 'anonymous'
    };
  }

  const result = canProcessVideo('anonymous', session.videosUploaded);

  return {
    canUpload: result.canProcess,
    videosUsed: result.used,
    limit: result.limit,
    remaining: result.remaining,
    requiresSignup: !result.canProcess, // Show signup wall if limit reached
    tier: 'anonymous'
  };
}

/**
 * Check if anonymous user can ask a question
 * @param {string} sessionId - Browser session ID
 * @returns {object} { canAsk, questionsUsed, limit, remaining, requiresSignup }
 */
function checkQuestionQuota(sessionId) {
  const session = getSession(sessionId);

  if (!session) {
    return {
      canAsk: false,
      questionsUsed: 0,
      limit: 3,
      remaining: 3,
      requiresSignup: true,
      tier: 'anonymous'
    };
  }

  const result = canAskQuestion('anonymous', session.questionsAsked);

  return {
    canAsk: result.canAsk,
    questionsUsed: result.used,
    limit: result.limit,
    remaining: result.remaining,
    requiresSignup: !result.canAsk, // Show signup wall if limit reached
    tier: 'anonymous'
  };
}

/**
 * Increment video upload count for anonymous session
 * @param {string} sessionId - Browser session ID
 * @returns {boolean} Success status
 */
function incrementVideoCount(sessionId) {
  const session = getSession(sessionId);

  if (!session) {
    return false;
  }

  session.videosUploaded++;
  session.lastActivity = new Date();
  anonymousSessions.set(sessionId, session);

  console.log(`Anonymous session ${sessionId}: ${session.videosUploaded} video(s) uploaded`);

  return true;
}

/**
 * Increment question count for anonymous session
 * @param {string} sessionId - Browser session ID
 * @returns {boolean} Success status
 */
function incrementQuestionCount(sessionId) {
  const session = getSession(sessionId);

  if (!session) {
    return false;
  }

  session.questionsAsked++;
  session.lastActivity = new Date();
  anonymousSessions.set(sessionId, session);

  console.log(`Anonymous session ${sessionId}: ${session.questionsAsked} question(s) asked`);

  return true;
}

/**
 * Clean up expired sessions (run periodically)
 */
function cleanupExpiredSessions() {
  const now = new Date();
  let cleaned = 0;

  for (const [sessionId, session] of anonymousSessions.entries()) {
    const sessionAge = now - new Date(session.createdAt);
    if (sessionAge > SESSION_EXPIRY_MS) {
      anonymousSessions.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired anonymous session(s)`);
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

/**
 * Get session stats (for debugging/monitoring)
 */
function getSessionStats() {
  return {
    totalSessions: anonymousSessions.size,
    sessions: Array.from(anonymousSessions.values()).map(s => ({
      sessionId: s.sessionId.substring(0, 8) + '...', // Partial ID for privacy
      videosUploaded: s.videosUploaded,
      questionsAsked: s.questionsAsked,
      createdAt: s.createdAt,
      lastActivity: s.lastActivity
    }))
  };
}

module.exports = {
  getSession,
  checkVideoQuota,
  checkQuestionQuota,
  incrementVideoCount,
  incrementQuestionCount,
  cleanupExpiredSessions,
  getSessionStats
};
