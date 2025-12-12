'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import ChannelImport from '@/components/ChannelImport'
import WanderMindViewer from '@/components/WanderMindViewer'
import ModernHeader from '@/components/ModernHeader'
import ConversationHistory from '@/components/ConversationHistory'
import Footer from '@/components/Footer'
import { Zap, Loader2, CheckCircle, Youtube, MessageSquare, BookOpen, Sparkles, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import axios from 'axios'
import { Conversation } from '@/lib/conversationStorage'
import { getSessionId, setUserId as setSessionUserId } from '@/lib/sessionManager'
import { trackLandingPageView, initScrollTracking, resetScrollTracking, getUTMParams } from '@/lib/analytics'

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

  // Track landing page view and initialize scroll tracking
  useEffect(() => {
    if (!currentProject) {
      trackLandingPageView()
      initScrollTracking()
      
      // Store UTM params for attribution
      getUTMParams()
    }
    return () => {
      resetScrollTracking()
    }
  }, [currentProject])

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
            {/* Hero Section */}
            <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 max-w-7xl">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Left: Value Proposition */}
                <div className="text-center lg:text-left">
                  <div className="inline-flex items-center px-4 py-2 bg-blue-50 rounded-full mb-6">
                    <Zap className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="text-sm font-semibold text-blue-600">{t('landing.badge')}</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                    {t('landing.hero_title')}
                  </h1>

                  <p className="text-lg sm:text-xl text-slate-600 mb-8 leading-relaxed">
                    {t('landing.hero_subtitle')}
                  </p>

                  {/* CTA */}
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-slate-200/60 shadow-xl shadow-slate-200/50 mb-6">
                    <ChannelImport userId={userId} onImportComplete={handleProjectCreated} />
                  </div>

                  {/* Trust Indicators */}
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span>{t('landing.trust_1')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span>{t('landing.trust_2')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span>{t('landing.trust_3')}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Visual Demo */}
                <div className="relative lg:block">
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl p-1 shadow-2xl">
                    <div className="bg-white rounded-[22px] p-6 sm:p-8">
                      {/* Mock Chat Interface */}
                      <div className="space-y-4">
                        {/* User Message */}
                        <div className="flex justify-end">
                          <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]">
                            <p className="text-sm">{t('landing.demo_question')}</p>
                          </div>
                        </div>

                        {/* AI Response */}
                        <div className="flex justify-start">
                          <div className="bg-slate-100 text-slate-900 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                            <p className="text-sm mb-3">{t('landing.demo_answer')}</p>
                            <div className="flex items-center gap-2 text-xs text-blue-600">
                              <Youtube className="w-4 h-4" />
                              <span className="font-medium">{t('landing.demo_citation')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Typing Indicator */}
                        <div className="flex justify-start">
                          <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Floating Badge */}
                  <div className="absolute -top-4 -right-4 bg-white rounded-2xl px-4 py-3 shadow-lg border border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-semibold text-slate-900">{t('landing.live_badge')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works Section */}
            <div className="bg-slate-50 py-16 sm:py-24">
              <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                <div className="text-center mb-16">
                  <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{t('landing.how_title')}</h2>
                  <p className="text-lg text-slate-600 max-w-2xl mx-auto">{t('landing.how_subtitle')}</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                  {/* Step 1 */}
                  <div className="bg-white rounded-2xl p-8 text-center shadow-lg hover:shadow-xl transition-shadow">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-6">
                      <Youtube className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold text-sm mb-4">1</div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">{t('landing.step1_title')}</h3>
                    <p className="text-slate-600">{t('landing.step1_desc')}</p>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-white rounded-2xl p-8 text-center shadow-lg hover:shadow-xl transition-shadow">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-6">
                      <MessageSquare className="w-8 h-8 text-purple-600" />
                    </div>
                    <div className="inline-flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full font-bold text-sm mb-4">2</div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">{t('landing.step2_title')}</h3>
                    <p className="text-slate-600">{t('landing.step2_desc')}</p>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-white rounded-2xl p-8 text-center shadow-lg hover:shadow-xl transition-shadow">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-6">
                      <Zap className="w-8 h-8 text-green-600" />
                    </div>
                    <div className="inline-flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full font-bold text-sm mb-4">3</div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">{t('landing.step3_title')}</h3>
                    <p className="text-slate-600">{t('landing.step3_desc')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Benefits Section */}
            <div className="py-16 sm:py-24">
              <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                <div className="text-center mb-16">
                  <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{t('landing.benefits_title')}</h2>
                  <p className="text-lg text-slate-600 max-w-2xl mx-auto">{t('landing.benefits_subtitle')}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{t('landing.benefit1_title')}</h3>
                      <p className="text-slate-600">{t('landing.benefit1_desc')}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{t('landing.benefit2_title')}</h3>
                      <p className="text-slate-600">{t('landing.benefit2_desc')}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{t('landing.benefit3_title')}</h3>
                      <p className="text-slate-600">{t('landing.benefit3_desc')}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{t('landing.benefit4_title')}</h3>
                      <p className="text-slate-600">{t('landing.benefit4_desc')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Final CTA */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 py-16 sm:py-24">
              <div className="container mx-auto px-4 sm:px-6 max-w-4xl text-center">
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">{t('landing.cta_title')}</h2>
                <p className="text-lg sm:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">{t('landing.cta_subtitle')}</p>
                <a href="#top" className="inline-block px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-colors shadow-xl">
                  {t('landing.cta_button')}
                </a>
              </div>
            </div>

            {/* Footer */}
            <Footer />
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

