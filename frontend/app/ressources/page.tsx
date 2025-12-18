'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, BookOpen, Clock, ArrowRight, TrendingUp, Star, Zap } from 'lucide-react'
import Footer from '@/components/Footer'
import articlesData from '@/data/articles.json'

const categories = [
  'Tous les articles',
  'Guides Pratiques',
  'Comparatifs & Reviews',
  'Use Cases'
]

export default function RessourcesPage() {
  const [selectedCategory, setSelectedCategory] = useState('Tous les articles')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter articles
  const filteredArticles = articlesData.filter(article => {
    const matchesCategory = selectedCategory === 'Tous les articles' || article.category === selectedCategory
    const matchesSearch = !searchQuery ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesCategory && matchesSearch
  })

  // Featured articles
  const featuredArticles = articlesData.filter(a => a.featured).slice(0, 3)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Simple Header for Resources */}
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

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-purple-600 pt-32 pb-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="text-center text-white">
            <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-6">
              <Star className="w-4 h-4 mr-2" />
              <span className="text-sm font-semibold">50+ Guides Gratuits</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Ressources IA pour YouTube
            </h1>

            <p className="text-xl sm:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Guides pratiques, comparatifs et astuces pour maîtriser l'IA sur YouTube. Gagnez du temps et apprenez plus efficacement.
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher un guide, une astuce..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:border-white/40 transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl py-16">
        {/* Featured Articles */}
        {!searchQuery && (
          <section className="mb-16">
            <div className="flex items-center gap-2 mb-8">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              <h2 className="text-3xl font-bold text-slate-900">Articles à la Une</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {featuredArticles.map(article => (
                <Link
                  key={article.id}
                  href={`/ressources/${article.slug}`}
                  className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all"
                >
                  <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <BookOpen className="w-16 h-16 text-white opacity-50" />
                  </div>

                  <div className="p-6">
                    <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {article.readTime}
                      </span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                        {article.category}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {article.title}
                    </h3>

                    <p className="text-slate-600 mb-4 line-clamp-2">
                      {article.excerpt}
                    </p>

                    <div className="flex items-center gap-2 text-blue-600 font-semibold">
                      <span>Lire l'article</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Category Filter */}
        <div className="flex flex-wrap gap-3 mb-8">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-600 hover:text-blue-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Results Count */}
        <p className="text-slate-600 mb-6">
          {filteredArticles.length} article{filteredArticles.length > 1 ? 's' : ''} trouvé{filteredArticles.length > 1 ? 's' : ''}
          {searchQuery && ` pour "${searchQuery}"`}
        </p>

        {/* Articles Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.map(article => (
            <Link
              key={article.id}
              href={`/ressources/${article.slug}`}
              className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:border-blue-200 transition-all"
            >
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {article.readTime}
                </span>
                <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-full">
                  {article.category}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                {article.title}
              </h3>

              <p className="text-slate-600 text-sm mb-4 line-clamp-3">
                {article.excerpt}
              </p>

              <div className="flex items-center gap-2 text-blue-600 text-sm font-semibold">
                <span>Lire la suite</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>

        {/* No Results */}
        {filteredArticles.length === 0 && (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              Aucun article trouvé
            </h3>
            <p className="text-slate-600 mb-6">
              Essayez avec d'autres mots-clés ou catégories
            </p>
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory('Tous les articles')
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-blue-600 to-purple-600 py-16">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Prêt à transformer votre apprentissage YouTube?
          </h2>
          <p className="text-lg sm:text-xl text-blue-100 mb-8">
            Essayez Lurnia gratuitement et posez vos premières questions à n'importe quelle chaîne YouTube
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-colors shadow-xl"
          >
            Commencer Gratuitement
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
