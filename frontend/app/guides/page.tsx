import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Play, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import Footer from '@/components/Footer'
import SEOHeader from '@/components/SEOHeader'
import GuidesFilters from './GuidesFilters'

interface PageProps {
  searchParams: Promise<{ page?: string; channel?: string; search?: string }>
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams
  const hasFilters = params.page || params.channel || params.search

  return {
    title: 'Guides IA de vidéos YouTube | Lurnia',
    description: 'Découvrez nos guides vidéo YouTube : points clés, timestamps et analyses générés par intelligence artificielle.',
    openGraph: {
      title: 'Guides IA de vidéos YouTube | Lurnia',
      description: 'Découvrez nos guides vidéo YouTube.',
      type: 'website'
    },
    alternates: {
      canonical: 'https://lurnia.app/guides'
    },
    // Add noindex for filtered/paginated pages to avoid duplicate content
    ...(hasFilters && {
      robots: {
        index: false,
        follow: true
      }
    })
  }
}

interface InsightSummary {
  id: string
  slug: string
  videoId: string
  videoTitle: string
  channelName: string
  channelId: string
  thumbnail: string
  metaDescription: string
  pageViews: number
}

interface Channel {
  id: string
  name: string
}

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface InsightsResponse {
  data: InsightSummary[]
  pagination: Pagination
  channels: Channel[]
}

async function getInsights(page: number = 1, channelId?: string, search?: string): Promise<InsightsResponse> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  try {
    const params = new URLSearchParams({ page: String(page), limit: '24' })
    if (channelId) params.set('channelId', channelId)
    if (search) params.set('search', search)

    const res = await fetch(`${API_URL}/api/public-insights/list?${params}`, {
      next: { revalidate: 300 } // 5 min cache
    })
    if (!res.ok) throw new Error('Failed to fetch')
    return await res.json()
  } catch (error) {
    console.error('Failed to fetch insights:', error)
    return {
      data: [],
      pagination: { page: 1, limit: 24, totalCount: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      channels: []
    }
  }
}

export default async function GuidesDirectoryPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = parseInt(params.page || '1') || 1
  const channelId = params.channel
  const search = params.search

  const { data: insights, pagination, channels } = await getInsights(page, channelId, search)

  // Build pagination URLs
  const buildUrl = (newPage: number) => {
    const urlParams = new URLSearchParams()
    if (newPage > 1) urlParams.set('page', String(newPage))
    if (channelId) urlParams.set('channel', channelId)
    if (search) urlParams.set('search', search)
    const query = urlParams.toString()
    return `/guides${query ? `?${query}` : ''}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <SEOHeader />

      <main className="pt-20 pb-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-6">
              Guides IA de vidéos YouTube
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Découvrez les points clés des meilleures vidéos YouTube, analysées et synthétisées par notre intelligence artificielle.
            </p>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-center gap-6 mb-8 text-sm text-slate-600">
            <span className="font-medium">{pagination.totalCount} guides disponibles</span>
            <span className="text-slate-300">•</span>
            <span>{channels.length} chaînes</span>
          </div>

          {/* Filters */}
          <GuidesFilters
            channels={channels}
            currentChannel={channelId}
            currentSearch={search}
          />

          {/* Insights Grid */}
          {insights.length > 0 ? (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {insights.map((insight) => (
                  <Link
                    key={insight.id}
                    href={`/guides/${insight.slug}`}
                    className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video">
                      <img
                        src={insight.thumbnail}
                        alt={insight.videoTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                          <Play className="w-6 h-6 text-blue-600 ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium mb-3">
                        {insight.channelName}
                      </span>
                      <h2 className="font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {insight.videoTitle}
                      </h2>
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {insight.metaDescription}
                      </p>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {insight.pageViews || 0} lectures
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
                  {/* Previous */}
                  {pagination.hasPrevPage ? (
                    <Link
                      href={buildUrl(pagination.page - 1)}
                      className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Précédent
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed">
                      <ChevronLeft className="w-4 h-4" />
                      Précédent
                    </span>
                  )}

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {generatePageNumbers(pagination.page, pagination.totalPages).map((pageNum, idx) => (
                      pageNum === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-3 py-2 text-slate-400">...</span>
                      ) : (
                        <Link
                          key={pageNum}
                          href={buildUrl(Number(pageNum))}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            Number(pageNum) === pagination.page
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {pageNum}
                        </Link>
                      )
                    ))}
                  </div>

                  {/* Next */}
                  {pagination.hasNextPage ? (
                    <Link
                      href={buildUrl(pagination.page + 1)}
                      className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Suivant
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed">
                      Suivant
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  )}
                </nav>
              )}

              {/* Page Info */}
              <p className="text-center text-sm text-slate-500 mt-4">
                Page {pagination.page} sur {pagination.totalPages} • {pagination.totalCount} guides au total
              </p>
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-slate-500 text-lg mb-6">
                {search || channelId
                  ? 'Aucun guide trouvé avec ces filtres.'
                  : 'Aucun guide disponible pour le moment.'}
              </p>
              {(search || channelId) && (
                <Link
                  href="/guides"
                  className="inline-flex items-center gap-2 px-6 py-3 text-blue-600 border border-blue-300 rounded-xl font-medium hover:bg-blue-50 transition-all"
                >
                  Voir tous les guides
                </Link>
              )}
            </div>
          )}

          {/* CTA Section */}
          <section className="mt-20 text-center py-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl text-white">
            <h2 className="text-3xl font-bold mb-4">
              Créez vos propres guides IA
            </h2>
            <p className="text-blue-100 mb-8 max-w-xl mx-auto text-lg">
              Importez n'importe quelle vidéo YouTube et obtenez un guide intelligent en quelques secondes.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors text-lg"
            >
              Commencer Gratuitement <ArrowRight className="w-5 h-5" />
            </Link>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  )
}

// Generate page numbers with ellipsis
function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | string)[] = []

  // Always show first page
  pages.push(1)

  if (current > 3) {
    pages.push('...')
  }

  // Show pages around current
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 2) {
    pages.push('...')
  }

  // Always show last page
  if (total > 1) {
    pages.push(total)
  }

  return pages
}
