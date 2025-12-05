'use client'

import { Suspense } from 'react'
import Auth from '@/components/Auth'

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
      <div className="text-slate-600">Loading...</div>
    </div>}>
      <Auth />
    </Suspense>
  )
}

