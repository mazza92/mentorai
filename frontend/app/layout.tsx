import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'

export const metadata: Metadata = {
  title: 'WanderMind - Your AI Learning Companion',
  description: 'Transform any YouTube video into an interactive learning experience with AI-powered Q&A',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}

