import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import Link from 'next/link'
import Image from 'next/image'
import { Play, ExternalLink, ArrowRight, Clock, Eye, MessageCircle, ChevronDown } from 'lucide-react'
import Footer from '@/components/Footer'

// Types
interface QuickInsight {
  emoji: string
  text: string
}

interface DeepLink {
  timestamp: number
  timestampFormatted: string
  title: string
  description: string
}

interface ConversionQuestion {
  icon: string
  question: string
}

interface FAQ {
  question: string
  answer: string
}

interface PublicInsight {
  id: string
  slug: string
  videoId: string
  channelId: string
  videoTitle: string
  channelName: string
  thumbnail: string
  duration: number
  viewCount: number
  seoTitle: string
  metaTitle: string
  metaDescription: string
  quickInsights: QuickInsight[]
  deepLinks: DeepLink[]
  semanticAnalysis: string
  conversionQuestions: ConversionQuestion[]
  faqs: FAQ[]
  keywords: string[]
  publishedAt: string | null
}

// Fetch data
async function getInsight(slug: string): Promise<PublicInsight | null> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  try {
    const res = await fetch(`${API_URL}/api/public-insights/by-slug/${slug}`, {
      next: { revalidate: 3600 } // ISR: revalidate every hour
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.success ? data.data : null
  } catch (error) {
    console.error('Failed to fetch insight:', error)
    return null
  }
}

// Generate static params for SSG
export async function generateStaticParams() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  try {
    const res = await fetch(`${API_URL}/api/public-insights/list?limit=100`, {
      next: { revalidate: 3600 }
    })
    if (!res.ok) return []
    const data = await res.json()

    return data.data?.map((insight: { slug: string }) => ({
      slug: insight.slug
    })) || []
  } catch (error) {
    console.error('Failed to generate static params:', error)
    return []
  }
}

// Dynamic metadata
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const insight = await getInsight(params.slug)

  if (!insight) {
    return {
      title: 'Page non trouvee | Lurnia',
      description: 'Le resume demande n\'existe pas.'
    }
  }

  return {
    title: insight.metaTitle,
    description: insight.metaDescription,
    keywords: insight.keywords?.join(', '),
    openGraph: {
      title: insight.metaTitle,
      description: insight.metaDescription,
      images: [insight.thumbnail],
      type: 'article',
      locale: 'fr_FR'
    },
    twitter: {
      card: 'summary_large_image',
      title: insight.metaTitle,
      description: insight.metaDescription,
      images: [insight.thumbnail]
    },
    alternates: {
      canonical: `https://lurnia.app/resume/${insight.slug}`
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1
      }
    }
  }
}

// Format duration
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Format view count
function formatViews(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(0)}K`
  }
  return count.toString()
}

// FAQ Accordion Component
function FAQAccordion({ faqs }: { faqs: FAQ[] }) {
  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => (
        <details key={i} className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
          <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors">
            <span className="font-medium text-slate-900 pr-4">{faq.question}</span>
            <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0" />
          </summary>
          <div className="px-4 pb-4 text-slate-600">
            {faq.answer}
          </div>
        </details>
      ))}
    </div>
  )
}

// Page component
export default async function ResumePage({ params }: { params: { slug: string } }) {
  const insight = await getInsight(params.slug)

  if (!insight) {
    notFound()
  }

  // Schema.org structured data
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": insight.seoTitle,
    "description": insight.metaDescription,
    "image": insight.thumbnail,
    "author": {
      "@type": "Organization",
      "name": "Lurnia"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Lurnia",
      "logo": {
        "@type": "ImageObject",
        "url": "https://lurnia.app/logo.png"
      }
    },
    "datePublished": insight.publishedAt,
    "mainEntityOfPage": `https://lurnia.app/resume/${insight.slug}`
  }

  const videoSchema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": insight.videoTitle,
    "description": insight.metaDescription,
    "thumbnailUrl": insight.thumbnail,
    "uploadDate": insight.publishedAt,
    "duration": `PT${Math.floor(insight.duration / 60)}M${insight.duration % 60}S`,
    "contentUrl": `https://youtube.com/watch?v=${insight.videoId}`,
    "embedUrl": `https://www.youtube.com/embed/${insight.videoId}`
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": insight.faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  }

  return (
    <>
      <Script
        id="article-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <Script
        id="video-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }}
      />
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

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
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
            {/* Breadcrumbs */}
            <nav className="mb-6 text-sm">
              <ol className="flex items-center gap-2 text-slate-500">
                <li>
                  <Link href="/" className="hover:text-blue-600 transition-colors">Accueil</Link>
                </li>
                <li>/</li>
                <li>
                  <Link href="/resume" className="hover:text-blue-600 transition-colors">Resumes IA</Link>
                </li>
                <li>/</li>
                <li className="text-slate-700 truncate max-w-[200px]">{insight.channelName}</li>
              </ol>
            </nav>

            {/* H1 Title */}
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-6 leading-tight">
              {insight.seoTitle}
            </h1>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-4 mb-8 text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDuration(insight.duration)}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {formatViews(insight.viewCount)} vues
              </span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                {insight.channelName}
              </span>
            </div>

            {/* Video Preview Card */}
            <div className="relative rounded-2xl overflow-hidden mb-10 shadow-xl group">
              <img
                src={insight.thumbnail}
                alt={insight.videoTitle}
                className="w-full aspect-video object-cover"
              />
              <a
                href={`https://youtube.com/watch?v=${insight.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors"
              >
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                  <Play className="w-10 h-10 text-white ml-1" fill="white" />
                </div>
              </a>
              {/* Duration badge */}
              <span className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/80 text-white rounded-lg text-sm font-medium">
                {formatDuration(insight.duration)}
              </span>
            </div>

            {/* Quick Insights Section */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-2xl">&#9889;</span> Points Cles en 30 Secondes
              </h2>
              <div className="grid gap-4">
                {insight.quickInsights.map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                    <span className="text-3xl flex-shrink-0">{item.emoji}</span>
                    <p className="text-slate-700 font-medium leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Deep Links Section */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-2xl">&#127919;</span> Moments Cles avec Timestamps
              </h2>
              <div className="space-y-4">
                {insight.deepLinks.map((link, i) => (
                  <a
                    key={i}
                    href={`https://youtube.com/watch?v=${insight.videoId}&t=${link.timestamp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-5 bg-white rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <span className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-mono text-sm font-medium flex-shrink-0">
                        {link.timestampFormatted}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-1">
                          {link.title}
                        </h3>
                        <p className="text-slate-600 text-sm leading-relaxed">{link.description}</p>
                      </div>
                      <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </a>
                ))}
              </div>
            </section>

            {/* Semantic Analysis */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-2xl">&#128202;</span> Analyse du Contenu
              </h2>
              <div
                className="prose prose-slate max-w-none bg-white rounded-xl p-6 border border-slate-200"
                dangerouslySetInnerHTML={{ __html: insight.semanticAnalysis.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
              />
            </section>

            {/* Conversion CTA - Questions */}
            <section className="mb-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-8 text-white shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <MessageCircle className="w-8 h-8" />
                <h2 className="text-2xl font-bold">
                  Posez vos Questions a cette Video
                </h2>
              </div>
              <p className="text-blue-100 mb-6 text-lg">
                Utilisez l'IA de Lurnia pour interroger cette video en profondeur et obtenir des reponses precises.
              </p>
              <div className="space-y-3 mb-8">
                {insight.conversionQuestions.map((q, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
                    <span className="text-2xl">{q.icon}</span>
                    <span className="text-white/95 font-medium">{q.question}</span>
                  </div>
                ))}
              </div>
              <Link
                href={`/?video=https://youtube.com/watch?v=${insight.videoId}`}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors text-lg shadow-lg"
              >
                Poser une Question <ArrowRight className="w-5 h-5" />
              </Link>
            </section>

            {/* FAQ Section */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-2xl">&#10067;</span> Questions Frequentes
              </h2>
              <FAQAccordion faqs={insight.faqs} />
            </section>

            {/* Final CTA */}
            <section className="text-center py-12 border-t border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Decouvrez Lurnia
              </h2>
              <p className="text-slate-600 mb-6 max-w-xl mx-auto">
                Transformez n'importe quelle video YouTube en assistant personnel. Posez des questions, obtenez des resumes instantanes.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all text-lg shadow-lg"
              >
                Essayer Gratuitement <ArrowRight className="w-5 h-5" />
              </Link>
            </section>

          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}
