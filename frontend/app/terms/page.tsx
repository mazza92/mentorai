'use client'

import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'

export default function TermsOfService() {
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
            <div className="p-3 bg-purple-100 rounded-xl">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900">Terms of Service</h1>
          </div>
          <p className="text-slate-600">Last updated: December 5, 2025</p>
        </div>

        {/* Content */}
        <div className="prose prose-slate max-w-none bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-slate-700 leading-relaxed">
              By accessing or using Lurnia ("Service"), you agree to be bound by these Terms of Service ("Terms").
              If you do not agree to these Terms, you may not use the Service.
            </p>
            <p className="text-slate-700 leading-relaxed mt-4">
              These Terms apply to all users of the Service, including anonymous users, free tier users, and
              Pro subscribers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Description of Service</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              Lurnia is a SaaS platform that allows users to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>Import YouTube channels and video content</li>
              <li>Ask questions about video content using AI-powered Q&A</li>
              <li>Receive AI-generated responses with citations to specific video timestamps</li>
              <li>Save conversation history for future reference</li>
            </ul>
            <p className="text-slate-700 leading-relaxed mt-4">
              The Service uses Google Gemini AI to analyze video transcripts and generate responses.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">3. User Accounts</h2>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">3.1 Account Creation</h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>You must provide accurate and complete information when creating an account</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>You must be at least 16 years old to create an account</li>
              <li>One person or legal entity may maintain only one free account</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">3.2 Anonymous Access</h3>
            <p className="text-slate-700 leading-relaxed">
              Anonymous users can try the Service with limited access (1 channel import, 1 question).
              Anonymous sessions expire after 24 hours of inactivity.
            </p>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">3.3 Account Termination</h3>
            <p className="text-slate-700 leading-relaxed">
              We reserve the right to suspend or terminate accounts that violate these Terms, engage in
              fraudulent activity, or abuse the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Subscription Tiers & Pricing</h2>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">4.1 Free Tier</h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>2 channel imports per month</li>
              <li>10 questions per month</li>
              <li>Conversation history saved</li>
              <li>On-demand transcript fetching</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">4.2 Pro Tier</h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>€24.99 per month (billed monthly)</li>
              <li>15 channel imports per month</li>
              <li>500 questions per month</li>
              <li>Priority support</li>
              <li>Export transcripts</li>
              <li>Early access to new features</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">4.3 Billing</h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>Pro subscriptions renew automatically each month</li>
              <li>You can cancel at any time; no refunds for partial months</li>
              <li>Quota resets on the 1st of each month</li>
              <li>Payment processing is handled securely by Stripe</li>
              <li>We reserve the right to change pricing with 30 days notice</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Acceptable Use Policy</h2>
            <p className="text-slate-700 leading-relaxed mb-4">You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Abuse the Service:</strong> No scraping, automated access, or circumventing quota limits</li>
              <li><strong>Violate Copyright:</strong> Only import YouTube channels you have the right to access</li>
              <li><strong>Harmful Content:</strong> No illegal, harmful, or offensive content</li>
              <li><strong>Reverse Engineering:</strong> No attempting to access source code or underlying technology</li>
              <li><strong>Security Violations:</strong> No hacking, phishing, or exploiting vulnerabilities</li>
              <li><strong>Reselling:</strong> No reselling or sublicensing the Service without written permission</li>
              <li><strong>Multiple Accounts:</strong> No creating multiple free accounts to bypass quota limits</li>
            </ul>
            <p className="text-slate-700 leading-relaxed mt-4">
              Violation of this policy may result in immediate account termination without refund.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Intellectual Property</h2>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">6.1 Our IP</h3>
            <p className="text-slate-700 leading-relaxed">
              All rights, title, and interest in the Service (including software, design, trademarks, and content)
              belong to Lurnia. You may not copy, modify, or create derivative works.
            </p>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">6.2 Your Content</h3>
            <p className="text-slate-700 leading-relaxed">
              You retain ownership of:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>Questions you ask</li>
              <li>Conversation history</li>
              <li>Channel selections</li>
            </ul>
            <p className="text-slate-700 leading-relaxed mt-4">
              By using the Service, you grant us a limited license to process your content to provide the Service
              (e.g., generate AI responses, store conversation history).
            </p>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">6.3 YouTube Content</h3>
            <p className="text-slate-700 leading-relaxed">
              Video transcripts and metadata are sourced from YouTube. You must comply with YouTube's Terms of Service.
              We do not claim ownership of YouTube content.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">7. AI-Generated Content Disclaimer</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              <strong>Important:</strong> AI-generated responses are provided for informational purposes only.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>AI responses may contain errors or inaccuracies</li>
              <li>Always verify critical information from original sources</li>
              <li>We do not guarantee the accuracy, completeness, or reliability of AI responses</li>
              <li>AI responses are not professional advice (legal, medical, financial, etc.)</li>
              <li>Use of AI responses is at your own risk</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">8. Service Availability</h2>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>We strive for 99.9% uptime but do not guarantee uninterrupted service</li>
              <li>Scheduled maintenance will be announced in advance</li>
              <li>We may temporarily suspend the Service for security, maintenance, or legal reasons</li>
              <li>Third-party dependencies (Google APIs, YouTube) may cause service disruptions</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">9. Data Privacy</h2>
            <p className="text-slate-700 leading-relaxed">
              Your use of the Service is also governed by our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>,
              which explains how we collect, use, and protect your data. By using the Service, you consent to our
              data practices as described in the Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">10. Limitation of Liability</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>The Service is provided "AS IS" without warranties of any kind</li>
              <li>We are not liable for indirect, incidental, or consequential damages</li>
              <li>Our total liability shall not exceed the amount you paid in the last 12 months</li>
              <li>We are not responsible for third-party services (YouTube, Google, Stripe)</li>
              <li>Some jurisdictions do not allow these limitations, so they may not apply to you</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">11. Indemnification</h2>
            <p className="text-slate-700 leading-relaxed">
              You agree to indemnify and hold harmless Lurnia from any claims, damages, or expenses arising from:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>Your violation of these Terms</li>
              <li>Your violation of any law or third-party rights</li>
              <li>Your use of the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">12. Changes to Terms</h2>
            <p className="text-slate-700 leading-relaxed">
              We may update these Terms from time to time. We will notify you of material changes by email or
              through a notice on the Service. Your continued use after changes constitutes acceptance of the
              updated Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">13. Termination</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              <strong>You may terminate:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>Cancel your subscription anytime from account settings</li>
              <li>Delete your account and all data</li>
            </ul>
            <p className="text-slate-700 leading-relaxed mb-4 mt-4">
              <strong>We may terminate:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>For violation of these Terms</li>
              <li>For fraudulent or abusive behavior</li>
              <li>If required by law</li>
            </ul>
            <p className="text-slate-700 leading-relaxed mt-4">
              Upon termination, your access will cease immediately. Pro subscriptions are non-refundable for
              partial months.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">14. Governing Law & Disputes</h2>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>These Terms are governed by the laws of France</li>
              <li>Any disputes shall be resolved in the courts of France</li>
              <li>For EU consumers: You retain the right to bring claims in your country of residence</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">15. Severability</h2>
            <p className="text-slate-700 leading-relaxed">
              If any provision of these Terms is found to be unenforceable, the remaining provisions will
              continue in full effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">16. Contact Us</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              If you have questions about these Terms, please contact us:
            </p>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-slate-700"><strong>Email:</strong> <a href="mailto:team@lurnia.app" className="text-purple-600 hover:underline">team@lurnia.app</a></p>
              <p className="text-slate-700"><strong>Website:</strong> <a href="https://lurnia.app" className="text-purple-600 hover:underline">lurnia.app</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
