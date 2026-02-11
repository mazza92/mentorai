'use client'

import { useState, useEffect } from 'react'
import { Check, Zap, Crown, Rocket, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import axios from 'axios'

interface PricingPlan {
  name: string
  price: string
  priceId: string
  description: string
  features: string[]
  icon: React.ReactNode
  popular?: boolean
}

// Plans will be defined inside component to access translations

export default function Pricing() {
  const { t } = useTranslation('common')
  const { user, loading: authLoading, signInWithGoogle } = useAuth()
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  const plans: PricingPlan[] = [
    {
      name: t('pricing.free_tier'),
      price: '€0',
      priceId: '',
      description: t('pricing.free_description'),
      features: [
        t('pricing.features.channels_per_month', { count: 2 }),
        t('pricing.features.questions_per_month', { count: 10 }),
        t('pricing.features.questions_per_channel', { count: 5 }),
        t('pricing.features.on_demand_transcripts'),
        t('pricing.features.community_support'),
      ],
      icon: <Zap className="w-6 h-6" />,
    },
    {
      name: t('pricing.pro_tier'),
      price: '€24.99',
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
      description: t('pricing.pro_description'),
      features: [
        t('pricing.features.channels_per_month', { count: 15 }),
        t('pricing.features.questions_per_month', { count: 500 }),
        t('pricing.features.on_demand_transcripts'),
        t('pricing.features.priority_support'),
        t('pricing.features.export_transcripts'),
        t('pricing.features.early_access'),
      ],
      icon: <Crown className="w-6 h-6" />,
      popular: true,
    },
  ]

  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus()

      // Check for pending upgrade intent after sign-in
      const pendingUpgrade = sessionStorage.getItem('pendingUpgrade')
      if (pendingUpgrade) {
        sessionStorage.removeItem('pendingUpgrade')
        // Small delay to ensure subscription status is fetched
        setTimeout(() => {
          handleSubscribe(pendingUpgrade, 'Pro')
        }, 500)
      }
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
      // Store intent to upgrade after sign-in
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pendingUpgrade', priceId)
      }
      // Trigger Google sign-in
      try {
        await signInWithGoogle()
      } catch (error) {
        console.error('Sign in error:', error)
      }
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

      // Redirect directly to Stripe Checkout URL (modern approach)
      if (response.data.url) {
        window.location.href = response.data.url
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error)
      alert(error.response?.data?.error || 'Failed to start checkout. Please try again.')
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
          <h1 className="text-4xl font-bold text-slate-900 mb-4">{t('pricing.title')}</h1>
          <p className="text-lg text-slate-600">{t('pricing.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => {
            const planTier = index === 0 ? 'free' : 'pro'
            const isCurrentPlan = planTier === currentTier

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
                      {t('pricing.most_popular')}
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
                  {plan.price !== '€0' && <span className="text-slate-600 ml-2">/month</span>}
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
                    {t('pricing.current_plan')}
                  </button>
                ) : planTier === 'free' ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-slate-200 text-slate-600 rounded-lg font-semibold cursor-not-allowed"
                  >
                    {t('pricing.free_tier')}
                  </button>
                ) : !user ? (
                  <button
                    onClick={() => handleSubscribe(plan.priceId, plan.name)}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all"
                  >
                    {t('pricing.sign_in_to_upgrade')}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.priceId, plan.name)}
                    disabled={checkoutLoading === plan.priceId}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50"
                  >
                    {checkoutLoading === plan.priceId ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      t('pricing.upgrade_to', { plan: plan.name })
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
              {loading ? t('common.loading') : t('pricing.manage_subscription')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
