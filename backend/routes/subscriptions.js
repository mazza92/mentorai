const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const { mockUsers } = require('../utils/mockStorage');

const router = express.Router();

// Initialize Stripe only if API key is provided
let stripe = null;
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim() !== '') {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Stripe:', error.message);
  }
} else {
  console.warn('⚠️ STRIPE_SECRET_KEY not configured. Payment features will be disabled.');
}

// Initialize Firestore
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

        console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON');

        throw error;

      }

    }


    firestore = new Firestore(firestoreConfig);
  } else {
    useMockMode = true;
    console.log('Google Cloud not configured, using mock storage for subscriptions');
  }
} catch (error) {
  console.error('Firestore initialization failed:', error.message);
  useMockMode = true;
}

// Get or create Stripe customer for user
async function getOrCreateCustomer(userId, email) {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
  }

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
      try {
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
      } catch (firestoreError) {
        console.error('Error saving to Firestore, falling back to mock storage:', firestoreError.message);
        // Fallback to mock storage
        if (!user) {
          user = { userId, tier: 'free', exportsThisMonth: 0, questionsThisMonth: 0 };
        }
        user.stripeCustomerId = customer.id;
        mockUsers.set(userId, user);
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
    if (!stripe) {
      return res.status(503).json({ error: 'Payment service is not configured. Please contact support.' });
    }

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
    res.status(500).json({
      error: 'Failed to create checkout session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/subscriptions/create-portal-session
 * Create Stripe Customer Portal session for subscription management
 */
router.post('/create-portal-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Payment service is not configured. Please contact support.' });
    }

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
    // Check if this is an invalid/deleted customer error
    if (error.code === 'resource_missing' && error.param === 'customer') {
      console.warn(`⚠️ Invalid Stripe customer ID for user ${userId}: ${user.stripeCustomerId}`);

      // Clear invalid customer ID from database
      if (useMockMode || !firestore) {
        user.stripeCustomerId = null;
        mockUsers.set(userId, user);
      } else {
        try {
          await firestore.collection('users').doc(userId).update({
            stripeCustomerId: null,
          });
        } catch (updateError) {
          console.error('Failed to clear invalid customer ID:', updateError.message);
        }
      }

      return res.status(404).json({ error: 'No active subscription found. Please subscribe first.' });
    }

    console.error('Error creating portal session:', error);
    res.status(500).json({
      error: 'Failed to create portal session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
      try {
        const userDoc = await firestore.collection('users').doc(userId).get();
        user = userDoc.exists ? userDoc.data() : null;
      } catch (firestoreError) {
        console.error('Error fetching from Firestore, falling back to mock storage:', firestoreError.message);
        user = mockUsers.get(userId);
      }
    }

    if (!user) {
      return res.json({
        tier: 'free',
        subscription: null,
        hasActiveSubscription: false,
      });
    }

    // If user has Stripe customer ID, get subscription from Stripe
    if (user.stripeCustomerId && stripe) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: 'active',
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          return res.json({
            tier: 'pro',
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
        // Check if this is an invalid/deleted customer error
        if (stripeError.code === 'resource_missing' && stripeError.param === 'customer') {
          console.warn(`⚠️ Invalid Stripe customer ID for user ${userId}: ${user.stripeCustomerId} - Clearing from database`);

          // Clear invalid customer ID from database to prevent future errors
          if (useMockMode || !firestore) {
            user.stripeCustomerId = null;
            mockUsers.set(userId, user);
          } else {
            try {
              await firestore.collection('users').doc(userId).update({
                stripeCustomerId: null,
              });
            } catch (updateError) {
              console.error('Failed to clear invalid customer ID:', updateError.message);
            }
          }
        } else {
          // Other Stripe errors - log for investigation
          console.error('Error fetching Stripe subscription:', stripeError);
        }
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
    res.status(500).json({
      error: 'Failed to get subscription status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Webhook handler (exported separately for server.js registration)
 * POST /api/subscriptions/webhook
 * Handle Stripe webhook events
 * Note: This route is registered in server.js with raw body parser BEFORE json middleware
 */
const webhookHandler = async (req, res) => {
  if (!stripe) {
    console.error('Stripe not configured, cannot process webhook');
    return res.status(503).send('Payment service not configured');
  }

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
          // Update user tier to pro
          if (useMockMode || !firestore) {
            const user = mockUsers.get(userId) || { userId, tier: 'free' };
            user.tier = 'pro';
            user.stripeCustomerId = session.customer;
            user.subscriptionId = session.subscription;
            mockUsers.set(userId, user);
          } else {
            await firestore.collection('users').doc(userId).update({
              tier: 'pro',
              stripeCustomerId: session.customer,
              subscriptionId: session.subscription,
              updatedAt: new Date(),
            });
          }
          console.log(`User ${userId} upgraded to pro tier`);
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
                user.tier = 'pro';
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
              updateData.tier = 'pro';
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

