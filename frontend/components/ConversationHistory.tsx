'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Plus, Trash2, Clock, ChevronRight } from 'lucide-react'
import { 
  Conversation, 
  loadConversations, 
  deleteConversation,
  createConversation 
} from '@/lib/conversationStorage'

interface ConversationHistoryProps {
  userId: string
  currentConversationId: string | null
  currentProjectId: string | null
  onSelectConversation: (conversation: Conversation) => void
  onNewConversation: () => void // Triggers video upload flow
  isMobileDrawer?: boolean // If true, hide collapse button and always show content
}

export default function ConversationHistory({
  userId,
  currentConversationId,
  currentProjectId,
  onSelectConversation,
  onNewConversation,
  isMobileDrawer = false,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isOpen, setIsOpen] = useState(true)
  
  // In mobile drawer, always show content
  const displayIsOpen = isMobileDrawer ? true : isOpen

  // Load conversations on mount and when userId or project changes
  useEffect(() => {
    const loadConversationsData = async () => {
      const loaded = await loadConversations(userId)
      setConversations(loaded)
    }
    loadConversationsData()
  }, [userId, currentConversationId, currentProjectId]) // Reload when conversation or project changes

  const handleNewConversation = () => {
    onNewConversation() // This will trigger video upload flow
  }

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation()
    if (confirm('Delete this conversation?')) {
      await deleteConversation(userId, conversationId)
      setConversations(prev => prev.filter(c => c.id !== conversationId))
      // If deleted conversation was active, navigate to upload
      if (currentConversationId === conversationId) {
        onNewConversation()
      }
    }
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) {
      return 'Today'
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return `${days} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div className={`bg-white/50 backdrop-blur-sm ${!isMobileDrawer ? 'border-r border-slate-100' : ''} flex flex-col transition-all duration-300 h-full ${
      displayIsOpen && !isMobileDrawer ? 'w-64' : isMobileDrawer ? 'w-full' : 'w-12'
    }`}>
      {/* Header - Only show in desktop mode */}
      {!isMobileDrawer && (
        <div className="p-3 border-b border-slate-100/80 flex items-center justify-between bg-white/80 backdrop-blur-sm">
          {displayIsOpen && (
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-medium text-slate-700">Conversations</h3>
            </div>
          )}
          <div className="flex items-center space-x-1">
            {displayIsOpen && (
              <button
                onClick={handleNewConversation}
                className="p-1.5 hover:bg-slate-100/80 rounded-md transition-colors"
                title="New conversation"
              >
                <Plus className="w-4 h-4 text-slate-500" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1.5 hover:bg-slate-100/80 rounded-md transition-colors"
              title={isOpen ? 'Collapse' : 'Expand'}
            >
              <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${!isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Conversation List */}
      {displayIsOpen && (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-600 mb-1">No conversations yet</p>
              <p className="text-xs text-slate-400 mb-4">Start a new video to begin</p>
              <button
                onClick={handleNewConversation}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-purple-600 transition-all shadow-sm hover:shadow-md"
              >
                Start New Chat
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv)}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                    currentConversationId === conv.id
                      ? 'bg-gradient-to-r from-blue-50 to-purple-50/50 shadow-sm'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate leading-snug ${
                        currentConversationId === conv.id ? 'text-slate-900' : 'text-slate-800'
                      }`}>
                        {conv.videoTitle || conv.title}
                      </p>
                      <div className="flex items-center space-x-1.5 mt-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">
                          {formatDate(conv.updatedAt)}
                        </span>
                        {conv.messages.length > 0 && (
                          <>
                            <span className="text-xs text-slate-300">•</span>
                            <span className="text-xs text-slate-400">
                              {conv.messages.length} {conv.messages.length === 1 ? 'message' : 'messages'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-md transition-all ml-2"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

