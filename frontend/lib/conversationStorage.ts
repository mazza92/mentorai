/**
 * Conversation Storage Utility
 * Manages conversation history persistence using backend API (for logged-in users) or localStorage (for anonymous users)
 */

import axios from 'axios'

interface Citation {
  videoId: string
  videoTitle: string
  timestamp: number
  timestampFormatted: string
  url: string
}

export interface ConversationMessage {
  type: 'user' | 'ai'
  text: string
  citations?: number[] // For single video mode
  channelCitations?: Citation[] // For channel mode with YouTube links
  timestamp: Date
}

export interface Conversation {
  id: string
  projectId: string
  title: string // Video title or first user message
  videoTitle?: string // Video metadata title
  videoThumbnail?: string // Video thumbnail URL
  messages: ConversationMessage[]
  createdAt: Date
  updatedAt: Date
}

const STORAGE_KEY_PREFIX = 'wandercut_conversations_'
const MAX_CONVERSATIONS = 100 // Limit total conversations per user
const CACHE_TTL = 30000 // Cache for 30 seconds to prevent excessive API calls

// Simple in-memory cache to prevent excessive API requests
const conversationsCache = new Map<string, { data: Conversation[], timestamp: number }>()

/**
 * Check if user is logged in (Supabase configured and userId is a Supabase UUID)
 * Supabase user IDs are UUIDs (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
 * Anonymous users have IDs like "user_1234567890"
 */
function isUserLoggedIn(userId: string): boolean {
  if (typeof window === 'undefined') return false
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  // Check if Supabase is configured (not just empty strings or placeholders)
  const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== '' && supabaseAnonKey !== '' && supabaseUrl !== 'your_supabase_url')
  
  // Check if userId looks like a Supabase UUID
  // Supabase user IDs are UUIDs, anonymous users have IDs like "user_1234567890"
  const looksLikeSupabaseId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId)
  
  return isConfigured && looksLikeSupabaseId
}

/**
 * Get API URL
 */
function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
}

/**
 * Get storage key for a user (for localStorage fallback)
 */
function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

/**
 * Load all conversations for a user (with caching to prevent excessive API calls)
 */
export async function loadConversations(userId: string): Promise<Conversation[]> {
  // Check cache first
  const cached = conversationsCache.get(userId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  // If user is logged in, use backend API
  if (isUserLoggedIn(userId)) {
    try {
      const apiUrl = getApiUrl()
      const response = await axios.get(`${apiUrl}/api/conversations/${userId}`)
      const conversations = (response.data.conversations || []) as Conversation[]

      // Convert date strings back to Date objects
      const processed = conversations.map(conv => ({
        ...conv,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt),
        messages: (conv.messages || []).map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }))

      // Cache the result
      conversationsCache.set(userId, { data: processed, timestamp: Date.now() })

      return processed
    } catch (error: any) {
      console.error('Error loading conversations from API:', error)

      // If it's a rate limit error and we have stale cache, use it
      if (error.response?.status === 429 && cached) {
        console.log('Using stale cache due to rate limit')
        return cached.data
      }

      // Fallback to localStorage
      return loadConversationsFromLocalStorage(userId)
    }
  }

  // Anonymous user - use localStorage
  const localData = loadConversationsFromLocalStorage(userId)
  conversationsCache.set(userId, { data: localData, timestamp: Date.now() })
  return localData
}

/**
 * Load conversations from localStorage (fallback for anonymous users or API errors)
 */
function loadConversationsFromLocalStorage(userId: string): Conversation[] {
  try {
    const key = getStorageKey(userId)
    const data = localStorage.getItem(key)
    if (!data) return []
    
    const conversations = JSON.parse(data) as Conversation[]
    // Convert date strings back to Date objects
    return conversations.map(conv => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: conv.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    }))
  } catch (error) {
    console.error('Error loading conversations from localStorage:', error)
    return []
  }
}

/**
 * Save a conversation
 */
export async function saveConversation(conversation: Conversation, userId: string): Promise<void> {
  // Invalidate cache when saving
  conversationsCache.delete(userId)

  // If user is logged in, use backend API
  if (isUserLoggedIn(userId)) {
    try {
      const apiUrl = getApiUrl()
      await axios.post(`${apiUrl}/api/conversations`, {
        userId,
        conversation: {
          ...conversation,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
          messages: conversation.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString()
          }))
        }
      })
      // Also save to localStorage as backup
      saveConversationToLocalStorage(conversation, userId)
      return
    } catch (error) {
      console.error('Error saving conversation to API:', error)
      // Fallback to localStorage
      saveConversationToLocalStorage(conversation, userId)
      return
    }
  }
  
  // Anonymous user - use localStorage
  saveConversationToLocalStorage(conversation, userId)
}

/**
 * Save conversation to localStorage (fallback for anonymous users or API errors)
 */
function saveConversationToLocalStorage(conversation: Conversation, userId: string): void {
  try {
    const conversations = loadConversationsFromLocalStorage(userId)
    
    // Update existing or add new
    const existingIndex = conversations.findIndex(c => c.id === conversation.id)
    if (existingIndex >= 0) {
      conversations[existingIndex] = conversation
    } else {
      conversations.unshift(conversation) // Add to beginning
      // Limit number of conversations
      if (conversations.length > MAX_CONVERSATIONS) {
        conversations.splice(MAX_CONVERSATIONS)
      }
    }
    
    // Sort by updatedAt (most recent first)
    conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    
    const key = getStorageKey(userId)
    localStorage.setItem(key, JSON.stringify(conversations))
  } catch (error) {
    console.error('Error saving conversation to localStorage:', error)
  }
}

/**
 * Create a new conversation
 */
export function createConversation(projectId: string, firstMessage?: string): Conversation {
  const now = new Date()
  const title = firstMessage 
    ? (firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage)
    : 'New Conversation'
  
  return {
    id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    projectId,
    title,
    messages: [],
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Load a specific conversation by ID
 */
export async function loadConversation(userId: string, conversationId: string): Promise<Conversation | null> {
  const conversations = await loadConversations(userId)
  return conversations.find(c => c.id === conversationId) || null
}

/**
 * Delete a conversation
 */
export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  // Invalidate cache when deleting
  conversationsCache.delete(userId)

  // If user is logged in, use backend API
  if (isUserLoggedIn(userId)) {
    try {
      const apiUrl = getApiUrl()
      await axios.delete(`${apiUrl}/api/conversations/${userId}/${conversationId}`)
      // Also delete from localStorage
      deleteConversationFromLocalStorage(userId, conversationId)
      return
    } catch (error) {
      console.error('Error deleting conversation from API:', error)
      // Fallback to localStorage
      deleteConversationFromLocalStorage(userId, conversationId)
      return
    }
  }

  // Anonymous user - use localStorage
  deleteConversationFromLocalStorage(userId, conversationId)
}

/**
 * Delete conversation from localStorage (fallback for anonymous users or API errors)
 */
function deleteConversationFromLocalStorage(userId: string, conversationId: string): void {
  try {
    const conversations = loadConversationsFromLocalStorage(userId)
    const filtered = conversations.filter(c => c.id !== conversationId)
    
    const key = getStorageKey(userId)
    localStorage.setItem(key, JSON.stringify(filtered))
  } catch (error) {
    console.error('Error deleting conversation from localStorage:', error)
  }
}

/**
 * Update conversation title (auto-generate from first user message)
 */
export function updateConversationTitle(conversation: Conversation): Conversation {
  const firstUserMessage = conversation.messages.find(m => m.type === 'user')
  if (firstUserMessage) {
    const title = firstUserMessage.text.length > 50 
      ? firstUserMessage.text.substring(0, 50) + '...'
      : firstUserMessage.text
    return { ...conversation, title }
  }
  return conversation
}

/**
 * Add message to conversation and save
 */
export function addMessageToConversation(
  conversation: Conversation,
  message: ConversationMessage
): Conversation {
  const updated = {
    ...conversation,
    messages: [...conversation.messages, message],
    updatedAt: new Date()
  }
  
  // Auto-update title from first user message
  if (message.type === 'user' && conversation.messages.length === 0) {
    return updateConversationTitle(updated)
  }
  
  return updated
}

