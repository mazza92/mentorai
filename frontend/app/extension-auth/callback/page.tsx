'use client'

import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, XCircle, Zap } from 'lucide-react'

function ExtensionAuthCallbackContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Completing sign-in...')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the stored redirect URI
        const redirectUri = localStorage.getItem('extension_auth_redirect')

        if (!redirectUri) {
          setStatus('error')
          setMessage('Session expired. Please try connecting again from the extension.')
          return
        }

        // Get the session (should be set by Supabase OAuth callback)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          setStatus('error')
          setMessage('Failed to complete sign-in. Please try again.')
          return
        }

        if (!session?.user) {
          // Wait a moment and try again (OAuth might still be processing)
          await new Promise(resolve => setTimeout(resolve, 1000))

          const { data: { session: retrySession } } = await supabase.auth.getSession()

          if (!retrySession?.user) {
            setStatus('error')
            setMessage('Sign-in failed. Please try again.')
            return
          }

          // Use retry session
          completeAuth(retrySession.user, redirectUri)
          return
        }

        completeAuth(session.user, redirectUri)
      } catch (error: any) {
        console.error('Callback error:', error)
        setStatus('error')
        setMessage('Something went wrong. Please try again.')
      }
    }

    const completeAuth = (user: any, redirectUri: string) => {
      setStatus('success')
      setMessage('Account connected! Redirecting to extension...')

      // Clean up stored redirect
      localStorage.removeItem('extension_auth_redirect')

      // Build redirect URL with user credentials
      const params = new URLSearchParams({
        userId: user.id,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        picture: user.user_metadata?.avatar_url || ''
      })

      // Redirect back to extension
      setTimeout(() => {
        window.location.href = `${redirectUri}?${params.toString()}`
      }, 1500)
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 mb-6 shadow-lg">
          <Zap className="w-8 h-8 text-white" />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Almost Done</h2>
            <p className="text-slate-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Success!</h2>
            <p className="text-slate-600">{message}</p>
            <p className="text-slate-500 text-sm mt-4">
              You can close this window if it doesn't close automatically.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Connection Failed</h2>
            <p className="text-slate-600">{message}</p>
            <button
              onClick={() => window.close()}
              className="mt-6 px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
            >
              Close Window
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function ExtensionAuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Loading</h2>
            <p className="text-slate-600">Please wait...</p>
          </div>
        </div>
      }
    >
      <ExtensionAuthCallbackContent />
    </Suspense>
  )
}
