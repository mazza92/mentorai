'use client'

import { useState, useEffect } from 'react'
import { Video, MessageSquare, TrendingUp, Crown, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import axios from 'axios'
import Link from 'next/link'

interface UsageDashboardProps {
  userId: string
  compact?: boolean
}

interface UsageData {
  tier: string
  channelsThisMonth: number
  channelsLimit: number
  channelsRemaining: number
  questionsThisMonth: number
  questionsLimit: number
  questionsRemaining: number
}

export default function UsageDashboard({ userId, compact = false }: UsageDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsage()

    // Auto-refresh every 30 seconds to keep quota display up-to-date
    const intervalId = setInterval(() => {
      fetchUsage()
    }, 30000) // 30 seconds

    return () => clearInterval(intervalId)
  }, [userId])

  const fetchUsage = async () => {
    try {
      setLoading(true)
      setError(null)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

      // Fetch user data which includes quota information
      const userResponse = await axios.get(`${apiUrl}/api/user/${userId}`)
      const user = userResponse.data.user

      // Fetch channel and question quota
      const [channelQuota, questionQuota] = await Promise.all([
        axios.post(`${apiUrl}/api/user/${userId}/check-channel`),
        axios.post(`${apiUrl}/api/user/${userId}/check-question`)
      ])

      setUsage({
        tier: user.tier || 'free',
        channelsThisMonth: channelQuota.data.channelsThisMonth,
        channelsLimit: channelQuota.data.limit,
        channelsRemaining: channelQuota.data.remaining,
        questionsThisMonth: questionQuota.data.questionsThisMonth,
        questionsLimit: questionQuota.data.limit,
        questionsRemaining: questionQuota.data.remaining
      })
    } catch (err: any) {
      console.error('Error fetching usage:', err)
      setError('Failed to load usage data')
    } finally {
      setLoading(false)
    }
  }

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === 0 || limit === Infinity) return 0
    if (used === 0) return 0
    const percentage = (used / limit) * 100
    // Show at least 1% if any usage exists, but keep decimal precision for small values
    if (percentage < 1 && used > 0) return Math.max(1, percentage)
    return Math.min(100, Math.round(percentage))
  }

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-500 bg-red-50'
    if (percentage >= 70) return 'text-amber-500 bg-amber-50'
    return 'text-green-500 bg-green-50'
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-amber-500'
    return 'bg-blue-500'
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-md ${compact ? 'p-4' : 'p-6'} border border-slate-200`}>
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      </div>
    )
  }

  if (error || !usage) {
    return (
      <div className={`bg-white rounded-xl shadow-md ${compact ? 'p-4' : 'p-6'} border border-slate-200`}>
        <div className="flex items-center text-red-500">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span className="text-sm">{error || 'Unable to load usage data'}</span>
        </div>
      </div>
    )
  }

  const channelPercentage = getUsagePercentage(usage.channelsThisMonth, usage.channelsLimit)
  const questionPercentage = getUsagePercentage(usage.questionsThisMonth, usage.questionsLimit)

  if (compact) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-3 border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600 uppercase">{usage.tier} Plan</span>
          {usage.tier === 'free' && (
            <Link href="/pricing" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              Upgrade
            </Link>
          )}
        </div>

        <div className="space-y-2">
          {/* Channels */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <Video className="w-3 h-3 text-slate-500 mr-1" />
                <span className="text-xs text-slate-600">Channels</span>
              </div>
              <span className="text-xs font-semibold text-slate-700">
                {usage.channelsThisMonth}/{usage.channelsLimit}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${getProgressColor(channelPercentage)}`}
                style={{ width: `${channelPercentage}%`, minWidth: channelPercentage > 0 ? '2px' : '0px' }}
              />
            </div>
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <MessageSquare className="w-3 h-3 text-slate-500 mr-1" />
                <span className="text-xs text-slate-600">Questions</span>
              </div>
              <span className="text-xs font-semibold text-slate-700">
                {usage.questionsThisMonth}/{usage.questionsLimit}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${getProgressColor(questionPercentage)}`}
                style={{ width: `${questionPercentage}%`, minWidth: questionPercentage > 0 ? '2px' : '0px' }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Usage Dashboard</h2>
          <p className="text-sm text-slate-600 mt-1">Track your monthly quota</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchUsage}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
            title="Refresh usage data"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${
            usage.tier === 'free' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'
          }`}>
            <Crown className="w-4 h-4 inline mr-1" />
            {usage.tier}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Channels */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <Video className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Channels Imported</h3>
                <p className="text-xs text-slate-500">Monthly limit</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">
                {usage.channelsThisMonth}<span className="text-base text-slate-500">/{usage.channelsLimit}</span>
              </p>
              <p className={`text-xs font-medium ${getStatusColor(channelPercentage).split(' ')[0]}`}>
                {usage.channelsRemaining} remaining
              </p>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(channelPercentage)}`}
              style={{ width: `${channelPercentage}%`, minWidth: channelPercentage > 0 ? '4px' : '0px' }}
            />
          </div>
          {channelPercentage >= 80 && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠️ You're running low on channel quota. Consider upgrading to import more channels.
            </p>
          )}
        </div>

        {/* Questions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Questions Asked</h3>
                <p className="text-xs text-slate-500">Monthly limit</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">
                {usage.questionsThisMonth}<span className="text-base text-slate-500">/{usage.questionsLimit}</span>
              </p>
              <p className={`text-xs font-medium ${getStatusColor(questionPercentage).split(' ')[0]}`}>
                {usage.questionsRemaining} remaining
              </p>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(questionPercentage)}`}
              style={{ width: `${questionPercentage}%`, minWidth: questionPercentage > 0 ? '4px' : '0px' }}
            />
          </div>
          {questionPercentage >= 80 && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠️ You're running low on questions. Consider upgrading for more questions.
            </p>
          )}
        </div>
      </div>

      {/* Upgrade CTA */}
      {usage.tier === 'free' && (channelPercentage >= 50 || questionPercentage >= 50) && (
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          <div className="flex items-start">
            <TrendingUp className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-slate-900 mb-1">Upgrade for More</h4>
              <p className="text-sm text-slate-600 mb-3">
                Get up to 15 channels and 500 questions per month with Pro plan.
              </p>
              <Link
                href="/pricing"
                className="inline-block px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all text-sm"
              >
                View Plans
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
