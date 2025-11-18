/**
 * WanderCut Pricing Tiers Configuration
 * Simplified 2-Tier Pricing for Better Conversion
 *
 * Cost Analysis (Gemini-only):
 * - Video processing: ~$0.09 per video (transcription + analysis)
 * - Question: ~$0.015 per question (with optimizations)
 *
 * Target: 60-75% profit margin
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
        '15 questions per month',
        'All AI features',
        'Community support'
      ]
    },
    // Cost calculation: 3 videos × $0.09 + 15 questions × $0.015 = $0.27 + $0.225 = $0.495
    estimatedCost: 0.50,
    margin: -100 // Acquisition cost
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    price: 19,
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
    popular: true,
    features: {
      videosPerMonth: 50,
      questionsPerMonth: 10000, // Effectively unlimited
      videoQuality: '1080p',
      features: [
        '50 videos per month',
        'Unlimited questions',
        'All AI features',
        'Priority support',
        'Export transcripts',
        'Early access to new features'
      ]
    },
    // Estimated cost: 50 videos × $0.09 + avg 200 questions × $0.015 = $4.50 + $3.00 = $7.50
    // Conservative estimate with higher usage: 50 videos + 500 questions = $4.50 + $7.50 = $12.00
    estimatedCost: 7.50,
    estimatedCostHeavyUser: 12.00,
    margin: 61 // (19 - 7.50) / 19 = 61%
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
