'use client'

import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { Send, Clock, BookOpen, Loader2, Zap, Youtube, ThumbsUp, List, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Menu, X, Video, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ConversationHistory from './ConversationHistory'
import ProcessingProgress from './ProcessingProgress'
import SignupWall from './SignupWall'
import ChannelViewer from './ChannelViewer'
import ChatStarters from './ChatStarters'
import SourceGuide from './SourceGuide'
import {
  Conversation,
  loadConversations,
  createConversation,
  saveConversation,
  updateConversationTitle,
  deleteConversation,
} from '@/lib/conversationStorage'

interface WanderMindViewerProps {
  projectId: string
  userId: string
  onNewConversation?: () => void
}

interface TranscriptLine {
  time: number
  text: string
}

interface QAMessage {
  type: 'user' | 'ai'
  text: string
  citations?: number[]
  timestamp: Date
}

// Utility to format seconds to MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Utility to format duration in seconds to HH:MM:SS or MM:SS
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Utility to format numbers (e.g., 1200000 -> "1.2M")
const formatNumber = (num: number | string): string => {
  const n = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(n)) return String(num)
  
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`
  } else if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`
  }
  return n.toString()
}

// Convert transcript words array to lines with timestamps
const processTranscript = (transcript: any): TranscriptLine[] => {
  if (!transcript) return []
  
  if (transcript.words && Array.isArray(transcript.words) && transcript.words.length > 0) {
    // Group words into sentences/phrases
    const lines: TranscriptLine[] = []
    let currentLine = ''
    let lineStartTime = transcript.words[0].startTime || 0
    
    transcript.words.forEach((word: any, index: number) => {
      if (index === 0) {
        currentLine = word.word || ''
        lineStartTime = word.startTime || 0
      } else {
        const prevWord = transcript.words[index - 1]
        const timeDiff = (word.startTime || 0) - (prevWord.endTime || 0)
        
        // Start new line if pause > 0.5s or sentence getting long
        if (timeDiff > 0.5 || currentLine.split(' ').length > 20) {
          lines.push({ time: lineStartTime, text: currentLine.trim() })
          currentLine = word.word || ''
          lineStartTime = word.startTime || 0
        } else {
          currentLine += ' ' + (word.word || '')
        }
      }
    })
    
    // Add last line
    if (currentLine.trim()) {
      lines.push({ time: lineStartTime, text: currentLine.trim() })
    }
    
    return lines
  } else if (transcript.text) {
    // Fallback: split text into chunks
    const sentences = transcript.text.split(/[.!?]+/).filter((s: string) => s.trim())
    return sentences.map((sentence: string, index: number) => ({
      time: index * 5, // Rough estimate: 5 seconds per sentence
      text: sentence.trim()
    }))
  }
  
  return []
}

interface VideoMetadata {
  title?: string
  author?: string
  views?: string
  likes?: string
  subscribers?: string
  duration?: string
  url?: string
  thumbnail?: string
  summary?: string
  keyTopics?: string[]
  videoCount?: number // For channels
}

interface Topic {
  title: string
  startTime: number
  description: string
  timeFormatted: string
}

// Context Panel (Left Side: Video & Transcript OR Channel Videos)
const ContextPanel = ({
  videoUrl,
  transcript,
  highlightedTime,
  setHighlightedTime,
  metadata,
  topics,
  loadingTopics,
  isChannel,
  channelId
}: {
  videoUrl?: string
  transcript: TranscriptLine[]
  highlightedTime: number
  setHighlightedTime: (time: number) => void
  metadata?: VideoMetadata
  topics?: Topic[]
  loadingTopics?: boolean
  isChannel?: boolean
  channelId?: string
}) => {
  const transcriptRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showFullTranscript, setShowFullTranscript] = useState(false)
  
  // Debug: Log metadata when it changes
  useEffect(() => {
    if (metadata) {
      console.log('📸 ContextPanel received metadata:', {
        hasThumbnail: !!metadata.thumbnail,
        thumbnail: metadata.thumbnail,
        title: metadata.title
      })
    }
  }, [metadata])
  
  // Show only first 10 lines by default
  const TRANSCRIPT_PREVIEW_LINES = 10
  const displayedTranscript = showFullTranscript 
    ? transcript 
    : transcript.slice(0, TRANSCRIPT_PREVIEW_LINES)

  // Effect to scroll to the highlighted citation and seek video
  useEffect(() => {
    if (highlightedTime > 0) {
      // Auto-expand transcript if the highlighted section is beyond preview
      const highlightedLine = transcript.find(line => Math.abs(line.time - highlightedTime) < 1)
      if (highlightedLine && !showFullTranscript) {
        const highlightedIndex = transcript.indexOf(highlightedLine)
        if (highlightedIndex >= TRANSCRIPT_PREVIEW_LINES) {
          setShowFullTranscript(true)
        }
      }
      
      // Scroll transcript to highlighted section (with slight delay to allow expansion)
      setTimeout(() => {
        if (transcriptRef.current) {
          const targetElement = transcriptRef.current.querySelector(`[data-time="${highlightedTime.toFixed(1)}"]`)
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
      }, showFullTranscript ? 0 : 100)
      
      // Seek video to highlighted time
      if (videoRef.current && videoUrl) {
        videoRef.current.currentTime = highlightedTime
      }
    }
  }, [highlightedTime, videoUrl, transcript, showFullTranscript])

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-blue-50/30 border-r border-slate-200/60 p-4 lg:p-6 space-y-6 overflow-y-auto custom-scrollbar">
      {/* Video Metadata Header (for non-channel projects only) */}
      {!isChannel && metadata && (metadata.title || metadata.author) && (
        <div className="space-y-3 pb-4 border-b border-slate-200/80">
          <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-slate-600">
            {metadata.author && (
              <div className="flex items-center">
                <Youtube className="w-4 h-4 mr-1.5 text-red-500" />
                <span className="text-slate-700">{metadata.author}</span>
              </div>
            )}
            {metadata.duration && (
              <div className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                <span className="text-slate-700">{metadata.duration}</span>
              </div>
            )}
            {metadata.subscribers && (
              <span className="text-slate-600">{metadata.subscribers} subscribers</span>
            )}
            {metadata.views && (
              <span className="text-slate-600">{metadata.views} views</span>
            )}
            {metadata.likes && (
              <div className="flex items-center">
                <ThumbsUp className="w-3.5 h-3.5 mr-1.5 text-pink-500" />
                <span className="text-slate-700">{metadata.likes} likes</span>
              </div>
            )}
          </div>
          {metadata.title && (
            <h1 className="text-xl font-bold text-slate-900 leading-snug">{metadata.title}</h1>
          )}
        </div>
      )}

      {/* Video Player */}
      <div className="aspect-video bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200/80 shadow-sm overflow-hidden ring-1 ring-slate-200/50">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full h-full rounded-xl"
            onTimeUpdate={(e) => {
              const currentTime = e.currentTarget.currentTime
              // Auto-highlight transcript as video plays (optional)
            }}
          />
        ) : (
          <div className="text-slate-400 flex flex-col items-center">
            <Zap className="w-8 h-8 mb-2 text-blue-400" />
            <p className="text-sm font-medium text-slate-600">Video Player</p>
            <p className="text-xs text-slate-500">Video will load here</p>
          </div>
        )}
      </div>

      {/* Video Thumbnail - Above TOC */}
      {metadata?.thumbnail && (
        <div 
          className="w-full mb-4 rounded-xl overflow-hidden border border-slate-200/80 shadow-md ring-1 ring-slate-200/50 bg-gradient-to-br from-slate-100 to-slate-200"
          style={{
            position: 'relative',
            zIndex: 10,
            minHeight: '200px'
          }}
        >
          <img
            src={metadata.thumbnail}
            alt={metadata.title || 'Video thumbnail'}
            className="w-full h-auto !block !visible !opacity-100"
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              maxHeight: '400px',
              objectFit: 'cover',
              position: 'relative',
              zIndex: 11,
              visibility: 'visible',
              opacity: 1
            }}
            onLoad={(e) => {
              const img = e.currentTarget
              const parent = img.parentElement
              console.log('✅ Thumbnail image loaded successfully:', metadata.thumbnail)
              console.log('📐 Image dimensions:', {
                width: img.offsetWidth,
                height: img.offsetHeight,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                display: window.getComputedStyle(img).display,
                visibility: window.getComputedStyle(img).visibility,
                opacity: window.getComputedStyle(img).opacity,
                parentWidth: parent?.offsetWidth,
                parentHeight: parent?.offsetHeight,
                parentDisplay: parent ? window.getComputedStyle(parent).display : 'N/A',
                parentVisibility: parent ? window.getComputedStyle(parent).visibility : 'N/A',
                parentOpacity: parent ? window.getComputedStyle(parent).opacity : 'N/A'
              })
            }}
            onError={(e) => {
              console.error('❌ Thumbnail image failed to load:', metadata.thumbnail)
              const img = e.currentTarget
              img.style.display = 'none'
              const parent = img.parentElement
              if (parent) {
                parent.innerHTML = '<div class="flex items-center justify-center p-8 text-slate-500 text-sm bg-slate-100">Thumbnail unavailable</div>'
              }
            }}
          />
        </div>
      )}

      {/* Table of Contents */}
      {topics && topics.length > 0 ? (
        <div className="space-y-3 pb-4 border-b border-slate-200/80">
          <div className="flex items-center mb-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 mr-2.5">
              <List className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Table of Contents</h3>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar-light pr-1">
            {topics.map((topic, index) => (
              <button
                key={index}
                onClick={() => setHighlightedTime(topic.startTime)}
                className="w-full text-left p-2.5 rounded-lg hover:bg-white/80 transition-all group border border-transparent hover:border-blue-200 hover:shadow-sm bg-white/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 group-hover:text-blue-600 transition-colors">
                      {topic.title}
                    </p>
                    {topic.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {topic.description}
                      </p>
                    )}
                  </div>
                  <span className="ml-2 text-xs font-mono text-blue-500 font-semibold flex-shrink-0 whitespace-nowrap">
                    {topic.timeFormatted}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : loadingTopics ? (
        <div className="space-y-3 pb-4 border-b border-slate-200/80">
          <div className="flex items-center mb-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 mr-2.5">
              <List className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Table of Contents</h3>
          </div>
          <div className="text-xs text-slate-600 flex items-center">
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-blue-500" />
            Generating topics...
          </div>
        </div>
      ) : null}
      
      {/* Channel Videos OR Transcript */}
      {isChannel && channelId ? (
        <div className="space-y-4">
          {/* Channel metadata header */}
          {metadata && (metadata.title || metadata.author) && (
            <div className="space-y-2 pb-4 border-b border-slate-200/80">
              <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-slate-600">
                {metadata.author && (
                  <div className="flex items-center">
                    <Youtube className="w-4 h-4 mr-1.5 text-red-500" />
                    <span className="text-slate-700">{metadata.author}</span>
                  </div>
                )}
                {metadata.videoCount !== undefined && (
                  <span className="text-slate-600">{metadata.videoCount} videos</span>
                )}
                {metadata.subscribers && (
                  <span className="text-slate-600">{metadata.subscribers} subscribers</span>
                )}
              </div>
              {metadata.title && (
                <h1 className="text-xl font-bold text-slate-900 leading-snug">{metadata.title}</h1>
              )}
            </div>
          )}

          <h2 className="text-lg font-semibold text-slate-900 flex items-center mb-4">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 mr-2.5">
              <Youtube className="w-4 h-4 text-white" />
            </div>
            Channel Videos
          </h2>
          <ChannelViewer channelId={channelId} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 mr-2.5">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              Transcript & Source
            </h2>
            {transcript.length > TRANSCRIPT_PREVIEW_LINES && (
              <button
                onClick={() => setShowFullTranscript(!showFullTranscript)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1 transition-colors px-2 py-1 rounded-md hover:bg-blue-50"
              >
                {showFullTranscript ? (
                  <>
                    <span>Show less</span>
                    <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <span>View full transcript</span>
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
            )}
          </div>
          <div
            ref={transcriptRef}
            className="text-slate-700 font-normal text-sm leading-relaxed bg-white/60 rounded-lg p-3 border border-slate-200/60"
          >
            {displayedTranscript.length > 0 ? (
              <>
                {displayedTranscript.map((line, index) => {
                  const isHighlighted = Math.abs(line.time - highlightedTime) < 1

                  return (
                    <p
                      key={index}
                      data-time={line.time.toFixed(1)}
                      className={`transition-all duration-300 py-2 px-3 rounded-lg cursor-pointer mb-1 ${
                        isHighlighted
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 font-medium text-white shadow-md ring-2 ring-blue-300'
                          : 'hover:bg-slate-100/80 text-slate-700'
                      }`}
                      onClick={() => setHighlightedTime(line.time)}
                    >
                      <span className={`font-mono text-xs mr-2.5 ${
                        isHighlighted ? 'text-blue-100' : 'text-blue-500 font-semibold'
                      }`}>
                        [{formatTime(line.time)}]
                      </span>
                      {line.text}
                    </p>
                  )
                })}
                {!showFullTranscript && transcript.length > TRANSCRIPT_PREVIEW_LINES && (
                  <div className="pt-2 text-center">
                    <p className="text-xs text-slate-500">
                      ... {transcript.length - TRANSCRIPT_PREVIEW_LINES} more lines
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-500 text-sm italic">
                No transcript available. The video will be transcribed automatically when you ask your first question.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Q&A Panel (Right Side: Chat Interface)
const QnAPanel = ({
  projectId,
  userId,
  setHighlightedTime,
  project,
  onNewConversation,
  showMobileHeader = false,
  onMenuClick,
  onSelectConversation,
  metadata,
  mobileContextOpen,
  setMobileContextOpen
}: {
  projectId: string
  userId: string
  setHighlightedTime: (time: number) => void
  project?: any
  onNewConversation?: () => void
  showMobileHeader?: boolean
  onMenuClick?: () => void
  onSelectConversation?: (conversation: Conversation) => void
  metadata?: VideoMetadata
  mobileContextOpen?: boolean
  setMobileContextOpen?: (open: boolean) => void
}) => {
  const { t } = useTranslation('common')
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<QAMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Thinking...')
  const [questionsRemaining, setQuestionsRemaining] = useState<number | null>(null)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [showSignupWall, setShowSignupWall] = useState(false)
  const [signupQuotaUsage, setSignupQuotaUsage] = useState<{used: number, limit: number} | undefined>(undefined)
  const [signupMessage, setSignupMessage] = useState<string | undefined>(undefined)
  const [sourceGuide, setSourceGuide] = useState<{summary: string, keyTopics: string[], suggestedPrompts?: string[]} | null>(null)
  const [loadingSourceGuide, setLoadingSourceGuide] = useState(false)
  const [promptStartIndex, setPromptStartIndex] = useState(0) // Track which prompts to show
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Dynamic loading messages (NotebookLM/Claude-style)
  const loadingMessages = [
    'Thinking...',
    'Analyzing content...',
    'Searching through video...',
    'Finding relevant insights...',
    'Crafting your answer...',
    'Almost there...',
  ]

  // Rotate loading messages
  useEffect(() => {
    if (!isLoading) return

    let messageIndex = 0
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length
      setLoadingMessage(loadingMessages[messageIndex])
    }, 2000) // Change message every 2 seconds

    return () => clearInterval(interval)
  }, [isLoading])

  // Load conversation for this project on mount - only when projectId changes
  useEffect(() => {
    const loadConversation = async () => {
      // Reset state first
      setCurrentConversationId(null)
      setHistory([])
      
      const conversations = await loadConversations(userId)
      // Find conversation for this project - must match exactly
      const projectConversation = conversations.find(c => c.projectId === projectId)
      
      if (projectConversation) {
        // Load existing conversation for this project
        console.log('Loading conversation for project:', projectId, 'Conversation ID:', projectConversation.id)
        setCurrentConversationId(projectConversation.id)
        setHistory(projectConversation.messages.map(msg => ({
          type: msg.type as 'user' | 'ai',
          text: msg.text,
          citations: msg.citations,
          timestamp: msg.timestamp
        })))
      } else {
        // Create new conversation for this project only if none exists
        console.log('Creating new conversation for project:', projectId)
        const newConv = createConversation(projectId)
        setCurrentConversationId(newConv.id)
        await saveConversation(newConv, userId)
        setHistory([])
      }
    }
    loadConversation()
  }, [projectId, userId]) // Only reload when projectId or userId changes

  // Load source guide from project or fetch if not available
  useEffect(() => {
    const loadSourceGuide = async () => {
      if (!project) return

      console.log('[WanderMindViewer] loadSourceGuide - project data:', {
        hasSourceGuide: !!project.sourceGuide,
        sourceGuideKeys: project.sourceGuide ? Object.keys(project.sourceGuide) : null,
        sourceGuideData: project.sourceGuide,
        hasTranscript: !!project.transcript,
        hasTranscriptText: !!project.transcript?.text
      });

      // If project already has cached source guide, use it
      if (project.sourceGuide) {
        console.log('Using cached source guide from project:', project.sourceGuide);
        setSourceGuide({
          ...project.sourceGuide,
          suggestedPrompts: project.suggestedPrompts || project.sourceGuide.suggestedPrompts || []
        });
        return;
      }

      // Only fetch if we haven't already fetched
      if (sourceGuide || loadingSourceGuide) return

      // For single videos, need transcript. For channels, can generate without transcript.
      const hasRequiredData = project.type === 'channel'
        ? !!project.channelId
        : !!project.transcript?.text;

      if (!hasRequiredData) {
        console.log('[SourceGuide] Missing required data for source guide generation');
        return;
      }

      console.log('Fetching source guide from API');
      setLoadingSourceGuide(true)
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        const response = await axios.post(`${apiUrl}/api/source-guide`, {
          projectId
        })

        if (response.data.success && response.data.sourceGuide) {
          // Combine sourceGuide with suggestedPrompts from API
          setSourceGuide({
            ...response.data.sourceGuide,
            suggestedPrompts: response.data.suggestedPrompts || []
          })
        }
      } catch (error) {
        console.error('Error fetching source guide:', error)
        // Silently fail - source guide is optional
      } finally {
        setLoadingSourceGuide(false)
      }
    }

    loadSourceGuide()
  }, [project, projectId, sourceGuide, loadingSourceGuide])

  // Save conversation whenever history changes
  useEffect(() => {
    const saveConversationData = async () => {
      if (currentConversationId && history.length > 0) {
        const conversations = await loadConversations(userId)
        const currentConv = conversations.find(c => c.id === currentConversationId)
        if (currentConv) {
          // Check if messages actually changed (new messages added)
          const existingMessageCount = currentConv.messages.length
          const newMessageCount = history.length
          const messagesChanged = newMessageCount > existingMessageCount

          const updated = {
            ...currentConv,
            messages: history.map(msg => ({
              type: msg.type,
              text: msg.text,
              citations: msg.citations,
              timestamp: msg.timestamp
            })),
            // Only update timestamp if messages actually changed
            updatedAt: messagesChanged ? new Date() : currentConv.updatedAt
          }
          // Auto-update title from first user message
          const titleUpdated = updateConversationTitle(updated)
          await saveConversation(titleUpdated, userId)
        }
      }
    }
    saveConversationData()
  }, [history, currentConversationId, projectId, userId])

  // Scrolls chat to the bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const handleQuery = async (userQuery: string) => {
    if (!userQuery.trim() || isLoading) return

    // Ensure we have a conversation
    if (!currentConversationId) {
      const newConv = createConversation(projectId, userQuery)
      setCurrentConversationId(newConv.id)
      await saveConversation(newConv, userId)
    }

    // Add user query to history
    const newUserEntry: QAMessage = { 
      type: 'user', 
      text: userQuery,
      timestamp: new Date()
    }
    setHistory(prev => [...prev, newUserEntry])
    setQuery('')
    setLoadingMessage('Thinking...') // Reset to first message
    setIsLoading(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

      // Build chatHistory from current conversation (last 5 exchanges)
      const chatHistory = history
        .filter(msg => msg.type === 'user' || msg.type === 'ai')
        .slice(-10) // Take last 10 messages (5 user + 5 AI)
        .reduce((acc, msg, index, arr) => {
          if (msg.type === 'user') {
            // Find the next AI message
            const aiMsg = arr[index + 1]
            if (aiMsg && aiMsg.type === 'ai') {
              acc.push({
                question: msg.text,
                answer: aiMsg.text
              })
            }
          }
          return acc
        }, [] as Array<{question: string, answer: string}>)

      // Get current language from i18n
      const currentLanguage = typeof window !== 'undefined' 
        ? (localStorage.getItem('wandermind_language') || navigator.language.split('-')[0] || 'en')
        : 'en';

      const response = await axios.post(`${apiUrl}/api/qa`, {
        projectId,
        question: userQuery,
        userId,
        chatHistory, // Send conversation history for context
        language: currentLanguage, // Send language preference
      })

      if (response.data.success) {
        const { answer, answerHtml, citations, questionsRemaining } = response.data

        // Update questions remaining counter
        if (questionsRemaining !== null && questionsRemaining !== undefined) {
          setQuestionsRemaining(questionsRemaining)
        }

        // Find the first citation to highlight
        if (citations && citations.length > 0) {
          setHighlightedTime(citations[0])
        }

        // Add AI response to history - prefer HTML for better formatting
        const aiEntry: QAMessage = {
          type: 'ai',
          text: answerHtml || answer || '', // Use HTML if available for proper formatting
          citations: citations || [],
          timestamp: new Date()
        }
        setHistory(prev => [...prev, aiEntry])
      }
    } catch (error: any) {
      console.error('Q&A error:', error)

      // Handle question limit reached
      if (error.response?.status === 403) {
        const errorData = error.response.data
        
        // Check if signup is required (anonymous user hit limit)
        if (errorData.requiresSignup) {
          setSignupQuotaUsage({
            used: errorData.questionsThisMonth || 3,
            limit: errorData.limit || 3
          })
          setSignupMessage(errorData.message)
          setShowSignupWall(true)
          
          // Remove the user message since it failed
          setHistory(prev => prev.slice(0, -1))
        }
        // Check if upgrade is required (free user hit limit)
        else if (errorData.upgradeRequired || errorData.error === 'Question limit reached') {
          const errorEntry: QAMessage = {
            type: 'ai',
            text: `🚫 **Question Limit Reached**\n\n${errorData.message}\n\nYou've used ${errorData.questionsThisMonth}/${errorData.limit} questions this month.`,
            timestamp: new Date()
          }
          setHistory(prev => [...prev, errorEntry])
        } else {
          const errorEntry: QAMessage = {
            type: 'ai',
            text: `❌ Error: ${errorData.error || error.message || 'Failed to get answer. Please try again.'}`,
            timestamp: new Date()
          }
          setHistory(prev => [...prev, errorEntry])
        }
      } else {
        const errorEntry: QAMessage = {
          type: 'ai',
          text: `❌ Error: ${error.response?.data?.error || error.message || 'Failed to get answer. Please try again.'}`,
          timestamp: new Date()
        }
        setHistory(prev => [...prev, errorEntry])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestedPrompt = (prompt: string) => {
    setQuery(prompt)
    handleQuery(prompt)
  }

  // Format AI answer with markdown, emojis, and grouped citations
  const formatAiAnswer = (text: string, citations?: number[]) => {
    if (!text) return null

    // Check if text is HTML (backend sends HTML for better formatting)
    const isHtml = text.includes('<p>') || text.includes('<ul>') || text.includes('<ol>') || text.includes('<li>') ||
                   text.includes('<strong>') || text.includes('<em>') || text.includes('<b>') || text.includes('<i>')

    // Remove ALL cite tags as a safety measure (backend should have done this, but double-check)
    text = text.replace(/<cite[^>]*>[\s]*<\/cite>/gi, '')
    text = text.replace(/<cite[^>]*>/gi, '')
    text = text.replace(/<\/cite>/gi, '')

    // Extract all citations from text and remove them from content
    const citationRegex = /\[(\d{1,2}):(\d{2})\]/g
    const foundCitations: Array<{time: number, original: string}> = []
    let match

    // Collect all citations
    while ((match = citationRegex.exec(text)) !== null) {
      const minutes = parseInt(match[1], 10)
      const seconds = parseInt(match[2], 10)
      const timeInSeconds = minutes * 60 + seconds
      foundCitations.push({
        time: timeInSeconds,
        original: match[0]
      })
    }

    // Remove citations from text for cleaner display
    const cleanedText = text.replace(/\[\d{1,2}:\d{2}\]/g, '').trim()

    // Group citations by removing duplicates and sorting
    const uniqueCitations = Array.from(
      new Map(foundCitations.map(c => [c.time, c])).values()
    ).sort((a, b) => a.time - b.time)

    // Render HTML directly if available
    if (isHtml) {
      return (
        <div className="space-y-3">
          <div
            className="qa-formatted-content"
            dangerouslySetInnerHTML={{ __html: cleanedText }}
          />
          {uniqueCitations.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-200">
              <span className="text-xs font-semibold text-slate-500 mr-1">References:</span>
              {uniqueCitations.map((citation, idx) => (
                <button
                  key={idx}
                  onClick={() => setHighlightedTime(citation.time)}
                  className="text-xs px-2.5 py-1 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 text-blue-600 rounded-lg transition-all duration-150 border border-blue-200/60 hover:border-blue-300 hover:shadow-sm font-medium"
                  title="Click to jump to this timestamp"
                >
                  {citation.original}
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }

    // Otherwise, process as markdown (fallback for old format)
    text = cleanedText.replace(/\s{2,}/g, ' ') // Clean up extra spaces

    // Remove bold markers from entire paragraphs (common AI mistake)
    const paragraphs = text.split(/\n\n+/)
    const cleanedParagraphs = paragraphs.map(para => {
      const trimmed = para.trim()
      if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
        const withoutMarkers = trimmed.slice(2, -2).trim()
        if (withoutMarkers.length > 50) {
          return withoutMarkers
        }
      }
      return para
    })
    text = cleanedParagraphs.join('\n\n')

    const formattedContent = formatMarkdown(text, 'answer')

    return (
      <div className="space-y-3">
        {formattedContent}
        {uniqueCitations.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-200">
            <span className="text-xs font-semibold text-slate-500 mr-1">References:</span>
            {uniqueCitations.map((citation, idx) => (
              <button
                key={idx}
                onClick={() => setHighlightedTime(citation.time)}
                className="text-xs px-2.5 py-1 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 text-blue-600 rounded-lg transition-all duration-150 border border-blue-200/60 hover:border-blue-300 hover:shadow-sm font-medium"
                title="Click to jump to this timestamp"
              >
                {citation.original}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Format markdown text with proper styling
  const formatMarkdown = (text: string, keyPrefix: string) => {
    if (!text || !text.trim()) return <p className="text-slate-700">{text}</p>
    
    // Pre-process: Remove bold markers from entire paragraphs (common AI mistake)
    // If a paragraph starts with ** and ends with **, it's likely a mistake - remove the outer markers
    text = text.replace(/(^|\n\n)(\*\*)([^*\n]+(?:\n[^*\n]+)*?)(\*\*)($|\n\n)/g, (match, before, startBold, content, endBold, after) => {
      // Only remove if the content is longer than 50 chars (likely a paragraph, not a phrase)
      if (content.trim().length > 50) {
        return before + content.trim() + after
      }
      return match
    })
    
    const elements: React.ReactNode[] = []
    let elementIndex = 0
    
    // First, check if the entire text contains numbered lists (even in continuous text)
    // This handles cases where numbered lists appear without proper line breaks
    const numberedListPattern = /\d+\.\s+[^\d\n]+/g
    const numberedMatches = text.match(numberedListPattern)
    
    // If we find numbered lists, split the text around them
    if (numberedMatches && numberedMatches.length >= 2) {
      // Split text by numbered list items (even if they're in continuous text)
      const parts: Array<{type: 'text' | 'list', content: string}> = []
      let remaining = text
      let lastIndex = 0
      
      // Find all numbered list start positions
      const listStarts: Array<{index: number, match: string}> = []
      let match
      const regex = /\d+\.\s+/g
      while ((match = regex.exec(text)) !== null) {
        listStarts.push({ index: match.index, match: match[0] })
      }
      
      if (listStarts.length >= 2) {
        // Process text before first list item
        if (listStarts[0].index > 0) {
          const beforeText = text.substring(0, listStarts[0].index).trim()
          if (beforeText) {
            parts.push({ type: 'text', content: beforeText })
          }
        }
        
        // Extract all list items
        const listItems: string[] = []
        for (let i = 0; i < listStarts.length; i++) {
          const start = listStarts[i].index
          const end = i < listStarts.length - 1 ? listStarts[i + 1].index : text.length
          const itemText = text.substring(start, end)
            .replace(/^\d+\.\s+/, '')
            .trim()
            .replace(/\s+/g, ' ') // Normalize whitespace
          if (itemText) {
            listItems.push(itemText)
          }
        }
        
        // Add the list
        if (listItems.length > 0) {
          parts.push({ type: 'list', content: listItems.join('|||') }) // Use separator
        }
        
        // Process text after last list item
        const lastListEnd = listStarts[listStarts.length - 1].index + listStarts[listStarts.length - 1].match.length
        if (lastListEnd < text.length) {
          const afterText = text.substring(lastListEnd).trim()
          if (afterText && !afterText.match(/^References?:/i)) {
            parts.push({ type: 'text', content: afterText })
          }
        }
        
        // Render parts
        parts.forEach((part, partIdx) => {
          const partKey = `${keyPrefix}-part-${partIdx}`
          if (part.type === 'list') {
            const items = part.content.split('|||').filter(i => i.trim())
            const listElements = items.map((item, liIndex) => (
              <li key={`${partKey}-li-${liIndex}`} className="mb-2 text-slate-700 leading-relaxed">
                {formatInlineMarkdown(item.trim(), `${partKey}-li-${liIndex}-inline`)}
              </li>
            ))
            elements.push(
              <ol key={partKey} className="list-decimal list-inside space-y-1.5 my-3 ml-2">
                {listElements}
              </ol>
            )
          } else {
            // Check if it's a heading
            const trimmed = part.content.trim()
            if (trimmed.match(/^##\s+/)) {
              const headingText = trimmed.replace(/^##\s+/, '').trim()
              elements.push(
                <h2 key={partKey} className="text-lg font-bold text-slate-900 mt-5 mb-2">
                  {formatInlineMarkdown(headingText, `${partKey}-inline`)}
                </h2>
              )
            } else if (trimmed.match(/^###\s+/)) {
              const headingText = trimmed.replace(/^###\s+/, '').trim()
              elements.push(
                <h3 key={partKey} className="text-base font-semibold text-slate-800 mt-3 mb-1.5">
                  {formatInlineMarkdown(headingText, `${partKey}-inline`)}
                </h3>
              )
            } else {
              const formatted = formatInlineMarkdown(trimmed, `${partKey}-inline`)
              elements.push(
                <p key={partKey} className="text-slate-700 leading-relaxed mb-2">
                  {formatted}
                </p>
              )
            }
          }
        })
        
        return elements.length > 0 ? <>{elements}</> : <p className="text-slate-700">{text}</p>
      }
    }
    
    // CRITICAL FIX: Detect and separate title/intro from first paragraph
    // Pattern: emoji + title text + paragraph text (merged together)
    // Example: "🚀 A Million-Dollar Design Agency Mark, a 19-year-old entrepreneur..."
    if (!text.trim().startsWith('#') && !text.trim().startsWith('*') && !text.trim().match(/^\d+\./)) {
      // Check if first "block" contains a merged title + paragraph pattern
      const emojiTitlePattern = /^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s*([A-Z][^.!?\n]{10,80}?)(\s+)([A-Z][a-z])/u;
      const firstBlock = text.split(/\n\n+/)[0];
      const match = firstBlock.match(emojiTitlePattern);
      
      if (match && match.index !== undefined) {
        const emoji = match[1];
        const titleText = match[2].trim();
        const paragraphStart = match[4];
        const fullMatch = match[0];
        
        // Find where paragraph actually starts
        const titleEndIndex = match.index + fullMatch.length - paragraphStart.length;
        const titlePart = firstBlock.substring(match.index, titleEndIndex).trim();
        const paragraphPart = firstBlock.substring(titleEndIndex).trim();
        const restOfText = text.substring(firstBlock.length).trim();
        
        // Only apply if title is reasonably short and paragraph exists
        if (titleText.length < 80 && titleText.length > 10 && paragraphPart.length > 20) {
          // Create heading from title
          const titleKey = `${keyPrefix}-title`
          elements.push(
            <h3 key={titleKey} className="text-base font-semibold text-slate-800 mt-3 mb-1.5">
              {formatInlineMarkdown(`${emoji} ${titleText}`, `${titleKey}-inline`)}
            </h3>
          )
          
          // Add paragraph
          const paraKey = `${keyPrefix}-intro-para`
          const formatted = formatInlineMarkdown(paragraphPart, `${paraKey}-inline`)
          elements.push(
            <p key={paraKey} className="text-slate-700 leading-relaxed mb-2">
              {formatted}
            </p>
          )
          
          // Process rest of text if any
          if (restOfText) {
            const restElements = formatMarkdown(restOfText, `${keyPrefix}-rest`)
            if (Array.isArray(restElements)) {
              elements.push(...restElements)
            } else {
              elements.push(restElements)
            }
          }
          
          return elements.length > 0 ? <>{elements}</> : <p className="text-slate-700">{text}</p>
        }
      }
    }
    
    // Fallback to original parsing if no numbered lists found
    // First, split by double newlines to get major blocks
    const majorBlocks = text.split(/\n\n+/)
    
    majorBlocks.forEach((block, blockIdx) => {
      if (!block.trim()) return
      
      const blockKey = `${keyPrefix}-block-${blockIdx}`
      const lines = block.split('\n').filter(l => l.trim())
      
      if (lines.length === 0) return
      
      // Check for headings (must be first line)
      const firstLine = lines[0].trim()
      if (firstLine.match(/^##\s+/)) {
        const headingText = firstLine.replace(/^##\s+/, '').trim()
        elements.push(
          <h2 key={blockKey} className="text-lg font-bold text-slate-900 mt-5 mb-2">
            {formatInlineMarkdown(headingText, `${blockKey}-inline`)}
          </h2>
        )
        return
      } else if (firstLine.match(/^###\s+/)) {
        const headingText = firstLine.replace(/^###\s+/, '').trim()
        elements.push(
          <h3 key={blockKey} className="text-base font-semibold text-slate-800 mt-3 mb-1.5">
            {formatInlineMarkdown(headingText, `${blockKey}-inline`)}
          </h3>
        )
        return
      }
      
      // Check if first line looks like a title (emoji + capitalized text, no period)
      // but is merged with paragraph on same line
      if (blockIdx === 0 && !firstLine.match(/^#{1,3}\s+/) && !firstLine.match(/^\d+\./)) {
        const emojiTitlePattern = /^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s*([A-Z][^.!?\n]{10,80}?)(\s+)([A-Z][a-z])/u;
        const match = firstLine.match(emojiTitlePattern);
        
        if (match && match.index !== undefined) {
          const emoji = match[1];
          const titleText = match[2].trim();
          const paragraphStart = match[4];
          const fullMatch = match[0];
          
          // Find where paragraph actually starts
          const titleEndIndex = match.index + fullMatch.length - paragraphStart.length;
          const titlePart = firstLine.substring(match.index, titleEndIndex).trim();
          const paragraphPart = firstLine.substring(titleEndIndex).trim();
          const remainingLines = lines.slice(1);
          
          // Only apply if title is reasonably short
          if (titleText.length < 80 && titleText.length > 10 && paragraphPart.length > 20) {
            // Create heading from title
            elements.push(
              <h3 key={`${blockKey}-title`} className="text-base font-semibold text-slate-800 mt-3 mb-1.5">
                {formatInlineMarkdown(`${emoji} ${titleText}`, `${blockKey}-title-inline`)}
              </h3>
            )
            
            // Add paragraph (combine with remaining lines if any)
            const fullParagraph = paragraphPart + (remainingLines.length > 0 ? ' ' + remainingLines.join(' ') : '')
            const formatted = formatInlineMarkdown(fullParagraph, `${blockKey}-intro-inline`)
            elements.push(
              <p key={`${blockKey}-intro`} className="text-slate-700 leading-relaxed mb-2">
                {formatted}
              </p>
            )
            return
          }
        }
      }
      
      // Check if block contains numbered list items
      const numberedItems = lines.filter(line => line.trim().match(/^\d+\.\s+/))
      if (numberedItems.length > 0) {
        // Extract numbered list items
        const listItems: string[] = []
        let currentItem = ''
        
        lines.forEach(line => {
          const trimmed = line.trim()
          if (trimmed.match(/^\d+\.\s+/)) {
            // New list item
            if (currentItem) {
              listItems.push(currentItem.trim())
            }
            currentItem = trimmed.replace(/^\d+\.\s+/, '').trim()
          } else if (currentItem) {
            // Continuation of current item
            currentItem += ' ' + trimmed
          }
        })
        
        if (currentItem) {
          listItems.push(currentItem.trim())
        }
        
        if (listItems.length > 0) {
          const listElements = listItems.map((item, liIndex) => (
            <li key={`${blockKey}-li-${liIndex}`} className="mb-2 text-slate-700 leading-relaxed">
              {formatInlineMarkdown(item, `${blockKey}-li-${liIndex}-inline`)}
            </li>
          ))
          
          elements.push(
            <ol key={blockKey} className="list-decimal list-inside space-y-1.5 my-3 ml-2">
              {listElements}
            </ol>
          )
        }
        return
      }
      
      // Check if block contains bullet list items
      const bulletItems = lines.filter(line => line.trim().match(/^[-\*]\s+/))
      if (bulletItems.length > 0) {
        const listItems: string[] = []
        let currentItem = ''
        
        lines.forEach(line => {
          const trimmed = line.trim()
          if (trimmed.match(/^[-\*]\s+/)) {
            if (currentItem) {
              listItems.push(currentItem.trim())
            }
            currentItem = trimmed.replace(/^[-\*]\s+/, '').trim()
          } else if (currentItem) {
            currentItem += ' ' + trimmed
          }
        })
        
        if (currentItem) {
          listItems.push(currentItem.trim())
        }
        
        if (listItems.length > 0) {
          const listElements = listItems.map((item, liIndex) => (
            <li key={`${blockKey}-li-${liIndex}`} className="mb-1.5 text-slate-700 leading-relaxed">
              <span className="text-blue-500 mr-2 font-bold">•</span>
              {formatInlineMarkdown(item, `${blockKey}-li-${liIndex}-inline`)}
            </li>
          ))
          
          elements.push(
            <ul key={blockKey} className="list-none space-y-1.5 my-2">
              {listElements}
            </ul>
          )
        }
        return
      }
      
      // Regular paragraph - join lines with spaces
      const paragraphText = lines.join(' ').trim()
      if (paragraphText) {
        const formatted = formatInlineMarkdown(paragraphText, `${blockKey}-inline`)
        elements.push(
          <p key={blockKey} className="text-slate-700 leading-relaxed mb-2">
            {formatted}
          </p>
        )
      }
    })
    
    return elements.length > 0 ? <>{elements}</> : <p className="text-slate-700">{text}</p>
  }

  // Format inline markdown (bold, italic, code)
  const formatInlineMarkdown = (text: string, keyPrefix: string): React.ReactNode => {
    if (!text) return null
    
    // Remove any cite tags that might have slipped through
    text = text.replace(/<cite[^>]*>[\s]*<\/cite>/gi, '')
    text = text.replace(/<cite[^>]*>/gi, '')
    text = text.replace(/<\/cite>/gi, '')
    
    // If no markdown formatting, return plain text
    if (!text.includes('**') && !text.includes('__')) {
      return text
    }
    
    let keyCounter = 0
    const parts: React.ReactNode[] = []
    let remaining = text
    
    // Process bold (**text** or __text__) - VERY strict matching
    // Only match **text** where text is:
    // - Not empty
    // - Not too long (max 60 chars to avoid matching entire paragraphs or long sentences)
    // - Has word boundaries (not just spaces)
    // - Doesn't contain sentence-ending punctuation (likely a full sentence, not a phrase)
    const boldRegex = /\*\*([^*\n]{1,60}?)\*\*/g
    const boldMatches: Array<{match: string, index: number, text: string}> = []
    let match
    
    // Reset regex lastIndex to avoid issues
    boldRegex.lastIndex = 0
    while ((match = boldRegex.exec(remaining)) !== null) {
      const boldText = match[1].trim()
      // Only include if:
      // - Has actual content (not just spaces/punctuation)
      // - Not too long (max 60 chars)
      // - Doesn't look like a full sentence (no sentence-ending punctuation in the middle)
      // - Has at least one word character
      if (boldText.length > 0 && 
          boldText.length <= 60 && 
          /\w/.test(boldText) &&
          !boldText.match(/[.!?]\s+\w/)) { // Don't match if it contains sentence-ending punctuation followed by more text
        boldMatches.push({
          match: match[0],
          index: match.index,
          text: boldText
        })
      }
    }
    
    if (boldMatches.length > 0) {
      let lastIndex = 0
      boldMatches.forEach((boldMatch) => {
        if (boldMatch.index > lastIndex) {
          const beforeText = remaining.substring(lastIndex, boldMatch.index)
          if (beforeText) {
            parts.push(beforeText)
          }
        }
        parts.push(
          <strong key={`${keyPrefix}-bold-${keyCounter++}`} className="font-semibold text-slate-900">
            {boldMatch.text}
          </strong>
        )
        lastIndex = boldMatch.index + boldMatch.match.length
      })
      if (lastIndex < remaining.length) {
        const afterText = remaining.substring(lastIndex)
        if (afterText) {
          parts.push(afterText)
        }
      }
      return <>{parts}</>
    }
    
    return text
  }

  // Use backend-generated chat starters if available (channels), otherwise fallback to contextual prompts
  const chatStarters = project?.chatStarters || []
  const sourceCount = project?.sourceCount || project?.videoCount

  // Generate contextual prompts from metadata if available (NotebookLM-style)
  const generateContextualPrompts = () => {
    // Get user's language preference
    const userLanguage: 'en' | 'fr' = (typeof window !== 'undefined'
      ? (localStorage.getItem('wandermind_language') || 'en')
      : 'en') as 'en' | 'fr'

    // Try to get title from multiple sources
    const title = metadata?.title || project?.title || project?.fileName || project?.originalFileName || ''
    const description = project?.description || ''

    // Multilingual prompt templates
    const promptTemplates = {
      business: {
        en: [
          'What are the key strategies mentioned?',
          'How can I apply this to my business?',
          'What were the results achieved?'
        ],
        fr: [
          'Quelles sont les stratégies clés mentionnées ?',
          'Comment puis-je appliquer cela à mon entreprise ?',
          'Quels ont été les résultats obtenus ?'
        ]
      },
      howto: {
        en: [
          'Walk me through the step-by-step process',
          'What tools or resources do I need?',
          'What are common mistakes to avoid?'
        ],
        fr: [
          'Explique-moi le processus étape par étape',
          'Quels outils ou ressources me faut-il ?',
          'Quelles sont les erreurs courantes à éviter ?'
        ]
      },
      beginner: {
        en: [
          'What do I need to get started?',
          'What are the fundamentals I should know?',
          'What are the next steps after watching?'
        ],
        fr: [
          'De quoi ai-je besoin pour commencer ?',
          'Quels sont les fondamentaux à connaître ?',
          'Quelles sont les prochaines étapes après le visionnage ?'
        ]
      },
      casestudy: {
        en: [
          'What were the key tactics that worked?',
          'What were the biggest challenges?',
          'How can I replicate these results?'
        ],
        fr: [
          'Quelles ont été les tactiques clés qui ont fonctionné ?',
          'Quels ont été les plus grands défis ?',
          'Comment puis-je reproduire ces résultats ?'
        ]
      },
      default: {
        en: [
          'What are the key insights from this video?',
          'What actionable steps can I take?',
          'What are the main takeaways?'
        ],
        fr: [
          'Quels sont les points clés de cette vidéo ?',
          'Quelles actions concrètes puis-je entreprendre ?',
          'Quelles sont les principales leçons à retenir ?'
        ]
      },
      generic: {
        en: [
          'Summarize the key points',
          'What are the main topics covered?',
          'What actionable tips are mentioned?'
        ],
        fr: [
          'Résume les points clés',
          'Quels sont les principaux sujets abordés ?',
          'Quels conseils pratiques sont mentionnés ?'
        ]
      }
    }

    // If we have specific content, generate contextual prompts
    if (title) {
      const titleLower = title.toLowerCase()
      const descLower = description.toLowerCase()
      const combined = titleLower + ' ' + descLower

      // Business/Marketing content
      if (combined.includes('dropshipping') || combined.includes('ecommerce') || combined.includes('business') ||
          combined.includes('entreprise') || combined.includes('marketing')) {
        return promptTemplates.business[userLanguage] || promptTemplates.business.en
      }

      // How-to / Tutorial content
      if (combined.includes('how to') || combined.includes('guide') || combined.includes('tutorial') ||
          combined.includes('comment') || combined.includes('tutoriel')) {
        return promptTemplates.howto[userLanguage] || promptTemplates.howto.en
      }

      // Beginner content
      if (combined.includes('beginners') || combined.includes('start') || combined.includes('getting started') ||
          combined.includes('débutant') || combined.includes('commencer')) {
        return promptTemplates.beginner[userLanguage] || promptTemplates.beginner.en
      }

      // Case study / Success story
      if (combined.includes('case study') || combined.includes('success') || combined.includes('results') ||
          combined.includes('étude de cas') || combined.includes('succès') || combined.includes('résultat')) {
        return promptTemplates.casestudy[userLanguage] || promptTemplates.casestudy.en
      }

      // Default contextual (better than generic)
      return promptTemplates.default[userLanguage] || promptTemplates.default.en
    }

    // Generic fallback only if absolutely no metadata
    return promptTemplates.generic[userLanguage] || promptTemplates.generic.en
  }

  // Use intelligent prompts from source guide (NotebookLM style)
  const suggestedPrompts = sourceGuide?.suggestedPrompts && sourceGuide.suggestedPrompts.length > 0
    ? sourceGuide.suggestedPrompts
    : chatStarters.length > 0
    ? chatStarters
    : (project?.suggestedPrompts && project.suggestedPrompts.length > 0)
    ? project.suggestedPrompts
    : generateContextualPrompts()

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Sticky Metadata Bar - Mobile Only */}
      {metadata && (
        <div className="lg:hidden fixed top-14 left-0 right-0 z-20 bg-white border-t-0 border-b border-slate-200/60">
          <button
            onClick={() => setMobileContextOpen?.(!mobileContextOpen)}
            className="w-full px-3 py-2 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            {/* Compact Horizontal Layout */}
            <div className="flex items-center gap-2.5">
              {/* Thumbnail */}
              {metadata.thumbnail && (
                <div className="flex-shrink-0 w-20 h-14 rounded-md overflow-hidden bg-slate-100 border border-slate-200">
                  <img
                    src={metadata.thumbnail}
                    alt={metadata.title || 'Video thumbnail'}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {/* Title + Stats */}
              <div className="flex-1 min-w-0">
                {metadata.title && (
                  <h3 className="text-xs font-semibold text-slate-900 line-clamp-1 leading-tight mb-0.5">
                    {metadata.title}
                  </h3>
                )}
                <div className="flex items-center gap-2 text-[10px] text-slate-600 flex-wrap">
                  {metadata.author && (
                    <span className="flex items-center truncate">
                      <Youtube className="w-2.5 h-2.5 mr-0.5 text-red-500 flex-shrink-0" />
                      <span className="truncate max-w-[80px]">{metadata.author}</span>
                    </span>
                  )}
                  {metadata.views && (
                    <span className="flex items-center whitespace-nowrap">
                      <Video className="w-2.5 h-2.5 mr-0.5" />
                      {metadata.views}
                    </span>
                  )}
                  {metadata.likes && (
                    <span className="flex items-center whitespace-nowrap">
                      <ThumbsUp className="w-2.5 h-2.5 mr-0.5" />
                      {metadata.likes}
                    </span>
                  )}
                  {metadata.duration && (
                    <span className="flex items-center whitespace-nowrap">
                      <Clock className="w-2.5 h-2.5 mr-0.5" />
                      {metadata.duration}
                    </span>
                  )}
                </div>
              </div>
              {/* Expand/Collapse Indicator */}
              <div className="flex-shrink-0">
                {mobileContextOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-600" />
                )}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col lg:p-6 p-0 overflow-hidden">

          {/* Chat History Area */}
          <div className="flex-grow overflow-y-auto lg:pr-4 px-4 pt-4 pb-2 space-y-4 lg:space-y-6 custom-scrollbar-light lg:pt-4 pt-[calc(56px+60px)]">
            {/* Desktop Header */}
            <div className="hidden lg:flex items-center mb-6">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 mr-3 shadow-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Lurnia Q&A
              </h1>
            </div>

            {/* Source Guide (NotebookLM style) - Always visible */}
            {sourceGuide && (
              <SourceGuide
                title={metadata?.title || project?.title || 'Video'}
                summary={sourceGuide.summary}
                keyTopics={sourceGuide.keyTopics}
                onTopicClick={(topic) => {
                  // Auto-fill question based on topic
                  setQuery(`Tell me more about ${topic}`)
                }}
              />
            )}

            {/* Loading source guide skeleton */}
            {loadingSourceGuide && (
              <div className="mb-6 border border-slate-200 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/30 overflow-hidden shadow-sm">
                <div className="px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                  <h3 className="text-base font-semibold text-slate-900">Generating source guide...</h3>
                </div>
              </div>
            )}

            {/* Removed Lurnia greeting - only Source Guide needed */}

            {history.map((item, index) => (
              <div key={index} className={`flex ${item.type === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                <div className={`max-w-[85%] lg:max-w-[75%] p-3 lg:p-4 rounded-2xl shadow-sm ${
                  item.type === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-br-sm lg:rounded-br-none shadow-lg' 
                    : 'bg-slate-50 text-slate-900 rounded-tl-sm lg:rounded-tl-none border border-slate-200/80'
                }`}>
                  {item.type === 'ai' ? (
                    <div className="ai-response">
                      {formatAiAnswer(item.text, item.citations)}
                    </div>
                  ) : (
                    <p className="text-white font-medium text-sm lg:text-base leading-relaxed">{item.text}</p>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-50 text-slate-700 p-3 lg:p-4 rounded-2xl rounded-tl-sm lg:rounded-tl-none shadow-sm flex items-center border border-slate-200/80">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin text-blue-500" />
                  <span className="text-xs lg:text-sm text-slate-600">{loadingMessage}</span>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>
          
          {/* Input Area - Sticky at bottom on mobile */}
          <div className="mt-auto pt-3 lg:pt-4 pb-3 lg:pb-0 px-4 lg:px-0 border-t border-slate-200 bg-white lg:bg-transparent sticky lg:static bottom-0 z-30">
            {/* Warning banner when running low on questions */}
            {questionsRemaining !== null && questionsRemaining <= 10 && questionsRemaining > 0 && (
              <div className="mb-2 lg:mb-3 p-2 lg:p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs lg:text-sm text-amber-800">
                  {t('qa.questions_remaining_warning', {
                    count: questionsRemaining,
                    defaultValue: '⚠️ {{count}} questions remaining this month. Upgrade to Pro for unlimited questions!'
                  })}
                </p>
              </div>
            )}

            {/* NotebookLM-style suggested questions - always visible above input */}
            {suggestedPrompts && suggestedPrompts.length > 0 && (
              <div className="mb-3 w-full max-w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                  {suggestedPrompts
                    .slice(promptStartIndex, promptStartIndex + 2)
                    .concat(suggestedPrompts.slice(0, Math.max(0, (promptStartIndex + 2) - suggestedPrompts.length)))
                    .slice(0, 2)
                    .map((prompt: string, idx: number) => (
                    <button
                      key={`${promptStartIndex}-${idx}`}
                      onClick={() => {
                        setQuery(prompt)
                        handleQuery(prompt)
                        // Cycle to next 2 prompts after selection
                        setPromptStartIndex((prev) => (prev + 2) % suggestedPrompts.length)
                      }}
                      title={prompt}
                      className="px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 text-left overflow-hidden text-ellipsis line-clamp-2"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 lg:gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleQuery(query)
                  }
                }}
                placeholder="Ask about this content..."
                className="flex-grow p-3 lg:p-3.5 text-sm lg:text-base bg-slate-50 border border-slate-200 text-slate-900 rounded-xl lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 placeholder-slate-400 shadow-sm"
                disabled={isLoading}
              />
              <button
                onClick={() => handleQuery(query)}
                className={`p-3 lg:p-3.5 rounded-xl transition-all duration-200 shadow-md flex-shrink-0 ${
                  query.trim() && !isLoading
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                disabled={!query.trim() || isLoading}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Signup Wall (for anonymous users) */}
      <SignupWall
        isOpen={showSignupWall}
        onClose={() => setShowSignupWall(false)}
        reason="question"
        currentUsage={signupQuotaUsage}
        message={signupMessage}
      />
    </div>
  )
}

// Main WanderMind Viewer Component
export default function WanderMindViewer({ projectId, userId, onNewConversation }: WanderMindViewerProps) {
  const { t } = useTranslation('common')
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [projectNotFound, setProjectNotFound] = useState(false)
  const [highlightedTime, setHighlightedTime] = useState(0)
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [metadata, setMetadata] = useState<VideoMetadata | undefined>(undefined)
  const [topics, setTopics] = useState<Topic[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [mobileContextOpen, setMobileContextOpen] = useState(false)
  const [transcriptStatus, setTranscriptStatus] = useState<'partial' | 'ready' | 'error'>('ready')
  const [transcriptProgress, setTranscriptProgress] = useState<any>(null)
  const topicsFetched = useRef(false)
  const projectRef = useRef(project)
  const projectNotFoundRef = useRef(false)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptPollingRef = useRef<NodeJS.Timeout | null>(null)
  
  // Helper function for mobile navigation
  const handleSelectConversation = (conversation: Conversation) => {
    if (typeof window !== 'undefined') {
      window.location.href = `/?project=${conversation.projectId}`
    }
  }
  
  const handleNewConversation = () => {
    if (onNewConversation) {
      onNewConversation()
    } else if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  }

  const handleRetryTranscription = async () => {
    try {
      // Reset transcription status to pending
      setProject((prev: any) => ({
        ...prev,
        transcriptionStatus: 'pending',
        transcriptionError: undefined,
      }))

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      await axios.post(`${apiUrl}/api/transcribe`, {
        projectId,
      })
      
      // Refresh project to get updated status
      await fetchProject()
    } catch (error: any) {
      console.error('Retry transcription error:', error)
      // Update project with error
      setProject((prev: any) => ({
        ...prev,
        transcriptionStatus: 'failed',
        transcriptionError: error.response?.data?.error || error.message || 'Failed to retry transcription',
      }))
    }
  }

  // Update refs when project or error state changes
  useEffect(() => {
    projectRef.current = project
  }, [project])
  
  useEffect(() => {
    projectNotFoundRef.current = projectNotFound
  }, [projectNotFound])

  useEffect(() => {
    // Reset topics fetched flag when project changes
    topicsFetched.current = false
    setTopics([])
    setLoadingTopics(false)
    setProjectNotFound(false) // Reset error state when projectId changes
    projectNotFoundRef.current = false // Reset ref as well
    
    fetchProject()

    // Exponential backoff polling to reduce server load
    let pollInterval = 5000 // Start at 5 seconds
    const maxInterval = 30000 // Max 30 seconds
    const minInterval = 5000 // Min 5 seconds
    let pollCount = 0
    let isPolling = true

    const poll = async () => {
      if (!isPolling) return

      // Fetch latest project data
      await fetchProject()

      // Check current project state (use refs to avoid stale closure)
      const currentProject = projectRef.current
      const isNotFound = projectNotFoundRef.current
      
      // Stop polling if project not found
      if (isNotFound || (!currentProject && !loading)) {
        isPolling = false
        return
      }

      // If no project found, stop polling
      if (!currentProject) {
        isPolling = false
        return
      }

      const isProcessing = currentProject?.status === 'processing' ||
          (currentProject?.transcriptionStatus === 'pending' || currentProject?.transcriptionStatus === 'processing') ||
          (currentProject?.analysisStatus === 'pending' && currentProject?.duration && currentProject.duration <= 1800)
      
      // Stop polling if transcription failed
      const transcriptionFailed = currentProject?.transcriptionStatus === 'failed'
      if (transcriptionFailed) {
        isPolling = false
        return
      }

      if (isProcessing && isPolling) {
        pollCount++

        // Exponential backoff: 5s -> 7.5s -> 11.25s -> 16.875s -> 25.3s -> 30s (max)
        pollInterval = Math.min(Math.floor(minInterval * Math.pow(1.5, pollCount)), maxInterval)

        pollingTimeoutRef.current = setTimeout(poll, pollInterval)
      } else {
        // Processing complete, stop polling
        isPolling = false
        pollCount = 0
      }
    }

    // Start polling after initial fetch
    pollingTimeoutRef.current = setTimeout(poll, pollInterval)

    return () => {
      isPolling = false
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
      }
    }
  }, [projectId]) // Only depend on projectId

  // Transcript status polling for partial data
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    const pollTranscriptStatus = async () => {
      if (!projectId) return

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        const response = await axios.get(`${apiUrl}/api/channel/status/${projectId}`)

        const { status, transcriptProgress, transcriptStats } = response.data

        setTranscriptStatus(status)
        setTranscriptProgress(transcriptProgress)

        // Stop polling when ready or error
        if (status === 'ready' || status === 'error') {
          if (intervalId) {
            clearInterval(intervalId)
          }
          // Refresh project data to get all transcripts
          fetchProject()
        }
      } catch (error) {
        console.error('Failed to poll transcript status:', error)
      }
    }

    // Start polling if status is partial
    if (transcriptStatus === 'partial') {
      intervalId = setInterval(pollTranscriptStatus, 3000) // Poll every 3 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [projectId, transcriptStatus])

  const fetchProject = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await axios.get(`${apiUrl}/api/projects/project/${projectId}`)
      const projectData = response.data.project
      
      // Project found - reset error state
      setProjectNotFound(false)
      setProject(projectData)

      // Check transcript status for partial data
      if (projectData.status === 'partial' && projectData.transcriptProgress) {
        setTranscriptStatus('partial')
        setTranscriptProgress(projectData.transcriptProgress)
        console.log(`[Transcript] Partial status detected: ${projectData.transcriptProgress.fetched}/${projectData.transcriptProgress.total}`)
      } else if (projectData.status === 'error') {
        setTranscriptStatus('error')
      } else {
        setTranscriptStatus('ready')
        setTranscriptProgress(null)
      }

      // Update conversation with video metadata if available
      // Find conversation for this project by projectId
      if (projectData) {
        const conversations = await loadConversations(userId)
        const projectConv = conversations.find(c => c.projectId === projectId)
        if (projectConv && (!projectConv.videoTitle || !projectConv.videoThumbnail)) {
          const videoTitle = projectData.title || projectData.originalFileName || 'New Video'
          const videoThumbnail = projectData.thumbnail || projectData.thumbnailUrl || projectData.thumbnails?.[0]?.url
          const updated = {
            ...projectConv,
            videoTitle,
            videoThumbnail,
            title: videoTitle
          }
          await saveConversation(updated, userId)
        }
      }
      
      // Process transcript (always update, even if empty)
      setTranscript(processTranscript(projectData.transcript))
      
      // Extract metadata from project
      // Try multiple possible thumbnail field names
      const thumbnailUrl = projectData.thumbnail || projectData.thumbnailUrl || projectData.thumbnails?.[0]?.url
      
      // Debug: Log thumbnail extraction
      console.log('🔍 Thumbnail Debug:')
      console.log('  - projectData.thumbnail:', projectData.thumbnail)
      console.log('  - projectData.thumbnailUrl:', projectData.thumbnailUrl)
      console.log('  - projectData.thumbnails:', projectData.thumbnails)
      console.log('  - Extracted thumbnailUrl:', thumbnailUrl)
      
      const videoMetadata: VideoMetadata = {
        title: projectData.title || projectData.originalFileName || projectData.fileName,
        author: projectData.author || projectData.channelName || 'Unknown Author',
        views: projectData.views ? formatNumber(projectData.views) : undefined,
        likes: projectData.likes ? formatNumber(projectData.likes) : undefined,
        subscribers: projectData.subscribers ? formatNumber(projectData.subscribers) : projectData.subscriberCount ? formatNumber(projectData.subscriberCount) : undefined,
        duration: projectData.duration ? formatDuration(projectData.duration) : undefined,
        url: projectData.youtubeUrl || projectData.publicUrl,
        thumbnail: thumbnailUrl,
        summary: projectData.videoAnalysis?.summary || (projectData.description ? (projectData.description.length > 300 ? projectData.description.substring(0, 300) + '...' : projectData.description) : undefined),
        keyTopics: projectData.videoAnalysis?.keyTopics || [],
        videoCount: projectData.type === 'channel' ? projectData.videoCount : undefined // Add video count for channels
      }

      console.log('✅ Final metadata.thumbnail:', videoMetadata.thumbnail)
      setMetadata(videoMetadata)
      
      setLoading(false)
    } catch (err: any) {
      console.error('Error fetching project:', err)
      
      // Check if it's a 404 error (project not found)
      if (err.response?.status === 404 || err.code === 'ERR_BAD_REQUEST') {
        setProjectNotFound(true)
        projectNotFoundRef.current = true // Update ref immediately
        setProject(null)
        
        // Clean up URL parameter if project doesn't exist
        if (typeof window !== 'undefined' && window.location.search.includes(`project=${projectId}`)) {
          const url = new URL(window.location.href)
          url.searchParams.delete('project')
          window.history.replaceState({}, '', url.pathname + url.search)
        }
        
        // Clean up localStorage - check if userId looks like a Supabase UUID
        const isSupabaseUserId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId)
        if (isSupabaseUserId) {
          localStorage.removeItem(`currentProject_${userId}`)
        } else {
          localStorage.removeItem('currentProject')
        }
        
        // Clean up conversation that references this missing project
        try {
          const conversations = await loadConversations(userId)
          const projectConv = conversations.find(c => c.projectId === projectId)
          if (projectConv) {
            console.log('Cleaning up conversation for missing project:', projectId)
            await deleteConversation(userId, projectConv.id)
          }
        } catch (convError) {
          console.error('Error cleaning up conversation:', convError)
        }
      }
      
      setLoading(false)
    }
  }

  // Update transcript when project changes
  useEffect(() => {
    if (project?.transcript) {
      setTranscript(processTranscript(project.transcript))
    }
  }, [project?.transcript])

  // Fetch topics once when transcript is available
  useEffect(() => {
    if (project && project.transcript && !loading && !topicsFetched.current) {
      fetchTopics()
    }
  }, [projectId, loading, project?.transcript])

  const fetchTopics = async () => {
    if (!project || !projectId) {
      console.log('Cannot fetch topics: project or projectId missing')
      setLoadingTopics(false)
      return
    }

    // If already fetched, skip
    if (topicsFetched.current) {
      console.log('Topics already fetched, skipping')
      return
    }

    // Check if topics are already in project data (multiple possible formats)
    if (project?.topics && Array.isArray(project.topics) && project.topics.length > 0) {
      console.log('Using topics from project data:', project.topics.length)
      setTopics(project.topics)
      setLoadingTopics(false)
      topicsFetched.current = true
      return
    }

    // Check if tableOfContents exists in project
    if (project?.tableOfContents?.chapters && Array.isArray(project.tableOfContents.chapters)) {
      console.log('Using tableOfContents from project data:', project.tableOfContents.chapters.length)
      const formattedTopics = project.tableOfContents.chapters.map((chapter: any) => ({
        title: chapter.title,
        startTime: chapter.startTimeSeconds || 0,
        description: chapter.description || '',
        timeFormatted: chapter.startTime || formatTime(chapter.startTimeSeconds || 0)
      }))
      setTopics(formattedTopics)
      setLoadingTopics(false)
      topicsFetched.current = true
      return
    }

    setLoadingTopics(true)
    topicsFetched.current = true
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      console.log('Fetching topics from API:', `${apiUrl}/api/topics/${projectId}`)
      const response = await axios.get(`${apiUrl}/api/topics/${projectId}`)
      
      console.log('Topics API response:', response.data)
      
      if (response.data.success) {
        // Handle different response formats
        if (response.data.topics && Array.isArray(response.data.topics)) {
          // Direct topics array
          console.log('Using direct topics array:', response.data.topics.length)
          setTopics(response.data.topics)
        } else if (response.data.toc?.chapters && Array.isArray(response.data.toc.chapters)) {
          // Table of contents format with chapters
          console.log('Using TOC chapters:', response.data.toc.chapters.length)
          const formattedTopics = response.data.toc.chapters.map((chapter: any) => ({
            title: chapter.title,
            startTime: chapter.startTimeSeconds || 0,
            description: chapter.description || '',
            timeFormatted: chapter.startTime || formatTime(chapter.startTimeSeconds || 0)
          }))
          setTopics(formattedTopics)
        } else if (response.data.toc === null && response.data.message?.includes('not generated')) {
          // TOC not generated yet, try to generate it
          console.log('TOC not generated, attempting to generate...')
          try {
            // Get user's language preference
            const userLanguage = typeof window !== 'undefined'
              ? (localStorage.getItem('wandermind_language') || 'en')
              : 'en'
            const generateResponse = await axios.post(`${apiUrl}/api/topics/`, {
              projectId,
              language: userLanguage
            })
            console.log('Generate TOC response:', generateResponse.data)
            
            if (generateResponse.data.success && generateResponse.data.toc?.chapters) {
              const formattedTopics = generateResponse.data.toc.chapters.map((chapter: any) => ({
                title: chapter.title,
                startTime: chapter.startTimeSeconds || 0,
                description: chapter.description || '',
                timeFormatted: chapter.startTime || formatTime(chapter.startTimeSeconds || 0)
              }))
              setTopics(formattedTopics)
            }
          } catch (genError: any) {
            console.error('Error generating TOC:', genError)
            // If generation fails, continue without topics
          }
        } else {
          console.warn('No topics found in API response')
        }
      }
    } catch (error: any) {
      console.error('Error fetching topics:', error)
      // Don't show error to user, just continue without topics
    } finally {
      setLoadingTopics(false)
    }
  }

  // Ensure video URL uses the backend API URL if it's a relative path
  const getVideoUrl = (url: string | undefined) => {
    if (!url) return undefined
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    return `${apiUrl}${url.startsWith('/') ? url : `/${url}`}`
  }

  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading project...</p>
        </div>
      </div>
    )
  }

  // Show error UI if project not found
  if (projectNotFound || (!loading && !project)) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-slate-200/80 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Project Not Found</h2>
            <p className="text-slate-600 mb-2">
              This video project is no longer available. In development mode, projects are stored in memory and are lost when the server restarts.
            </p>
            <p className="text-xs text-slate-500">
              To persist projects permanently, configure Google Cloud Firestore in production.
            </p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => {
                // Clean up URL and navigate to upload
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', '/')
                  if (onNewConversation) {
                    onNewConversation()
                  } else {
                    window.location.href = '/'
                  }
                }
              }}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Upload New Video
            </button>
            
            <button
              onClick={() => {
                // Clean up URL and go to home
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', '/')
                  window.location.reload()
                }
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-6 rounded-xl transition-all duration-200"
            >
              Go to Home
            </button>
          </div>
          
          <p className="text-xs text-slate-500 mt-6">
            The conversation for this project has been automatically cleaned up.
          </p>
        </div>
      </div>
    )
  }

  const videoUrl = getVideoUrl(project.processedUrl || project.publicUrl)

  // Check if transcription failed
  const transcriptionFailed = project.transcriptionStatus === 'failed'

  // Check if still processing (exclude failed status and channel projects)
  // Channel projects use instant captions, not transcription, so skip processing UI
  const isProcessing = project.type !== 'channel' && !transcriptionFailed && (
                       !project.transcript ||
                       project.transcriptionStatus === 'pending' ||
                       project.transcriptionStatus === 'processing' ||
                       loadingTopics)

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .qa-formatted-content p {
          margin: 0.75rem 0;
          line-height: 1.6;
          color: #475569;
        }
        .qa-formatted-content p:first-child {
          margin-top: 0;
        }
        .qa-formatted-content p:last-child {
          margin-bottom: 0;
        }
        .qa-formatted-content p:empty {
          display: none;
        }
        .qa-formatted-content h1,
        .qa-formatted-content h2,
        .qa-formatted-content h3 {
          font-weight: 600;
          margin: 1.25rem 0 0.5rem 0;
          line-height: 1.3;
          color: #1e293b;
        }
        .qa-formatted-content h3 {
          font-size: 1rem;
        }
        .qa-formatted-content ul,
        .qa-formatted-content ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
          line-height: 1.6;
        }
        .qa-formatted-content ul {
          list-style-type: disc;
        }
        .qa-formatted-content ol {
          list-style-type: decimal;
        }
        .qa-formatted-content li {
          margin: 0.35rem 0;
          color: #475569;
          display: list-item;
        }
        .qa-formatted-content strong {
          font-weight: 600;
          color: #1e293b;
        }
        .qa-formatted-content code {
          background: #f1f5f9;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
          font-family: monospace;
        }
      `}} />
      <div className="h-full bg-gradient-to-br from-white to-slate-50 text-slate-900 font-sans flex flex-col overflow-hidden relative">
        {/* Failed Transcription Overlay */}
        {transcriptionFailed && (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-red-200/80">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Transcription Failed</h3>
                  <p className="text-sm text-slate-600">
                    The transcription service encountered an error. This is usually due to high demand on the AI service.
                  </p>
                  {project.transcriptionError && (
                    <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded">
                      {project.transcriptionError}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleRetryTranscription}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl"
                  >
                    Retry Transcription
                  </button>
                  <button
                    onClick={handleNewConversation}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-6 rounded-xl transition-all"
                  >
                    Start New Video
                  </button>
                </div>

                <p className="text-xs text-slate-500 pt-2">
                  The video was downloaded successfully. You can retry transcription or start a new video.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay - New Improved Progress UI */}
      {isProcessing && (
        <ProcessingProgress
          project={project}
          topics={topics}
          loadingTopics={loadingTopics}
          videoDuration={project.duration}
        />
      )}

      {/* Desktop View: Split Panels */}
      <div className="hidden lg:flex w-full h-full">
        {/* Far Left: Conversation History */}
        <div className="w-64 flex-shrink-0">
          <ConversationHistory
            userId={userId}
            currentConversationId={null}
            currentProjectId={null}
            onSelectConversation={handleSelectConversation}
            onNewConversation={onNewConversation || (() => {})}
          />
        </div>

        {/* Left Panel: Context & Transcript (reduced by 15%: ~34% width) */}
        <div className="w-1/3 flex-shrink-0 border-r border-slate-100">
          <ContextPanel
            videoUrl={videoUrl}
            transcript={transcript}
            highlightedTime={highlightedTime}
            setHighlightedTime={setHighlightedTime}
            metadata={metadata}
            topics={topics}
            loadingTopics={loadingTopics}
            isChannel={project.type === 'channel'}
            channelId={project.channelId}
          />
        </div>
        
        {/* Right Panel: Q&A Chat */}
        <div className="flex-1 flex-shrink-0 flex flex-col">
          {/* Partial data banner */}
          {transcriptStatus === 'partial' && (
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    Loading additional channel content...
                  </p>
                  {transcriptProgress && (
                    <p className="text-xs text-blue-700 mt-1">
                      {transcriptProgress.fetched} / {transcriptProgress.total} videos processed
                    </p>
                  )}
                </div>
                <p className="text-xs text-blue-600">
                  Chatting with {transcriptProgress?.fetched || 15} most popular videos
                </p>
              </div>
            </div>
          )}
          <QnAPanel
            projectId={projectId}
            userId={userId}
            setHighlightedTime={setHighlightedTime}
            project={project}
            onNewConversation={onNewConversation}
            onSelectConversation={handleSelectConversation}
            metadata={metadata}
            mobileContextOpen={mobileContextOpen}
            setMobileContextOpen={setMobileContextOpen}
          />
        </div>
      </div>

      {/* Mobile View: Full-screen Chat with Sticky Metadata */}
      <div className="lg:hidden w-full h-full flex flex-col relative">
        {/* Partial data banner - Mobile */}
        {transcriptStatus === 'partial' && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  Loading more videos...
                </p>
                {transcriptProgress && (
                  <p className="text-xs text-blue-700 mt-1">
                    {transcriptProgress.fetched} / {transcriptProgress.total}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        <QnAPanel
          projectId={projectId}
          userId={userId}
          setHighlightedTime={setHighlightedTime}
          project={project}
          onNewConversation={onNewConversation}
          showMobileHeader={false}
          onSelectConversation={handleSelectConversation}
          metadata={metadata}
          mobileContextOpen={mobileContextOpen}
          setMobileContextOpen={setMobileContextOpen}
        />
      </div>

      {/* Mobile Context Panel Modal */}
      {mobileContextOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Video Details</h2>
            <button
              onClick={() => setMobileContextOpen(false)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Context Panel Content */}
          <div className="h-[calc(100vh-56px)] overflow-y-auto">
            <ContextPanel
              videoUrl={videoUrl}
              transcript={transcript}
              highlightedTime={highlightedTime}
              setHighlightedTime={setHighlightedTime}
              metadata={metadata}
              topics={topics}
              loadingTopics={loadingTopics}
              isChannel={project.type === 'channel'}
              channelId={project.channelId}
            />
          </div>
        </div>
      )}
    </div>
    </>
  )
}

