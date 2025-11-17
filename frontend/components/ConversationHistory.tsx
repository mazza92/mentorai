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
    <div className={`bg-white ${!isMobileDrawer ? 'border-r border-slate-200' : ''} flex flex-col transition-all duration-300 h-full ${
      displayIsOpen && !isMobileDrawer ? 'w-64' : isMobileDrawer ? 'w-full' : 'w-12'
    }`}>
      {/* Header - Only show in desktop mode */}
      {!isMobileDrawer && (
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          {displayIsOpen && (
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">Conversations</h3>
            </div>
          )}
          <div className="flex items-center space-x-1">
            {displayIsOpen && (
              <button
                onClick={handleNewConversation}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                title="New conversation"
              >
                <Plus className="w-4 h-4 text-slate-600" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              title={isOpen ? 'Collapse' : 'Expand'}
            >
              <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform ${!isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Conversation List */}
      {displayIsOpen && (
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>No conversations yet</p>
              <button
                onClick={handleNewConversation}
                className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition-colors"
              >
                Start New Chat
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv)}
                  className={`group relative p-2.5 rounded-lg cursor-pointer transition-all ${
                    currentConversationId === conv.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        currentConversationId === conv.id ? 'text-blue-900' : 'text-slate-900'
                      }`}>
                        {conv.videoTitle || conv.title}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">
                          {formatDate(conv.updatedAt)}
                        </span>
                        {conv.messages.length > 0 && (
                          <span className="text-xs text-slate-400">
                            • {conv.messages.length} messages
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
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

