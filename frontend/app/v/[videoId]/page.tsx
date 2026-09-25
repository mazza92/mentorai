import PlaybookClient from '@/components/PlaybookClient'
import type { Metadata } from 'next'
import { guideSerpDescription, guideSerpTitle } from '@/lib/seo'

export async function generateMetadata({ params }: { params: { videoId: string } }): Promise<Metadata> {
  const { videoId } = params
  let videoTitle = 'YouTube playbook'
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
      { next: { revalidate: 86400 } }
    )
    if (res.ok) {
      const data = await res.json()
      if (data?.title) videoTitle = data.title
    }
  } catch {
    // oEmbed is best-effort; keep a punchy fallback
  }

  const title = guideSerpTitle(videoTitle, videoTitle, videoId)
  const description = guideSerpDescription('', videoTitle, videoId)

  return {
    title,
    description,
    alternates: {
      canonical: `https://lurnia.app/v/${videoId}`
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://lurnia.app/v/${videoId}`
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description
    }
  }
}

export default function VideoPlaybookPage({
  params,
  searchParams
}: {
  params: { videoId: string }
  searchParams?: { q?: string }
}) {
  const query = typeof searchParams?.q === 'string' ? searchParams.q : ''
  return <PlaybookClient videoId={params.videoId} query={query} />
}
