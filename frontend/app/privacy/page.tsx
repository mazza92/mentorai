'use client'

import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'

export default function PrivacyPolicy() {
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
            <div className="p-3 bg-blue-100 rounded-xl">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900">Privacy Policy</h1>
          </div>
          <p className="text-slate-600">Last updated: December 5, 2025</p>
        </div>

        {/* Content */}
        <div className="prose prose-slate max-w-none bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Introduction</h2>
            <p className="text-slate-700 leading-relaxed">
              Welcome to Lurnia. We respect your privacy and are committed to protecting your personal data.
              This privacy policy explains how we collect, use, and safeguard your information when you use our service.
            </p>
            <p className="text-slate-700 leading-relaxed mt-4">
              Lurnia ("we", "our", or "us") operates lurnia.app (the "Service"), which allows users to import
              YouTube channels and interact with content through AI-powered Q&A.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Data Controller</h2>
            <p className="text-slate-700 leading-relaxed">
              The data controller responsible for your personal data is:
            </p>
            <div className="bg-slate-50 p-4 rounded-lg mt-4">
              <p className="text-slate-700"><strong>Company:</strong> Lurnia</p>
              <p className="text-slate-700"><strong>Email:</strong> privacy@lurnia.app</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Data We Collect</h2>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">3.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Account Information:</strong> Email address, password (encrypted)</li>
              <li><strong>Profile Information:</strong> Name (optional), language preference</li>
              <li><strong>Payment Information:</strong> Processed by Stripe (we do not store credit card details)</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">3.2 Usage Data</h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Channel Imports:</strong> YouTube channels you import, video metadata</li>
              <li><strong>Questions & Answers:</strong> Questions you ask and AI-generated responses</li>
              <li><strong>Usage Metrics:</strong> Number of channels imported, questions asked per month</li>
              <li><strong>Conversation History:</strong> Your Q&A interactions for context and history</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">3.3 Technical Data</h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Device Information:</strong> Browser type, operating system, screen resolution</li>
              <li><strong>Browser Fingerprint:</strong> For anonymous users to prevent abuse (VPN/cookie bypass detection)</li>
              <li><strong>IP Address:</strong> For security and fraud prevention</li>
              <li><strong>Cookies:</strong> Session cookies, preference cookies (see Cookie Policy)</li>
              <li><strong>Analytics:</strong> Page views, feature usage, error logs</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">4. How We Use Your Data</h2>
            <p className="text-slate-700 leading-relaxed mb-4">We use your data for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Service Delivery:</strong> To provide AI-powered Q&A on YouTube content</li>
              <li><strong>Account Management:</strong> To create and manage your account, authenticate users</li>
              <li><strong>Payment Processing:</strong> To process Pro tier subscriptions via Stripe</li>
              <li><strong>Usage Tracking:</strong> To enforce quota limits (channel imports, questions per month)</li>
              <li><strong>Service Improvement:</strong> To analyze usage patterns and improve our AI models</li>
              <li><strong>Security:</strong> To prevent fraud, abuse, and unauthorized access</li>
              <li><strong>Communication:</strong> To send service updates, quota notifications, and support responses</li>
              <li><strong>Legal Compliance:</strong> To comply with legal obligations and resolve disputes</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Legal Basis for Processing (GDPR)</h2>
            <p className="text-slate-700 leading-relaxed mb-4">Under GDPR, we process your data based on:</p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Contract Performance:</strong> Providing the service you signed up for</li>
              <li><strong>Legitimate Interest:</strong> Improving our service, preventing fraud</li>
              <li><strong>Consent:</strong> Marketing communications (if you opt in)</li>
              <li><strong>Legal Obligation:</strong> Complying with tax, accounting, and legal requirements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Data Sharing & Third Parties</h2>
            <p className="text-slate-700 leading-relaxed mb-4">We share data with the following third parties:</p>

            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-slate-800 mb-2">Google Services</h4>
              <ul className="list-disc pl-6 space-y-1 text-slate-700 text-sm">
                <li><strong>Firebase Authentication:</strong> Account creation and login</li>
                <li><strong>Google Cloud Firestore:</strong> Database storage</li>
                <li><strong>Google Gemini AI:</strong> AI-powered Q&A generation</li>
                <li><strong>YouTube API:</strong> Fetching channel and video data</li>
              </ul>
              <p className="text-xs text-slate-600 mt-2">Privacy Policy: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://policies.google.com/privacy</a></p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-slate-800 mb-2">Stripe</h4>
              <p className="text-slate-700 text-sm">Payment processing for Pro subscriptions. Stripe handles all payment data securely.</p>
              <p className="text-xs text-slate-600 mt-2">Privacy Policy: <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://stripe.com/privacy</a></p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-800 mb-2">Hosting & Infrastructure</h4>
              <p className="text-slate-700 text-sm">Railway.app (hosting), Vercel (frontend deployment)</p>
            </div>

            <p className="text-slate-700 leading-relaxed mt-4">
              <strong>We do not sell your personal data to third parties.</strong>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Account Data:</strong> Retained while your account is active</li>
              <li><strong>Conversation History:</strong> Retained for service functionality; you can delete anytime</li>
              <li><strong>Usage Logs:</strong> Retained for 90 days for analytics and debugging</li>
              <li><strong>Payment Records:</strong> Retained for 7 years for tax compliance</li>
              <li><strong>Anonymous Session Data:</strong> Deleted after 24 hours of inactivity</li>
            </ul>
            <p className="text-slate-700 leading-relaxed mt-4">
              When you delete your account, we delete all personal data within 30 days, except where
              retention is required by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">8. Your Rights (GDPR)</h2>
            <p className="text-slate-700 leading-relaxed mb-4">Under GDPR, you have the following rights:</p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Right to Access:</strong> Request a copy of your personal data</li>
              <li><strong>Right to Rectification:</strong> Correct inaccurate data</li>
              <li><strong>Right to Erasure:</strong> Delete your account and personal data</li>
              <li><strong>Right to Restrict Processing:</strong> Limit how we use your data</li>
              <li><strong>Right to Data Portability:</strong> Export your data in machine-readable format</li>
              <li><strong>Right to Object:</strong> Object to processing based on legitimate interest</li>
              <li><strong>Right to Withdraw Consent:</strong> Opt out of marketing communications</li>
            </ul>
            <p className="text-slate-700 leading-relaxed mt-4">
              To exercise your rights, contact us at <a href="mailto:privacy@lurnia.app" className="text-blue-600 hover:underline">privacy@lurnia.app</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">9. Data Security</h2>
            <p className="text-slate-700 leading-relaxed mb-4">We implement industry-standard security measures:</p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Encryption:</strong> HTTPS/TLS for data in transit, encrypted passwords</li>
              <li><strong>Access Controls:</strong> Role-based access, authentication required</li>
              <li><strong>Regular Backups:</strong> Automated daily backups of Firestore data</li>
              <li><strong>Monitoring:</strong> Error tracking, uptime monitoring, security alerts</li>
              <li><strong>Third-Party Security:</strong> All vendors (Google, Stripe) are SOC 2 / ISO 27001 certified</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">10. International Data Transfers</h2>
            <p className="text-slate-700 leading-relaxed">
              Your data may be processed in the United States and other countries where our service providers operate.
              We ensure adequate protection through:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700 mt-4">
              <li>Standard Contractual Clauses (EU-approved)</li>
              <li>Privacy Shield frameworks where applicable</li>
              <li>Vendor commitments to GDPR compliance</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">11. Children's Privacy</h2>
            <p className="text-slate-700 leading-relaxed">
              Lurnia is not intended for users under 16 years of age. We do not knowingly collect personal data
              from children. If you believe we have collected data from a child, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">12. Changes to This Policy</h2>
            <p className="text-slate-700 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes by
              email or through a notice on our Service. Your continued use of the Service after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">13. Contact Us</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              If you have questions about this Privacy Policy or how we handle your data, please contact us:
            </p>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-slate-700"><strong>Email:</strong> <a href="mailto:privacy@lurnia.app" className="text-blue-600 hover:underline">privacy@lurnia.app</a></p>
              <p className="text-slate-700"><strong>Support:</strong> <a href="mailto:support@lurnia.app" className="text-blue-600 hover:underline">support@lurnia.app</a></p>
            </div>
            <p className="text-slate-700 leading-relaxed mt-4">
              You also have the right to lodge a complaint with your local data protection authority if you believe
              we have not addressed your concerns adequately.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
