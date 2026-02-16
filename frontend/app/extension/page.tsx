'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { Chrome, Star, Users, Zap, MessageSquare, Clock, Download, ArrowRight, CheckCircle2, Play, Sparkles } from 'lucide-react'

export default function ExtensionPage() {
  const { t } = useTranslation('common')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const features = [
    {
      icon: MessageSquare,
      title: 'Ask Any Question',
      description: 'Get instant AI answers about any YouTube video content'
    },
    {
      icon: Clock,
      title: 'Clickable Timestamps',
      description: 'Jump directly to the exact moment in the video'
    },
    {
      icon: Zap,
      title: 'Works Instantly',
      description: 'No setup needed - just click and ask on any YouTube video'
    },
    {
      icon: Sparkles,
      title: 'Multi-Language',
      description: 'Ask in any language, get answers in your preferred language'
    }
  ]

  const steps = [
    {
      number: '1',
      title: 'Install Extension',
      description: 'Add Lurnia to Chrome in one click'
    },
    {
      number: '2',
      title: 'Open YouTube',
      description: 'Navigate to any YouTube video'
    },
    {
      number: '3',
      title: 'Click & Ask',
      description: 'Click the Lurnia icon and ask your question'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-xl text-slate-900">Lurnia</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/pricing" className="text-slate-600 hover:text-slate-900 font-medium text-sm">
                Pricing
              </Link>
              <Link href="/" className="text-slate-600 hover:text-slate-900 font-medium text-sm">
                Web App
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <Chrome className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Chrome Extension</span>
          </div>

          {/* Headline */}
          <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6 transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            Ask questions about
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              any YouTube video
            </span>
          </h1>

          {/* Subtitle */}
          <p className={`text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            Get instant AI-powered answers with clickable timestamps.
            Learn faster from educational videos, tutorials, and lectures.
          </p>

          {/* CTA Buttons */}
          <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <a
              href="https://chromewebstore.google.com/detail/lurnia-youtube-learning-c/fggidhdboaodfblhdigckdfcofimocim"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl font-semibold text-lg shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/30 transition-all hover:scale-105"
            >
              <Chrome className="w-6 h-6" />
              <span>Install for Free</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <Link
              href="/"
              className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-semibold text-lg border-2 border-slate-200 hover:border-slate-300 transition-all"
            >
              <Play className="w-5 h-5" />
              <span>Try Web App</span>
            </Link>
          </div>

          {/* Trust Signals */}
          <div className={`flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm transition-all duration-700 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <span className="text-slate-600 font-medium">5.0 Rating</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Users className="w-4 h-4" />
              <span className="font-medium">Active Users</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="font-medium">Free plan available</span>
            </div>
          </div>
        </div>
      </section>

      {/* Preview Section */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className={`max-w-5xl mx-auto transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-200/50">
            {/* Browser Chrome */}
            <div className="bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-3 flex items-center gap-3 border-b border-slate-200">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="bg-white rounded-lg px-4 py-1.5 text-sm text-slate-500 border border-slate-200 flex items-center gap-2 max-w-md w-full">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M2 12h20"></path>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                  youtube.com/watch?v=...
                </div>
              </div>
            </div>
            {/* Screenshot/Demo */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 aspect-video flex items-center justify-center relative">
              <div className="absolute inset-0 bg-[url('/extension-demo.png')] bg-cover bg-center opacity-90"></div>
              {/* Fallback content if no image */}
              <div className="relative z-10 text-center p-8">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm mx-auto">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Lurnia</div>
                      <div className="text-xs text-green-600 flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        Ready to answer questions
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-100 rounded-xl p-3 mb-3">
                    <div className="text-sm text-slate-600">What are the main points of this video?</div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-3 text-left">
                    <div className="text-sm text-slate-700 mb-2">The video covers 3 main topics:</div>
                    <div className="text-sm text-slate-600">1. Introduction at <span className="text-blue-600 font-medium cursor-pointer hover:underline">0:45</span></div>
                    <div className="text-sm text-slate-600">2. Key concept at <span className="text-blue-600 font-medium cursor-pointer hover:underline">3:22</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Everything you need to learn faster
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Turn any YouTube video into an interactive learning experience
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 rounded-2xl bg-slate-50 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 border border-slate-100 hover:border-blue-200 transition-all hover:shadow-lg"
              >
                <div className="w-12 h-12 rounded-xl bg-white group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-purple-500 flex items-center justify-center mb-4 shadow-sm group-hover:shadow-lg transition-all">
                  <feature.icon className="w-6 h-6 text-slate-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Start learning in seconds
            </h2>
            <p className="text-lg text-slate-600">
              No account required to get started
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white shadow-lg shadow-blue-500/25">
                  {step.number}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div className="text-center mt-16">
            <a
              href="https://chromewebstore.google.com/detail/lurnia-youtube-learning-c/fggidhdboaodfblhdigckdfcofimocim"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl font-semibold text-lg shadow-xl shadow-blue-500/25 hover:shadow-2xl transition-all hover:scale-105"
            >
              <Download className="w-5 h-5" />
              <span>Add to Chrome - It's Free</span>
            </a>
            <p className="text-sm text-slate-500 mt-4">
              Works on Chrome, Edge, Brave, and other Chromium browsers
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-slate-900">Lurnia</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-600">
            <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
            <Link href="/privacy-extension" className="hover:text-slate-900">Extension Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
