// Lurnia Extension - API Module

// Toggle between production and development
const IS_DEV = false;
const API_BASE = IS_DEV ? 'http://localhost:3001/api' : 'https://mentorai-production.up.railway.app/api';
const APP_URL = IS_DEV ? 'http://localhost:3000' : 'https://lurnia.app';

export const api = {
  /**
   * Get the authentication URL for Google OAuth
   * Opens the main app's login page which will redirect back with token
   */
  getAuthUrl() {
    const extensionId = chrome.runtime.id;
    const redirectUri = `https://${extensionId}.chromiumapp.org/`;
    // The main app needs to handle this redirect and pass back the auth token
    return `${APP_URL}/extension-auth?redirect_uri=${encodeURIComponent(redirectUri)}`;
  },

  /**
   * Get user info from userId (decoded from Firebase token on client)
   */
  async getUser(userId) {
    const response = await fetch(`${API_BASE}/user/${userId}`);

    if (!response.ok) {
      throw new Error('Failed to get user');
    }

    const data = await response.json();
    return data.user;
  },

  /**
   * Get user quota information
   */
  async getQuota(userId) {
    const response = await fetch(`${API_BASE}/user/${userId}/check-question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch quota');
    }

    const data = await response.json();
    return {
      questions: data.questionsThisMonth || 0,
      limit: data.limit || 500,
      plan: data.tier || 'free'
    };
  },

  /**
   * Ask a question about a video (uses direct endpoint)
   * If transcript is provided, backend uses it directly (faster, bypasses IP blocking)
   */
  async askQuestion({ videoId, question, videoTitle, channelName, transcript }, userId) {
    const response = await fetch(`${API_BASE}/qa/video-direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        videoId,
        question,
        videoTitle,
        channelName,
        userId,
        transcript // Client-side fetched transcript (optional)
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to get answer');
    }

    const data = await response.json();

    // Extract timestamps from the response
    const timestamps = extractTimestamps(data.answer);

    return {
      answer: data.answer,
      timestamps
    };
  },

  /**
   * Get video transcript (for advanced features)
   */
  async getTranscript(videoId, token) {
    const response = await fetch(`${API_BASE}/transcript/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch transcript');
    }

    return response.json();
  }
};

/**
 * Extract timestamps from answer text
 * Looks for patterns like [00:00], (1:23), 1:23:45, etc.
 */
function extractTimestamps(text) {
  const timestamps = [];
  const regex = /\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    let seconds;
    if (match[3]) {
      // HH:MM:SS format
      seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    } else {
      // MM:SS format
      seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
    }

    timestamps.push({
      label: match[0].replace(/[\[\]]/g, ''),
      seconds,
      index: match.index
    });
  }

  return timestamps;
}

export default api;
