'use client'

import { X, Zap, MessageSquare, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface SignupWallProps {
  isOpen: boolean
  onClose: () => void
  reason: 'video' | 'question'
  currentUsage?: {
    used: number
    limit: number
  }
  message?: string
}

export default function SignupWall({ isOpen, onClose, reason, currentUsage, message }: SignupWallProps) {
  const { t } = useTranslation('common')
  const router = useRouter()
  const { user } = useAuth()

  if (!isOpen) return null

  // If user is already authenticated, don't show signup wall
  if (user) {
    onClose()
    return null
  }

  const title = reason === 'video'
    ? t('signup_wall.video_title', { defaultValue: 'Free Trial Complete!' })
    : t('signup_wall.question_title', { defaultValue: 'Free Trial Complete!' })

  // Always use translations (ignore backend message for proper i18n)
  const description = reason === 'video'
    ? t('signup_wall.video_message', {
        defaultValue: "You've used your {{limit}} free upload. Sign up to get 3 uploads per month!",
        used: currentUsage?.used || 1,
        limit: currentUsage?.limit || 1
      })
    : t('signup_wall.question_message', {
        defaultValue: "You've used your {{limit}} free questions. Sign up to get 15 questions per month!",
        used: currentUsage?.used || 3,
        limit: currentUsage?.limit || 3
      })

  const benefits = [
    { icon: Zap, text: reason === 'video' ? t('signup_wall.benefit_videos', { defaultValue: '3 uploads per month' }) : t('signup_wall.benefit_questions', { defaultValue: '15 questions per month' }) },
    { icon: MessageSquare, text: t('signup_wall.benefit_ai', { defaultValue: 'All AI features' }) },
    { icon: Sparkles, text: t('signup_wall.benefit_free', { defaultValue: 'Free forever' }) },
  ]

  const handleSignUp = () => {
    onClose()
    router.push('/auth')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 mb-4 shadow-lg">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{title}</h2>
            <p className="text-slate-600 leading-relaxed">{description}</p>
          </div>

          {/* Usage Indicator */}
          {currentUsage && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">
                  {reason === 'video' ? t('signup_wall.uploads_used', { defaultValue: 'Uploads used' }) : t('signup_wall.questions_used', { defaultValue: 'Questions used' })}
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {currentUsage.used}/{currentUsage.limit}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${(currentUsage.used / currentUsage.limit) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Benefits */}
          <div className="mb-8 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              {t('signup_wall.what_you_get', { defaultValue: 'What you get when you sign up:' })}
            </h3>
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-blue-50/50 rounded-lg">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <benefit.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-slate-700 font-medium">{benefit.text}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleSignUp}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
            >
              <span>{t('signup_wall.sign_up_button', { defaultValue: 'Sign Up Free' })}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="w-full text-slate-600 hover:text-slate-800 font-medium py-2 transition-colors"
            >
              {t('signup_wall.maybe_later', { defaultValue: 'Maybe later' })}
            </button>
          </div>

          {/* Trust Indicators */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-center space-x-6 text-xs text-slate-500">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>{t('auth.trust.free_to_start', { defaultValue: 'Free to start' })}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>{t('auth.trust.no_credit_card', { defaultValue: 'No credit card' })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

