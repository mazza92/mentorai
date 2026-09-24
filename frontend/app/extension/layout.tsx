import { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Don't trust the thumbnail: Lurnia for Chrome",
  description:
    'Rank YouTube by real engagement, steal the playbook, skip the empty-scroll. Ask any video. Free Chrome extension. Not affiliated with YouTube.',
  keywords: [
    'high value YouTube',
    "don't trust the thumbnail",
    'YouTube clickbait',
    'YouTube playbook',
    'Chrome extension YouTube',
    'skip YouTube fluff',
    'YouTube search by comments'
  ],
  authors: [{ name: 'Lurnia' }],
  creator: 'Lurnia',
  publisher: 'Lurnia',
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
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://lurnia.app/extension',
    siteName: 'Lurnia',
    title: "Don't trust the thumbnail: Lurnia for Chrome",
    description: 'Stop the empty-scroll. Rank YouTube by comments and depth, extract the playbook, ask the video.',
    images: [
      {
        url: 'https://lurnia.app/og-extension.png',
        width: 1200,
        height: 630,
        alt: 'Lurnia Chrome extension: find signal, steal the playbook',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Don't trust the thumbnail: Lurnia for Chrome",
    description: 'High-value YouTube search + playbooks. Skip the bait.',
    images: ['https://lurnia.app/og-extension.png'],
    creator: '@luraboratory',
  },
  alternates: {
    canonical: 'https://lurnia.app/extension',
    languages: {
      'en': 'https://lurnia.app/extension',
      'fr': 'https://lurnia.app/extension',
    },
  },
  category: 'Technology',
  classification: 'Chrome Extension',
}

// JSON-LD Structured Data
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Lurnia: high-value YouTube, not the thumbnail',
  applicationCategory: 'BrowserApplication',
  operatingSystem: 'Chrome, Edge, Brave',
  description: "Don't trust the thumbnail. Rank YouTube by real engagement, extract a playbook, ask the video.",
  url: 'https://lurnia.app/extension',
  downloadUrl: 'https://chromewebstore.google.com/detail/lurnia-youtube-learning-c/fggidhdboaodfblhdigckdfcofimocim',
  softwareVersion: '1.4.0',
  author: {
    '@type': 'Organization',
    name: 'Lurnia',
    url: 'https://lurnia.app',
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free plan available with optional Pro upgrade',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '5',
    ratingCount: '10',
    bestRating: '5',
    worstRating: '1',
  },
  featureList: [
    "Don't trust the thumbnail. Rank by comments, likes, depth",
    'Playbook: takeaways, timestamps, what to skip',
    'Ask any YouTube video from captions and comments',
    'Shorts hidden unless you ask',
    'Works on youtube.com instantly'
  ],
  screenshot: 'https://lurnia.app/extension-screenshot.png',
  browserRequirements: 'Requires Chrome, Edge, Brave, or other Chromium-based browser',
}

export default function ExtensionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
