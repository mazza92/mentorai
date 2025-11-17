'use client'

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { Send, Loader2, Sparkles, MessageSquare } from 'lucide-react'

interface ConversationalEditorProps {
  projectId: string
  userId: string
  onEditComplete: () => void
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function ConversationalEditor({
  projectId,
  userId,
  onEditComplete,
}: ConversationalEditorProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize messages on client side only to avoid hydration mismatch
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: "Hi! I'm your AI video editor. Tell me how you'd like to edit your video. For example:\n\n• \"Cut the first 30 seconds and add dynamic captions\"\n• \"Make it cinematic and speed it up 2x\"\n• \"Remove all silences longer than 2 seconds\"\n• \"Resize to 9:16 and add travel filter\"",
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

  const handleSend = async () => {
    if (!input.trim() || processing) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setProcessing(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await axios.post(`${apiUrl}/api/edit`, {
        projectId,
        userPrompt: input,
        userId,
      })

      if (response.data.success) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: `✅ Video edited successfully!\n\nI've applied the following changes:\n${response.data.instructions
            .map((inst: any) => `• ${inst.action}: ${JSON.stringify(inst.parameters)}`)
            .join('\n')}\n\nThe processed video is ready for review.`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
        onEditComplete()
      }
    } catch (error: any) {
      console.error('Edit error:', error)
      const errorDetails = error.response?.data?.details || error.response?.data?.error || error.message || 'Failed to process your request. Please try again.'
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ Error: ${errorDetails}\n\n${error.response?.data?.stack ? `\nTechnical details:\n${error.response.data.stack}` : ''}`,
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
        <Sparkles className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">AI Editor</h3>
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
                <span className="text-sm text-gray-600">Processing your request...</span>
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
            placeholder="Describe how you want to edit your video..."
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

