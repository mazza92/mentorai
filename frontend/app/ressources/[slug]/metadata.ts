import { Metadata } from 'next'
import articlesData from '@/data/articles.json'

type Props = {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = articlesData.find(a => a.slug === params.slug)

  if (!article) {
    return {
      title: 'Article Not Found',
    }
  }

  const canonicalUrl = `https://lurnia.app/ressources/${article.slug}`

  return {
    title: article.metaTitle,
    description: article.metaDescription,
    keywords: article.keywords.join(', '),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: article.metaTitle,
      description: article.metaDescription,
      url: canonicalUrl,
      siteName: 'Lurnia',
      images: [
        {
          url: `https://lurnia.app/images/blog/${article.slug}.jpg`,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
      locale: 'fr_FR',
      type: 'article',
      publishedTime: article.publishDate,
      authors: [article.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.metaTitle,
      description: article.metaDescription,
      images: [`https://lurnia.app/images/blog/${article.slug}.jpg`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

export async function generateStaticParams() {
  return articlesData.map((article) => ({
    slug: article.slug,
  }))
}
