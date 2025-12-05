'use client'

import Script from 'next/script'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function GoogleAnalytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Get GA4 measurement ID from environment variables
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

  // Track page views on route changes
  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return

    const url = pathname + searchParams.toString()

    // Send pageview event to GA4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', GA_MEASUREMENT_ID, {
        page_path: url,
      })
    }
  }, [pathname, searchParams, GA_MEASUREMENT_ID])

  // Don't render if GA_MEASUREMENT_ID is not set
  if (!GA_MEASUREMENT_ID) {
    console.warn('⚠️ Google Analytics not configured. Set NEXT_PUBLIC_GA_MEASUREMENT_ID in .env')
    return null
  }

  return (
    <>
      {/* Google Analytics gtag.js script */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            // Initialize with cookie consent settings (default: denied)
            gtag('consent', 'default', {
              'analytics_storage': 'denied',
              'ad_storage': 'denied'
            });

            // Configure GA4
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
              anonymize_ip: true
            });

            // Listen for cookie consent changes
            window.addEventListener('cookieConsentUpdate', function(event) {
              const consent = event.detail;
              gtag('consent', 'update', {
                'analytics_storage': consent.analytics ? 'granted' : 'denied',
                'ad_storage': consent.advertising ? 'granted' : 'denied'
              });
            });
          `,
        }}
      />
    </>
  )
}

/**
 * Helper function to track custom events
 * Usage: trackEvent('sign_up', { method: 'google' })
 */
export function trackEvent(eventName: string, eventParams?: Record<string, any>) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, eventParams)
  }
}

/**
 * Track conversion events for Google Ads
 * Usage: trackConversion('sign_up')
 */
export function trackConversion(conversionName: string, value?: number) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

    (window as any).gtag('event', 'conversion', {
      'send_to': `${GA_MEASUREMENT_ID}/${conversionName}`,
      'value': value || 0,
      'currency': 'EUR'
    })
  }
}
