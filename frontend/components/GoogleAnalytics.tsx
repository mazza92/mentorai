'use client'

import Script from 'next/script'
import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function GoogleAnalyticsTracking() {
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

  return null
}

export default function GoogleAnalytics() {
  // Get GA4 measurement ID from environment variables
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  // Google Ads ID (hardcoded as it's campaign-specific)
  const GOOGLE_ADS_ID = 'AW-17789946840'

  // Don't render if GA_MEASUREMENT_ID is not set
  if (!GA_MEASUREMENT_ID) {
    console.warn('⚠️ Google Analytics not configured. Set NEXT_PUBLIC_GA_MEASUREMENT_ID in .env')
    return null
  }

  return (
    <>
      {/* Google Analytics + Google Ads gtag.js script */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
      />
      <Script
        id="google-analytics-ads"
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

            // Configure Google Ads
            gtag('config', '${GOOGLE_ADS_ID}');

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
      {/* Track page views with Suspense boundary */}
      <Suspense fallback={null}>
        <GoogleAnalyticsTracking />
      </Suspense>
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
 * Usage: trackConversion('AW-CONVERSION-LABEL', 25.99)
 * Get conversion labels from Google Ads dashboard
 */
export function trackConversion(conversionLabel: string, value?: number) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    const GOOGLE_ADS_ID = 'AW-17789946840'

    (window as any).gtag('event', 'conversion', {
      'send_to': `${GOOGLE_ADS_ID}/${conversionLabel}`,
      'value': value || 0,
      'currency': 'EUR'
    })
  }
}

/**
 * Track signup conversion for Google Ads
 * Call this after successful signup
 */
export function trackSignupConversion() {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'conversion', {
      'send_to': 'AW-17789946840/SIGNUP_LABEL' // Replace SIGNUP_LABEL with actual label from Google Ads
    })
  }
}

/**
 * Track purchase/upgrade conversion for Google Ads
 * Call this after successful Pro upgrade
 */
export function trackPurchaseConversion(value: number = 24.99) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'conversion', {
      'send_to': 'AW-17789946840/PURCHASE_LABEL', // Replace PURCHASE_LABEL with actual label from Google Ads
      'value': value,
      'currency': 'EUR',
      'transaction_id': Date.now().toString()
    })
  }
}
