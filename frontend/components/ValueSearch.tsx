'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Search, Loader2, MessageSquare, ThumbsUp, Clock, ArrowRight } from 'lucide-react'
import { getApiUrl } from '@/lib/apiUrl'

export interface RankedVideo {
  videoId: string
  title: string
  channel: string
  description?: string
  thumbnail: string
  views: number
  likes: number
  comments: number
  durationSec: number
  valueScore: number
  reasons: string[]
}

const DEFAULT_STARTERS = [
  'price a freelance offer',
  'cold email that books',
  'SQL for a real job',
  'validate a SaaS idea',
  'time-block like a solopreneur'
]

function formatCompact(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`
  return String(n || 0)
}

function formatClock(sec: number) {
  const t = Math.max(0, Math.floor(sec || 0))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function ValueSearch({
  autoFocus = true,
  placeholder = 'What do you actually need to get done?',
  rankHint = 'Ranked by real engagement. Not views. Not the thumbnail.',
  searchLabel = 'Find signal',
  includeShortsLabel = 'Include Shorts',
  starters
}: {
  userId?: string
  autoFocus?: boolean
  placeholder?: string
  rankHint?: string
  searchLabel?: string
  includeShortsLabel?: string
  starters?: string[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [includeShorts, setIncludeShorts] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videos, setVideos] = useState<RankedVideo[]>([])
  const [searched, setSearched] = useState(false)

  const chips = Array.isArray(starters) && starters.length ? starters : DEFAULT_STARTERS

  const runSearch = async (raw: string) => {
    const q = raw.trim()
    if (q.length < 2) return
    setQuery(q)
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const { data } = await axios.post(`${getApiUrl()}/api/search/value`, {
        query: q,
        includeShorts,
        limit: 12
      })
      setVideos(data.videos || [])
      if (!data.videos?.length) setError('No strong matches. Try a sharper skill or outcome.')
    } catch (err: any) {
      setVideos([])
      setError(err.response?.data?.message || err.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    runSearch(query)
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            autoFocus={autoFocus}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-2xl border border-indigo-100 bg-white py-4 pl-12 pr-4 text-base text-slate-900 shadow-sm shadow-indigo-500/5 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100"
          />
        </div>
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-4 font-semibold text-white shadow-md shadow-indigo-500/20 disabled:opacity-40 hover:from-blue-500 hover:to-violet-500"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : searchLabel}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <p>{rankHint}</p>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={includeShorts} onChange={(e) => setIncludeShorts(e.target.checked)} />
          {includeShortsLabel}
        </label>
      </div>

      {!searched && (
        <div className="mt-5 flex flex-wrap gap-2">
          {chips.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => runSearch(starter)}
              className="rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <p className="mt-8 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Killing the bait. Scoring comments, likes, and depth…
        </p>
      )}

      {error && !loading && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!loading && videos.length > 0 && (
        <ul className="mt-6 divide-y divide-indigo-50 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm shadow-indigo-500/5">
          {videos.map((video, index) => (
            <li key={video.videoId}>
              <button
                type="button"
                onClick={() => router.push(`/v/${video.videoId}`)}
                className="flex w-full gap-4 p-4 text-left transition hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-violet-50/80 sm:gap-5 sm:p-5"
              >
                <div className="flex w-12 shrink-0 flex-col items-center justify-center">
                  <span className="text-xs font-medium text-slate-400">#{index + 1}</span>
                  <span className="mt-1 text-xl font-bold bg-gradient-to-br from-blue-600 to-violet-600 bg-clip-text text-transparent">{video.valueScore}</span>
                  <span className="text-[10px] uppercase tracking-wide text-violet-400">value</span>
                </div>
                <div className="relative h-[72px] w-[128px] shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-[90px] sm:w-[160px]">
                  <img src={video.thumbnail} alt="" className="h-full w-full object-cover" />
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {formatClock(video.durationSec)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 font-semibold text-slate-900">{video.title}</h3>
                  <p className="mt-0.5 text-sm text-slate-500">{video.channel}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {video.reasons.map((reason) => (
                      <span key={reason} className="rounded-full bg-gradient-to-r from-emerald-50 to-cyan-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                        {reason}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-slate-500">
                    <span>{formatCompact(video.views)} views</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{formatCompact(video.comments)}</span>
                    <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{formatCompact(video.likes)}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatClock(video.durationSec)}</span>
                  </div>
                </div>
                <ArrowRight className="mt-6 hidden h-5 w-5 shrink-0 text-violet-300 sm:block" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
