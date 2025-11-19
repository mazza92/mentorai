import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from '@/public/locales/en/common.json'
import frCommon from '@/public/locales/fr/common.json'

// Detect browser language
const getBrowserLanguage = (): string => {
  if (typeof window === 'undefined') return 'en'

  const browserLang = navigator.language.split('-')[0] // Get 'fr' from 'fr-FR'
  return ['en', 'fr'].includes(browserLang) ? browserLang : 'en'
}

// Get saved language preference or browser language
const getInitialLanguage = (): string => {
  if (typeof window === 'undefined') return 'en'

  const savedLang = localStorage.getItem('wandermind_language')
  return savedLang || getBrowserLanguage()
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
      },
      fr: {
        common: frCommon,
      },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  })

export default i18n
