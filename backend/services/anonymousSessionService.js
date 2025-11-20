/**
 * Anonymous Session Service
 *
 * Tracks usage for anonymous users (no signup) before showing signup wall.
 * Uses sessionId + fingerprint to track:
 * - Video uploads (limit: 1)
 * - Questions asked (limit: 3)
 *
 * VPN/Cookie Bypass Protection:
 * - Extracts fingerprint from sessionId (embedded in session format)
 * - Tracks by fingerprint to prevent VPN abuse
 * - If fingerprint already used, denies access even with new sessionId
 *
 * NOTE: In production, this should use Redis for distributed sessions.
 * Current implementation uses in-memory Map (resets on server restart).
 */

const { canProcessVideo, canAskQuestion } = require('../config/pricing');

// In-memory session store (replace with Redis in production)
const anonymousSessions = new Map();
// Fingerprint tracking to prevent VPN bypass
const fingerprintUsage = new Map();

// Session expiry: 7 days
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Extract fingerprint from sessionId
 * SessionId format: session_{random}_{fingerprint}
 */
function extractFingerprint(sessionId) {
  if (!sessionId || !sessionId.startsWith('session_')) return null;

  const parts = sessionId.split('_');
  if (parts.length >= 3) {
    return parts[2]; // fingerprint part
  }
  return null;
}

/**
 * Check if fingerprint has already been used
 */
function isFingerprintUsed(fingerprint) {
  if (!fingerprint) return false;

  const usage = fingerprintUsage.get(fingerprint);
  if (!usage) return false;

  // Check if fingerprint usage is expired
  const now = new Date();
  const usageAge = now - new Date(usage.firstUsed);
  if (usageAge > SESSION_EXPIRY_MS) {
    // Expired - allow reuse
    fingerprintUsage.delete(fingerprint);
    return false;
  }

  return true;
}

/**
 * Get or create anonymous session
 * @param {string} sessionId - Browser session ID
 * @returns {object} Session data
 */
function getSession(sessionId) {
  if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
    return null;
  }

  // Extract and track fingerprint
  const fingerprint = extractFingerprint(sessionId);
  if (fingerprint && isFingerprintUsed(fingerprint)) {
    // Fingerprint already used - return a "used" session to block access
    console.log(`⚠️ Fingerprint already used: ${fingerprint.substring(0, 8)}... (VPN/cookie bypass attempt blocked)`);
    return {
      sessionId,
      tier: 'anonymous',
      videosUploaded: 1, // Already "used" to block uploads
      questionsAsked: 3, // Already "used" to block questions
      createdAt: new Date(),
      lastActivity: new Date(),
      fingerprintBlocked: true
    };
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
      fingerprint
    };
    anonymousSessions.set(sessionId, session);

    // Track fingerprint
    if (fingerprint) {
      fingerprintUsage.set(fingerprint, {
        sessionId,
        firstUsed: new Date(),
        lastUsed: new Date()
      });
    }
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
 * Clean up expired sessions and fingerprints (run periodically)
 */
function cleanupExpiredSessions() {
  const now = new Date();
  let cleaned = 0;
  let fingerprintsCleaned = 0;

  // Clean up sessions
  for (const [sessionId, session] of anonymousSessions.entries()) {
    const sessionAge = now - new Date(session.createdAt);
    if (sessionAge > SESSION_EXPIRY_MS) {
      anonymousSessions.delete(sessionId);
      cleaned++;
    }
  }

  // Clean up fingerprints
  for (const [fingerprint, usage] of fingerprintUsage.entries()) {
    const usageAge = now - new Date(usage.firstUsed);
    if (usageAge > SESSION_EXPIRY_MS) {
      fingerprintUsage.delete(fingerprint);
      fingerprintsCleaned++;
    }
  }

  if (cleaned > 0 || fingerprintsCleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired session(s) and ${fingerprintsCleaned} fingerprint(s)`);
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
