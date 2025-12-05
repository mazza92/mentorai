'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { Loader2, Mail, Lock, LogIn, UserPlus, Chrome, Zap, Sparkles, Video, MessageSquare, CheckCircle2, ArrowRight } from 'lucide-react'

export default function Auth() {
  const { t } = useTranslation('common')
  const { user, signIn, signUp, signInWithGoogle, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check if mode=signup is in the URL, default to sign in
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Update isSignUp when URL changes
  useEffect(() => {
    setIsSignUp(searchParams.get('mode') === 'signup')
  }, [searchParams])

  // Redirect to home if user is already logged in
  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = '/'
    }
  }, [user, authLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const result = await signUp(email, password)

        if (result.error) {
          // Check if it's a "user already exists" error
          if (result.error.message?.includes('already registered') ||
              result.error.message?.includes('already exists')) {
            setError(t('auth.error_email_exists'))
          } else {
            setError(result.error.message)
          }
        } else {
          // Signup successful - show success message
          setSuccess(t('auth.success_check_email'))
          setEmail('')
          setPassword('')
        }
      } else {
        const result = await signIn(email, password)

        if (result.error) {
          setError(result.error.message)
        } else {
          // Sign-in successful - redirect immediately
          setSuccess('Signing you in...')
          
          // Force redirect - use window.location for more reliable navigation
          setTimeout(() => {
            window.location.href = '/'
          }, 500)
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.')
      console.error('Auth error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
      // OAuth redirect will happen, so we don't need to set loading to false
      // The user will be redirected to Google, then back to /auth/callback
    } catch (err: any) {
      console.error('Google sign-in error:', err)
      // Check for specific error messages
      if (err?.message?.includes('provider is not enabled') || err?.code === 400) {
        setError(t('auth.error_google_not_enabled'))
      } else {
        setError(err?.message || t('auth.error_google_failed'))
      }
      setLoading(false)
    }
  }

  const features = [
    { icon: Video, text: t('auth.features.upload_video') },
    { icon: MessageSquare, text: t('auth.features.ask_questions') },
    { icon: Sparkles, text: t('auth.features.instant_answers') },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex">
      {/* Left Side - Hero Section (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '40px 40px'
            }}
          ></div>
        </div>
        
        {/* Floating orbs with staggered animation */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0s' }}></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 text-white">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-6 shadow-xl">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl xl:text-6xl font-bold mb-4 leading-tight">
              {t('app_name')}
            </h1>
            <p className="text-xl xl:text-2xl text-blue-100 mb-8 leading-relaxed">
              {t('tagline')}
            </p>
          </div>

          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center space-x-4 group">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-lg text-blue-50 font-medium">{feature.text}</p>
              </div>
            ))}
          </div>

          {/* Trust indicators */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="flex items-center space-x-6 text-sm text-blue-100">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>{t('auth.trust.free_to_start')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>{t('auth.trust.no_credit_card')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>{t('auth.trust.secure')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 mb-4 shadow-lg">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              {t('app_name')}
            </h1>
            <p className="text-slate-600 text-sm">{t('tagline')}</p>
          </div>

          {/* Auth Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/50 p-8 sm:p-10">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                {isSignUp ? t('auth.get_started') : t('auth.welcome_back')}
              </h2>
              <p className="text-slate-600">
                {isSignUp ? t('auth.create_account_to_start') : t('auth.sign_in_to_continue')}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start space-x-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                  <span className="text-red-600 text-xs">!</span>
                </div>
                <p className="flex-1">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="flex-1">{success}</p>
              </div>
            )}

            {/* Google Sign In - Prominent */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3.5 px-4 border-2 border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mb-6 shadow-sm hover:shadow-md"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Chrome className="w-5 h-5 mr-3" />
                  {t('auth.continue_with_google')}
                </>
              )}
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">{t('auth.continue_with_email')}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900 placeholder-slate-400"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900 placeholder-slate-400"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isSignUp ? (
                      <>
                        <UserPlus className="w-5 h-5 mr-2" />
                        {t('auth.sign_up_button')}
                      </>
                    ) : (
                      <>
                        <LogIn className="w-5 h-5 mr-2" />
                        {t('auth.sign_in_button')}
                      </>
                    )}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                  setSuccess(null)
                }}
                className="text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors inline-flex items-center space-x-1 group"
              >
                <span>
                  {isSignUp ? t('auth.already_have_account') : t('auth.dont_have_account')}
                </span>
                <span className="text-blue-600 group-hover:text-blue-700 font-semibold">
                  {isSignUp ? t('auth.sign_in') : t('auth.sign_up')}
                </span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-500">
            {t('auth.terms_notice')}
          </p>
        </div>
      </div>
    </div>
  )
}

