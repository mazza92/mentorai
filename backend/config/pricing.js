/**
 * Lurnia pricing
 *
 * Charge the aha (playbooks + questions). Search stays free: that is acquisition.
 * Playbook quota is unique videos opened this month. Reopening the same video is free.
 *
 * Cost (cached playbooks + Gemini Q&A):
 * - Search: YouTube Data API, cacheable, ~€0
 * - New playbook: ~€0.03 once, then cache
 * - Question: ~€0.015
 *
 * Stripe: keep STRIPE_PRO_PRICE_ID in env. Create a €15/month price in Stripe to match the UI.
 */

const PRICING_TIERS = {
  anonymous: {
    id: 'anonymous',
    name: 'Try it',
    price: 0,
    priceId: '',
    features: {
      searchesPerMonth: null,
      playbooksPerMonth: 1,
      questionsPerMonth: 3,
      channelsPerMonth: 0,
      questionsPerChannel: 3,
      features: [
        'Search high-value YouTube',
        '1 playbook',
        '3 questions',
        'Sign up for more'
      ]
    },
    estimatedCostEUR: 0.08,
    margin: -100
  },

  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: '',
    features: {
      searchesPerMonth: null,
      playbooksPerMonth: 6,
      questionsPerMonth: 25,
      channelsPerMonth: 0,
      questionsPerChannel: null,
      features: [
        'Unlimited value search',
        '6 playbooks / month',
        '25 questions / month',
        'Ranked by engagement, not views'
      ]
    },
    estimatedCostEUR: 0.55,
    margin: -100
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    price: 15,
    priceEUR: 15,
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
    popular: true,
    features: {
      searchesPerMonth: null,
      playbooksPerMonth: 60,
      questionsPerMonth: 250,
      channelsPerMonth: 0,
      questionsPerChannel: null,
      features: [
        'Unlimited value search',
        '60 playbooks / month',
        '250 questions / month',
        'Export playbooks',
        'Priority support'
      ]
    },
    estimatedCostEUR: 4.2,
    margin: 72
  }
};

function getTierConfig(tierId) {
  return PRICING_TIERS[tierId] || PRICING_TIERS.free;
}

function getAllTiers() {
  return Object.values(PRICING_TIERS);
}

function canImportChannel(tier, channelsThisMonth) {
  const config = getTierConfig(tier);
  const limit = config.features.channelsPerMonth || 0;
  const remaining = Math.max(0, limit - channelsThisMonth);

  return {
    canImport: channelsThisMonth < limit,
    limit,
    remaining,
    used: channelsThisMonth
  };
}

function canProcessVideo(tier, videosThisMonth) {
  return canOpenPlaybook(tier, videosThisMonth);
}

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

function canOpenPlaybook(tier, playbooksThisMonth, videoId, openedIds) {
  const config = getTierConfig(tier);
  const limit = config.features.playbooksPerMonth;
  const ids = Array.isArray(openedIds) ? openedIds : [];
  const alreadyOpen = videoId && ids.includes(videoId);
  const used = ids.length || playbooksThisMonth || 0;
  const remaining = Math.max(0, limit - used);

  if (alreadyOpen) {
    return {
      canOpen: true,
      isNew: false,
      limit,
      remaining,
      used
    };
  }

  return {
    canOpen: used < limit,
    isNew: used < limit,
    limit,
    remaining,
    used
  };
}

function getUsagePercentage(used, limit) {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

module.exports = {
  PRICING_TIERS,
  getTierConfig,
  getAllTiers,
  canImportChannel,
  canProcessVideo,
  canAskQuestion,
  canOpenPlaybook,
  getUsagePercentage
};
