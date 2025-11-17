const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Firestore } = require('@google-cloud/firestore');
const { mockUsers } = require('../utils/mockStorage');

const router = express.Router();

// Initialize Firestore
let firestore;
let useMockMode = false;

try {
  firestore = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'mock-project',
  });
} catch (error) {
  console.log('Firestore not configured, using mock mode for subscriptions');
  useMockMode = true;
}

// Get or create Stripe customer for user
async function getOrCreateCustomer(userId, email) {
  try {
    // Check if user already has a Stripe customer ID
    let user;
    if (useMockMode || !firestore) {
      user = mockUsers.get(userId);
    } else {
      const userDoc = await firestore.collection('users').doc(userId).get();
      user = userDoc.exists ? userDoc.data() : null;
    }

    if (user && user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        userId: userId,
      },
    });

    // Save customer ID to user
    if (useMockMode || !firestore) {
      if (!user) {
        user = { userId, tier: 'free', exportsThisMonth: 0, questionsThisMonth: 0 };
      }
      user.stripeCustomerId = customer.id;
      mockUsers.set(userId, user);
    } else {
      if (user) {
        await firestore.collection('users').doc(userId).update({
          stripeCustomerId: customer.id,
        });
      } else {
        await firestore.collection('users').doc(userId).set({
          userId,
          stripeCustomerId: customer.id,
          tier: 'free',
          exportsThisMonth: 0,
          questionsThisMonth: 0,
          createdAt: new Date(),
        });
      }
    }

    return customer.id;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
}

/**
 * POST /api/subscriptions/create-checkout-session
 * Create Stripe Checkout session for subscription
 */
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { userId, email, priceId } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: 'User ID and email are required' });
    }

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(userId, email);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/cancel`,
      metadata: {
        userId: userId,
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session', details: error.message });
  }
});

/**
 * POST /api/subscriptions/create-portal-session
 * Create Stripe Customer Portal session for subscription management
 */
router.post('/create-portal-session', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get user's Stripe customer ID
    let user;
    if (useMockMode || !firestore) {
      user = mockUsers.get(userId);
    } else {
      const userDoc = await firestore.collection('users').doc(userId).get();
      user = userDoc.exists ? userDoc.data() : null;
    }

    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({ error: 'No subscription found for this user' });
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000'}/settings`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session', details: error.message });
  }
});

/**
 * GET /api/subscriptions/status/:userId
 * Get user's subscription status
 */
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user
    let user;
    if (useMockMode || !firestore) {
      user = mockUsers.get(userId);
    } else {
      const userDoc = await firestore.collection('users').doc(userId).get();
      user = userDoc.exists ? userDoc.data() : null;
    }

    if (!user) {
      return res.json({
        tier: 'free',
        subscription: null,
        hasActiveSubscription: false,
      });
    }

    // If user has Stripe customer ID, get subscription from Stripe
    if (user.stripeCustomerId) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: 'active',
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          return res.json({
            tier: 'creator',
            subscription: {
              id: subscription.id,
              status: subscription.status,
              currentPeriodEnd: subscription.current_period_end,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            },
            hasActiveSubscription: subscription.status === 'active',
          });
        }
      } catch (stripeError) {
        console.error('Error fetching Stripe subscription:', stripeError);
      }
    }

    // Fallback to user tier from database
    res.json({
      tier: user.tier || 'free',
      subscription: null,
      hasActiveSubscription: false,
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ error: 'Failed to get subscription status', details: error.message });
  }
});

/**
 * Webhook handler (exported separately for server.js registration)
 * POST /api/subscriptions/webhook
 * Handle Stripe webhook events
 * Note: This route is registered in server.js with raw body parser BEFORE json middleware
 */
const webhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(400).send('Webhook secret not configured');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;

        if (userId) {
          // Update user tier to creator
          if (useMockMode || !firestore) {
            const user = mockUsers.get(userId) || { userId, tier: 'free' };
            user.tier = 'creator';
            user.stripeCustomerId = session.customer;
            user.subscriptionId = session.subscription;
            mockUsers.set(userId, user);
          } else {
            await firestore.collection('users').doc(userId).update({
              tier: 'creator',
              stripeCustomerId: session.customer,
              subscriptionId: session.subscription,
              updatedAt: new Date(),
            });
          }
          console.log(`User ${userId} upgraded to creator tier`);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by Stripe customer ID
        if (useMockMode || !firestore) {
          // In mock mode, iterate through users
          for (const [userId, user] of mockUsers.entries()) {
            if (user.stripeCustomerId === customerId) {
              if (subscription.status === 'active') {
                user.tier = 'creator';
                user.subscriptionId = subscription.id;
              } else {
                user.tier = 'free';
                user.subscriptionId = null;
              }
              mockUsers.set(userId, user);
              console.log(`User ${userId} subscription updated: ${subscription.status}`);
              break;
            }
          }
        } else {
          const usersRef = firestore.collection('users');
          const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();

          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const updateData = {
              subscriptionId: subscription.id,
              updatedAt: new Date(),
            };

            if (subscription.status === 'active') {
              updateData.tier = 'creator';
            } else {
              updateData.tier = 'free';
            }

            await userDoc.ref.update(updateData);
            console.log(`User ${userDoc.id} subscription updated: ${subscription.status}`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Also register as regular route (for testing, but won't work without raw body)
router.post('/webhook', webhookHandler);

module.exports = router;
module.exports.webhookHandler = webhookHandler;

