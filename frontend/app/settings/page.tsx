'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Crown, Zap, CreditCard, LogOut, ArrowLeft } from 'lucide-react'
import axios from 'axios'
import UsageDashboard from '@/components/UsageDashboard'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  const fetchSubscriptionStatus = useCallback(async () => {
    if (!user) return

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await axios.get(`${apiUrl}/api/subscriptions/status/${user.id}`)
      setSubscriptionStatus(response.data)
    } catch (error) {
      console.error('Error fetching subscription status:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus()
    } else {
      router.push('/auth')
    }
  }, [user, router, fetchSubscriptionStatus])

  const handleManageSubscription = async () => {
    if (!user) return

    setPortalLoading(true)
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
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    )
  }

  const isCreator = subscriptionStatus?.tier === 'creator' || subscriptionStatus?.hasActiveSubscription

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navigation Header */}
      <div className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 lg:px-6">
          {/* Left: Logo and Back Button */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg px-2 py-1 -ml-2"
            >
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                WanderMind
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-8">Settings</h1>

          {/* Subscription Section */}
          <div className="mb-8 pb-8 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Subscription</h2>
                <div className="flex items-center space-x-2">
                  {isCreator ? (
                    <>
                      <Crown className="w-5 h-5 text-yellow-500" />
                      <span className="text-slate-700">Creator Tier</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 text-slate-400" />
                      <span className="text-slate-700">Free Tier</span>
                    </>
                  )}
                </div>
              </div>
              {isCreator ? (
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center"
                >
                  {portalLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Manage Subscription
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => router.push('/pricing')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all"
                >
                  Upgrade to Creator
                </button>
              )}
            </div>

            {subscriptionStatus?.subscription && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>Status:</strong> {subscriptionStatus.subscription.status}
                </p>
                {subscriptionStatus.subscription.currentPeriodEnd && (
                  <p className="text-sm text-slate-600 mt-1">
                    <strong>Renews:</strong>{' '}
                    {new Date(subscriptionStatus.subscription.currentPeriodEnd * 1000).toLocaleDateString()}
                  </p>
                )}
                {subscriptionStatus.subscription.cancelAtPeriodEnd && (
                  <p className="text-sm text-orange-600 mt-1">
                    Subscription will cancel at the end of the billing period
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Account Section */}
          <div className="mb-8 pb-8 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Account</h2>
            <div className="space-y-2">
              <p className="text-slate-700">
                <strong>Email:</strong> {user?.email}
              </p>
              <p className="text-slate-700">
                <strong>User ID:</strong> {user?.id}
              </p>
            </div>
          </div>

          {/* Usage Section - Comprehensive Dashboard */}
          <div className="mb-8">
            {user && <UsageDashboard userId={user.id} />}
          </div>

          {/* Sign Out */}
          <div>
            <button
              onClick={async () => {
                await signOut()
                router.push('/auth')
              }}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

