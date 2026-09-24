import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MessageSquare, ThumbsUp, Clock, ArrowRight } from 'lucide-react'
import Footer from '@/components/Footer'
import SearchHeader from '@/components/SearchHeader'
import { getAllTopics, getRelatedTopics, getTopic } from '@/data/topics'
import { SITE_URL } from '@/lib/seo'
import { fetchRankedVideos, formatClock, formatCompact } from '@/lib/valueSearch'

export const revalidate = 21600
export const dynamicParams = false

export function generateStaticParams() {
  return getAllTopics().map((topic) => ({ slug: topic.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const topic = getTopic(params.slug)
  if (!topic) return { title: 'Topic not found' }

  return {
    title: topic.title,
    description: topic.description,
    alternates: { canonical: `${SITE_URL}/learn/${topic.slug}` },
    openGraph: {
      title: topic.title,
      description: topic.description,
      url: `${SITE_URL}/learn/${topic.slug}`,
      type: 'article',
      locale: topic.lang === 'fr' ? 'fr_FR' : 'en_US'
    }
  }
}

export default async function TopicHubPage({ params }: { params: { slug: string } }) {
  const topic = getTopic(params.slug)
  if (!topic) notFound()

  const videos = await fetchRankedVideos(topic.query, { language: topic.lang, limit: 8 })
  const related = getRelatedTopics(topic)
  const url = `${SITE_URL}/learn/${topic.slug}`

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: topic.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a }
    }))
  }

  const itemListJsonLd = videos.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: topic.h1,
        itemListElement: videos.map((video, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${SITE_URL}/v/${video.videoId}`,
          name: video.title
        }))
      }
    : null

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Lurnia', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Learn', item: `${SITE_URL}/learn` },
      { '@type': 'ListItem', position: 3, name: topic.h1, item: url }
    ]
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-violet-50/40">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {itemListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}

      <SearchHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-16 sm:px-6">
        <nav className="text-sm text-slate-500">
          <Link href="/learn" className="hover:text-indigo-700">Topics</Link>
          <span className="px-2">/</span>
          <span className="text-slate-700">{topic.lang}</span>
        </nav>

        <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-violet-600">
          Don&apos;t trust the thumbnail
        </p>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
          {topic.h1}
        </h1>
        <p className="mt-5 text-lg leading-7 text-slate-700">{topic.definition}</p>
        <p className="mt-4 text-sm leading-6 text-slate-500">{topic.howWeRank}</p>

        <div className="mt-8">
          <Link
            href={`/?q=${encodeURIComponent(topic.query)}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 font-semibold text-white shadow-md shadow-indigo-500/20 hover:from-blue-500 hover:to-violet-500"
          >
            Find signal on this topic
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-extrabold text-slate-900">Ranked by engagement, not views</h2>
          {videos.length > 0 ? (
            <ul className="mt-5 divide-y divide-indigo-50 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm shadow-indigo-500/5">
              {videos.map((video, index) => (
                <li key={video.videoId}>
                  <Link
                    href={`/v/${video.videoId}`}
                    className="flex gap-4 p-4 transition hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-violet-50/80 sm:gap-5 sm:p-5"
                  >
                    <div className="flex w-12 shrink-0 flex-col items-center justify-center">
                      <span className="text-xs font-medium text-slate-400">#{index + 1}</span>
                      <span className="mt-1 text-xl font-bold bg-gradient-to-br from-blue-600 to-violet-600 bg-clip-text text-transparent">
                        {video.valueScore}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-violet-400">value</span>
                    </div>
                    <div className="relative h-[72px] w-[128px] shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      <img src={video.thumbnail} alt="" className="h-full w-full object-cover" />
                      <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {formatClock(video.durationSec)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 font-semibold text-slate-900">{video.title}</h3>
                      <p className="mt-0.5 text-sm text-slate-500">{video.channel}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-slate-500">
                        <span>{formatCompact(video.views)} views</span>
                        <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{formatCompact(video.comments)}</span>
                        <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{formatCompact(video.likes)}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatClock(video.durationSec)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl border border-indigo-100 bg-white p-5 text-sm text-slate-600">
              Ranking is refreshing. Use Find signal to pull the live list, or read the answer above. Thumbnails still don&apos;t get a vote.
            </p>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-extrabold text-slate-900">Straight answers</h2>
          <dl className="mt-5 space-y-4">
            {topic.faqs.map((faq) => (
              <div key={faq.q} className="rounded-2xl border border-indigo-50 bg-white p-5">
                <dt className="font-semibold text-slate-900">{faq.q}</dt>
                <dd className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-extrabold text-slate-900">Related hubs</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/learn/${item.slug}`}
                    className="block rounded-2xl border border-indigo-100 bg-white p-4 text-sm font-semibold text-slate-800 hover:border-violet-300 hover:bg-violet-50/50"
                  >
                    {item.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
