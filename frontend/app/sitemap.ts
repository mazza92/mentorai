import { MetadataRoute } from 'next'
import articlesData from '@/data/articles.json'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface SitemapEntry {
  loc: string
  lastmod: string
  changefreq: string
  priority: number
}

async function getPublishedGuides(): Promise<SitemapEntry[]> {
  try {
    // Use dedicated sitemap endpoint that returns ALL guides (no pagination limit)
    const res = await fetch(`${API_URL}/api/public-insights/sitemap`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://lurnia.app'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/ressources`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/guides`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/extension`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ]

  // Dynamic article pages
  const articlePages: MetadataRoute.Sitemap = articlesData.map(article => ({
    url: `${baseUrl}/ressources/${article.slug}`,
    lastModified: new Date(article.publishDate),
    changeFrequency: 'weekly' as const,
    priority: article.featured ? 0.9 : 0.7,
  }))

  // Dynamic guide pages (pSEO - fetched from API sitemap endpoint)
  // Returns ALL published guides with full URLs
  const guides = await getPublishedGuides()
  const guidePages: MetadataRoute.Sitemap = guides.map(guide => ({
    url: guide.loc, // Already a full URL from backend
    lastModified: guide.lastmod ? new Date(guide.lastmod) : new Date(),
    changeFrequency: guide.changefreq as 'weekly' | 'daily' | 'monthly',
    priority: guide.priority,
  }))

  return [...staticPages, ...articlePages, ...guidePages]
}
