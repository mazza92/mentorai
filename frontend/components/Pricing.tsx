'use client'

import { useState, useEffect } from 'react'
import { Check, Zap, Crown, Rocket, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import axios from 'axios'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

interface PricingPlan {
  name: string
  price: string
  priceId: string
  description: string
  features: string[]
  icon: React.ReactNode
  popular?: boolean
}

const plans: PricingPlan[] = [
  {
    name: 'Free',
    price: '$0',
    priceId: '',
    description: 'Perfect for trying out WanderMind',
    features: [
      '3 videos per month',
      '15 questions total',
      'All AI features',
      'Community support',
    ],
    icon: <Zap className="w-6 h-6" />,
  },
  {
    name: 'Starter',
    price: '$15',
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || '',
    description: 'Great for students and learners',
    features: [
      '25 videos per month',
      '100 questions per month',
      'All AI features',
      'Email support',
    ],
    icon: <Zap className="w-6 h-6" />,
  },
  {
    name: 'Creator',
    price: '$35',
    priceId: process.env.NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID || '',
    description: 'For serious learners and professionals',
    features: [
      '75 videos per month',
      '300 questions per month',
      'All AI features',
      'Priority support',
      'Export transcripts',
    ],
    icon: <Crown className="w-6 h-6" />,
    popular: true,
  },
  {
    name: 'Pro',
    price: '$89',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
    description: 'For power users and educators',
    features: [
      '200 videos per month',
      '1000 questions per month',
      'All AI features',
      'Priority support',
      'Export transcripts',
      'API access',
      'White-label option',
    ],
    icon: <Rocket className="w-6 h-6" />,
  },
]

export default function Pricing() {
  const { user, loading: authLoading } = useAuth()
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus()
    }
  }, [user])

  const fetchSubscriptionStatus = async () => {
    if (!user) return

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await axios.get(`${apiUrl}/api/subscriptions/status/${user.id}`)
      setSubscriptionStatus(response.data)
    } catch (error) {
      console.error('Error fetching subscription status:', error)
    }
  }

  const handleSubscribe = async (priceId: string, planName: string) => {
    if (!user) {
      alert('Please sign in to subscribe')
      return
    }

    if (!priceId) {
      alert(`Price ID not configured. Please set NEXT_PUBLIC_STRIPE_${planName.toUpperCase()}_PRICE_ID`)
      return
    }

    setCheckoutLoading(priceId)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await axios.post(`${apiUrl}/api/subscriptions/create-checkout-session`, {
        userId: user.id,
        email: user.email,
        priceId: priceId,
      })

      const stripe = await stripePromise
      if (stripe && response.data.sessionId) {
        // @ts-ignore - Stripe types may be outdated
        await stripe.redirectToCheckout({ sessionId: response.data.sessionId })
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error)
      alert(error.response?.data?.error || 'Failed to start checkout. Please try again.')
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handleManageSubscription = async () => {
    if (!user) return

    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await axios.post(`${apiUrl}/api/subscriptions/create-portal-session`, {
        userId: user.id,
      })

      if (response.data.url) {
        window.location.href = response.data.url
      }
    } catch (error: any) {
      console.error('Error creating portal session:', error)
      alert(error.response?.data?.error || 'Failed to open subscription management. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const currentTier = subscriptionStatus?.tier || 'free'
  const hasPaidSubscription = currentTier !== 'free'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Choose Your Plan</h1>
          <p className="text-lg text-slate-600">Unlock the full potential of WanderMind AI</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const isCurrentPlan = plan.name.toLowerCase() === currentTier.toLowerCase()

            return (
              <div
                key={plan.name}
                className={`relative bg-white rounded-2xl shadow-lg border-2 p-6 ${
                  plan.popular ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex items-center mb-4">
                  <div className={`p-3 rounded-lg mr-3 ${plan.popular ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {plan.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-slate-600 text-sm">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                  {plan.price !== '$0' && <span className="text-slate-600 ml-2">/month</span>}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-slate-200 text-slate-600 rounded-lg font-semibold cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : plan.name === 'Free' ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-slate-200 text-slate-600 rounded-lg font-semibold cursor-not-allowed"
                  >
                    Free Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.priceId, plan.name)}
                    disabled={!user || checkoutLoading === plan.priceId}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50"
                  >
                    {checkoutLoading === plan.priceId ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {hasPaidSubscription && (
          <div className="mt-8 text-center">
            <button
              onClick={handleManageSubscription}
              disabled={loading}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {loading ? 'Loading...' : 'Manage your subscription'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
