'use client'

import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { ArrowLeft, Cookie } from 'lucide-react'

export default function CookiePolicy() {
  const { t } = useTranslation('common')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <Cookie className="w-6 h-6 text-orange-600" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900">Cookie Policy</h1>
          </div>
          <p className="text-slate-600">Last updated: December 5, 2025</p>
        </div>

        {/* Content */}
        <div className="prose prose-slate max-w-none bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">1. What Are Cookies?</h2>
            <p className="text-slate-700 leading-relaxed">
              Cookies are small text files stored on your device when you visit a website. They help websites
              remember your preferences, authenticate you, and improve your experience.
            </p>
            <p className="text-slate-700 leading-relaxed mt-4">
              Lurnia uses cookies and similar technologies (local storage, session storage) to provide and
              improve our Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Types of Cookies We Use</h2>

            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">2.1 Strictly Necessary Cookies</h3>
              <p className="text-slate-700 text-sm mb-2">
                <strong>Purpose:</strong> Essential for the Service to function. Cannot be disabled.
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-700 text-sm">
                <li><strong>Authentication:</strong> Firebase session cookies to keep you logged in</li>
                <li><strong>Security:</strong> CSRF tokens, session IDs</li>
                <li><strong>Anonymous Sessions:</strong> Session ID for anonymous users (expires after 24h)</li>
              </ul>
              <p className="text-xs text-slate-600 mt-2"><strong>Duration:</strong> Session or until logout</p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg mb-4">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">2.2 Functional Cookies</h3>
              <p className="text-slate-700 text-sm mb-2">
                <strong>Purpose:</strong> Remember your preferences and improve your experience.
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-700 text-sm">
                <li><strong>Language Preference:</strong> Remember your language choice (FR/EN)</li>
                <li><strong>Current Project:</strong> Remember your last viewed channel</li>
                <li><strong>UI Preferences:</strong> Theme, layout settings</li>
                <li><strong>Cookie Consent:</strong> Remember your cookie consent choice</li>
              </ul>
              <p className="text-xs text-slate-600 mt-2"><strong>Duration:</strong> 1 year</p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg mb-4">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">2.3 Analytics Cookies</h3>
              <p className="text-slate-700 text-sm mb-2">
                <strong>Purpose:</strong> Understand how users interact with the Service to improve it.
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-700 text-sm">
                <li><strong>Google Analytics:</strong> Page views, feature usage, user flows (if enabled)</li>
                <li><strong>Error Tracking:</strong> Capture errors to improve stability</li>
                <li><strong>Performance Monitoring:</strong> Page load times, API response times</li>
              </ul>
              <p className="text-xs text-slate-600 mt-2"><strong>Duration:</strong> 2 years</p>
              <p className="text-xs text-slate-600"><strong>Third Party:</strong> Google Analytics (privacy policy: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">link</a>)</p>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">2.4 Advertising Cookies (if applicable)</h3>
              <p className="text-slate-700 text-sm mb-2">
                <strong>Purpose:</strong> Track ad campaign performance and conversions.
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-700 text-sm">
                <li><strong>Google Ads:</strong> Conversion tracking for ad campaigns</li>
                <li><strong>Remarketing:</strong> Show relevant ads to previous visitors</li>
              </ul>
              <p className="text-xs text-slate-600 mt-2"><strong>Duration:</strong> 90 days</p>
              <p className="text-xs text-slate-600"><strong>Third Party:</strong> Google Ads</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Browser Fingerprinting</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              For anonymous users, we collect a browser fingerprint to prevent abuse (VPN/cookie bypass).
              This fingerprint is:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>A hash of browser characteristics (user agent, screen size, timezone, etc.)</li>
              <li>Not personally identifiable on its own</li>
              <li>Used only to enforce quota limits for anonymous users</li>
              <li>Deleted after 24 hours of inactivity</li>
              <li>Not used for tracking across websites</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Third-Party Cookies</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              We use services that may set their own cookies:
            </p>

            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-slate-800">Google Services</h4>
                <p className="text-slate-700 text-sm">Firebase Auth, Analytics, YouTube API</p>
                <p className="text-xs text-slate-600">Privacy: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://policies.google.com/privacy</a></p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-semibold text-slate-800">Stripe</h4>
                <p className="text-slate-700 text-sm">Payment processing, fraud detection</p>
                <p className="text-xs text-slate-600">Privacy: <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">https://stripe.com/privacy</a></p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-slate-800">Vercel (Hosting)</h4>
                <p className="text-slate-700 text-sm">Analytics, performance monitoring</p>
                <p className="text-xs text-slate-600">Privacy: <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">https://vercel.com/legal/privacy-policy</a></p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">5. How to Manage Cookies</h2>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">5.1 Cookie Consent Banner</h3>
            <p className="text-slate-700 leading-relaxed">
              When you first visit Lurnia, you'll see a cookie consent banner. You can choose to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700 mt-2">
              <li><strong>Accept All:</strong> Allow all cookies for the best experience</li>
              <li><strong>Reject Non-Essential:</strong> Only use strictly necessary cookies</li>
              <li><strong>Customize:</strong> Choose which types of cookies to allow</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">5.2 Browser Settings</h3>
            <p className="text-slate-700 leading-relaxed mb-4">
              You can control cookies through your browser settings:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies</li>
              <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies</li>
              <li><strong>Safari:</strong> Preferences → Privacy → Cookies</li>
              <li><strong>Edge:</strong> Settings → Cookies and site permissions</li>
            </ul>
            <p className="text-slate-700 leading-relaxed mt-4 text-sm">
              <strong>Note:</strong> Disabling strictly necessary cookies may prevent the Service from working properly.
            </p>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">5.3 Do Not Track (DNT)</h3>
            <p className="text-slate-700 leading-relaxed">
              Some browsers offer a "Do Not Track" signal. While we respect your privacy, DNT signals are not
              universally standardized, and we do not alter our behavior based on DNT headers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Opt-Out of Analytics</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              To opt out of Google Analytics:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>Install the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Analytics Opt-out Browser Add-on</a></li>
              <li>Or reject analytics cookies in our cookie consent banner</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Updates to This Policy</h2>
            <p className="text-slate-700 leading-relaxed">
              We may update this Cookie Policy to reflect changes in technology or legal requirements.
              Check this page periodically for updates. The "Last updated" date at the top indicates
              when changes were made.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">8. Contact Us</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              If you have questions about our use of cookies, please contact us:
            </p>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-slate-700"><strong>Email:</strong> <a href="mailto:privacy@lurnia.app" className="text-orange-600 hover:underline">privacy@lurnia.app</a></p>
              <p className="text-slate-700"><strong>Support:</strong> <a href="mailto:support@lurnia.app" className="text-orange-600 hover:underline">support@lurnia.app</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
