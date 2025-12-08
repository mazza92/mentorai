'use client'

import { useEffect, useState } from 'react'
import { trackEvent } from '@/components/GoogleAnalytics'

export default function DebugGA() {
  const [status, setStatus] = useState({
    envVarSet: false,
    gtagLoaded: false,
    cookieConsent: null as any,
    testEventSent: false,
    measurementId: ''
  })

  useEffect(() => {
    // Check environment variable
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''

    // Check if gtag is loaded
    const gtagLoaded = typeof window !== 'undefined' && !!(window as any).gtag

    // Check cookie consent
    let cookieConsent = null
    if (typeof window !== 'undefined') {
      const consentStr = localStorage.getItem('cookie-consent')
      if (consentStr) {
        cookieConsent = JSON.parse(consentStr)
      }
    }

    setStatus({
      envVarSet: !!measurementId,
      gtagLoaded,
      cookieConsent,
      testEventSent: false,
      measurementId: measurementId || 'NOT SET'
    })
  }, [])

  const sendTestEvent = () => {
    trackEvent('test_event', {
      test_param: 'debug_page',
      timestamp: new Date().toISOString()
    })
    setStatus(prev => ({ ...prev, testEventSent: true }))
  }

  const updateConsent = () => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'granted'
      })

      const consent = {
        necessary: true,
        functional: true,
        analytics: true,
        advertising: true,
        timestamp: new Date().toISOString()
      }
      localStorage.setItem('cookie-consent', JSON.stringify(consent))

      setStatus(prev => ({ ...prev, cookieConsent: consent }))
      alert('Consent updated! Refresh page and check status.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Google Analytics 4 Debug</h1>

        <div className="space-y-4">
          {/* Environment Variable */}
          <div className={`p-4 rounded-lg border-2 ${status.envVarSet ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  {status.envVarSet ? '✅' : '❌'} Environment Variable
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  NEXT_PUBLIC_GA_MEASUREMENT_ID: <code className="bg-white px-2 py-1 rounded">{status.measurementId}</code>
                </p>
              </div>
            </div>
            {!status.envVarSet && (
              <div className="mt-4 p-3 bg-white rounded border border-red-300">
                <p className="font-semibold text-red-700">Fix:</p>
                <ol className="list-decimal list-inside text-sm mt-2 space-y-1">
                  <li>Go to Vercel Dashboard → Your Project → Settings → Environment Variables</li>
                  <li>Add: <code className="bg-slate-100 px-1">NEXT_PUBLIC_GA_MEASUREMENT_ID</code> = <code className="bg-slate-100 px-1">G-4QHLCL3S60</code></li>
                  <li>Select: Production, Preview, Development</li>
                  <li>Save and Redeploy</li>
                </ol>
              </div>
            )}
          </div>

          {/* gtag Script Loaded */}
          <div className={`p-4 rounded-lg border-2 ${status.gtagLoaded ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  {status.gtagLoaded ? '✅' : '❌'} gtag Script Loaded
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  window.gtag: {status.gtagLoaded ? 'Available' : 'Not loaded'}
                </p>
              </div>
            </div>
            {!status.gtagLoaded && (
              <div className="mt-4 p-3 bg-white rounded border border-red-300">
                <p className="font-semibold text-red-700">Possible causes:</p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>Environment variable not set (see above)</li>
                  <li>Ad blocker is blocking Google Analytics</li>
                  <li>Script failed to load from google.com</li>
                </ul>
              </div>
            )}
          </div>

          {/* Cookie Consent */}
          <div className={`p-4 rounded-lg border-2 ${
            status.cookieConsent?.analytics ? 'bg-green-50 border-green-500' : 'bg-yellow-50 border-yellow-500'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  {status.cookieConsent?.analytics ? '✅' : '⚠️'} Cookie Consent
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Analytics: {status.cookieConsent?.analytics ? 'Granted' : 'Denied or Not Set'}
                </p>
                {status.cookieConsent && (
                  <pre className="text-xs bg-white p-2 rounded mt-2 overflow-auto">
                    {JSON.stringify(status.cookieConsent, null, 2)}
                  </pre>
                )}
              </div>
            </div>
            {!status.cookieConsent?.analytics && (
              <div className="mt-4">
                <button
                  onClick={updateConsent}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
                >
                  Grant Analytics Consent
                </button>
              </div>
            )}
          </div>

          {/* Test Event */}
          <div className="p-4 rounded-lg border-2 bg-blue-50 border-blue-500">
            <h3 className="font-semibold text-lg mb-2">🧪 Test Event</h3>
            <p className="text-sm text-slate-600 mb-4">
              Send a test event to verify tracking is working
            </p>
            <button
              onClick={sendTestEvent}
              disabled={!status.envVarSet || !status.gtagLoaded}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              Send Test Event
            </button>
            {status.testEventSent && (
              <p className="mt-2 text-green-700 font-semibold">
                ✅ Test event sent! Check GA4 Realtime report in 30 seconds.
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="p-4 rounded-lg bg-white border-2 border-slate-300">
            <h3 className="font-semibold text-lg mb-2">📋 Next Steps</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Ensure all checks above are ✅ green</li>
              <li>Click "Send Test Event" button</li>
              <li>Go to GA4: <a href="https://analytics.google.com" target="_blank" rel="noopener" className="text-blue-600 underline">analytics.google.com</a></li>
              <li>Navigate to: Reports → Realtime</li>
              <li>You should see this page view + test event within 30 seconds</li>
            </ol>
          </div>

          {/* Browser Console Test */}
          <div className="p-4 rounded-lg bg-slate-100 border-2 border-slate-300">
            <h3 className="font-semibold text-lg mb-2">🔍 Manual Console Test</h3>
            <p className="text-sm text-slate-600 mb-2">
              Open browser console (F12) and run:
            </p>
            <pre className="bg-white p-3 rounded text-sm overflow-auto">
{`// Check if gtag exists
window.gtag

// Send manual test event
gtag('event', 'manual_test', {
  test_source: 'console',
  test_time: new Date().toISOString()
})`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
