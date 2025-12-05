'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { setUserId } from '@/lib/sessionManager'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; data?: { session: Session | null; user: User | null } | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null; data?: any }>
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if Supabase is properly configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    
    if (!supabaseUrl || !supabaseAnonKey) {
      // Supabase not configured, skip auth initialization
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error)
        setLoading(false)
        return
      }
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch((error) => {
      console.error('Error initializing auth:', error)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      // Update sessionManager when user signs in/out
      if (session?.user) {
        setUserId(session.user.id)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    if (!supabaseUrl) {
      return { error: { message: 'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY' } as any }
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    // If successful, update state immediately
    if (data?.session && !error) {
      setSession(data.session)
      setUser(data.session.user)
      // Update sessionManager with authenticated user ID
      setUserId(data.session.user.id)
      setLoading(false)
    }
    
    return { error, data }
  }

  const signUp = async (email: string, password: string) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    if (!supabaseUrl) {
      return {
        error: { message: 'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY' } as any,
        data: undefined
      }
    }

    // Get the current origin dynamically (works for localhost and production)
    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
        : 'http://localhost:3000/auth/callback'

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    })

    // If signup successful and user is immediately authenticated (no email confirmation required)
    if (data?.session?.user && !error) {
      setUserId(data.session.user.id)
      setSession(data.session)
      setUser(data.session.user)
    }

    // For email confirmation flow:
    // - Supabase creates user and sends confirmation email → data.user exists, data.session is null, error is null
    // - This is NORMAL and SUCCESS - do not treat as error

    // If actual error (email already exists with confirmed account), Supabase will return error object
    // Trust Supabase's error response
    return { error, data }
  }

  const signOut = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    if (!supabaseUrl) return
    
    await supabase.auth.signOut()
  }

  const signInWithGoogle = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    if (!supabaseUrl) {
      throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    
    // Get redirect URL - use NEXT_PUBLIC_SITE_URL if available (for production), otherwise use current origin
    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
        : 'http://localhost:3000/auth/callback'
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    
    if (error) {
      console.error('Google OAuth error:', error)
      throw error
    }
    
    // OAuth redirect will happen automatically via data.url
    // The redirectTo option should handle the callback
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

