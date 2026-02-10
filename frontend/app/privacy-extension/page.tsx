'use client'

import Link from 'next/link'
import { ArrowLeft, Shield, Chrome } from 'lucide-react'

export default function ExtensionPrivacyPolicy() {
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
            <div className="p-3 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl">
              <Chrome className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900">Lurnia Chrome Extension Privacy Policy</h1>
          </div>
          <p className="text-slate-600">Last updated: February 10, 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-slate max-w-none bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Introduction</h2>
            <p className="text-slate-700 leading-relaxed">
              This Privacy Policy explains how the Lurnia Chrome Extension ("Extension", "we", "our") collects, uses, and protects your information.
              Lurnia is an AI-powered learning companion that enhances video comprehension through real-time Q&A and timestamp-linked insights.
            </p>
            <p className="text-slate-700 leading-relaxed mt-4">
              <strong>Note:</strong> Lurnia is not affiliated with YouTube or Google. This extension operates independently to provide educational assistance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Data We Collect</h2>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Google Account (Optional):</strong> If you sign in, we receive your email, name, and profile picture from Google OAuth</li>
              <li><strong>Questions:</strong> Questions you ask about YouTube videos through the extension</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">2.2 Automatically Collected Data</h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Video Metadata:</strong> Title, channel name, and video ID of YouTube videos you interact with</li>
              <li><strong>Transcript Data:</strong> Video transcripts are processed to enable Q&A functionality</li>
              <li><strong>Usage Statistics:</strong> Number of questions asked (for quota management)</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">2.3 Data We Do NOT Collect</h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>Browsing history outside of YouTube</li>
              <li>Personal files or documents</li>
              <li>Passwords or financial information</li>
              <li>YouTube watch history or recommendations</li>
              <li>Cookies from other websites</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Extension Permissions Explained</h2>
            <p className="text-slate-700 leading-relaxed mb-4">The extension requests the following permissions:</p>

            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-slate-800 mb-2">activeTab</h4>
              <p className="text-slate-700 text-sm">Allows the extension to access the current YouTube tab only when you click the extension icon. This is required to detect the video being watched.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-slate-800 mb-2">storage</h4>
              <p className="text-slate-700 text-sm">Stores your authentication token, preferences, and chat history locally in your browser. Data syncs across your Chrome browsers if signed into Chrome.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-slate-800 mb-2">scripting</h4>
              <p className="text-slate-700 text-sm">Injects the Lurnia learning sidebar into YouTube pages so you can interact with video content.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-slate-800 mb-2">identity</h4>
              <p className="text-slate-700 text-sm">Enables secure Google Sign-In through Chrome's built-in authentication system.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-800 mb-2">Host Permissions (youtube.com)</h4>
              <p className="text-slate-700 text-sm">Required to detect video information and inject the learning sidebar. The extension only activates on YouTube domains.</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">4. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Q&A Generation:</strong> Your questions and video transcripts are processed by our AI to provide accurate answers</li>
              <li><strong>Authentication:</strong> To identify you and manage your subscription</li>
              <li><strong>Quota Management:</strong> To track usage against your plan limits</li>
              <li><strong>Service Improvement:</strong> Aggregated, anonymized usage patterns help us improve the service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Data Sharing</h2>
            <p className="text-slate-700 leading-relaxed mb-4">We share data with the following services:</p>

            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-slate-800 mb-2">Google Gemini AI</h4>
              <p className="text-slate-700 text-sm">Video transcripts and your questions are sent to Google's Gemini AI to generate answers. Google processes this data according to their AI terms of service.</p>
              <p className="text-xs text-slate-600 mt-2">Privacy Policy: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://policies.google.com/privacy</a></p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-slate-800 mb-2">Firebase (Authentication)</h4>
              <p className="text-slate-700 text-sm">If you sign in, your authentication is handled by Firebase. Firebase stores your email and profile for account management.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-800 mb-2">Lurnia Backend</h4>
              <p className="text-slate-700 text-sm">Our secure backend (hosted on Railway) processes Q&A requests and stores conversation history.</p>
            </div>

            <p className="text-slate-700 leading-relaxed mt-4">
              <strong>We do not sell your personal data to third parties.</strong>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Data Storage & Retention</h2>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Local Storage:</strong> Chat history and preferences are stored in Chrome's local storage on your device</li>
              <li><strong>Server Storage:</strong> If signed in, conversation history is stored on our secure servers</li>
              <li><strong>Retention Period:</strong> Data is retained while your account is active. You can delete your data anytime by signing out or uninstalling the extension</li>
              <li><strong>Anonymous Usage:</strong> If not signed in, session data is deleted when you close the browser</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Data Security</h2>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>HTTPS Only:</strong> All communication with our servers uses encrypted HTTPS connections</li>
              <li><strong>Secure Authentication:</strong> We use Chrome's built-in identity API for secure Google Sign-In</li>
              <li><strong>No Remote Code:</strong> The extension does not execute any remote code; all logic is bundled in the extension package</li>
              <li><strong>Manifest V3:</strong> Built on Chrome's latest, most secure extension platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">8. Your Rights</h2>
            <p className="text-slate-700 leading-relaxed mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Access:</strong> Request a copy of your data by contacting us</li>
              <li><strong>Delete:</strong> Remove all your data by signing out and uninstalling the extension</li>
              <li><strong>Export:</strong> Export your chat history as PDF using the extension's export feature</li>
              <li><strong>Opt Out:</strong> Use the extension without signing in for anonymous, session-based usage</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">9. Children's Privacy</h2>
            <p className="text-slate-700 leading-relaxed">
              The Lurnia extension is intended for users aged 13 and older. We do not knowingly collect personal information from children under 13.
              If you believe we have collected data from a child under 13, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">10. Changes to This Policy</h2>
            <p className="text-slate-700 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes through the extension or by email if you have an account.
              Continued use of the extension after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">11. Contact Us</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              If you have questions about this Privacy Policy or your data, please contact us:
            </p>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-slate-700"><strong>Email:</strong> <a href="mailto:team@lurnia.app" className="text-blue-600 hover:underline">team@lurnia.app</a></p>
              <p className="text-slate-700"><strong>Website:</strong> <a href="https://lurnia.app" className="text-blue-600 hover:underline">lurnia.app</a></p>
              <p className="text-slate-700"><strong>Main Privacy Policy:</strong> <a href="/privacy" className="text-blue-600 hover:underline">lurnia.app/privacy</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
