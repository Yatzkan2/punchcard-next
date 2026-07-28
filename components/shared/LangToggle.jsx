"use client"

import { useTranslation } from 'react-i18next'

export default function LangToggle({ className = '' }) {
  const { i18n } = useTranslation()
  const isHe = i18n.language === 'he'

  function toggle() {
    i18n.changeLanguage(isHe ? 'en' : 'he')
  }

  return (
    <button
      onClick={toggle}
      className={`text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors ${className}`}
    >
      {isHe ? 'EN' : 'עב'}
    </button>
  )
}
