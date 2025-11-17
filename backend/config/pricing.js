/**
 * WanderCut Pricing Tiers Configuration
 * Solution 3: Usage-Based Pricing with Credit System
 *
 * Cost Analysis (Gemini-only):
 * - Video processing: ~$0.09 per video (transcription + analysis)
 * - Question: ~$0.015 per question (with optimizations)
 *
 * Target: 75-85% profit margin
 */

const PRICING_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: '', // No Stripe price ID for free tier
    features: {
      videosPerMonth: 3,
      questionsPerMonth: 15,
      videoQuality: '720p',
      features: [
        '3 videos per month',
        '15 questions total',
        'All AI features',
        'Community support'
      ]
    },
    // Cost calculation: 3 videos × $0.09 + 15 questions × $0.015 = $0.27 + $0.225 = $0.495
    estimatedCost: 0.50,
    margin: -100 // Acquisition cost
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    price: 15,
    priceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter',
    features: {
      videosPerMonth: 25,
      questionsPerMonth: 100,
      videoQuality: '1080p',
      features: [
        '25 videos per month',
        '100 questions per month',
        'All AI features',
        'Email support'
      ]
    },
    // Cost: 25 × $0.09 + 100 × $0.015 = $2.25 + $1.50 = $3.75
    estimatedCost: 3.75,
    margin: 75 // (15 - 3.75) / 15 = 75%
  },

  creator: {
    id: 'creator',
    name: 'Creator',
    price: 35,
    priceId: process.env.STRIPE_CREATOR_PRICE_ID || 'price_creator',
    popular: true,
    features: {
      videosPerMonth: 75,
      questionsPerMonth: 300,
      videoQuality: '4K',
      features: [
        '75 videos per month',
        '300 questions per month',
        'All AI features',
        'Priority support',
        'Export transcripts'
      ]
    },
    // Cost: 75 × $0.09 + 300 × $0.015 = $6.75 + $4.50 = $11.25
    estimatedCost: 11.25,
    margin: 68 // (35 - 11.25) / 35 = 68%
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    price: 89,
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
    features: {
      videosPerMonth: 200,
      questionsPerMonth: 1000,
      videoQuality: '4K',
      features: [
        '200 videos per month',
        '1000 questions per month',
        'All AI features',
        'Priority support',
        'Export transcripts',
        'API access',
        'White-label option'
      ]
    },
    // Cost: 200 × $0.09 + 1000 × $0.015 = $18.00 + $15.00 = $33.00
    estimatedCost: 33.00,
    margin: 63 // (89 - 33) / 89 = 63%
  }
};

/**
 * Get tier configuration by tier ID
 * @param {string} tierId - Tier ID (free, starter, creator, pro)
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
 * Check if user can process a video based on tier limits
 * @param {string} tier - User's tier
 * @param {number} videosThisMonth - Videos processed this month
 * @returns {object} { canProcess: boolean, limit: number, remaining: number }
 */
function canProcessVideo(tier, videosThisMonth) {
  const config = getTierConfig(tier);
  const limit = config.features.videosPerMonth;
  const remaining = Math.max(0, limit - videosThisMonth);

  return {
    canProcess: videosThisMonth < limit,
    limit,
    remaining,
    used: videosThisMonth
  };
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
  canProcessVideo,
  canAskQuestion,
  getUsagePercentage
};
