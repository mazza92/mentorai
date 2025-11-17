const express = require('express');
const { mockUsers } = require('../utils/mockStorage');

const router = express.Router();

/**
 * TEST HELPER ENDPOINTS
 * These endpoints should ONLY be enabled in development/test mode
 */

// Set user tier and counters for testing
router.post('/set-user', (req, res) => {
  try {
    const { userId, tier, questionsThisMonth, exportsThisMonth } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = {
      userId,
      tier: tier || 'free',
      questionsThisMonth: questionsThisMonth !== undefined ? questionsThisMonth : 0,
      exportsThisMonth: exportsThisMonth !== undefined ? exportsThisMonth : 0,
      lastResetDate: new Date(),
      createdAt: new Date(),
    };

    mockUsers.set(userId, user);

    res.json({
      success: true,
      message: 'User data set successfully',
      user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user data for verification
router.get('/get-user/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const user = mockUsers.get(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist in mock storage',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset user to initial state
router.post('/reset-user/:userId', (req, res) => {
  try {
    const { userId } = req.params;

    const user = {
      userId,
      tier: 'free',
      questionsThisMonth: 0,
      exportsThisMonth: 0,
      lastResetDate: new Date(),
      createdAt: new Date(),
    };

    mockUsers.set(userId, user);

    res.json({
      success: true,
      message: 'User reset to initial state',
      user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simulate month change (reset counters)
router.post('/simulate-month-reset/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    let user = mockUsers.get(userId);

    if (!user) {
      user = {
        userId,
        tier: 'free',
        questionsThisMonth: 0,
        exportsThisMonth: 0,
        createdAt: new Date(),
      };
    }

    // Set lastResetDate to previous month to trigger reset
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    user.lastResetDate = lastMonth;
    mockUsers.set(userId, user);

    res.json({
      success: true,
      message: 'Month reset simulated. Call GET /api/user/:userId to trigger reset.',
      user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all mock users
router.get('/list-users', (req, res) => {
  try {
    const users = Array.from(mockUsers.entries()).map(([userId, user]) => ({
      userId,
      ...user,
    }));

    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
