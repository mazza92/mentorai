'use client'

import { useState } from 'react'
import { MessageCircle, X, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface FloatingAskWidgetProps {
  videoId: string
  videoTitle: string
  channelName: string
  conversionQuestions?: { icon: string; question: string }[]
}

export default function FloatingAskWidget({
  videoId,
  videoTitle,
  channelName,
  conversionQuestions
}: FloatingAskWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const chatUrl = `/?video=https://youtube.com/watch?v=${videoId}`

  // Get first question for quick action if available
  const firstQuestion = conversionQuestions?.[0]?.question

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {isExpanded ? (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-80 animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900">Poser une question</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Fermer"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            <p className="text-sm text-slate-600 mb-4">
              Utilisez l'IA de Lurnia pour interroger cette video de <span className="font-medium text-slate-900">{channelName}</span>
            </p>

            {/* Quick question preview */}
            {firstQuestion && (
              <Link
                href={`${chatUrl}&question=${encodeURIComponent(firstQuestion)}`}
                className="block p-3 mb-3 bg-slate-50 rounded-xl text-sm text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200"
              >
                <span className="text-slate-400 text-xs uppercase tracking-wide font-medium block mb-1">Question suggere</span>
                <span className="line-clamp-2">{firstQuestion}</span>
              </Link>
            )}

            {/* Main CTA */}
            <Link
              href={chatUrl}
              className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
            >
              Demarrer le chat <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="group w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
          aria-label="Poser une question a Lurnia"
        >
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
      )}
    </div>
  )
}
