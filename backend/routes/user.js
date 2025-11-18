const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const {
  getTierConfig,
  getAllTiers,
  canProcessVideo,
  canAskQuestion,
  getUsagePercentage
} = require('../config/pricing');

const router = express.Router();

// Use shared mock storage
const { mockUsers } = require('../utils/mockStorage');

// Initialize Firestore with error handling for development mode
let firestore;
let useMockMode = false;

try {
  if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id' && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'mock-project') {
    const firestoreConfig = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    };

    // Handle credentials from Railway environment variable
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
    console.log('✅ Firestore initialized for user service');
  } else {
    useMockMode = true;
    console.log('Google Cloud not configured, using mock mode for user service');
  }
} catch (error) {
  console.log('Firestore initialization failed, using mock mode for user service');
  console.log('Error:', error.message);
  useMockMode = true;
}

// Get user subscription info and usage
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Use mock mode if Firestore is not available
    if (useMockMode || !process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID === 'your_project_id') {
      let user = mockUsers.get(userId);

      if (!user) {
        // Create new user with free tier
        user = {
          userId,
          tier: 'free',
          videosThisMonth: 0,
          questionsThisMonth: 0,
          exportsThisMonth: 0,
          createdAt: new Date(),
          lastResetDate: new Date(),
        };
        mockUsers.set(userId, user);
      }

      // Sync tier with Stripe subscription if customer ID exists
      if (user.stripeCustomerId && !useMockMode) {
        try {
          const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          const subscriptions = await stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            status: 'active',
            limit: 1,
          });

          if (subscriptions.data.length > 0 && user.tier !== 'pro') {
            user.tier = 'pro';
            mockUsers.set(userId, user);
          } else if (subscriptions.data.length === 0 && user.tier === 'pro') {
            user.tier = 'free';
            mockUsers.set(userId, user);
          }
        } catch (stripeError) {
          console.error('Error syncing Stripe subscription:', stripeError);
        }
      }

      // Reset monthly count if new month
      const now = new Date();
      const lastReset = user.lastResetDate ? new Date(user.lastResetDate) : null;
      if (!lastReset || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        user.videosThisMonth = 0;
        user.questionsThisMonth = 0;
        user.exportsThisMonth = 0;
        user.lastResetDate = now;
        mockUsers.set(userId, user);
      }
      
      return res.json({ user });
    }
    
    // Get user document from Firestore
    const userDoc = await firestore.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      // Create new user with free tier
      const newUser = {
        userId,
        tier: 'free',
        videosThisMonth: 0,
        questionsThisMonth: 0,
        exportsThisMonth: 0,
        createdAt: new Date(),
        lastResetDate: new Date(),
      };
      await firestore.collection('users').doc(userId).set(newUser);
      return res.json({ user: newUser });
    }

    let user = userDoc.data();

    // Sync tier with Stripe subscription if customer ID exists
    if (user.stripeCustomerId) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: 'active',
          limit: 1,
        });

        const shouldBePro = subscriptions.data.length > 0;
        if (shouldBePro && user.tier !== 'pro') {
          await firestore.collection('users').doc(userId).update({ tier: 'pro' });
          user.tier = 'pro';
        } else if (!shouldBePro && user.tier === 'pro') {
          await firestore.collection('users').doc(userId).update({ tier: 'free' });
          user.tier = 'free';
        }
      } catch (stripeError) {
        console.error('Error syncing Stripe subscription:', stripeError);
      }
    }

    // Reset monthly count if new month
    const now = new Date();
    const lastReset = user.lastResetDate ? user.lastResetDate.toDate() : null;
    if (!lastReset || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      await firestore.collection('users').doc(userId).update({
        videosThisMonth: 0,
        questionsThisMonth: 0,
        exportsThisMonth: 0,
        lastResetDate: now,
      });
      user.videosThisMonth = 0;
      user.questionsThisMonth = 0;
      user.exportsThisMonth = 0;
    }

    res.json({ user });
  } catch (error) {
    // Fallback to mock mode on error
    if (error.code === 'ENOTFOUND' || error.message.includes('credentials') || error.message.includes('Could not load the default credentials')) {
      console.log('Using mock user data for development');
      const { userId } = req.params;
      let user = mockUsers.get(userId) || {
        userId,
        tier: 'free',
        exportsThisMonth: 0,
        createdAt: new Date(),
      };
      mockUsers.set(userId, user);
      return res.json({ user });
    }
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user', details: error.message });
  }
});

// Check if user can export (based on tier limits)
router.post('/:userId/check-export', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Use mock mode if Firestore is not available
    if (useMockMode || !process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID === 'your_project_id') {
      const user = mockUsers.get(userId) || { tier: 'free', exportsThisMonth: 0 };
      const limits = { free: 3, pro: Infinity };
      const limit = limits[user.tier] || 3;
      const canExport = user.exportsThisMonth < limit;
      return res.json({ canExport, tier: user.tier, exportsThisMonth: user.exportsThisMonth || 0, limit });
    }
    
    const userDoc = await firestore.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.json({ canExport: true, tier: 'free', exportsThisMonth: 0, limit: 3 });
    }

    const user = userDoc.data();
    const tier = user.tier || 'free';
    const exportsThisMonth = user.exportsThisMonth || 0;
    
    const limits = {
      free: 3,
      pro: Infinity,
    };

    const limit = limits[tier] || 3;
    const canExport = exportsThisMonth < limit;

    res.json({
      canExport,
      tier,
      exportsThisMonth,
      limit,
    });
  } catch (error) {
    // Fallback to mock mode
    if (error.code === 'ENOTFOUND' || error.message.includes('credentials')) {
      const { userId } = req.params;
      const user = mockUsers.get(userId) || { tier: 'free', exportsThisMonth: 0 };
      return res.json({ canExport: true, tier: user.tier, exportsThisMonth: user.exportsThisMonth || 0, limit: 3 });
    }
    console.error('Error checking export:', error);
    res.status(500).json({ error: 'Failed to check export eligibility', details: error.message });
  }
});

// Increment export count
router.post('/:userId/increment-export', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Use mock mode if Firestore is not available
    if (useMockMode || !process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID === 'your_project_id') {
      let user = mockUsers.get(userId) || { userId, tier: 'free', exportsThisMonth: 0 };
      user.exportsThisMonth = (user.exportsThisMonth || 0) + 1;
      mockUsers.set(userId, user);
      return res.json({ success: true });
    }
    
    const userDoc = await firestore.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      await firestore.collection('users').doc(userId).set({
        userId,
        tier: 'free',
        exportsThisMonth: 1,
        createdAt: new Date(),
        lastResetDate: new Date(),
      });
      return res.json({ success: true });
    }

    const currentCount = userDoc.data().exportsThisMonth || 0;
    await firestore.collection('users').doc(userId).update({
      exportsThisMonth: currentCount + 1,
      updatedAt: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    // Fallback to mock mode
    if (error.code === 'ENOTFOUND' || error.message.includes('credentials')) {
      const { userId } = req.params;
      let user = mockUsers.get(userId) || { userId, tier: 'free', exportsThisMonth: 0 };
      user.exportsThisMonth = (user.exportsThisMonth || 0) + 1;
      mockUsers.set(userId, user);
      return res.json({ success: true });
    }
    console.error('Error incrementing export:', error);
    res.status(500).json({ error: 'Failed to increment export count', details: error.message });
  }
});

// Check if user can ask a question (based on tier limits)
router.post('/:userId/check-question', async (req, res) => {
  try {
    const { userId } = req.params;

    // Use mock mode if Firestore is not available
    if (useMockMode || !process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID === 'your_project_id') {
      const user = mockUsers.get(userId) || { tier: 'free', questionsThisMonth: 0 };
      const result = canAskQuestion(user.tier, user.questionsThisMonth || 0);
      return res.json({
        canAsk: result.canAsk,
        tier: user.tier,
        questionsThisMonth: result.used,
        limit: result.limit,
        remaining: result.remaining
      });
    }

    try {
      const userDoc = await firestore.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        const result = canAskQuestion('free', 0);
        return res.json({
          canAsk: true,
          tier: 'free',
          questionsThisMonth: 0,
          limit: result.limit,
          remaining: result.remaining
        });
      }

      const user = userDoc.data();
      const tier = user.tier || 'free';
      const questionsThisMonth = user.questionsThisMonth || 0;

      const result = canAskQuestion(tier, questionsThisMonth);

      return res.json({
        canAsk: result.canAsk,
        tier,
        questionsThisMonth: result.used,
        limit: result.limit,
        remaining: result.remaining
      });
    } catch (firestoreError) {
      console.error('Firestore error in check-question, falling back to mock mode:', firestoreError.message);
      // Fallback to mock mode
      const { userId } = req.params;
      const user = mockUsers.get(userId) || { tier: 'free', questionsThisMonth: 0 };
      const result = canAskQuestion(user.tier, user.questionsThisMonth || 0);
      return res.json({
        canAsk: result.canAsk,
        tier: user.tier,
        questionsThisMonth: result.used,
        limit: result.limit,
        remaining: result.remaining
      });
    }
  } catch (error) {
    // Fallback to mock mode for any other errors
    console.error('Error in check-question route:', error.message);
    const { userId } = req.params;
    const user = mockUsers.get(userId) || { tier: 'free', questionsThisMonth: 0 };
    const result = canAskQuestion(user.tier, user.questionsThisMonth || 0);
    return res.json({
      canAsk: result.canAsk,
      tier: user.tier,
      questionsThisMonth: result.used,
      limit: result.limit,
      remaining: result.remaining
    });
  }
});

// Check if user can process a video (based on tier limits)
router.post('/:userId/check-video', async (req, res) => {
  try {
    const { userId } = req.params;

    // Use mock mode if Firestore is not available
    if (useMockMode || !process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID === 'your_project_id') {
      const user = mockUsers.get(userId) || { tier: 'free', videosThisMonth: 0 };
      const result = canProcessVideo(user.tier, user.videosThisMonth || 0);
      return res.json({
        canProcess: result.canProcess,
        tier: user.tier,
        videosThisMonth: result.used,
        limit: result.limit,
        remaining: result.remaining
      });
    }

    const userDoc = await firestore.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      const result = canProcessVideo('free', 0);
      return res.json({
        canProcess: true,
        tier: 'free',
        videosThisMonth: 0,
        limit: result.limit,
        remaining: result.remaining
      });
    }

    const user = userDoc.data();
    const tier = user.tier || 'free';
    const videosThisMonth = user.videosThisMonth || 0;

    const result = canProcessVideo(tier, videosThisMonth);

    res.json({
      canProcess: result.canProcess,
      tier,
      videosThisMonth: result.used,
      limit: result.limit,
      remaining: result.remaining
    });
  } catch (error) {
    // Fallback to mock mode
    if (error.code === 'ENOTFOUND' || error.message.includes('credentials')) {
      const { userId } = req.params;
      const user = mockUsers.get(userId) || { tier: 'free', videosThisMonth: 0 };
      const result = canProcessVideo(user.tier, user.videosThisMonth || 0);
      return res.json({
        canProcess: result.canProcess,
        tier: user.tier,
        videosThisMonth: result.used,
        limit: result.limit,
        remaining: result.remaining
      });
    }
    console.error('Error checking video quota:', error);
    res.status(500).json({ error: 'Failed to check video quota', details: error.message });
  }
});

// Increment video count
// IMPORTANT: This tracks TOTAL videos processed this month, not active videos.
// The count is incremented when a video is uploaded and NEVER decremented,
// even if a project is deleted. This prevents users from deleting videos
// and uploading new ones to bypass monthly limits.
router.post('/:userId/increment-video', async (req, res) => {
  try {
    const { userId } = req.params;

    // Use mock mode if Firestore is not available
    if (useMockMode || !process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID === 'your_project_id') {
      let user = mockUsers.get(userId) || { userId, tier: 'free', videosThisMonth: 0, questionsThisMonth: 0, exportsThisMonth: 0 };
      user.videosThisMonth = (user.videosThisMonth || 0) + 1;
      mockUsers.set(userId, user);
      return res.json({ success: true, videosThisMonth: user.videosThisMonth });
    }

    const userDoc = await firestore.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      await firestore.collection('users').doc(userId).set({
        userId,
        tier: 'free',
        videosThisMonth: 1,
        questionsThisMonth: 0,
        exportsThisMonth: 0,
        createdAt: new Date(),
        lastResetDate: new Date(),
      });
      return res.json({ success: true, videosThisMonth: 1 });
    }

    const currentCount = userDoc.data().videosThisMonth || 0;
    await firestore.collection('users').doc(userId).update({
      videosThisMonth: currentCount + 1,
      updatedAt: new Date(),
    });

    res.json({ success: true, videosThisMonth: currentCount + 1 });
  } catch (error) {
    // Fallback to mock mode
    if (error.code === 'ENOTFOUND' || error.message.includes('credentials')) {
      const { userId } = req.params;
      let user = mockUsers.get(userId) || { userId, tier: 'free', videosThisMonth: 0, questionsThisMonth: 0, exportsThisMonth: 0 };
      user.videosThisMonth = (user.videosThisMonth || 0) + 1;
      mockUsers.set(userId, user);
      return res.json({ success: true, videosThisMonth: user.videosThisMonth });
    }
    console.error('Error incrementing video count:', error);
    res.status(500).json({ error: 'Failed to increment video count', details: error.message });
  }
});

// Increment question count
router.post('/:userId/increment-question', async (req, res) => {
  try {
    const { userId } = req.params;

    // Use mock mode if Firestore is not available
    if (useMockMode || !process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID === 'your_project_id') {
      let user = mockUsers.get(userId) || { userId, tier: 'free', questionsThisMonth: 0, exportsThisMonth: 0 };
      user.questionsThisMonth = (user.questionsThisMonth || 0) + 1;
      mockUsers.set(userId, user);
      return res.json({ success: true });
    }

    try {
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
        return res.json({ success: true });
      }

      const currentCount = userDoc.data().questionsThisMonth || 0;
      await firestore.collection('users').doc(userId).update({
        questionsThisMonth: currentCount + 1,
        updatedAt: new Date(),
      });

      return res.json({ success: true });
    } catch (firestoreError) {
      console.error('Firestore error in increment-question, falling back to mock mode:', firestoreError.message);
      // Fallback to mock mode
      const { userId } = req.params;
      let user = mockUsers.get(userId) || { userId, tier: 'free', questionsThisMonth: 0, exportsThisMonth: 0 };
      user.questionsThisMonth = (user.questionsThisMonth || 0) + 1;
      mockUsers.set(userId, user);
      return res.json({ success: true });
    }
  } catch (error) {
    // Fallback to mock mode for any other errors
    console.error('Error in increment-question route:', error.message);
    const { userId } = req.params;
    let user = mockUsers.get(userId) || { userId, tier: 'free', questionsThisMonth: 0, exportsThisMonth: 0 };
    user.questionsThisMonth = (user.questionsThisMonth || 0) + 1;
    mockUsers.set(userId, user);
    return res.json({ success: true });
  }
});

module.exports = router;

