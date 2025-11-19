'use client'

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { Send, Loader2, MessageCircle, Clock } from 'lucide-react'

interface VideoQAProps {
  projectId: string
  userId: string
}

interface QAMessage {
  role: 'user' | 'assistant'
  content: string
  contentHtml?: string // HTML formatted content for better rendering
  citations?: number[] // Timestamps in seconds
  timestamp: Date
}

export default function VideoQA({ projectId, userId }: VideoQAProps) {
  const [messages, setMessages] = useState<QAMessage[]>([])
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState(0) // Track retry attempts for UI feedback
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize messages on client side only
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: "Hi! I'm WanderMind, your AI video assistant. Ask me anything about this video!\n\nFor example:\n\n• \"What are the main topics covered?\"\n• \"Summarize the key points\"\n• \"What did they say about [topic]?\"\n• \"When do they mention [keyword]?\"",
        timestamp: new Date(),
      },
    ])
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Helper: Sleep for exponential backoff
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  // Helper: Check if error is retryable (503, timeout, network errors)
  const isRetryableError = (error: any): boolean => {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return true
    if (error.response?.status === 503) return true
    if (error.message?.includes('timeout')) return true
    if (error.message?.includes('network')) return true
    return false
  }

  const handleSend = async () => {
    if (!input.trim() || processing) return

    const userMessage: QAMessage = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const question = input
    setInput('')
    setProcessing(true)
    setRetryAttempt(0)

    const maxRetries = 3
    let lastError: any = null

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Get current language from i18n
        const currentLanguage = typeof window !== 'undefined'
          ? (localStorage.getItem('wandermind_language') || navigator.language.split('-')[0] || 'en')
          : 'en'

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

        // Configure axios with timeout
        const response = await axios.post(
          `${apiUrl}/api/qa`,
          {
            projectId,
            question,
            userId,
            language: currentLanguage,
          },
          {
            timeout: 60000, // 60 second timeout per attempt
          }
        )

        if (response.data.success) {
          // Debug: Log the HTML being received
          console.log('📝 Markdown:', response.data.answer?.substring(0, 200))
          console.log('🎨 HTML:', response.data.answerHtml?.substring(0, 200))

          const assistantMessage: QAMessage = {
            role: 'assistant',
            content: response.data.answer,
            contentHtml: response.data.answerHtml, // Use HTML formatted version for better rendering
            citations: response.data.citations || [],
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, assistantMessage])
          setProcessing(false)
          setRetryAttempt(0)
          return // Success! Exit retry loop
        }
      } catch (error: any) {
        lastError = error
        console.error(`Q&A attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message)

        // Check if we should retry
        if (isRetryableError(error) && attempt < maxRetries) {
          // Calculate exponential backoff: 2s, 4s, 8s
          const backoffMs = Math.pow(2, attempt + 1) * 1000
          const jitter = Math.random() * 500 // Add 0-500ms jitter
          const waitTime = backoffMs + jitter

          console.log(`Retrying in ${Math.floor(waitTime / 1000)}s... (attempt ${attempt + 1}/${maxRetries})`)
          setRetryAttempt(attempt + 1) // Update UI with retry count

          await sleep(waitTime)
          continue // Retry
        } else {
          // Not retryable or max retries reached - fail permanently
          break
        }
      }
    }

    // All retries exhausted - show error
    setProcessing(false)
    setRetryAttempt(0)

    const errorDetails = lastError?.response?.data?.error || lastError?.message || 'Failed to answer your question.'
    const isServiceBusy = lastError?.response?.status === 503

    const errorMessage: QAMessage = {
      role: 'assistant',
      content: isServiceBusy
        ? `⚠️ **Service Busy**\n\nThe AI service is currently experiencing high demand. We tried ${maxRetries} times but couldn't get through.\n\nPlease wait a moment and try again.`
        : `❌ **Error**\n\n${errorDetails}\n\nPlease try again or rephrase your question.`,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, errorMessage])
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

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
      <div className="bg-white rounded-lg shadow-lg h-[600px] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center space-x-2">
          <MessageCircle className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">WanderMind Q&A</h3>
        </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.role === 'assistant' && message.contentHtml ? (
                <div
                  className="text-sm qa-formatted-content"
                  dangerouslySetInnerHTML={{ __html: message.contentHtml }}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
              {message.citations && message.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300">
                  <div className="flex items-center space-x-1 text-xs opacity-70">
                    <Clock className="w-3 h-3" />
                    <span>Cited at:</span>
                    {message.citations.map((timestamp, idx) => (
                      <span key={idx} className="font-mono">
                        {formatTimestamp(timestamp)}
                        {idx < message.citations!.length - 1 && ', '}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs mt-1 opacity-70">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {processing && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
                <span className="text-sm text-gray-600">
                  {retryAttempt > 0
                    ? `Service busy, retrying... (${retryAttempt}/3)`
                    : 'Analyzing video and preparing answer...'}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about this video..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            rows={2}
            disabled={processing}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || processing}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {processing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
    </>
  )
}

