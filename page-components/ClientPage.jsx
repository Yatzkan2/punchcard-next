"use client"

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getClientByCode } from '../lib/clients'
import Spinner from '../components/shared/Spinner'
import LangToggle from '../components/shared/LangToggle'
import Topbar from '../components/shared/Topbar'
import Schedule from '../components/client/Schedule'
import { useSettings } from '../lib/SettingsContext'
import { logEvent } from '../lib/activityLog'

const CODE_LENGTH = 6

function statusFor(passes) {
  if (passes === 0) return { labelKey: 'client_view.status_empty', color: 'red' }
  if (passes <= 2)  return { labelKey: 'client_view.status_low',   color: 'amber' }
  return               { labelKey: 'client_view.status_active',  color: 'green' }
}

const palette = {
  green: {
    count:   'text-green-500',
    badge:   'bg-green-50 text-green-700 ring-1 ring-green-200',
    bar:     'bg-green-400',
    track:   'bg-green-100',
  },
  amber: {
    count:   'text-alert-amber',
    badge:   'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    bar:     'bg-amber-400',
    track:   'bg-amber-100',
  },
  red: {
    count:   'text-alert-red',
    badge:   'bg-red-50 text-red-700 ring-1 ring-red-200',
    bar:     'bg-red-400',
    track:   'bg-red-100',
  },
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

function LookupCard({ onFound }) {
  const { t } = useTranslation()
  const settings = useSettings()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(1), 300)
    const t2 = setTimeout(() => setVisible(2), 900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  function handleChange(e) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)
    setCode(val)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (code.length < CODE_LENGTH) {
      setError(t('client_view.error_incomplete_code'))
      inputRef.current?.focus()
      return
    }
    setLoading(true)
    setError('')
    try {
      const client = await getClientByCode(code)
      onFound(client)
    } catch {
      setError(t('client_view.no_active_found'))
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-app">
      <Topbar
        title={t('dashboard.brand')}
        subtitle={settings.studio_name || t('dashboard.studio')}
        langToggle={<LangToggle />}
      />
      <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className={`flex justify-center mb-8 transition-opacity duration-1000 ${visible >= 1 ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M9 12h6M12 9v6" />
            </svg>
          </div>
        </div>

        <div className={`bg-card rounded-2xl border border-gray-200 shadow-sm p-8 transition-opacity duration-1000 ${visible >= 2 ? 'opacity-100' : 'opacity-0'}`}>
          <h1 className="text-xl font-semibold text-gray-900 mb-1 text-center">{t('client_view.lookup_title')}</h1>
          <p className="text-sm text-gray-400 text-center mb-7">{t('client_view.lookup_subtitle')}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              value={code}
              onChange={handleChange}
              placeholder={t('client_view.lookup_placeholder')}
              maxLength={CODE_LENGTH}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full text-center font-mono text-2xl font-bold tracking-[0.35em] border border-gray-200 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-200 placeholder:tracking-[0.35em] uppercase"
            />

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.5zm0 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length < CODE_LENGTH}
              className="w-full bg-primary hover:bg-primary-hover active:bg-primary-active text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Spinner className="w-4 h-4" />
                  {t('client_view.looking_up')}
                </>
              ) : t('client_view.lookup_submit')}
            </button>
          </form>
        </div>
      </div>
      </div>
    </div>
  )
}

// ─── Result ───────────────────────────────────────────────────────────────────

function PassCard({ product_name, remaining }) {
  const { t } = useTranslation()
  const { labelKey, color } = statusFor(remaining)
  const c   = palette[color]
  const pct = Math.min(Math.round((remaining / 10) * 100), 100)

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{product_name}</p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>{t(labelKey)}</span>
        </div>
        <div className="flex items-end gap-3">
          <span className={`text-5xl font-black tabular-nums leading-none ${c.count}`}>
            {remaining}
          </span>
          <p className="text-sm text-gray-400 mb-1">
            {remaining === 1 ? t('client_view.pass_remaining_one') : t('client_view.pass_remaining_other')}
          </p>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className={`h-2 rounded-full ${c.track} overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
            style={{ width: remaining === 0 ? '0%' : `${Math.max(pct, 3)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-300">0</span>
          <span className="text-xs text-gray-300">10+</span>
        </div>
      </div>
    </div>
  )
}

function ResultCard({ client, onBack }) {
  const { t } = useTranslation()
  const { name, passes } = client
  const hasWarning = passes.some(p => p.remaining <= 2)
  const [visible, setVisible] = useState(0)
  const [tab,     setTab]     = useState('passes')

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(1), 200)
    const t2 = setTimeout(() => setVisible(2), 700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const tabBtn = active =>
    `flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
      active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
    }`

  return (
    <div className="min-h-screen bg-app px-4 py-8">
      <div className="w-full max-w-sm mx-auto space-y-3">

        {/* Header card: back + name + tabs */}
        <div className={`bg-card rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-opacity duration-1000 ${visible >= 1 ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-gray-50 border-b border-gray-100 px-6 py-4">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 rtl:scale-x-[-1]" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd"/>
              </svg>
              {t('client_view.check_another')}
            </button>
          </div>

          <div className="px-6 pt-5 pb-4 text-center">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">{t('client_view.welcome_back')}</p>
            <h2 className="text-2xl font-bold text-gray-900">{name}</h2>
          </div>

          {/* Tab toggle */}
          <div className="px-4 pb-4">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button className={tabBtn(tab === 'passes')}   onClick={() => setTab('passes')}>
                {t('client_view.tab_passes')}
              </button>
              <button className={tabBtn(tab === 'schedule')} onClick={() => setTab('schedule')}>
                {t('client_view.tab_schedule')}
              </button>
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div className={`transition-opacity duration-1000 ${visible >= 2 ? 'opacity-100' : 'opacity-0'}`}>
          {tab === 'passes' ? (
            <div className="bg-card rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-4 space-y-3">
                {passes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">{t('client_view.no_passes')}</p>
                ) : (
                  [...passes].sort((a, b) => (b.remaining === 0) - (a.remaining === 0) || a.remaining - b.remaining).map(p => (
                    <PassCard key={p.product_name} product_name={p.product_name} remaining={p.remaining} />
                  ))
                )}
              </div>
              {hasWarning && (
                <div className="border-t border-amber-100 bg-amber-50 px-6 py-4 text-center">
                  <p className="text-sm font-medium text-amber-700">{t('client_view.low_warning')}</p>
                </div>
              )}
            </div>
          ) : (
            <Schedule clientId={client.id} clientName={client.name} />
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'studio_client'
const SEVEN_DAYS  = 7 * 24 * 60 * 60 * 1000

function readStoredClient(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStoredClient(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // iOS Safari private mode, quota exceeded, etc. — ignore
  }
}

function clearStoredClient(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // iOS Safari private mode, quota exceeded, etc. — ignore
  }
}

export default function ClientPage() {
  const [client,      setClient]      = useState(null)
  const [autoLoading, setAutoLoading] = useState(true)

  useEffect(() => {
    async function tryAutoLookup() {
      try {
        const raw = readStoredClient(STORAGE_KEY)
        if (!raw) return
        const { code, lastSeen } = JSON.parse(raw)
        if (Date.now() - lastSeen >= SEVEN_DAYS) {
          clearStoredClient(STORAGE_KEY)
          return
        }
        writeStoredClient(STORAGE_KEY, JSON.stringify({ code, lastSeen: Date.now() }))
        const result = await getClientByCode(code)
        logEvent({ eventType: 'client_login', actor: 'client', clientName: result.name })
        setClient(result)
      } catch {
        clearStoredClient(STORAGE_KEY)
      } finally {
        setAutoLoading(false)
      }
    }
    tryAutoLookup()
  }, [])

  function handleFound(result) {
    writeStoredClient(STORAGE_KEY, JSON.stringify({ code: result.code, lastSeen: Date.now() }))
    logEvent({ eventType: 'client_login', actor: 'client', clientName: result.name })
    setClient(result)
  }

  function handleBack() {
    clearStoredClient(STORAGE_KEY)
    setClient(null)
  }

  if (autoLoading) return null

  if (client) {
    return <ResultCard client={client} onBack={handleBack} />
  }
  return <LookupCard onFound={handleFound} />
}
