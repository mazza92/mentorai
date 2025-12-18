'use client'

import { notFound } from 'next/navigation'
import { Clock, Calendar, User, ArrowLeft, Share2, BookmarkPlus, Zap } from 'lucide-react'
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
  const article = articlesData.find(a => a.slug === params.slug)

  if (!article) {
    notFound()
  }

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

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        {/* Simple Header */}
        <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
          <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">Lurnia</span>
              </Link>

              <nav className="hidden md:flex items-center gap-6">
                <Link href="/ressources" className="text-blue-600 font-semibold">
                  Ressources
                </Link>
                <Link href="/pricing" className="text-slate-700 hover:text-blue-600 transition-colors">
                  Tarifs
                </Link>
                <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                  Essayer Gratuitement
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Article Header */}
        <article className="pt-32 pb-20">
          <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
            {/* Breadcrumbs */}
            <Breadcrumbs
              items={[
                { label: 'Ressources', href: '/ressources' },
                { label: article.category, href: `/ressources?category=${encodeURIComponent(article.category)}` },
                { label: article.title, href: `/ressources/${article.slug}` }
              ]}
              className="mb-8"
            />

            {/* Back Button */}
            <Link
              href="/ressources"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour aux ressources
            </Link>

            {/* Category Badge */}
            <div className="mb-6">
              <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                {article.category}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              {article.title}
            </h1>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-6 text-slate-600 mb-8">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <time dateTime={article.publishDate}>
                  {new Date(article.publishDate).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </time>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>{article.readTime} de lecture</span>
              </div>

              <div className="flex items-center gap-2">
                <User className="w-5 h-5" />
                <span>{article.author}</span>
              </div>
            </div>

            {/* Social Share Buttons */}
            <div className="flex gap-3 mb-12">
              <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
                <Share2 className="w-4 h-4" />
                Partager
              </button>
              <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
                <BookmarkPlus className="w-4 h-4" />
                Enregistrer
              </button>
            </div>

            {/* Excerpt */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 mb-12 border-l-4 border-blue-600">
              <p className="text-lg sm:text-xl text-slate-700 leading-relaxed">
                {article.excerpt}
              </p>
            </div>
          </div>

          {/* Article Content with Sidebar */}
          <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="grid lg:grid-cols-[1fr_300px] gap-12">
              {/* Main Content */}
              <div
                className="article-content prose prose-lg prose-slate max-w-none
                  prose-headings:font-bold prose-headings:text-slate-900
                  prose-h1:text-4xl prose-h1:mt-8 prose-h1:mb-6 prose-h1:leading-tight
                  prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-3
                  prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-blue-700
                  prose-h4:text-xl prose-h4:mt-6 prose-h4:mb-3 prose-h4:text-slate-800
                  prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-6 prose-p:text-base
                  prose-a:text-blue-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline hover:prose-a:text-blue-700
                  prose-strong:text-slate-900 prose-strong:font-bold
                  prose-em:text-slate-700 prose-em:italic
                  prose-ul:my-6 prose-ul:space-y-3
                  prose-ol:my-6 prose-ol:space-y-3
                  prose-li:text-slate-700 prose-li:leading-relaxed
                  prose-li:marker:text-blue-600
                  prose-code:bg-blue-50 prose-code:text-blue-800 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-mono
                  prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:p-6 prose-pre:rounded-xl prose-pre:overflow-x-auto
                  prose-blockquote:border-l-4 prose-blockquote:border-blue-600 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-slate-600 prose-blockquote:bg-blue-50 prose-blockquote:py-4 prose-blockquote:pr-4 prose-blockquote:rounded-r-lg
                  prose-table:border prose-table:border-slate-300 prose-table:rounded-lg
                  prose-th:bg-slate-100 prose-th:p-3 prose-th:font-bold prose-th:text-left prose-th:border prose-th:border-slate-300
                  prose-td:p-3 prose-td:border prose-td:border-slate-200
                  prose-hr:my-12 prose-hr:border-slate-300"
                dangerouslySetInnerHTML={{ __html: articleContent }}
              />

              {/* Sidebar */}
              <aside className="lg:sticky lg:top-24 lg:self-start space-y-6">
                <TableOfContents />

                {/* CTA Card */}
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
                  <h3 className="text-xl font-bold mb-3">
                    Prêt à essayer Lurnia?
                  </h3>
                  <p className="text-blue-100 mb-4 text-sm">
                    Posez vos premières questions à n'importe quelle chaîne YouTube gratuitement.
                  </p>
                  <Link
                    href="/"
                    className="block w-full px-4 py-3 bg-white text-blue-600 rounded-xl font-bold text-center hover:bg-blue-50 transition-colors"
                  >
                    Commencer Gratuitement
                  </Link>
                  <p className="text-xs text-blue-200 mt-3 text-center">
                    Sans carte bancaire • 2 chaînes gratuites
                  </p>
                </div>
              </aside>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="container mx-auto px-4 sm:px-6 max-w-5xl mt-20">
            <FAQSection faqs={faqs} />
          </div>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="container mx-auto px-4 sm:px-6 max-w-5xl mt-20">
              <h2 className="text-3xl font-bold text-slate-900 mb-8">
                Articles Similaires
              </h2>

              <div className="grid md:grid-cols-3 gap-6">
                {relatedArticles.map(related => (
                  <Link
                    key={related.id}
                    href={`/ressources/${related.slug}`}
                    className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:border-blue-200 transition-all"
                  >
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                      <Clock className="w-4 h-4" />
                      {related.readTime}
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {related.title}
                    </h3>

                    <p className="text-slate-600 text-sm line-clamp-2">
                      {related.excerpt}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Final CTA */}
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl mt-20">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-12 text-center text-white">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Transformez votre apprentissage YouTube dès aujourd'hui
              </h2>
              <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
                Rejoignez des milliers d'utilisateurs qui gagnent du temps et apprennent plus vite grâce à l'IA
              </p>
              <Link
                href="/"
                className="inline-block px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-colors shadow-xl"
              >
                Essayer Lurnia Gratuitement →
              </Link>
              <p className="text-sm text-blue-200 mt-4">
                2 chaînes gratuites • 10 questions/mois • Aucune carte bancaire
              </p>
            </div>
          </div>
        </article>

        <Footer />
      </div>
    </>
  )
}
