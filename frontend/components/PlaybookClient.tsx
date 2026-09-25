'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { ArrowLeft, Clock, Eye, MessageSquare, ThumbsUp, ExternalLink, Loader2, Play, AlertTriangle } from 'lucide-react'
import { getApiUrl } from '@/lib/apiUrl'
import { getSessionId } from '@/lib/sessionManager'
import { useAuth } from '@/contexts/AuthContext'
import SearchHeader from '@/components/SearchHeader'
import Footer from '@/components/Footer'
import PlaybookChat from '@/components/PlaybookChat'

interface PlaybookData {
  aiGenerated?: boolean
  video: {
    videoId: string
    title: string
    channel: string
    description?: string
    thumbnail: string
    views: number
    likes: number
    comments: number
    durationSec: number
  }
  transcriptAvailable: boolean
  playbook: {
    headline: string
    oneLiner: string
    whyThisNotClickbait: string
    audience: string
    keyTakeaways: { title: string; detail: string }[]
    playbook: { step: number; action: string; detail: string; timestamp?: number; timestampFormatted?: string }[]
    skipFluff: Array<{ kind?: string; timestamp?: number; timestampFormatted?: string; title?: string; recap?: string } | string>
    viewerFeedback?: { author: string; quote: string; insight?: string }[]
    timestamps: { timestamp: number; timestampFormatted: string; title: string; description: string }[]
    suggestedQuestions: string[]
    faqs: { question: string; answer: string }[]
  }
}

function formatCompact(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(n || 0)
}

function formatClock(sec: number) {
  const t = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(t / 60)
  const s = t % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PlaybookClient({ videoId }: { videoId: string }) {
  const { user } = useAuth()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PlaybookData | null>(null)

  const [quotaError, setQuotaError] = useState<{
    signup: boolean
    message: string
    used?: number
    limit?: number
  } | null>(null)

  useEffect(() => {
    setUserId(user?.id || getSessionId())
  }, [user])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setQuotaError(null)
      try {
        const lang = typeof navigator !== 'undefined' && navigator.language.startsWith('fr') ? 'fr' : 'en'
        const { data: payload } = await axios.get(
          `${getApiUrl()}/api/playbook/${videoId}?lang=${lang}&userId=${encodeURIComponent(userId)}`,
          { timeout: 120000 }
        )
        if (!cancelled) setData(payload)
      } catch (err: any) {
        if (cancelled) return
        const status = err.response?.status
        const payload = err.response?.data
        if (status === 402) {
          setQuotaError({
            signup: payload?.code === 'SIGNUP_REQUIRED',
            message: payload?.error || 'Playbook limit reached.',
            used: payload?.used,
            limit: payload?.limit
          })
        } else {
          setError(payload?.error || err.message || 'Could not build this playbook')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [videoId, userId])

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-slate-50 to-white">
      <SearchHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-700">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </Link>

        {loading && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white p-8 shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
              <p className="mt-4 text-center font-semibold text-slate-900">Building your playbook</p>
              <p className="mt-1 text-center text-sm text-slate-500">Pulling captions, comments, and turning them into actions you can use now.</p>
              <div className="mt-8 space-y-3">
                <div className="h-4 w-2/3 rounded-full bg-indigo-50" />
                <div className="h-24 rounded-2xl bg-gradient-to-r from-blue-50 to-violet-50" />
                <div className="h-16 rounded-xl bg-slate-50" />
                <div className="h-16 rounded-xl bg-slate-50" />
              </div>
            </div>
            <div className="hidden rounded-2xl border border-indigo-100 bg-white p-4 lg:block">
              <div className="h-4 w-28 rounded-full bg-violet-100" />
              <div className="mt-4 space-y-2">
                <div className="h-10 rounded-xl bg-indigo-50" />
                <div className="h-10 rounded-xl bg-indigo-50" />
                <div className="h-10 rounded-xl bg-indigo-50" />
              </div>
            </div>
          </div>
        )}

        {quotaError && (
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">Don&apos;t trust the thumbnail. Steal more playbooks.</p>
            <h2 className="mt-2 text-xl font-extrabold text-slate-900">
              {quotaError.signup ? 'Sign up to keep going' : 'Playbook limit reached'}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{quotaError.message}</p>
            {typeof quotaError.used === 'number' && (
              <p className="mt-1 text-xs text-slate-500">{quotaError.used}/{quotaError.limit} unique playbooks this month.</p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={quotaError.signup ? '/auth' : '/pricing'}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {quotaError.signup ? 'Sign up free' : 'Go Pro. €15/mo.'}
              </Link>
              <a href={`https://youtube.com/watch?v=${videoId}`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 underline">
                Open on YouTube <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="font-semibold">Couldn’t generate a playbook</p>
            <p className="mt-1 text-sm">{error}</p>
            <a href={`https://youtube.com/watch?v=${videoId}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline">
              Open on YouTube <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {data && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <article>
              <p className="inline-flex rounded-full bg-gradient-to-r from-blue-50 to-violet-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-violet-700">{data.playbook.audience}</p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
                {data.playbook.headline || data.video.title}
              </h1>
              <p className="mt-3 text-lg text-slate-600">{data.playbook.oneLiner}</p>

              {data.aiGenerated === false && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Draft from the video description and chapters. Captions were unavailable for a full AI pass.
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                <span className="font-medium text-slate-800">{data.video.channel}</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{formatClock(data.video.durationSec)}</span>
                <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" />{formatCompact(data.video.views)}</span>
                <span className="inline-flex items-center gap-1"><MessageSquare className="h-4 w-4" />{formatCompact(data.video.comments)}</span>
                <span className="inline-flex items-center gap-1"><ThumbsUp className="h-4 w-4" />{formatCompact(data.video.likes)}</span>
                {!data.transcriptAvailable && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">No captions</span>
                )}
              </div>

              <div className="relative mt-6 overflow-hidden rounded-2xl bg-black shadow-xl">
                <div className="aspect-video">
                  <iframe
                    className="h-full w-full"
                    src={`https://www.youtube.com/embed/${data.video.videoId}`}
                    title={data.video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>

              <section className="mt-8 rounded-2xl border border-indigo-100 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 p-5 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-700">Why this over a viral recap</h2>
                <p className="mt-2 text-slate-700">{data.playbook.whyThisNotClickbait}</p>
              </section>

              <section className="mt-10">
                <h2 className="text-2xl font-bold text-slate-900">Key takeaways</h2>
                <p className="mt-1 text-sm text-slate-500">From the video, not the comment section.</p>
                <div className="mt-4 grid gap-3">
                  {(data.playbook.keyTakeaways || []).map((item, i) => (
                    <div key={i} className="rounded-xl border border-indigo-50 bg-white p-4 shadow-sm shadow-indigo-500/5">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-10">
                <h2 className="text-2xl font-bold text-slate-900">Playbook</h2>
                <p className="mt-1 text-sm text-slate-500">Do these in order. Jump to the moment in the video if a timestamp exists.</p>
                <ol className="mt-4 space-y-3">
                  {(data.playbook.playbook || []).map((step) => (
                    <li key={step.step} className="flex gap-4 rounded-xl border border-indigo-50 bg-white p-4 shadow-sm shadow-indigo-500/5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-bold text-white">
                        {step.step}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{step.action}</h3>
                          {typeof step.timestamp === 'number' && step.timestampFormatted ? (
                            <a
                              href={`https://youtube.com/watch?v=${data.video.videoId}&t=${step.timestamp}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded bg-gradient-to-r from-blue-600 to-violet-600 px-2 py-0.5 font-mono text-xs text-white"
                            >
                              {step.timestampFormatted}
                            </a>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {(data.playbook.timestamps || []).length > 0 && (
                <section className="mt-10">
                  <h2 className="text-2xl font-bold text-slate-900">Key moments</h2>
                  <div className="mt-4 space-y-3">
                    {data.playbook.timestamps.map((link, i) => (
                      <a
                        key={i}
                        href={`https://youtube.com/watch?v=${data.video.videoId}&t=${link.timestamp}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex gap-4 rounded-xl border border-indigo-50 bg-white p-4 hover:border-violet-300"
                      >
                        <span className="h-fit rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-2.5 py-1 font-mono text-sm text-white">
                          {link.timestampFormatted}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{link.title}</p>
                          <p className="text-sm text-slate-600">{link.description}</p>
                        </div>
                        <Play className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {(data.playbook.skipFluff || []).length > 0 && (
                <section className="mt-10">
                  <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                    <AlertTriangle className="h-6 w-6 text-amber-500" /> Skip the fluff
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">Specific filler beats. Jump past them.</p>
                  <ul className="mt-4 space-y-2">
                    {data.playbook.skipFluff.map((item, i) => {
                      const fluff = typeof item === 'string'
                        ? { title: item, recap: '', timestamp: 0, timestampFormatted: '', kind: '' }
                        : item
                      return (
                        <li key={i} className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                          <div className="flex flex-wrap items-center gap-2">
                            {fluff.kind ? (
                              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                {fluff.kind}
                              </span>
                            ) : null}
                            {typeof fluff.timestamp === 'number' && fluff.timestampFormatted ? (
                              <a
                                href={`https://youtube.com/watch?v=${data.video.videoId}&t=${fluff.timestamp}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded bg-amber-700 px-2 py-0.5 font-mono text-xs text-white"
                              >
                                {fluff.timestampFormatted}
                              </a>
                            ) : null}
                            <span className="font-semibold">{fluff.title || fluff.recap}</span>
                          </div>
                          {fluff.recap && fluff.recap !== fluff.title ? (
                            <p className="mt-1 text-amber-900/80">{fluff.recap}</p>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {(data.playbook.viewerFeedback || []).length > 0 && (
                <section className="mt-10">
                  <h2 className="text-2xl font-bold text-slate-900">From the comments</h2>
                  <p className="mt-1 text-sm text-slate-500">Sentiment, caveats, and honest testimony. Not the lesson list.</p>
                  <ul className="mt-4 space-y-3">
                    {(data.playbook.viewerFeedback || []).map((item, i) => (
                      <li key={i} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-800">@{item.author}</p>
                        <p className="mt-1 text-sm text-slate-700">“{item.quote}”</p>
                        {item.insight ? <p className="mt-2 text-xs text-slate-500">{item.insight}</p> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {(data.playbook.faqs || []).length > 0 && (
                <section className="mt-10 mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">FAQ</h2>
                  <div className="mt-4 space-y-3">
                    {data.playbook.faqs.map((faq, i) => (
                      <details key={i} className="group rounded-xl border border-indigo-50 bg-white shadow-sm">
                        <summary className="cursor-pointer list-none p-4 font-medium text-slate-900">{faq.question}</summary>
                        <p className="px-4 pb-4 text-sm text-slate-600">{faq.answer}</p>
                      </details>
                    ))}
                  </div>
                </section>
              )}
            </article>

            <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
              <PlaybookChat
                videoId={data.video.videoId}
                videoTitle={data.video.title}
                channelName={data.video.channel}
                description={data.video.description}
                userId={userId}
                suggested={data.playbook.suggestedQuestions}
              />
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
