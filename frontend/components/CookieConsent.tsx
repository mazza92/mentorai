'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { Cookie, X, Settings } from 'lucide-react'

export default function CookieConsent() {
  const { t } = useTranslation('common')
  const [show, setShow] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [preferences, setPreferences] = useState({
    necessary: true, // Always true, can't be disabled
    functional: true,
    analytics: true,
    advertising: true
  })

  useEffect(() => {
    // Check if user has already given consent
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      // Show banner after 1 second delay for better UX
      setTimeout(() => setShow(true), 1000)
    }
  }, [])

  const handleAcceptAll = () => {
    const consent = {
      necessary: true,
      functional: true,
      analytics: true,
      advertising: true,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem('cookie-consent', JSON.stringify(consent))
    setShow(false)

    // Initialize analytics if accepted
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'granted'
      })
    }
  }

  const handleRejectNonEssential = () => {
    const consent = {
      necessary: true,
      functional: false,
      analytics: false,
      advertising: false,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem('cookie-consent', JSON.stringify(consent))
    setShow(false)

    // Deny analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied'
      })
    }
  }

  const handleSavePreferences = () => {
    const consent = {
      ...preferences,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem('cookie-consent', JSON.stringify(consent))
    setShow(false)

    // Update consent based on preferences
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: preferences.analytics ? 'granted' : 'denied',
        ad_storage: preferences.advertising ? 'granted' : 'denied'
      })
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 animate-in slide-in-from-bottom duration-500">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200">
        {!showDetails ? (
          // Simple view
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Cookie className="w-6 h-6 text-orange-600" />
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  We use cookies
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  We use cookies to enhance your experience, analyze site usage, and assist in our marketing efforts.
                  By clicking "Accept All", you consent to our use of cookies. Learn more in our{' '}
                  <Link href="/cookies" className="text-blue-600 hover:underline">Cookie Policy</Link>.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleAcceptAll}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                  >
                    Accept All
                  </button>
                  <button
                    onClick={handleRejectNonEssential}
                    className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-all"
                  >
                    Reject Non-Essential
                  </button>
                  <button
                    onClick={() => setShowDetails(true)}
                    className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Customize
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShow(false)}
                className="flex-shrink-0 p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        ) : (
          // Detailed preferences view
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Cookie className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Cookie Preferences</h3>
                  <p className="text-sm text-slate-600">Choose which cookies you want to allow</p>
                </div>
              </div>
              <button
                onClick={() => setShow(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Necessary Cookies */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-900">Strictly Necessary</h4>
                    <p className="text-sm text-slate-600">Required for the service to function</p>
                  </div>
                  <div className="bg-slate-300 px-3 py-1 rounded-full text-xs font-semibold text-slate-700">
                    Always Active
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Authentication, security, session management
                </p>
              </div>

              {/* Functional Cookies */}
              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">Functional</h4>
                    <p className="text-sm text-slate-600">Remember your preferences</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={(e) => setPreferences(prev => ({ ...prev, functional: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Language preference, UI settings, last viewed channel
                </p>
              </div>

              {/* Analytics Cookies */}
              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">Analytics</h4>
                    <p className="text-sm text-slate-600">Help us improve the service</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) => setPreferences(prev => ({ ...prev, analytics: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Google Analytics, error tracking, performance monitoring
                </p>
              </div>

              {/* Advertising Cookies */}
              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">Advertising</h4>
                    <p className="text-sm text-slate-600">Measure ad campaign performance</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.advertising}
                      onChange={(e) => setPreferences(prev => ({ ...prev, advertising: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Google Ads conversion tracking, remarketing
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSavePreferences}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                Save Preferences
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-all"
              >
                Accept All
              </button>
              <button
                onClick={() => setShowDetails(false)}
                className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-all"
              >
                Back
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-4">
              Learn more in our{' '}
              <Link href="/cookies" className="text-blue-600 hover:underline">Cookie Policy</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
