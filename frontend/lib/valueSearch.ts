import { getApiUrl } from '@/lib/apiUrl'

export type RankedVideo = {
  videoId: string
  title: string
  channel: string
  thumbnail: string
  views: number
  likes: number
  comments: number
  durationSec: number
  valueScore: number
  reasons: string[]
}

export async function fetchRankedVideos(
  query: string,
  options: { language?: 'en' | 'fr'; limit?: number } = {}
): Promise<RankedVideo[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(options.limit || 8)
  })
  if (options.language) params.set('language', options.language)

  try {
    const res = await fetch(`${getApiUrl()}/api/search/value?${params}`, {
      next: { revalidate: 21600 }
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.videos) ? data.videos : []
  } catch {
    return []
  }
}

export function formatCompact(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`
  return String(n || 0)
}

export function formatClock(sec: number) {
  const t = Math.max(0, Math.floor(sec || 0))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
