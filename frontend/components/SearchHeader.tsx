'use client'

import Link from 'next/link'
import { Zap, Chrome } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { CHROME_STORE_URL } from '@/lib/chromeStore'

export default function SearchHeader() {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-50 border-b border-indigo-100/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 p-1.5 shadow-sm shadow-indigo-400/40">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
            Lurnia
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-4">
          <Link href="/#how" className="hidden text-slate-600 hover:text-indigo-700 sm:inline">
            How it works
          </Link>
          <Link href="/learn" className="hidden text-slate-600 hover:text-indigo-700 sm:inline">
            Topics
          </Link>
          <Link href="/guides" className="hidden text-slate-600 hover:text-indigo-700 md:inline">
            Playbooks
          </Link>
          <Link
            href={user ? '/settings' : '/auth'}
            className="hidden text-slate-600 hover:text-indigo-700 sm:inline"
          >
            {user ? 'Account' : 'Sign in'}
          </Link>
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-1.5 font-semibold text-white shadow-sm shadow-indigo-500/20 hover:from-blue-500 hover:to-violet-500"
          >
            <Chrome className="h-4 w-4" aria-hidden="true" />
            Add to Chrome
          </a>
        </nav>
      </div>
    </header>
  )
}
