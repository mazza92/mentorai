'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles, Tag } from 'lucide-react'

interface SourceGuideProps {
  title: string
  summary: string
  keyTopics: string[]
  onTopicClick?: (topic: string) => void
}

export default function SourceGuide({ title, summary, keyTopics, onTopicClick }: SourceGuideProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Debug: Log what data we receive
  console.log('[SourceGuide] Rendering with:', {
    title,
    summary: summary?.substring(0, 100),
    keyTopicsCount: keyTopics?.length,
    isExpanded,
    summaryType: typeof summary,
    keyTopicsType: typeof keyTopics,
    summaryValue: summary,
    keyTopicsValue: keyTopics
  });

  // Safety check: ensure we have valid data
  if (!summary || !keyTopics) {
    console.error('[SourceGuide] Missing required props:', { summary, keyTopics });
    return null;
  }

  return (
    <div className="mb-6 border border-slate-200 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/30 overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-base font-semibold text-slate-900">Source guide</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-600" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Video Title */}
          <h4 className="text-sm font-bold text-slate-900 leading-snug">
            {title}
          </h4>

          {/* Summary */}
          <div className="text-sm text-slate-700 leading-relaxed space-y-2">
            {summary.split('\n').map((paragraph, idx) => {
              if (!paragraph.trim()) return null

              // Parse markdown bold (**text**)
              const parts = paragraph.split(/(\*\*.*?\*\*)/)

              return (
                <p key={idx} className="text-slate-700">
                  {parts.map((part, partIdx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      const boldText = part.slice(2, -2)
                      return <strong key={partIdx} className="font-semibold text-slate-900">{boldText}</strong>
                    }
                    return <span key={partIdx}>{part}</span>
                  })}
                </p>
              )
            })}
          </div>

          {/* Key Topics */}
          {keyTopics.length > 0 && (
            <div className="pt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {keyTopics.map((topic, idx) => (
                  <button
                    key={idx}
                    onClick={() => onTopicClick?.(topic)}
                    className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 rounded-full border border-slate-200 transition-all hover:border-purple-300 hover:text-purple-700 hover:shadow-sm"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
