'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your email...')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for error in URL params (from Supabase)
        const error = searchParams?.get('error')
        const errorDescription = searchParams?.get('error_description')

        if (error) {
          console.error('Auth callback error from URL:', error, errorDescription)
          setStatus('error')
          setMessage(errorDescription || 'Email verification failed. Please try signing up again.')
          setTimeout(() => router.push('/auth'), 3000)
          return
        }

        // Get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Auth callback session error:', sessionError)
          setStatus('error')
          setMessage('Failed to verify your email. Please try again.')
          setTimeout(() => router.push('/auth'), 3000)
          return
        }

        if (session) {
          // Successfully authenticated
          setStatus('success')
          setMessage('Email verified! Redirecting to dashboard...')
          setTimeout(() => router.push('/'), 2000)
        } else {
          // No session but no error - might be expired link
          setStatus('error')
          setMessage('Verification link expired or invalid. Please sign in or request a new verification email.')
          setTimeout(() => router.push('/auth'), 4000)
        }
      } catch (error: any) {
        console.error('Error handling auth callback:', error)
        setStatus('error')
        setMessage('Something went wrong. Please try again.')
        setTimeout(() => router.push('/auth'), 3000)
      }
    }

    handleAuthCallback()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Verifying Email</h2>
            <p className="text-slate-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Success!</h2>
            <p className="text-slate-600">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Verification Failed</h2>
            <p className="text-slate-600">{message}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <Loader2 className="w-16 h-16 animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Loading</h2>
            <p className="text-slate-600">Please wait...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}

