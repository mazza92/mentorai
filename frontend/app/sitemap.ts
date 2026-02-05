import { MetadataRoute } from 'next'
import articlesData from '@/data/articles.json'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function getPublishedGuides(): Promise<{ slug: string; publishedAt: string }[]> {
  try {
    const res = await fetch(`${API_URL}/api/public-insights/list?limit=100`, {
      next: { revalidate: 3600 }
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
  ]

  // Dynamic article pages
  const articlePages: MetadataRoute.Sitemap = articlesData.map(article => ({
    url: `${baseUrl}/ressources/${article.slug}`,
    lastModified: new Date(article.publishDate),
    changeFrequency: 'weekly' as const,
    priority: article.featured ? 0.9 : 0.7,
  }))

  // Dynamic guide pages (pSEO - fetched from API)
  const guides = await getPublishedGuides()
  const guidePages: MetadataRoute.Sitemap = guides.map(guide => ({
    url: `${baseUrl}/guides/${guide.slug}`,
    lastModified: guide.publishedAt ? new Date(guide.publishedAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...articlePages, ...guidePages]
}
