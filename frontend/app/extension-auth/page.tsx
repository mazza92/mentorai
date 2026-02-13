'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, XCircle, Zap } from 'lucide-react'

function ExtensionAuthContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'authenticating' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Connecting to your account...')

  useEffect(() => {
    const handleExtensionAuth = async () => {
      try {
        const redirectUri = searchParams?.get('redirect_uri')

        if (!redirectUri) {
          setStatus('error')
          setMessage('Invalid request. Missing redirect URI.')
          return
        }

        // Check if user is already logged in
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
        }

        if (session?.user) {
          // User is already logged in - redirect back to extension with credentials
          setStatus('success')
          setMessage('Account connected! Redirecting...')

          const user = session.user
          const params = new URLSearchParams({
            userId: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            picture: user.user_metadata?.avatar_url || ''
          })

          setTimeout(() => {
            window.location.href = `${redirectUri}?${params.toString()}`
          }, 1000)
          return
        }

        // User not logged in - trigger Google OAuth
        setStatus('authenticating')
        setMessage('Opening Google sign-in...')

        // Store redirect URI for after OAuth callback
        localStorage.setItem('extension_auth_redirect', redirectUri)

        // Trigger Google OAuth with extension callback
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/extension-auth/callback`,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        })

        if (error) {
          console.error('OAuth error:', error)
          setStatus('error')
          setMessage('Failed to start Google sign-in. Please try again.')
        }
        // OAuth redirect will happen automatically
      } catch (error: any) {
        console.error('Extension auth error:', error)
        setStatus('error')
        setMessage('Something went wrong. Please try again.')
      }
    }

    handleExtensionAuth()
  }, [searchParams])

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
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Connecting Extension</h2>
            <p className="text-slate-600">{message}</p>
          </>
        )}

        {status === 'authenticating' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Sign In Required</h2>
            <p className="text-slate-600">{message}</p>
            <p className="text-slate-500 text-sm mt-4">
              You'll be redirected to Google to sign in.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Connected!</h2>
            <p className="text-slate-600">{message}</p>
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

export default function ExtensionAuth() {
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
      <ExtensionAuthContent />
    </Suspense>
  )
}
