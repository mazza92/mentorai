'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import ChannelImport from '@/components/ChannelImport'
import WanderMindViewer from '@/components/WanderMindViewer'
import ModernHeader from '@/components/ModernHeader'
import ConversationHistory from '@/components/ConversationHistory'
import { Zap } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'
import axios from 'axios'
import { Conversation } from '@/lib/conversationStorage'
import { getSessionId, setUserId as setSessionUserId } from '@/lib/sessionManager'

export default function Home() {
  const { t } = useTranslation()
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [currentProject, setCurrentProject] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('anonymous')
  const [isInitialized, setIsInitialized] = useState(false)

  // Function to check URL and update project
  const checkUrlAndSetProject = (effectiveUserId?: string) => {
    if (typeof window === 'undefined') return

    const urlParams = new URLSearchParams(window.location.search)
    const projectParam = urlParams.get('project')

    if (projectParam) {
      // URL param always wins - update even if currentProject is already set
      if (currentProject !== projectParam) {
        console.log('URL project param detected:', projectParam, 'Current:', currentProject)
        setCurrentProject(projectParam)
        // Use effectiveUserId (from sessionManager) if available, fallback to user.id
        const storageKey = effectiveUserId && effectiveUserId !== 'anonymous'
          ? `currentProject_${effectiveUserId}`
          : (user ? `currentProject_${user.id}` : 'currentProject')
        localStorage.setItem(storageKey, projectParam)
        // Clear upload flag when switching to a project via URL
        sessionStorage.removeItem('isUploadingVideo')
      }
      return true // URL param found
    }
    return false // No URL param
  }

  useEffect(() => {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    if (!supabaseUrl || !supabaseAnonKey) {
      // Supabase not configured - use fallback anonymous mode with sessionManager
      const sessionId = getSessionId()
      setUserId(sessionId)

      // PRIORITY: Check URL params FIRST (for conversation switching)
      if (checkUrlAndSetProject(sessionId)) {
        setIsInitialized(true)
        return // URL param takes priority
      }

      // Only restore from localStorage on initial load (when currentProject is null)
      // Don't restore if we're in the middle of uploading
      if (!currentProject && typeof window !== 'undefined') {
        const isUploading = sessionStorage.getItem('isUploadingVideo') === 'true'
        if (!isUploading) {
          // Use sessionId-based key for consistency
          const storageKey = sessionId && sessionId !== 'anonymous'
            ? `currentProject_${sessionId}`
            : 'currentProject'
          const storedProject = localStorage.getItem(storageKey)
          if (storedProject) {
            console.log('[Page] Restoring project from localStorage:', storedProject)
            setCurrentProject(storedProject)
          }
        }
      }
      setIsInitialized(true)
      return
    }

    // Supabase is configured - allow anonymous access with freemium
    if (!authLoading) {
      if (user) {
        // Authenticated user - use their Supabase user ID
        setSessionUserId(user.id) // Update sessionManager
        setUserId(user.id)
      } else {
        // Anonymous user - use sessionId from sessionManager
        const sessionId = getSessionId()
        setUserId(sessionId)
      }
    }

    if (user) {
      // Use Supabase user ID (already set above, but keep for consistency)
      setSessionUserId(user.id) // Ensure sessionManager is updated
      setUserId(user.id)

      // PRIORITY: Check URL params FIRST (for conversation switching)
      if (checkUrlAndSetProject(user.id)) {
        setIsInitialized(true)
        return // URL param takes priority
      }

      // Only restore from localStorage on initial load (when currentProject is null)
      // Don't restore if we're in the middle of uploading
      if (!currentProject && typeof window !== 'undefined') {
        const isUploading = sessionStorage.getItem('isUploadingVideo') === 'true'
        if (!isUploading) {
          // Use userId for consistency (at this point userId === user.id)
          const storageKey = userId && userId !== 'anonymous'
            ? `currentProject_${userId}`
            : 'currentProject'
          const storedProject = localStorage.getItem(storageKey)
          if (storedProject) {
            setCurrentProject(storedProject)
          }
        }
      }
    }
    
    setIsInitialized(true)
  }, [user, authLoading, router]) // Remove currentProject from dependencies to prevent loops

  // No redirect needed - freemium allows anonymous access
  // Signup wall will be shown when limits are reached (handled by backend API responses)

  // Listen for URL changes (popstate for back/forward buttons)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleUrlChange = () => {
      // Re-check URL when browser back/forward is used
      const urlParams = new URLSearchParams(window.location.search)
      const projectParam = urlParams.get('project')
      
      if (projectParam && currentProject !== projectParam) {
        console.log('URL changed via popstate:', projectParam)
        setCurrentProject(projectParam)
        // Use userId (from sessionManager) if available, fallback to user.id
        const storageKey = userId && userId !== 'anonymous'
          ? `currentProject_${userId}`
          : (user ? `currentProject_${user.id}` : 'currentProject')
        localStorage.setItem(storageKey, projectParam)
        sessionStorage.removeItem('isUploadingVideo')
      } else if (!projectParam && currentProject) {
        // URL param removed - go to upload screen
        console.log('URL param removed, clearing project')
        setCurrentProject(null)
        // Use userId (from sessionManager) if available, fallback to user.id
        const storageKey = userId && userId !== 'anonymous'
          ? `currentProject_${userId}`
          : (user ? `currentProject_${user.id}` : 'currentProject')
        localStorage.removeItem(storageKey)
      }
    }
    
    // Listen for popstate (back/forward buttons)
    window.addEventListener('popstate', handleUrlChange)
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange)
    }
  }, [user, userId, currentProject]) // Re-setup listeners when user, userId, or currentProject changes

  const handleProjectCreated = async (projectIdOrChannelId: string, projectId?: string) => {
    // If second parameter exists, use it (channel import case)
    // Otherwise use first parameter (single video case)
    const actualProjectId = projectId || projectIdOrChannelId

    // Clear upload flag first
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('isUploadingVideo')
    }

    // Update URL to include project parameter (this will trigger useEffect to set currentProject)
    if (typeof window !== 'undefined') {
      const newUrl = `/?project=${actualProjectId}`
      window.history.pushState({ projectId: actualProjectId }, '', newUrl)
    }

    setCurrentProject(actualProjectId)
    // Use userId (from sessionManager) if available, fallback to user.id
    const storageKey = userId && userId !== 'anonymous'
      ? `currentProject_${userId}`
      : (user ? `currentProject_${user.id}` : 'currentProject')
    localStorage.setItem(storageKey, actualProjectId)
    
    // Create conversation for this new project
    const { createConversation, saveConversation, loadConversations } = await import('@/lib/conversationStorage')
    const conversations = await loadConversations(userId)
    // Check if conversation already exists for this project
    const existing = conversations.find(c => c.projectId === actualProjectId)
    if (!existing) {
      // Create conversation immediately (metadata will be updated later when project loads)
      const newConv = createConversation(actualProjectId)
      newConv.title = 'New Video'
      await saveConversation(newConv, userId)

      // Try to get video metadata for title (async, don't block)
      setTimeout(async () => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
          const response = await axios.get(`${apiUrl}/api/projects/project/${actualProjectId}`)
          const projectData = response.data.project
          const videoTitle = projectData.title || projectData.originalFileName || 'New Video'
          const videoThumbnail = projectData.thumbnail || projectData.thumbnailUrl || projectData.thumbnails?.[0]?.url

          const updatedConv = {
            ...newConv,
            videoTitle,
            videoThumbnail,
            title: videoTitle
          }
          await saveConversation(updatedConv, userId)
        } catch (err) {
          // If metadata fetch fails, conversation already created with default title
          console.log('Could not fetch video metadata immediately, will update later')
        }
      }, 1000)
    }
  }

  const handleNewProject = () => {
    // Clear upload flag
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('isUploadingVideo')
      // Update URL to remove project parameter
      window.history.pushState({}, '', '/')
    }
    
    setCurrentProject(null)
    if (user) {
      localStorage.removeItem(`currentProject_${user.id}`)
    } else {
      // Anonymous mode - use regular localStorage key
      localStorage.removeItem('currentProject')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const isSupabaseConfigured = supabaseUrl && supabaseAnonKey

  // Show loading until initialized
  if (!isInitialized || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Freemium model: Allow anonymous access
  // No redirect needed - users can try the product without signup
  // Signup wall will appear when they hit limits (1 upload, 3 questions)

  // Helper function for conversation selection
  const handleSelectConversation = (conversation: Conversation) => {
    if (typeof window !== 'undefined') {
      console.log('[Page] Switching to conversation:', conversation.projectId)

      // Update URL without full page reload
      const newUrl = `/?project=${conversation.projectId}`
      window.history.pushState({ projectId: conversation.projectId }, '', newUrl)

      // Clear upload flag
      sessionStorage.removeItem('isUploadingVideo')

      // Update project state directly
      setCurrentProject(conversation.projectId)

      // Save to localStorage
      const storageKey = userId && userId !== 'anonymous'
        ? `currentProject_${userId}`
        : (user ? `currentProject_${user.id}` : 'currentProject')
      localStorage.setItem(storageKey, conversation.projectId)
      console.log('[Page] Project state updated successfully')
    }
  }

  // If no project, show upload screen
  if (!currentProject) {
    return (
      <div className="h-screen bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 flex flex-col overflow-hidden">
        <ModernHeader 
          onNewProject={handleNewProject}
          userId={userId}
          currentProjectId={null}
          onSelectConversation={handleSelectConversation}
        />
        
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop: Show conversation history sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0 h-full">
            <ConversationHistory
              userId={userId}
              currentConversationId={null}
              currentProjectId={null}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewProject}
            />
          </div>
          
          <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            <div className="container mx-auto px-6 py-16 max-w-3xl">
              <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-500 mb-8 shadow-lg shadow-blue-500/20">
                  <Zap className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-5">
                  {t('app_name')}
                </h1>
                <p className="text-xl md:text-2xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                  {t('homepage_subtitle')}
                </p>
              </div>

              {/* Channel Import Only (MVP) */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 md:p-10 border border-slate-200/60 shadow-xl shadow-slate-200/50">
                <ChannelImport userId={userId} onImportComplete={handleProjectCreated} />
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // If project exists, show the split-panel Q&A interface
  return (
    <div className="h-screen bg-gradient-to-br from-white via-slate-50/30 to-blue-50/20 flex flex-col">
      <ModernHeader 
        onNewProject={handleNewProject}
        userId={userId}
        currentProjectId={currentProject}
        onSelectConversation={handleSelectConversation}
      />
      
      <div className="flex-1 overflow-hidden">
        <WanderMindViewer 
          projectId={currentProject} 
          userId={userId}
          onNewConversation={handleNewProject}
        />
      </div>
    </div>
  )
}

