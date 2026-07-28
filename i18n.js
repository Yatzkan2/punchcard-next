import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en/translation.json'
import he from './locales/he/translation.json'

const instance = i18n.use(initReactI18next)

if (typeof window !== 'undefined') {
  instance.use(LanguageDetector)
}

instance.init({
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  fallbackLng: 'en',
  supportedLngs: ['en', 'he'],
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: 'i18n_lang',
  },
  interpolation: {
    escapeValue: false,
  },
})

function applyDir(lang) {
  if (typeof window !== 'undefined') {
    document.documentElement.lang = lang
    document.documentElement.dir  = lang === 'he' ? 'rtl' : 'ltr'
  }
}

i18n.on('languageChanged', applyDir)

if (typeof window !== 'undefined') {
  let storedLang = null
  try {
    storedLang = localStorage.getItem('i18n_lang')
  } catch {
    storedLang = null
  }

  // default to Hebrew if localStorage has no prior choice
  if (!storedLang) {
    i18n.changeLanguage('he')
  } else {
    applyDir(i18n.language)
  }
}

export default i18n
