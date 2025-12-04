/**
 * WanderCut Pricing Tiers Configuration
 * MVP Focus: Channel Upload Only (USP)
 *
 * Cost Analysis (On-Demand Transcript Fetching):
 * - Channel import (metadata): ~€0.01 (negligible)
 * - Question cost: ~€0.015 per question (Gemini API + 3 on-demand transcript fetches)
 *
 * Target: 70% profit margin
 */

const PRICING_TIERS = {
  anonymous: {
    id: 'anonymous',
    name: 'Anonymous',
    price: 0,
    priceId: '', // No Stripe - teaser tier before signup
    features: {
      channelsPerMonth: 1,
      questionsPerMonth: 1,
      questionsPerChannel: 1,
      features: [
        '1 channel upload (teaser)',
        '1 question (teaser)',
        'Sign up for more'
      ]
    },
    // Cost calculation: 1 channel × €0.01 + 1 question × €0.015 = €0.01 + €0.015 = €0.025
    estimatedCost: 0.025,
    estimatedCostEUR: 0.025,
    margin: -100 // Teaser/acquisition cost
  },

  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: '', // No Stripe price ID for free tier
    features: {
      channelsPerMonth: 2,
      questionsPerMonth: 10, // 5 questions per channel average
      questionsPerChannel: 5, // Soft limit per channel
      features: [
        '2 channel uploads per month',
        '10 questions total (5 per channel)',
        'On-demand transcript fetching',
        'All AI-powered insights',
        'Community support'
      ]
    },
    // Cost calculation: 2 channels × €0.01 + 10 questions × €0.015 = €0.02 + €0.15 = €0.17
    estimatedCost: 0.17,
    estimatedCostEUR: 0.17,
    margin: -100 // Acquisition cost
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    price: 24.99,
    priceEUR: 24.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
    popular: true,
    features: {
      channelsPerMonth: 15,
      questionsPerMonth: 500, // ~33 questions per channel on average
      questionsPerChannel: null, // No per-channel limit
      features: [
        '15 channel uploads per month',
        '500 questions per month',
        'On-demand transcript fetching',
        'All AI-powered insights',
        'Priority support',
        'Export transcripts',
        'Early access to new features'
      ]
    },
    // Cost calculation: 15 channels × €0.01 + 500 questions × €0.015 = €0.15 + €7.50 = €7.65
    estimatedCost: 7.65,
    estimatedCostEUR: 7.65,
    margin: 69 // (24.99 - 7.65) / 24.99 = 69%
  }
};

/**
 * Get tier configuration by tier ID
 * @param {string} tierId - Tier ID (free, pro)
 * @returns {object} Tier configuration
 */
function getTierConfig(tierId) {
  return PRICING_TIERS[tierId] || PRICING_TIERS.free;
}

/**
 * Get all tier configurations
 * @returns {array} Array of tier configurations
 */
function getAllTiers() {
  return Object.values(PRICING_TIERS);
}

/**
 * Check if user can import a channel based on tier limits
 * @param {string} tier - User's tier
 * @param {number} channelsThisMonth - Channels imported this month
 * @returns {object} { canImport: boolean, limit: number, remaining: number }
 */
function canImportChannel(tier, channelsThisMonth) {
  const config = getTierConfig(tier);
  const limit = config.features.channelsPerMonth;
  const remaining = Math.max(0, limit - channelsThisMonth);

  return {
    canImport: channelsThisMonth < limit,
    limit,
    remaining,
    used: channelsThisMonth
  };
}

/**
 * Legacy function - kept for backward compatibility
 * @deprecated Use canImportChannel instead
 */
function canProcessVideo(tier, videosThisMonth) {
  return canImportChannel(tier, videosThisMonth);
}

/**
 * Check if user can ask a question based on tier limits
 * @param {string} tier - User's tier
 * @param {number} questionsThisMonth - Questions asked this month
 * @returns {object} { canAsk: boolean, limit: number, remaining: number }
 */
function canAskQuestion(tier, questionsThisMonth) {
  const config = getTierConfig(tier);
  const limit = config.features.questionsPerMonth;
  const remaining = Math.max(0, limit - questionsThisMonth);

  return {
    canAsk: questionsThisMonth < limit,
    limit,
    remaining,
    used: questionsThisMonth
  };
}

/**
 * Get usage percentage for UI display
 * @param {number} used - Amount used
 * @param {number} limit - Total limit
 * @returns {number} Percentage (0-100)
 */
function getUsagePercentage(used, limit) {
  if (limit === 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}

module.exports = {
  PRICING_TIERS,
  getTierConfig,
  getAllTiers,
  canImportChannel,
  canProcessVideo, // Legacy - use canImportChannel
  canAskQuestion,
  getUsagePercentage
};
