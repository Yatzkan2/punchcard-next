"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import LangToggle from '../components/shared/LangToggle'
import Topbar from '../components/shared/Topbar'
import { useSettings } from '../lib/SettingsContext'

export default function HomePage() {
  const { t } = useTranslation()
  const settings = useSettings()
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(1), 300)
    const t2 = setTimeout(() => setVisible(2), 1100)
    const t3 = setTimeout(() => setVisible(3), 1900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div className="min-h-screen bg-app flex flex-col">
      <Topbar
        title={t('dashboard.brand')}
        subtitle={settings.studio_name || t('dashboard.studio')}
        langToggle={<LangToggle />}
      />
      <div className="flex-1 flex flex-col items-center justify-center gap-2 relative">
        <h1 className={`text-2xl font-semibold text-gray-900 transition-opacity duration-1000 ${visible >= 1 ? 'opacity-100' : 'opacity-0'}`}>
          {t('home.welcome', { studio: settings.studio_name || t('dashboard.studio') })}
        </h1>
        <p className={`text-sm text-gray-500 transition-opacity duration-1000 ${visible >= 2 ? 'opacity-100' : 'opacity-0'}`}>
          {t('home.tagline')}
        </p>
        <div className={`mt-8 transition-opacity duration-1000 ${visible >= 3 ? 'opacity-100' : 'opacity-0'}`}>
          <Link
            href="/client"
            className="bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-lg font-semibold px-10 py-4 rounded-2xl shadow-sm transition-colors"
          >
            {t('home.cta')}
          </Link>
        </div>
        <Link
          href="/admin"
          className="absolute bottom-3 ltr:right-3 rtl:left-3 text-[10px] text-gray-400 hover:text-gray-600 transition-colors select-none"
          tabIndex={-1}
        >
          admin
        </Link>
      </div>
    </div>
  )
}
