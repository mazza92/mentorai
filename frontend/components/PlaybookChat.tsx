'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Send, Loader2, Sparkles } from 'lucide-react'
import { getApiUrl } from '@/lib/apiUrl'

interface Turn {
  role: 'user' | 'assistant'
  content: string
  contentHtml?: string
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function markdownToHtml(raw: string) {
  let text = escapeHtml(raw || '')
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/(^|\n)<strong>([^<]{1,40})<\/strong>(?=\n|$)/g, '$1<h3>$2</h3>')
  text = text.replace(/(^|\n)#{1,3}\s+(.+)/g, '$1<h3>$2</h3>')
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  text = text.replace(/\[(\d{1,2}:\d{2})\]/g, '<span class="chat-ts">$1</span>')
  const blocks = text.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n')
    const listItems = lines.filter((l) => /^\s*[-*]\s+/.test(l))
    if (listItems.length === lines.length && lines.length > 1) {
      return `<ul>${lines.map((l) => `<li>${l.replace(/^\s*[-*]\s+/, '')}</li>`).join('')}</ul>`
    }
    return `<p>${block.replace(/\n/g, '<br />')}</p>`
  })
  return blocks.join('')
}

export default function PlaybookChat({
  videoId,
  videoTitle,
  channelName,
  description,
  userId,
  suggested
}: {
  videoId: string
  videoTitle: string
  channelName: string
  description?: string
  userId: string
  suggested?: string[]
}) {
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, busy])

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || busy) return
    setInput('')
    setTurns((prev) => [...prev, { role: 'user', content: q }])
    setBusy(true)
    try {
      const history = []
      for (let i = 0; i < turns.length - 1; i++) {
        if (turns[i].role === 'user' && turns[i + 1]?.role === 'assistant') {
          history.push({ question: turns[i].content, answer: turns[i + 1].content })
          i++
        }
      }
      const { data } = await axios.post(`${getApiUrl()}/api/qa/video-direct`, {
        videoId,
        question: q,
        userId: userId || 'anonymous',
        videoTitle,
        channelName,
        videoDescription: description || '',
        chatHistory: history
      })
      const answer = data.answer || 'No answer returned.'
      const html = data.answerHtml && !String(data.answerHtml).includes('**')
        ? data.answerHtml
        : markdownToHtml(answer)
      setTurns((prev) => [...prev, { role: 'assistant', content: answer, contentHtml: html }])
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Could not answer this video.'
      setTurns((prev) => [...prev, {
        role: 'assistant',
        content: message,
        contentHtml: markdownToHtml(message)
      }])
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    ask(input)
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-lg shadow-indigo-500/5">
      <div className="border-b border-indigo-50 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Ask this video
        </p>
        <p className="text-xs text-slate-500">Answers from captions and comments</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Try a practitioner question:</p>
            {(suggested || []).slice(0, 3).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className="block w-full rounded-xl border border-indigo-100 bg-gradient-to-r from-white to-indigo-50/60 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-violet-300 hover:text-violet-800"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {turns.map((turn, i) => (
          turn.role === 'user' ? (
            <div key={i} className="ml-6 rounded-2xl rounded-br-md bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-2 text-sm text-white shadow-sm">
              {turn.content}
            </div>
          ) : (
            <div
              key={i}
              className="playbook-chat-md mr-2 rounded-2xl rounded-bl-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              dangerouslySetInnerHTML={{ __html: turn.contentHtml || markdownToHtml(turn.content) }}
            />
          )
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-violet-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </p>
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-indigo-50 bg-slate-50/70 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a specific question…"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 p-2 text-white shadow-sm disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
