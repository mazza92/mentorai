const { Firestore } = require('@google-cloud/firestore');
const {
  canProcessVideo,
  canImportChannel,
  canAskQuestion,
} = require('../config/pricing');
const { mockUsers } = require('../utils/mockStorage');
const anonymousSessionService = require('./anonymousSessionService');

// Initialize Firestore
let firestore;
let useMockMode = false;

try {
  if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id' && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'mock-project') {
    const firestoreConfig = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    };

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        firestoreConfig.credentials = credentials;
      } catch (error) {
        console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON for user service');
        throw error;
      }
    }

    firestore = new Firestore(firestoreConfig);
  } else {
    useMockMode = true;
  }
} catch (error) {
  useMockMode = true;
}

/**
 * Check if user is anonymous (no signup)
 * @param {string} userId - User ID
 * @returns {boolean}
 */
function isAnonymousUser(userId) {
  return !userId || userId === 'anonymous' || userId.startsWith('anon_') || userId.startsWith('session_');
}

/**
 * Check if user can ask a question (based on tier limits)
 * @param {string} userId - User ID (or sessionId for anonymous)
 * @returns {Promise<object>} - { canAsk, tier, questionsThisMonth, limit, remaining, requiresSignup }
 */
async function checkQuestionQuota(userId) {
  // Handle anonymous users
  if (isAnonymousUser(userId)) {
    const result = anonymousSessionService.checkQuestionQuota(userId);
    return {
      canAsk: result.canAsk,
      tier: result.tier,
      questionsThisMonth: result.questionsUsed,
      limit: result.limit,
      remaining: result.remaining,
      requiresSignup: result.requiresSignup
    };
  }
  try {
    // Use mock mode if Firestore is not available
    if (useMockMode || !firestore) {
      const user = mockUsers.get(userId) || { tier: 'free', questionsThisMonth: 0 };
      const result = canAskQuestion(user.tier, user.questionsThisMonth || 0);
      return {
        canAsk: result.canAsk,
        tier: user.tier,
        questionsThisMonth: result.used,
        limit: result.limit,
        remaining: result.remaining
      };
    }

    const userDoc = await firestore.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      const result = canAskQuestion('free', 0);
      return {
        canAsk: true,
        tier: 'free',
        questionsThisMonth: 0,
        limit: result.limit,
        remaining: result.remaining
      };
    }

    const user = userDoc.data();
    const tier = user.tier || 'free';
    const questionsThisMonth = user.questionsThisMonth || 0;

    const result = canAskQuestion(tier, questionsThisMonth);

    return {
      canAsk: result.canAsk,
      tier,
      questionsThisMonth: result.used,
      limit: result.limit,
      remaining: result.remaining
    };
  } catch (error) {
    console.error('Error checking question quota:', error.message);
    // Fallback to free tier with no questions asked
    const result = canAskQuestion('free', 0);
    return {
      canAsk: true,
      tier: 'free',
      questionsThisMonth: 0,
      limit: result.limit,
      remaining: result.remaining
    };
  }
}

/**
 * Check if user can import a channel
 * @param {string} userId - User ID
 * @returns {Promise<object>} - { canImport, tier, channelsThisMonth, limit, remaining }
 */
async function checkChannelQuota(userId) {
  try {
    if (useMockMode || !firestore) {
      const user = mockUsers.get(userId) || { tier: 'free', channelsThisMonth: 0 };
      const result = canImportChannel(user.tier, user.channelsThisMonth || 0);
      return {
        canImport: result.canImport,
        tier: user.tier,
        channelsThisMonth: result.used,
        limit: result.limit,
        remaining: result.remaining
      };
    }

    const userDoc = await firestore.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      const result = canImportChannel('free', 0);
      return {
        canImport: true,
        tier: 'free',
        channelsThisMonth: 0,
        limit: result.limit,
        remaining: result.remaining
      };
    }

    const user = userDoc.data();
    const tier = user.tier || 'free';
    const channelsThisMonth = user.channelsThisMonth || 0;

    const result = canImportChannel(tier, channelsThisMonth);

    return {
      canImport: result.canImport,
      tier,
      channelsThisMonth: result.used,
      limit: result.limit,
      remaining: result.remaining
    };
  } catch (error) {
    console.error('Error checking channel quota:', error.message);
    const result = canImportChannel('free', 0);
    return {
      canImport: true,
      tier: 'free',
      channelsThisMonth: 0,
      limit: result.limit,
      remaining: result.remaining
    };
  }
}

/**
 * Check if user can upload/process a video
 * @deprecated Use checkChannelQuota for MVP (channel-only uploads)
 * @param {string} userId - User ID (or sessionId for anonymous)
 * @returns {Promise<object>} - { canProcess, tier, videosThisMonth, limit, remaining, requiresSignup }
 */
async function checkVideoQuota(userId) {
  // Handle anonymous users
  if (isAnonymousUser(userId)) {
    const result = anonymousSessionService.checkVideoQuota(userId);
    return {
      canProcess: result.canUpload,
      tier: result.tier,
      videosThisMonth: result.videosUsed,
      limit: result.limit,
      remaining: result.remaining,
      requiresSignup: result.requiresSignup
    };
  }

  // For authenticated users, use existing logic
  try {
    if (useMockMode || !firestore) {
      const user = mockUsers.get(userId) || { tier: 'free', videosThisMonth: 0 };
      const result = canProcessVideo(user.tier, user.videosThisMonth || 0);
      return {
        canProcess: result.canProcess,
        tier: user.tier,
        videosThisMonth: result.used,
        limit: result.limit,
        remaining: result.remaining,
        requiresSignup: false
      };
    }

    const userDoc = await firestore.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      const result = canProcessVideo('free', 0);
      return {
        canProcess: true,
        tier: 'free',
        videosThisMonth: 0,
        limit: result.limit,
        remaining: result.remaining,
        requiresSignup: false
      };
    }

    const user = userDoc.data();
    const tier = user.tier || 'free';
    const videosThisMonth = user.videosThisMonth || 0;

    const result = canProcessVideo(tier, videosThisMonth);

    return {
      canProcess: result.canProcess,
      tier,
      videosThisMonth: result.used,
      limit: result.limit,
      remaining: result.remaining,
      requiresSignup: false
    };
  } catch (error) {
    console.error('Error checking video quota:', error.message);
    const result = canProcessVideo('free', 0);
    return {
      canProcess: true,
      tier: 'free',
      videosThisMonth: 0,
      limit: result.limit,
      remaining: result.remaining,
      requiresSignup: false
    };
  }
}

/**
 * Increment video count for a user
 * @param {string} userId - User ID (or sessionId for anonymous)
 * @returns {Promise<boolean>} - Success status
 */
async function incrementVideoCount(userId) {
  // Handle anonymous users
  if (isAnonymousUser(userId)) {
    return anonymousSessionService.incrementVideoCount(userId);
  }

  // For authenticated users
  try {
    if (useMockMode || !firestore) {
      let user = mockUsers.get(userId) || { userId, tier: 'free', videosThisMonth: 0, questionsThisMonth: 0 };
      user.videosThisMonth = (user.videosThisMonth || 0) + 1;
      mockUsers.set(userId, user);
      return true;
    }

    const userDoc = await firestore.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      await firestore.collection('users').doc(userId).set({
        userId,
        tier: 'free',
        videosThisMonth: 1,
        questionsThisMonth: 0,
        createdAt: new Date(),
        lastResetDate: new Date(),
      });
      return true;
    }

    const currentCount = userDoc.data().videosThisMonth || 0;
    await firestore.collection('users').doc(userId).update({
      videosThisMonth: currentCount + 1,
      updatedAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error('Error incrementing video count:', error.message);
    return false;
  }
}

/**
 * Increment channel import count for a user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Success status
 */
async function incrementChannelCount(userId) {
  try {
    if (useMockMode || !firestore) {
      let user = mockUsers.get(userId) || { userId, tier: 'free', channelsThisMonth: 0, questionsThisMonth: 0 };
      user.channelsThisMonth = (user.channelsThisMonth || 0) + 1;
      mockUsers.set(userId, user);
      return true;
    }

    const userDoc = await firestore.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      await firestore.collection('users').doc(userId).set({
        userId,
        tier: 'free',
        channelsThisMonth: 1,
        questionsThisMonth: 0,
        createdAt: new Date(),
        lastResetDate: new Date(),
      });
      return true;
    }

    const currentCount = userDoc.data().channelsThisMonth || 0;
    await firestore.collection('users').doc(userId).update({
      channelsThisMonth: currentCount + 1,
      updatedAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error('Error incrementing channel count:', error.message);
    return false;
  }
}

/**
 * Increment question count for a user
 * @param {string} userId - User ID (or sessionId for anonymous)
 * @returns {Promise<boolean>} - Success status
 */
async function incrementQuestionCount(userId) {
  // Handle anonymous users
  if (isAnonymousUser(userId)) {
    return anonymousSessionService.incrementQuestionCount(userId);
  }
  try {
    // Use mock mode if Firestore is not available
    if (useMockMode || !firestore) {
      let user = mockUsers.get(userId) || { userId, tier: 'free', questionsThisMonth: 0, exportsThisMonth: 0 };
      user.questionsThisMonth = (user.questionsThisMonth || 0) + 1;
      mockUsers.set(userId, user);
      return true;
    }

    const userDoc = await firestore.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      await firestore.collection('users').doc(userId).set({
        userId,
        tier: 'free',
        questionsThisMonth: 1,
        exportsThisMonth: 0,
        createdAt: new Date(),
        lastResetDate: new Date(),
      });
      return true;
    }

    const currentCount = userDoc.data().questionsThisMonth || 0;
    await firestore.collection('users').doc(userId).update({
      questionsThisMonth: currentCount + 1,
      updatedAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error('Error incrementing question count:', error.message);
    // Fallback to mock mode
    let user = mockUsers.get(userId) || { userId, tier: 'free', questionsThisMonth: 0, exportsThisMonth: 0 };
    user.questionsThisMonth = (user.questionsThisMonth || 0) + 1;
    mockUsers.set(userId, user);
    return true;
  }
}

/**
 * Get remaining questions for a user
 * @param {string} userId - User ID
 * @returns {Promise<object>} - { remaining, limit, used, tier }
 */
async function getRemainingQuestions(userId) {
  try {
    const quotaInfo = await checkQuestionQuota(userId);
    return {
      remaining: quotaInfo.remaining,
      limit: quotaInfo.limit,
      used: quotaInfo.questionsThisMonth,
      tier: quotaInfo.tier
    };
  } catch (error) {
    console.error('Error getting remaining questions:', error.message);
    return {
      remaining: 15,
      limit: 15,
      used: 0,
      tier: 'free'
    };
  }
}

module.exports = {
  checkQuestionQuota,
  checkVideoQuota,
  checkChannelQuota,
  incrementQuestionCount,
  incrementVideoCount,
  incrementChannelCount,
  getRemainingQuestions,
  isAnonymousUser
};
