'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import VideoUpload from '@/components/VideoUpload'
import WanderMindViewer from '@/components/WanderMindViewer'
import ModernHeader from '@/components/ModernHeader'
import ConversationHistory from '@/components/ConversationHistory'
import { Zap, Clock, User, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'
import axios from 'axios'
import { Conversation } from '@/lib/conversationStorage'

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [currentProject, setCurrentProject] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('anonymous')

  useEffect(() => {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    
    if (!supabaseUrl || !supabaseAnonKey) {
      // Supabase not configured - use fallback anonymous mode
      const stored = localStorage.getItem('userId')
      if (!stored) {
        const newUserId = `user_${Date.now()}`
        localStorage.setItem('userId', newUserId)
        setUserId(newUserId)
      } else {
        setUserId(stored)
      }
      
      // PRIORITY: Check URL params FIRST (for conversation switching)
      // Always check URL params - they take absolute priority
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        const projectParam = urlParams.get('project')
        if (projectParam) {
          // URL param always wins - update even if currentProject is already set
          setCurrentProject(projectParam)
          localStorage.setItem('currentProject', projectParam)
          return // Exit early - URL param takes priority
        }
      }
      
      // Fallback: Restore current project from localStorage (only if no URL param)
      // Only set if currentProject is null (initial load)
      if (!currentProject) {
        const storedProject = localStorage.getItem('currentProject')
        if (storedProject) {
          setCurrentProject(storedProject)
        }
      }
      return
    }

    // Supabase is configured - require authentication
    if (!authLoading && !user) {
      // Redirect to auth if not signed in
      router.push('/auth')
      return
    }

    if (user) {
      // Use Supabase user ID
      setUserId(user.id)

      // PRIORITY: Check URL params FIRST (for conversation switching)
      // Always check URL params - they take absolute priority
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        const projectParam = urlParams.get('project')
        if (projectParam) {
          // URL param always wins - update even if currentProject is already set
          setCurrentProject(projectParam)
          localStorage.setItem(`currentProject_${user.id}`, projectParam)
          return // Exit early - URL param takes priority
        }
      }

      // Fallback: Restore current project from localStorage (only if no URL param)
      // Only set if currentProject is null (initial load)
      if (!currentProject) {
        const storedProject = localStorage.getItem(`currentProject_${user.id}`)
        if (storedProject) {
          setCurrentProject(storedProject)
        }
      }
    }
  }, [user, authLoading, router])

  const handleProjectCreated = async (projectId: string) => {
    setCurrentProject(projectId)
    if (user) {
      localStorage.setItem(`currentProject_${user.id}`, projectId)
    } else {
      // Anonymous mode - use regular localStorage key
      localStorage.setItem('currentProject', projectId)
    }
    
    // Create conversation for this new project
    const { createConversation, saveConversation, loadConversations } = await import('@/lib/conversationStorage')
    const conversations = await loadConversations(userId)
    // Check if conversation already exists for this project
    const existing = conversations.find(c => c.projectId === projectId)
    if (!existing) {
      // Create conversation immediately (metadata will be updated later when project loads)
      const newConv = createConversation(projectId)
      newConv.title = 'New Video'
      await saveConversation(newConv, userId)
      
      // Try to get video metadata for title (async, don't block)
      setTimeout(async () => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
          const response = await axios.get(`${apiUrl}/api/projects/project/${projectId}`)
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

  if (isSupabaseConfigured) {
    // Supabase is configured - require authentication
    if (authLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      )
    }

    if (!user) {
      return null // Will redirect to auth
    }
  } else {
    // Supabase not configured - show warning but allow anonymous access
    if (authLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      )
    }
  }

  // Helper function for conversation selection
  const handleSelectConversation = (conversation: Conversation) => {
    if (typeof window !== 'undefined') {
      window.location.href = `/?project=${conversation.projectId}`
    }
  }

  // If no project, show upload screen
  if (!currentProject) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col overflow-hidden">
        <ModernHeader 
          onNewProject={handleNewProject}
          userId={userId}
          currentProjectId={null}
          onSelectConversation={handleSelectConversation}
        />
        
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop: Show conversation history sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0 border-r border-slate-200/60 bg-white h-full">
            <ConversationHistory
              userId={userId}
              currentConversationId={null}
              currentProjectId={null}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewProject}
            />
          </div>
          
          <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl overflow-y-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 mb-6">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                WanderMind
              </h1>
              <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
                Turn video content into searchable knowledge. Ask questions and get instant answers with timestamp citations.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 md:p-8 border border-slate-200 shadow-sm">
              <VideoUpload userId={userId} onUploadComplete={handleProjectCreated} />
            </div>
          </main>
        </div>
      </div>
    )
  }

  // If project exists, show the split-panel Q&A interface
  return (
    <div className="h-screen bg-gradient-to-br from-white to-slate-50 flex flex-col">
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

