const { Firestore } = require('@google-cloud/firestore');
const {
  canProcessVideo,
  canAskQuestion,
} = require('../config/pricing');
const { mockUsers } = require('../utils/mockStorage');

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
 * Check if user can ask a question (based on tier limits)
 * @param {string} userId - User ID
 * @returns {Promise<object>} - { canAsk, tier, questionsThisMonth, limit, remaining }
 */
async function checkQuestionQuota(userId) {
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
 * Increment question count for a user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Success status
 */
async function incrementQuestionCount(userId) {
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
  incrementQuestionCount,
  getRemainingQuestions
};
