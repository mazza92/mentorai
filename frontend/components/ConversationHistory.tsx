'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Plus, Trash2, Clock, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Conversation,
  loadConversations,
  deleteConversation,
  createConversation
} from '@/lib/conversationStorage'
import ConfirmDialog from './ConfirmDialog'

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
  const { t } = useTranslation('common')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isOpen, setIsOpen] = useState(true)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null)

  // In mobile drawer, always show content
  const displayIsOpen = isMobileDrawer ? true : isOpen

  // Load conversations on mount and when userId changes
  // NOTE: Do NOT include currentConversationId or currentProjectId in dependencies
  // as it causes race conditions (reloading conversations while navigating to one)
  useEffect(() => {
    const loadConversationsData = async () => {
      const loaded = await loadConversations(userId)
      setConversations(loaded)
    }
    loadConversationsData()
  }, [userId]) // Only reload when userId changes

  const handleNewConversation = () => {
    onNewConversation() // This will trigger video upload flow
  }

  const handleDelete = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation()
    setConversationToDelete(conversationId)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!conversationToDelete) return

    await deleteConversation(userId, conversationToDelete)
    setConversations(prev => prev.filter(c => c.id !== conversationToDelete))

    // If deleted conversation was active, navigate to upload
    if (currentConversationId === conversationToDelete) {
      onNewConversation()
    }

    setConversationToDelete(null)
  }

  const formatDate = (date: Date) => {
    const now = new Date()

    // Reset time to midnight for accurate day comparison
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    // Calculate difference in calendar days
    const diff = nowDate.getTime() - inputDate.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return t('conversations.today')
    } else if (days === 1) {
      return t('conversations.yesterday')
    } else if (days < 7) {
      return t('conversations.days_ago_plural', { count: days })
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
              <h3 className="text-sm font-medium text-slate-700">{t('header.conversations')}</h3>
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
              <p className="text-slate-600 mb-1">{t('conversations.empty_state')}</p>
              <p className="text-xs text-slate-400 mb-4">{t('conversations.empty_hint')}</p>
              <button
                onClick={handleNewConversation}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-purple-600 transition-all shadow-sm hover:shadow-md"
              >
                {t('conversations.start_new')}
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
                              {conv.messages.length === 1 
                                ? t('conversations.message_count', { count: conv.messages.length })
                                : t('conversations.message_count_plural', { count: conv.messages.length })
                              }
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

      {/* Modern Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false)
          setConversationToDelete(null)
        }}
        onConfirm={confirmDelete}
        title={t('conversations.delete_title')}
        message={t('conversations.delete_message')}
        confirmText={t('conversations.delete_button')}
        cancelText={t('common.cancel')}
        variant="danger"
      />
    </div>
  )
}

