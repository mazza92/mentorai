import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Play, Clock, Eye } from 'lucide-react'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Resumes IA de Videos YouTube | Lurnia',
  description: 'Decouvrez nos resumes IA de videos YouTube populaires. Points cles, timestamps importants et analyses approfondies generes par intelligence artificielle.',
  openGraph: {
    title: 'Resumes IA de Videos YouTube | Lurnia',
    description: 'Decouvrez nos resumes IA de videos YouTube populaires.',
    type: 'website'
  },
  alternates: {
    canonical: 'https://lurnia.app/resume'
  }
}

interface InsightSummary {
  id: string
  slug: string
  videoId: string
  videoTitle: string
  channelName: string
  thumbnail: string
  metaDescription: string
  pageViews: number
}

async function getInsights(): Promise<InsightSummary[]> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  try {
    const res = await fetch(`${API_URL}/api/public-insights/list?limit=50`, {
      next: { revalidate: 3600 }
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
  } catch (error) {
    console.error('Failed to fetch insights:', error)
    return []
  }
}

export default async function ResumeDirectoryPage() {
  const insights = await getInsights()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <span className="font-bold text-xl text-slate-900">Lurnia</span>
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all text-sm"
            >
              Essayer Lurnia
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-6">
              Resumes IA de Videos YouTube
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Decouvrez les points cles des meilleures videos YouTube, analyses et resumes par notre intelligence artificielle.
            </p>
          </div>

          {/* Insights Grid */}
          {insights.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {insights.map((insight) => (
                <Link
                  key={insight.id}
                  href={`/resume/${insight.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video">
                    <img
                      src={insight.thumbnail}
                      alt={insight.videoTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
          ) : (
            <div className="text-center py-20">
              <p className="text-slate-500 text-lg mb-6">
                Aucun resume disponible pour le moment.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                Creer votre premier resume <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          )}

          {/* CTA Section */}
          <section className="mt-20 text-center py-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl text-white">
            <h2 className="text-3xl font-bold mb-4">
              Creez vos propres resumes IA
            </h2>
            <p className="text-blue-100 mb-8 max-w-xl mx-auto text-lg">
              Importez n'importe quelle video YouTube et obtenez un resume intelligent en quelques secondes.
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
