'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          router.push('/auth?error=auth_failed')
          return
        }

        if (session) {
          // Successfully authenticated, redirect to home
          router.push('/')
        } else {
          router.push('/auth?error=no_session')
        }
      } catch (error) {
        console.error('Error handling auth callback:', error)
        router.push('/auth?error=callback_failed')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-slate-600">Completing sign in...</p>
      </div>
    </div>
  )
}

