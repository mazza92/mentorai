'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const GOOGLE_CLIENT_ID = process.env.NEXT_GOOGLE_CLIENT_ID || ''

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void
        }
      }
    }
  }
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
}

export function hasGoogleIdentityClient() {
  return Boolean(GOOGLE_CLIENT_ID)
}

type Props = {
  onSuccess?: () => void
  onError?: (message: string) => void
}

export default function GoogleSignInButton({ onSuccess, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const nonceRef = useRef('')
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  const [loading, setLoading] = useState(true)

  onSuccessRef.current = onSuccess
  onErrorRef.current = onError

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !hostRef.current) return

    let cancelled = false
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true

    script.onload = async () => {
      if (cancelled || !hostRef.current || !window.google?.accounts?.id) return

      nonceRef.current = randomNonce()
      const hashedNonce = await sha256Hex(nonceRef.current)
      const width = Math.min(Math.floor(hostRef.current.clientWidth || 360), 400)

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        nonce: hashedNonce,
        ux_mode: 'popup',
        auto_select: false,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) {
            onErrorRef.current?.('Google sign-in was cancelled.')
            return
          }
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce: nonceRef.current,
          })
          if (error) {
            onErrorRef.current?.(error.message)
            return
          }
          onSuccessRef.current?.()
        },
      })

      hostRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(hostRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width,
        logo_alignment: 'left',
      })
      if (!cancelled) setLoading(false)
    }

    script.onerror = () => {
      if (!cancelled) {
        setLoading(false)
        onErrorRef.current?.('Could not load Google sign-in.')
      }
    }

    document.head.appendChild(script)
    return () => {
      cancelled = true
      script.remove()
    }
  }, [])

  if (!GOOGLE_CLIENT_ID) return null

  return (
    <div className="relative mb-6 w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      )}
      <div ref={hostRef} className="flex w-full justify-center" />
    </div>
  )
}
