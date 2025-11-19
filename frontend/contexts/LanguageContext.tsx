'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n'

interface LanguageContextType {
  language: string
  setLanguage: (lang: string) => void
  t: (key: string, options?: any) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation('common')
  const [language, setLanguageState] = useState<string>('en')

  useEffect(() => {
    // Set initial language from i18n
    setLanguageState(i18n.language)
  }, [i18n.language])

  const setLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('wandermind_language', lang)
    setLanguageState(lang)
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
