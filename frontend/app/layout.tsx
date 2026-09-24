import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import CookieConsent from '@/components/CookieConsent'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import { Analytics } from '@vercel/analytics/next'
import { homepageFaqJsonLd, organizationJsonLd } from '@/lib/seo'

export const metadata: Metadata = {
  metadataBase: new URL('https://lurnia.app'),
  title: {
    default: "Don't trust the thumbnail | Lurnia: high-value YouTube search",
    template: '%s | Lurnia'
  },
  description:
    "YouTube ranks hooks. Lurnia ranks videos people actually learned from (comments, likes, depth), then turns them into a playbook. Don't get fooled by the thumbnail.",
  keywords: [
    'high value YouTube videos',
    'YouTube clickbait',
    "don't trust the thumbnail",
    'YouTube playbook',
    'skip YouTube fluff',
    'find useful YouTube tutorials',
    'YouTube search by engagement',
    'résumer vidéo YouTube',
    'vidéos YouTube utiles'
  ],
  alternates: {
    canonical: 'https://lurnia.app',
    languages: {
      'en': 'https://lurnia.app',
      'fr': 'https://lurnia.app',
      'x-default': 'https://lurnia.app'
    }
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['fr_FR'],
    url: 'https://lurnia.app',
    siteName: 'Lurnia',
    title: "Don't trust the thumbnail | Lurnia",
    description:
      'Stop the empty-scroll. Find YouTube videos worth studying, extract the playbook, skip the fluff.',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Don't trust the thumbnail | Lurnia",
    description: 'High-value YouTube search. Playbooks instead of recaps.',
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
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <GoogleAnalytics />
        <Script
          id="lurnia-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Script
          id="lurnia-faq-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageFaqJsonLd) }}
        />
      </head>
      <body className="antialiased">
        <LanguageProvider>
          <AuthProvider>
            {children}
            <CookieConsent />
          </AuthProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}

