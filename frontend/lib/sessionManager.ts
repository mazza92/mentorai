/**
 * Session Manager
 * Handles anonymous session tracking and user ID management for freemium model
 * Includes browser fingerprinting to prevent VPN/cookie bypass
 */

import { getCachedFingerprint } from './fingerprint'

const SESSION_ID_KEY = 'wandercut_session_id'
const USER_ID_KEY = 'wandercut_user_id'

/**
 * Generate a random session ID with fingerprint component
 */
function generateSessionId(): string {
  const fingerprint = getCachedFingerprint()
  const randomPart = Math.random().toString(36).substr(2, 9)
  return `session_${randomPart}_${fingerprint.substring(3, 11)}`
}

/**
 * Get or create session ID
 * Returns sessionId for anonymous users or userId for authenticated users
 * This is the main function to use for all API calls
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    return 'anonymous'
  }

  // Check if user is authenticated (has real userId from Supabase)
  const userId = localStorage.getItem(USER_ID_KEY)
  if (userId && userId !== 'anonymous' && !userId.startsWith('session_') && !userId.startsWith('user_')) {
    // Real authenticated user - return their Supabase user ID
    return userId
  }

  // Get or create anonymous session ID
  let sessionId = localStorage.getItem(SESSION_ID_KEY)

  if (!sessionId || sessionId === 'anonymous') {
    sessionId = generateSessionId()
    localStorage.setItem(SESSION_ID_KEY, sessionId)
    console.log('🆔 Created new anonymous session:', sessionId)
  }

  return sessionId
}

/**
 * Set authenticated user ID
 * Called after successful signup/login
 */
export function setUserId(userId: string): void {
  if (typeof window === 'undefined') return

  const oldSessionId = getSessionId()

  localStorage.setItem(USER_ID_KEY, userId)

  // Clear session ID since we're now authenticated
  localStorage.removeItem(SESSION_ID_KEY)

  console.log('✅ User authenticated:', {
    from: oldSessionId.substring(0, 20) + '...',
    to: userId.substring(0, 20) + '...'
  })
}

/**
 * Get current user ID (returns sessionId if anonymous)
 */
export function getUserId(): string {
  return getSessionId()
}

/**
 * Check if user is anonymous (not authenticated)
 */
export function isAnonymous(): boolean {
  if (typeof window === 'undefined') return true

  const userId = localStorage.getItem(USER_ID_KEY)
  if (!userId || userId === 'anonymous') return true

  const sessionId = localStorage.getItem(SESSION_ID_KEY)
  if (sessionId && sessionId.startsWith('session_')) return true

  return false
}

/**
 * Clear session (logout)
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem(USER_ID_KEY)
  localStorage.removeItem(SESSION_ID_KEY)

  console.log('🚪 Session cleared')
}

/**
 * Get session info for debugging
 */
export function getSessionInfo() {
  if (typeof window === 'undefined') {
    return { sessionId: 'server-side', userId: null, isAnonymous: true }
  }

  return {
    sessionId: localStorage.getItem(SESSION_ID_KEY),
    userId: localStorage.getItem(USER_ID_KEY),
    isAnonymous: isAnonymous(),
    currentId: getSessionId()
  }
}

// Log session info on initialization (only in dev)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('📋 Session Manager initialized:', getSessionInfo())
}
