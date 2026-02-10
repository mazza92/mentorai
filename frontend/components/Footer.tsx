'use client'

import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { Mail, FileText, Shield, Cookie, Chrome } from 'lucide-react'

export default function Footer() {
  const { t } = useTranslation('common')
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
              </div>
              <span className="text-xl font-bold text-white">Lurnia</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Transform YouTube channels into searchable knowledge bases with AI-powered Q&A.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/guides" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {t('header.guides')}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/#features" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/ressources" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Resources & Blog
                </Link>
              </li>
              <li>
                <a href="mailto:team@lurnia.app" className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Support
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-2">
                  <Cookie className="w-4 h-4" />
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link href="/privacy-extension" className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-2">
                  <Chrome className="w-4 h-4" />
                  Extension Privacy
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-3">
              <li>
                <a href="mailto:team@lurnia.app" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="mailto:team@lurnia.app" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Customer Support
                </a>
              </li>
              <li>
                <a href="mailto:team@lurnia.app" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Legal Inquiries
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">
              © {currentYear} Lurnia. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <button
                onClick={() => {
                  localStorage.removeItem('cookie-consent')
                  window.location.reload()
                }}
                className="hover:text-white transition-colors"
              >
                Cookie Settings
              </button>
              <span>•</span>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <span>•</span>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
