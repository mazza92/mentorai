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
  citations?: number[] // Timestamps in seconds
  timestamp: Date
}

export default function VideoQA({ projectId, userId }: VideoQAProps) {
  const [messages, setMessages] = useState<QAMessage[]>([])
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
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

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await axios.post(`${apiUrl}/api/qa`, {
        projectId,
        question,
        userId,
      })

      if (response.data.success) {
        const assistantMessage: QAMessage = {
          role: 'assistant',
          content: response.data.answer,
          citations: response.data.citations || [],
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (error: any) {
      console.error('Q&A error:', error)
      const errorDetails = error.response?.data?.error || error.message || 'Failed to answer your question. Please try again.'
      const errorMessage: QAMessage = {
        role: 'assistant',
        content: `❌ Error: ${errorDetails}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setProcessing(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
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
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
                <span className="text-sm text-gray-600">Analyzing video and preparing answer...</span>
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
  )
}

