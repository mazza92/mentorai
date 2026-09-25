'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ValueSearch from '@/components/ValueSearch'
import WanderMindViewer from '@/components/WanderMindViewer'
import ModernHeader from '@/components/ModernHeader'
import SearchHeader from '@/components/SearchHeader'
import ChromeExtensionInvite from '@/components/ChromeExtensionInvite'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { Loader2, Search, ListChecks, MessageSquare } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { Conversation } from '@/lib/conversationStorage'
import { getSessionId, setUserId as setSessionUserId } from '@/lib/sessionManager'
import { trackLandingPageView, initScrollTracking, resetScrollTracking, getUTMParams } from '@/lib/analytics'

export default function Home() {
  const { t } = useTranslation('common')
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [currentProject, setCurrentProject] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('anonymous')
  const [isInitialized, setIsInitialized] = useState(false)
  const [initialTimestamp, setInitialTimestamp] = useState<number | null>(null)
  const [initialQuestion, setInitialQuestion] = useState<string | null>(null)

  const checkUrlAndSetProject = (effectiveUserId?: string) => {
    if (typeof window === 'undefined') return

    const urlParams = new URLSearchParams(window.location.search)
    const projectParam = urlParams.get('project')
    const timestampParam = urlParams.get('t')
    const questionParam = urlParams.get('question')

    if (timestampParam) {
      const timestamp = parseInt(timestampParam, 10)
      if (!isNaN(timestamp) && timestamp > 0) {
        setInitialTimestamp(timestamp)
      }
    }

    if (questionParam) {
      setInitialQuestion(decodeURIComponent(questionParam))
    }

    if (projectParam) {
      if (currentProject !== projectParam) {
        setCurrentProject(projectParam)
        const storageKey = effectiveUserId && effectiveUserId !== 'anonymous'
          ? `currentProject_${effectiveUserId}`
          : (user ? `currentProject_${user.id}` : 'currentProject')
        localStorage.setItem(storageKey, projectParam)
        sessionStorage.removeItem('isUploadingVideo')
      }
      return true
    }
    return false
  }

  useEffect(() => {
    if (!currentProject) {
      trackLandingPageView()
      initScrollTracking()
      getUTMParams()
    }
    return () => {
      resetScrollTracking()
    }
  }, [currentProject])

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    if (!supabaseUrl || !supabaseAnonKey) {
      const sessionId = getSessionId()
      setUserId(sessionId)
      if (checkUrlAndSetProject(sessionId)) {
        setIsInitialized(true)
        return
      }
      setIsInitialized(true)
      return
    }

    if (!authLoading) {
      if (user) {
        setSessionUserId(user.id)
        setUserId(user.id)
      } else {
        setUserId(getSessionId())
      }
    }

    if (user) {
      setSessionUserId(user.id)
      setUserId(user.id)
      if (checkUrlAndSetProject(user.id)) {
        setIsInitialized(true)
        return
      }
    }

    setIsInitialized(true)
  }, [user, authLoading, router])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search)
      const projectParam = urlParams.get('project')

      if (projectParam && currentProject !== projectParam) {
        setCurrentProject(projectParam)
      } else if (!projectParam && currentProject) {
        setCurrentProject(null)
      }
    }

    window.addEventListener('popstate', handleUrlChange)
    return () => window.removeEventListener('popstate', handleUrlChange)
  }, [user, userId, currentProject])

  const handleNewProject = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('isUploadingVideo')
      window.history.pushState({}, '', '/')
    }
    setCurrentProject(null)
  }

  const handleSelectConversation = (conversation: Conversation) => {
    const newUrl = `/?project=${conversation.projectId}`
    window.history.pushState({ projectId: conversation.projectId }, '', newUrl)
    sessionStorage.removeItem('isUploadingVideo')
    setCurrentProject(conversation.projectId)
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-violet-50/40">
        <SearchHeader />
        <ChromeExtensionInvite />
        <main>
          <section className="relative mx-auto max-w-3xl px-4 pb-10 pt-16 sm:px-6 sm:pt-24">
            <div className="pointer-events-none absolute inset-x-0 -top-8 h-64 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.18),_transparent_60%)]" />
            <p className="relative text-center text-sm font-semibold uppercase tracking-wide text-violet-600">
              {t('landing.badge')}
            </p>
            <h1 className="relative mt-3 text-center text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
              {t('landing.hero_title')}
              <span className="mt-2 block bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                {t('landing.hero_accent')}
              </span>
            </h1>
            <p className="relative mx-auto mt-4 max-w-2xl text-center text-lg text-slate-600">
              {t('landing.hero_subtitle')}
            </p>
            <div className="relative mt-8">
              <ValueSearch
                userId={userId}
                autoFocus={false}
                placeholder={t('landing.search_placeholder')}
                rankHint={t('landing.rank_hint')}
                searchLabel={t('landing.search_button')}
                includeShortsLabel={t('landing.include_shorts')}
                starters={t('landing.starters', { returnObjects: true }) as string[]}
              />
              <p className="mt-4 text-center text-sm text-slate-500">
                <Link href="/learn" className="font-medium text-indigo-600 hover:text-violet-700">
                  {t('landing.topics_link')}
                </Link>
              </p>
            </div>
          </section>

          <section id="how" className="border-t border-indigo-50 bg-white/70 py-16">
            <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:grid-cols-3 sm:px-6">
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Search className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-bold text-slate-900">{t('landing.step1_title')}</h2>
                <p className="mt-2 text-sm text-slate-600">{t('landing.step1_desc')}</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white">
                  <ListChecks className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-bold text-slate-900">{t('landing.step2_title')}</h2>
                <p className="mt-2 text-sm text-slate-600">{t('landing.step2_desc')}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-bold text-slate-900">{t('landing.step3_title')}</h2>
                <p className="mt-2 text-sm text-slate-600">{t('landing.step3_desc')}</p>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-extrabold text-slate-900">{t('landing.faq_title')}</h2>
            <dl className="mt-6 space-y-4">
              {[5, 1, 2, 3, 4].map((n) => (
                <div key={n} className="rounded-2xl border border-indigo-50 bg-white p-5">
                  <dt className="font-semibold text-slate-900">{t(`landing.faq${n}_q`)}</dt>
                  <dd className="mt-2 text-sm leading-6 text-slate-600">{t(`landing.faq${n}_a`)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </main>
        <Footer />
      </div>
    )
  }

  if (!isInitialized || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      <ModernHeader
        onNewProject={handleNewProject}
        userId={userId}
        currentProjectId={currentProject}
        onSelectConversation={handleSelectConversation}
      />
      <div className="flex-1 overflow-hidden">
        <WanderMindViewer
          projectId={currentProject}
          userId={userId}
          onNewConversation={handleNewProject}
          initialTimestamp={initialTimestamp}
          initialQuestion={initialQuestion}
        />
      </div>
    </div>
  )
}
