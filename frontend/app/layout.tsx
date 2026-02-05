import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import CookieConsent from '@/components/CookieConsent'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  metadataBase: new URL('https://lurnia.app'),
  title: 'Lurnia - Your AI Learning Companion',
  description: 'Transform any YouTube video into an interactive learning experience with AI-powered Q&A',
  alternates: {
    canonical: 'https://lurnia.app',
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
    <html lang="fr">
      <head>
        <GoogleAnalytics />
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

