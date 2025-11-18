'use client'

import { useRouter } from 'next/navigation'
import Pricing from '@/components/Pricing'
import { ArrowLeft, Zap } from 'lucide-react'

export default function PricingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navigation Header */}
      <div className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 lg:px-6">
          {/* Left: Logo and Back Button */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg px-2 py-1 -ml-2"
            >
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                WanderMind
              </span>
            </button>
          </div>

        </div>
      </div>
      
      <Pricing />
    </div>
  )
}

