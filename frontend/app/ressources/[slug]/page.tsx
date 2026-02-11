'use client'

import { notFound } from 'next/navigation'
import { Clock, Calendar, User, ArrowLeft, Share2, BookmarkPlus, Zap, ArrowUp, Twitter, Facebook, Linkedin, Mail } from 'lucide-react'
import Link from 'next/link'
import Script from 'next/script'
import Footer from '@/components/Footer'
import TableOfContents from '@/components/seo/TableOfContents'
import FAQSection, { FAQItem } from '@/components/seo/FAQSection'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import articlesData from '@/data/articles.json'
import { useEffect, useState } from 'react'

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const [articleContent, setArticleContent] = useState<string>('')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showJumpTop, setShowJumpTop] = useState(false)
  const article = articlesData.find(a => a.slug === params.slug)

  if (!article) {
    notFound()
  }

  // Handle scroll progress and jump-to-top visibility
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight - windowHeight
      const scrolled = window.scrollY
      const progress = (scrolled / documentHeight) * 100

      setScrollProgress(progress)
      setShowJumpTop(scrolled > 300)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Load and parse article content from markdown file
    const loadArticle = async () => {
      try {
        const response = await fetch(`/article-content/${params.slug}.md`)
        const markdown = await response.text()

        // Dynamically import marked for markdown parsing
        const { marked } = await import('marked')

        // Convert markdown to HTML
        const html = await marked.parse(markdown, {
          breaks: true,
          gfm: true
        })
        setArticleContent(html)
      } catch (err) {
        console.error('Failed to load article content:', err)
        setArticleContent('<p>Erreur de chargement du contenu. Veuillez réessayer.</p>')
      }
    }

    loadArticle()
  }, [params.slug])

  const handleJumpToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareTitle = article.title

  // Article Schema.org structured data
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.excerpt,
    "image": `https://lurnia.app/images/blog/${article.slug}.jpg`,
    "author": {
      "@type": "Organization",
      "name": article.author
    },
    "publisher": {
      "@type": "Organization",
      "name": "Lurnia",
      "logo": {
        "@type": "ImageObject",
        "url": "https://lurnia.app/logo.png"
      }
    },
    "datePublished": article.publishDate,
    "dateModified": article.publishDate,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://lurnia.app/ressources/${article.slug}`
    },
    "keywords": article.keywords.join(', '),
    "articleSection": article.category,
    "wordCount": 2500
  }

  // Dynamic FAQs based on article
  const faqs: FAQItem[] = [
    {
      question: "Est-ce que ça fonctionne avec toutes les vidéos YouTube?",
      answer: "Oui, tant que la vidéo a des sous-titres (automatiques ou manuels). 95% des vidéos YouTube ont des sous-titres automatiques générés par YouTube."
    },
    {
      question: "L'IA peut-elle se tromper?",
      answer: "Oui, comme tout système IA. C'est pourquoi Lurnia vous donne <strong>toujours les timestamps exacts</strong> pour vérifier vous-même la source. La vérification se fait en 1 clic."
    },
    {
      question: "Combien de questions puis-je poser?",
      answer: "En version gratuite: 10 questions/mois. En version Pro: 500 questions/mois. Chaque réponse inclut des citations avec timestamps cliquables."
    },
    {
      question: "Est-ce légal d'utiliser l'IA sur YouTube?",
      answer: "Oui, 100% légal. Lurnia utilise les transcriptions publiques de YouTube (comme quand vous cliquez sur \"Afficher la transcription\"). Aucun téléchargement de vidéo n'est effectué."
    },
    {
      question: "Combien de temps ça prend pour obtenir une réponse?",
      answer: "L'importation d'une chaîne prend 3-5 secondes. Chaque réponse est générée en 2-3 secondes. Total: moins de 10 secondes du début à la fin."
    }
  ]

  // Related articles
  const relatedArticles = articlesData
    .filter(a => a.slug !== article.slug && a.category === article.category)
    .slice(0, 3)

  return (
    <>
      {/* Meta Tags */}
      <title>{article.metaTitle}</title>
      <meta name="description" content={article.metaDescription} />
      <meta name="keywords" content={article.keywords.join(', ')} />
      <link rel="canonical" href={`https://lurnia.app/ressources/${article.slug}`} />

      {/* Open Graph */}
      <meta property="og:title" content={article.metaTitle} />
      <meta property="og:description" content={article.metaDescription} />
      <meta property="og:image" content={`https://lurnia.app/images/blog/${article.slug}.jpg`} />
      <meta property="og:url" content={`https://lurnia.app/ressources/${article.slug}`} />
      <meta property="og:type" content="article" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={article.metaTitle} />
      <meta name="twitter:description" content={article.metaDescription} />
      <meta name="twitter:image" content={`https://lurnia.app/images/blog/${article.slug}.jpg`} />

      {/* Structured Data */}
      <Script
        id="article-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-200 z-[60]">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-200"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
        {/* Simple Header */}
        <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-b border-slate-200/50 z-50 shadow-sm">
          <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center space-x-2 group">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 group-hover:scale-110 transition-transform">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Lurnia
                </span>
              </Link>

              <nav className="hidden md:flex items-center gap-6">
                <Link href="/ressources" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                  Ressources
                </Link>
                <Link href="/pricing" className="text-slate-700 hover:text-blue-600 transition-colors">
                  Tarifs
                </Link>
                <Link href="/" className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all">
                  Essayer Gratuitement
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Article Header */}
        <article className="pt-24 sm:pt-28 pb-20">
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
            {/* Breadcrumbs */}
            <Breadcrumbs
              items={[
                { label: 'Ressources', href: '/ressources' },
                { label: article.category, href: `/ressources?category=${encodeURIComponent(article.category)}` },
                { label: article.title, href: `/ressources/${article.slug}` }
              ]}
              className="mb-6"
            />

            {/* Back Button */}
            <Link
              href="/ressources"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 font-medium transition-all hover:gap-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour aux ressources
            </Link>

            {/* Category Badge */}
            <div className="mb-6">
              <span className="inline-block px-4 py-1.5 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 rounded-full text-sm font-bold uppercase tracking-wide">
                {article.category}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 mb-6 leading-[1.1] tracking-tight">
              {article.title}
            </h1>

            {/* Excerpt / Lead Paragraph */}
            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-8 font-medium">
              {article.excerpt}
            </p>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-slate-600 mb-8 pb-8 border-b border-slate-200">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg">
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">{article.author}</span>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <time dateTime={article.publishDate} className="text-sm">
                  {new Date(article.publishDate).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </time>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-sm">{article.readTime} de lecture</span>
              </div>
            </div>
          </div>

          {/* Article Content with Sidebar */}
          <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="grid lg:grid-cols-[1fr_320px] gap-12 xl:gap-16">
              {/* Main Content */}
              <div className="min-w-0">
                <div
                  className="article-content ai-response max-w-none text-[17px]"
                  style={{
                    fontSize: '17px',
                    lineHeight: '1.8'
                  }}
                  dangerouslySetInnerHTML={{ __html: articleContent }}
                />

                {/* CTA Card - Embedded in Content */}
                <div className="my-16 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 rounded-2xl p-8 sm:p-10 text-white shadow-2xl">
                  <div className="max-w-xl mx-auto text-center">
                    <Zap className="w-12 h-12 mx-auto mb-4 text-blue-200" />
                    <h3 className="text-2xl sm:text-3xl font-bold mb-3">
                      Prêt à transformer votre apprentissage YouTube?
                    </h3>
                    <p className="text-blue-100 mb-6 text-base sm:text-lg">
                      Rejoignez des milliers d'utilisateurs qui gagnent 10h+ par semaine avec Lurnia
                    </p>
                    <Link
                      href="https://lurnia.app"
                      className="inline-block px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all hover:scale-105 shadow-lg"
                    >
                      Essayer Lurnia Gratuitement →
                    </Link>
                    <p className="text-xs text-blue-200 mt-4">
                      ✓ 2 chaînes gratuites • ✓ 10 questions/mois • ✓ Sans carte bancaire
                    </p>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <aside className="hidden lg:block">
                <div className="sticky top-24 space-y-6">
                  <TableOfContents />

                  {/* Social Share - Enhanced */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wide">
                      Partager l'article
                    </h3>
                    <div className="flex flex-col gap-3">
                      <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1DA1F2] text-white rounded-lg font-semibold hover:bg-[#1a8cd8] transition-all hover:scale-105 shadow-sm"
                      >
                        <Twitter className="w-4 h-4" />
                        Twitter
                      </a>
                      <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#4267B2] text-white rounded-lg font-semibold hover:bg-[#365899] transition-all hover:scale-105 shadow-sm"
                      >
                        <Facebook className="w-4 h-4" />
                        Facebook
                      </a>
                      <a
                        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0077B5] text-white rounded-lg font-semibold hover:bg-[#006399] transition-all hover:scale-105 shadow-sm"
                      >
                        <Linkedin className="w-4 h-4" />
                        LinkedIn
                      </a>
                      <a
                        href={`mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareUrl)}`}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-all hover:scale-105"
                      >
                        <Mail className="w-4 h-4" />
                        Email
                      </a>
                    </div>
                  </div>

                  {/* CTA Card */}
                  <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
                    <h3 className="text-xl font-bold mb-3">
                      Prêt à essayer Lurnia?
                    </h3>
                    <p className="text-blue-100 mb-4 text-sm leading-relaxed">
                      Posez vos premières questions à n'importe quelle chaîne YouTube gratuitement.
                    </p>
                    <Link
                      href="/"
                      className="block w-full px-4 py-3 bg-white text-blue-600 rounded-xl font-bold text-center hover:bg-blue-50 transition-all hover:scale-105 shadow-lg"
                    >
                      Commencer Gratuitement
                    </Link>
                    <p className="text-xs text-blue-200 mt-3 text-center">
                      Sans carte bancaire • 2 chaînes gratuites
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl mt-24">
            <FAQSection faqs={faqs} />
          </div>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="container mx-auto px-4 sm:px-6 max-w-6xl mt-24">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 text-center">
                Continuez votre lecture
              </h2>
              <p className="text-slate-600 text-center mb-12 text-lg">
                Découvrez d'autres articles pour maîtriser l'IA
              </p>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedArticles.map(related => (
                  <Link
                    key={related.id}
                    href={`/ressources/${related.slug}`}
                    className="group bg-white rounded-2xl border-2 border-slate-200 p-6 hover:shadow-2xl hover:border-blue-400 hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                      <Clock className="w-4 h-4" />
                      {related.readTime}
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                      {related.title}
                    </h3>

                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">
                      {related.excerpt}
                    </p>

                    <div className="mt-4 inline-flex items-center text-blue-600 font-semibold text-sm group-hover:gap-2 transition-all">
                      Lire l'article
                      <ArrowLeft className="w-4 h-4 rotate-180 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Final CTA */}
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl mt-24">
            <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700 rounded-3xl p-10 sm:p-14 text-center text-white shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
              <div className="relative z-10">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
                  Transformez votre apprentissage YouTube dès aujourd'hui
                </h2>
                <p className="text-lg sm:text-xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
                  Rejoignez des milliers d'utilisateurs qui gagnent du temps et apprennent plus vite grâce à l'IA
                </p>
                <Link
                  href="/"
                  className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all shadow-2xl hover:scale-105"
                >
                  Essayer Lurnia Gratuitement →
                </Link>
                <p className="text-sm text-blue-200 mt-5 font-medium">
                  ✓ 2 chaînes gratuites • ✓ 10 questions/mois • ✓ Aucune carte bancaire
                </p>
              </div>
            </div>
          </div>
        </article>

        {/* Jump to Top Button */}
        {showJumpTop && (
          <button
            onClick={handleJumpToTop}
            className="fixed bottom-8 right-8 p-4 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full shadow-2xl hover:scale-110 hover:shadow-blue-500/50 transition-all z-50 group"
            aria-label="Retour en haut"
          >
            <ArrowUp className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
          </button>
        )}

        <Footer />
      </div>
    </>
  )
}
