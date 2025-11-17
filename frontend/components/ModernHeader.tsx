'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Menu, X, User, LogOut, Settings, CreditCard, ChevronDown, MessageSquare, Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import ConversationHistory from '@/components/ConversationHistory'
import { Conversation } from '@/lib/conversationStorage'

interface ModernHeaderProps {
  onNewProject: () => void
  userId?: string
  currentProjectId?: string | null
  onSelectConversation?: (conversation: Conversation) => void
}

export default function ModernHeader({ onNewProject, userId, currentProjectId, onSelectConversation }: ModernHeaderProps) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
    setUserMenuOpen(false)
  }

  const handlePricing = () => {
    router.push('/pricing')
    setMobileMenuOpen(false)
  }

  const handleNewProjectClick = () => {
    onNewProject()
    setMobileMenuOpen(false)
  }

  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your_supabase_id'

  // Get user display name/email
  const userDisplayName = user?.email?.split('@')[0] || user?.user_metadata?.name || 'User'
  const userInitials = userDisplayName.charAt(0).toUpperCase()

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 lg:px-6">
          {/* Left: Logo */}
          <div className="flex items-center">
            <button
              onClick={() => router.push('/')}
              className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg px-2 py-1 -ml-2"
            >
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                WanderMind
              </span>
            </button>
          </div>

          {/* Right: User Menu & Mobile Menu Button */}
          <div className="flex items-center space-x-2">
            {/* Desktop User Menu */}
            {isSupabaseConfigured && user && (
              <div className="hidden md:block relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                    {userInitials}
                  </div>
                  <span className="text-sm font-medium text-slate-700 max-w-[120px] truncate">
                    {userDisplayName}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-lg border border-slate-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-900">{user.email}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Free Tier</p>
                    </div>
                    <button
                      onClick={() => {
                        router.push('/pricing')
                        setUserMenuOpen(false)
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Pricing</span>
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={() => {
                        router.push('/pricing')
                        setUserMenuOpen(false)
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Upgrade to Pro</span>
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        // Settings page can be added later
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-slate-700" />
              ) : (
                <Menu className="w-5 h-5 text-slate-700" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Mobile Menu Drawer */}
          <div className="fixed top-14 left-0 right-0 bottom-0 bg-white z-40 md:hidden flex flex-col">
            {/* User Info (if logged in) */}
            {isSupabaseConfigured && user && (
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                    {userInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{user.email}</p>
                    <p className="text-xs text-slate-500">Free Tier</p>
                  </div>
                </div>
              </div>
            )}

            {/* Conversation History Section (always show, even for anonymous users) */}
            {userId && (
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-3 bg-white sticky top-0 z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-5 h-5 text-slate-600" />
                      <h3 className="text-base font-semibold text-slate-900">Conversations</h3>
                    </div>
                    <button
                      onClick={handleNewProjectClick}
                      className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                      title="New conversation"
                    >
                      <Plus className="w-4 h-4 text-blue-500" />
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <ConversationHistory
                    userId={userId}
                    currentConversationId={null}
                    currentProjectId={null}
                    onSelectConversation={(conv) => {
                      if (onSelectConversation) {
                        onSelectConversation(conv)
                      } else if (typeof window !== 'undefined') {
                        window.location.href = `/?project=${conv.projectId}`
                      }
                      setMobileMenuOpen(false)
                    }}
                    onNewConversation={() => {
                      handleNewProjectClick()
                    }}
                    isMobileDrawer={true}
                  />
                </div>
              </div>
            )}

            {/* Navigation Links */}
            <div className="px-4 py-4 space-y-1 border-t border-slate-200 bg-white">
              <button
                onClick={handlePricing}
                className="w-full flex items-center space-x-3 px-4 py-3 text-left text-base font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <CreditCard className="w-5 h-5 text-purple-500" />
                <span>Pricing</span>
              </button>

              {isSupabaseConfigured && user && (
                <>
                  <div className="border-t border-slate-200 my-2" />
                  <button
                    onClick={() => {
                      router.push('/pricing')
                      setMobileMenuOpen(false)
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-left text-base font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <CreditCard className="w-5 h-5 text-slate-500" />
                    <span>Upgrade to Pro</span>
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-left text-base font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <Settings className="w-5 h-5 text-slate-500" />
                    <span>Settings</span>
                  </button>
                  <div className="border-t border-slate-200 my-2" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-left text-base font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign out</span>
                  </button>
                </>
              )}

              {/* Supabase Not Configured Warning */}
              {!isSupabaseConfigured && (
                <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    ⚠️ Supabase not configured - running in anonymous mode
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

