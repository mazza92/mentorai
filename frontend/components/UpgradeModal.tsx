'use client'

import { X, Crown, Zap, Rocket, Check } from 'lucide-react'
import Link from 'next/link'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  reason: 'video' | 'question'
  currentUsage?: {
    used: number
    limit: number
  }
}

export default function UpgradeModal({ isOpen, onClose, reason, currentUsage }: UpgradeModalProps) {
  if (!isOpen) return null

  const plans = [
    {
      name: 'Pro',
      price: '€24.99',
      icon: <Crown className="w-5 h-5" />,
      color: 'from-blue-500 to-purple-500',
      features: reason === 'video'
        ? ['15 channel imports/month', '500 questions/month', 'On-demand transcripts', 'Priority support', 'Export transcripts', 'Early access to features']
        : ['500 questions/month', '15 channel imports/month', 'On-demand transcripts', 'Priority support', 'Export transcripts', 'Early access to features'],
      highlighted: true
    }
  ]

  const title = reason === 'video'
    ? 'Channel Limit Reached'
    : 'Question Limit Reached'

  const description = reason === 'video'
    ? `You've imported ${currentUsage?.used || 0}/${currentUsage?.limit || 0} channels this month. Upgrade to import more channels and unlock unlimited learning.`
    : `You've asked ${currentUsage?.used || 0}/${currentUsage?.limit || 0} questions this month. Upgrade to ask more questions and get deeper insights.`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-600 mt-1">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        {/* Plans Grid */}
        <div className="p-6">
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-white rounded-xl border-2 p-6 transition-all ${
                  plan.highlighted
                    ? 'border-blue-500 ring-2 ring-blue-200 scale-105'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${plan.color} text-white mb-4`}>
                  {plan.icon}
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-slate-600 ml-1">/month</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/pricing"
                  className={`block w-full py-3 px-4 rounded-lg font-semibold text-center transition-all ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  onClick={onClose}
                >
                  Choose {plan.name}
                </Link>
              </div>
            ))}
          </div>

          {/* Benefits Section */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
            <h3 className="font-semibold text-slate-900 mb-3">Why Upgrade?</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <Zap className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 text-sm">Import More Channels</h4>
                  <p className="text-xs text-slate-600">Learn from entire YouTube channels</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <Crown className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 text-sm">Ask More Questions</h4>
                  <p className="text-xs text-slate-600">Get deeper insights with more queries</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <Check className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 text-sm">Priority Support</h4>
                  <p className="text-xs text-slate-600">Get help when you need it</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 bg-orange-100 rounded-lg mr-3">
                  <Rocket className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 text-sm">Advanced Features</h4>
                  <p className="text-xs text-slate-600">Export transcripts, API access & more</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <button
              onClick={onClose}
              className="text-sm text-slate-600 hover:text-slate-800 font-medium"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
