'use client'

import { useRouter } from 'next/navigation'
import { XCircle } from 'lucide-react'

export default function SubscriptionCancel() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
        <XCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Subscription Cancelled</h1>
        <p className="text-slate-600 mb-6">
          You cancelled the subscription process. No charges were made.
        </p>
        <button
          onClick={() => router.push('/pricing')}
          className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

