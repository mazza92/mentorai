export type LastSearchVideo = {
  videoId: string
  title: string
  channel: string
  thumbnail: string
  views: number
  likes: number
  comments: number
  durationSec: number
  valueScore: number
  reasons?: string[]
}

const KEY = 'lurnia:lastSearch'
const TTL_MS = 6 * 60 * 60 * 1000

export function saveLastSearch(query: string, videos: LastSearchVideo[]) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        query: String(query || '').trim(),
        videos: (videos || []).slice(0, 12),
        at: Date.now()
      })
    )
  } catch {
    // ignore quota / private mode
  }
}

export function loadLastSearch(excludeVideoId?: string): { query: string; videos: LastSearchVideo[] } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.videos?.length || Date.now() - (data.at || 0) > TTL_MS) return null
    const videos = (data.videos as LastSearchVideo[]).filter((v) => v.videoId && v.videoId !== excludeVideoId)
    if (!videos.length) return null
    return { query: String(data.query || ''), videos }
  } catch {
    return null
  }
}
