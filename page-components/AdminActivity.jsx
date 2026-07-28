"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import supabase from '../supabase'
import { getActivityLog } from '../lib/activityLog'
import { useSettings } from '../lib/SettingsContext'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import LangToggle from '../components/shared/LangToggle'
import Topbar from '../components/shared/Topbar'
import Spinner from '../components/shared/Spinner'

const LIMIT = 50

const KNOWN_EVENT_TYPES = [
  'client_login',
  'class_registered',
  'class_cancelled',
  'pass_punched',
  'pass_refilled',
  'client_removed',
  'slot_deleted',
  'debt_created',
  'debt_settled',
  'pass_adjusted',
  'client_deactivated',
  'client_reactivated',
]

const DOT_COLOR = {
  client_login:       'bg-green-400',
  class_registered:   'bg-primary',
  class_cancelled:    'bg-amber-400',
  pass_punched:       'bg-purple-400',
  pass_refilled:      'bg-teal-400',
  client_removed:     'bg-red-400',
  slot_deleted:       'bg-orange-400',
  debt_created:       'bg-rose-500',
  debt_settled:       'bg-teal-500',
  pass_adjusted:      'bg-slate-500',
  client_deactivated: 'bg-amber-500',
  client_reactivated: 'bg-green-500',
}

function relativeTime(dateStr, t) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('activity.just_now')
  if (mins < 60) return t('activity.minutes_ago', { n: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('activity.hours_ago', { n: hrs })
  return t('activity.days_ago', { n: Math.floor(hrs / 24) })
}

function shortDate(dateStr, locale, t) {
  const d = new Date(dateStr)
  const timePart = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today))     return `${t('activity.today')} ${timePart}`
  if (sameDay(d, yesterday)) return `${t('activity.yesterday')} ${timePart}`
  const datePart = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
  return `${datePart}, ${timePart}`
}

function buildParams(entry) {
  const m = entry.metadata ?? {}
  return {
    name:     entry.client_name ?? '—',
    activity: m.activity      ?? '—',
    product:  m.product_name  ?? '—',
    date:     m.slot_date     ?? '—',
    time:     m.slot_time     ?? '—',
    eventType: entry.event_type,
  }
}

function MetadataLine({ entry }) {
  const m = entry.metadata ?? {}
  const bits = []

  if (entry.event_type === 'pass_punched' && m.before != null && m.after != null) {
    bits.push(<span key="passes" dir="ltr" style={{ display: 'inline-block' }}>{m.before} → {m.after}</span>)
  }
  if ((entry.event_type === 'class_registered' || entry.event_type === 'class_cancelled') &&
      (m.slot_date || m.slot_time)) {
    bits.push([m.slot_date, m.slot_time].filter(Boolean).join(' '))
  }

  if (!bits.length) return null
  return (
    <span className="text-xs text-gray-400 ms-2">
      {bits.map((bit, i) => <span key={i}>{i > 0 && ' · '}{bit}</span>)}
    </span>
  )
}

function detailRows(entry, t) {
  const m = entry.metadata ?? {}
  const rows = []

  const classHasActivity = !!(m.activity && (m.slot_time || m.slot_date))
  if (m.product_name && !classHasActivity) {
    rows.push({ label: t('activity.detail_product'), value: m.product_name })
  }
  if (m.before != null && m.after != null) {
    rows.push({ label: t('activity.detail_passes'), value: <span dir="ltr" style={{ display: 'inline-block' }}>{m.before} → {m.after}</span> })
  }
  if (m.attended != null) {
    rows.push({ label: t('activity.detail_attendance'), value: m.attended ? t('activity.detail_attended_yes') : t('activity.detail_attended_no') })
  }
  if (m.slot_time || m.slot_date) {
    const time = m.slot_time ?? ''
    const activity = m.activity ? ` — ${m.activity}` : ''
    const date = m.slot_date ? ` (${m.slot_date})` : ''
    rows.push({ label: t('activity.detail_class'), value: `${time}${activity}${date}` })
  }

  return rows
}

function EventRow({ entry, locale, t }) {
  const [expanded, setExpanded] = useState(false)
  const dot         = DOT_COLOR[entry.event_type] ?? 'bg-gray-300'
  const descKey     = `activity.event_${entry.event_type}`
  const description = t(descKey, { defaultValue: entry.event_type, ...buildParams(entry) })
  const exact       = new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(entry.created_at))

  const curated = detailRows(entry, t)

  return (
    <div
      className={`border-b border-gray-100 last:border-0 cursor-pointer select-none transition-colors ${expanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="mt-2 shrink-0">
          <span className={`block w-2 h-2 rounded-full ${dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 leading-snug">
            {description}
            <MetadataLine entry={entry} />
          </p>
        </div>
          <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-400">{shortDate(entry.created_at, locale, t)}</span>
            <svg
              className={`w-3 h-3 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 16 16" fill="currentColor"
            >
              <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"/>
            </svg>
          </div>
        </div>

      <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-4 pb-3 ltr:pl-9 rtl:pr-9 space-y-1">
            <div className="flex gap-2">
              <span className="text-xs text-gray-400 w-24 shrink-0">{t('activity.detail_actor')}</span>
              <span className="text-xs text-gray-600">{entry.actor}</span>
            </div>
            {entry.client_name && (
              <div className="flex gap-2">
                <span className="text-xs text-gray-400 w-24 shrink-0">{t('activity.detail_client')}</span>
                <span className="text-xs text-gray-600">{entry.client_name}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-xs text-gray-400 w-24 shrink-0">{t('activity.detail_time')}</span>
              <span className="text-xs text-gray-600">{exact}</span>
            </div>
            {curated.map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
                <span className="text-xs text-gray-600">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminActivity() {
  const { t, i18n } = useTranslation()
  const router      = useRouter()
  const settings    = useSettings()
  const locale      = i18n.language === 'he' ? 'he-IL' : 'en-GB'

  const [session,     setSession]     = useState(null)
  const [entries,     setEntries]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error,       setError]       = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [hasMore,      setHasMore]      = useState(true)

  const debouncedSearch = useDebouncedValue(clientSearch, 250)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/admin')
      else setSession(data.session)
    })
  }, [router])

  const fetchInitial = useCallback(async (evtType, search) => {
    setLoading(true)
    setError('')
    setEntries([])
    setHasMore(true)
    try {
      const data = await getActivityLog({ eventType: evtType || null, excludeType: evtType ? null : 'client_login', clientName: search || null, limit: LIMIT })
      setEntries(data)
      setHasMore(data.length === LIMIT)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) fetchInitial(filterType, debouncedSearch)
  }, [session, filterType, debouncedSearch, fetchInitial])

  async function loadMore() {
    if (!entries.length) return
    setLoadingMore(true)
    try {
      const before = entries[entries.length - 1].created_at
      const data = await getActivityLog({ eventType: filterType || null, excludeType: filterType ? null : 'client_login', clientName: debouncedSearch || null, before, limit: LIMIT })
      setEntries(prev => [...prev, ...data])
      setHasMore(data.length === LIMIT)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-app">
      <Topbar
        title={t('dashboard.brand')}
        subtitle={settings.studio_name || t('dashboard.studio')}
        nav={[
          <Link key="clients"  href="/admin"          className="text-xs text-gray-400 hover:text-gray-700 transition-colors">{t('dashboard.nav_clients')}</Link>,
          <Link key="schedule" href="/admin/schedule" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">{t('dashboard.nav_schedule')}</Link>,
          <Link key="settings" href="/admin/settings" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">{t('dashboard.nav_settings')}</Link>,
          <span key="activity" className="text-xs font-medium text-primary">{t('dashboard.nav_activity')}</span>,
        ]}
        langToggle={<LangToggle />}
        actions={[{ label: t('auth.sign_out'), onClick: () => supabase.auth.signOut() }]}
      />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-base font-semibold text-gray-900">{t('activity.title')}</h1>
          <input
            type="text"
            value={clientSearch}
            onChange={e => setClientSearch(e.target.value)}
            placeholder={t('activity.search_client')}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('activity.filter_all')}</option>
            {KNOWN_EVENT_TYPES.map(et => (
              <option key={et} value={et}>{t(`activity.filter_${et}`)}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="w-5 h-5 text-gray-400" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">{t('activity.empty')}</p>
        ) : (
          <>
            <div className="bg-card rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {entries.map(entry => (
                <EventRow key={entry.id} entry={entry} locale={locale} t={t} />
              ))}
            </div>
            <div className="mt-4 flex justify-center">
              {hasMore ? (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-active font-medium px-4 py-2 rounded-lg border border-primary-light hover:border-primary-light transition-colors disabled:opacity-50"
                >
                  {loadingMore && <Spinner className="w-4 h-4" />}
                  {loadingMore ? t('activity.loading_more') : t('activity.load_more')}
                </button>
              ) : (
                <p className="text-xs text-gray-400">{t('activity.no_more')}</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
