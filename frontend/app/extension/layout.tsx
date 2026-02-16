import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lurnia Chrome Extension - Ask AI Questions About Any YouTube Video',
  description: 'Install the free Lurnia Chrome extension to ask AI-powered questions about any YouTube video. Get instant answers with clickable timestamps. Works on tutorials, lectures, podcasts, and more.',
  keywords: [
    'YouTube extension',
    'Chrome extension',
    'YouTube AI',
    'video learning',
    'YouTube questions',
    'video transcript',
    'YouTube summary',
    'AI assistant',
    'learn from YouTube',
    'YouTube study tool',
    'video timestamps',
    'educational videos',
    'YouTube tutorial helper',
    'video Q&A'
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
    title: 'Lurnia Chrome Extension - AI-Powered YouTube Learning',
    description: 'Ask questions about any YouTube video and get instant AI answers with timestamps. Free Chrome extension for students, professionals, and lifelong learners.',
    images: [
      {
        url: 'https://lurnia.app/og-extension.png',
        width: 1200,
        height: 630,
        alt: 'Lurnia Chrome Extension - Ask questions about YouTube videos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lurnia Chrome Extension - Ask AI Questions About YouTube Videos',
    description: 'Get instant AI answers with clickable timestamps. Free Chrome extension for learning from YouTube.',
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
  name: 'Lurnia - YouTube Learning Companion',
  applicationCategory: 'BrowserApplication',
  operatingSystem: 'Chrome, Edge, Brave',
  description: 'AI-powered Chrome extension that lets you ask questions about any YouTube video and get instant answers with clickable timestamps.',
  url: 'https://lurnia.app/extension',
  downloadUrl: 'https://chromewebstore.google.com/detail/lurnia-youtube-learning-c/fggidhdboaodfblhdigckdfcofimocim',
  softwareVersion: '1.1.0',
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
    'Ask AI questions about any YouTube video',
    'Get answers with clickable timestamps',
    'Multi-language support',
    'Works on tutorials, lectures, and podcasts',
    'No setup required',
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
