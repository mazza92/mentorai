'use client'

import Link from 'next/link'
import { Zap } from 'lucide-react'

interface SEOHeaderProps {
  ctaText?: string
  ctaHref?: string
}

export default function SEOHeader({
  ctaText = 'Essayer Lurnia',
  ctaHref = '/'
}: SEOHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Lurnia
            </span>
          </Link>
          <Link
            href={ctaHref}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all text-sm shadow-sm hover:shadow-md"
          >
            {ctaText}
          </Link>
        </div>
      </div>
    </header>
  )
}
