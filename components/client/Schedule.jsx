"use client"

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getSlotsByWeek, canClientCancel, getFutureRegistrationsForClient } from '../../lib/slots'
import { registerClient, unregisterClient } from '../../lib/registrations'
import { getPassesForClient } from '../../lib/passes'
import { getSetting } from '../../lib/settings'
import { logEvent } from '../../lib/activityLog'
import WeekNav from '../shared/WeekNav'
import Spinner from '../shared/Spinner'

function sundayOf(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function localDateKey(isoString) {
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '00')}-${String(d.getDate()).padStart(2, '00')}`
}

function groupByDay(slots) {
  const map = new Map()
  for (const slot of slots) {
    const key = localDateKey(slot.starts_at)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(slot)
  }
  return map
}

function RegisterConfirmDialog({ slot, t, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={onCancel}
    >
      <div
        className="bg-card rounded-2xl shadow-xl p-6 w-full max-w-xs space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-gray-800">
          {t('schedule.register_confirm_title')}
        </p>
        <p className="text-sm text-gray-500">
          {t('schedule.register_confirm_body', { activity: slot.products?.name ?? '—' })}
        </p>
        {!canClientCancel(slot) && (
          <p className="text-xs text-amber-600">{t('schedule.no_cancel_warning', { hours: slot.cancellation_cutoff_hours })}</p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {t('passes.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-hover transition-colors"
          >
            {t('schedule.register')}
          </button>
        </div>
      </div>
    </div>
  )
}

function SlotRow({ slot, clientId, locale, t, onRegister, onUnregister, policy, remainingByProduct, upcomingByProduct }) {
  const now          = new Date()
  const startsAt     = new Date(slot.starts_at)
  const isPast       = startsAt < now
  const isRegistered = slot.slot_registrations?.some(r => r.clients?.id === clientId)
  const spotsLeft    = slot.capacity - (slot.slot_registrations?.length ?? 0)
  const isFull       = spotsLeft <= 0

  const remaining = remainingByProduct[slot.product_id] ?? 0
  const upcoming  = upcomingByProduct[slot.product_id] ?? 0
  const registrationBlocked = policy === 'strict' && upcoming >= remaining

  const [confirming, setConfirming] = useState(false)
  const [busy,       setBusy]       = useState(false)
  const [rowError,   setRowError]   = useState('')

  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(startsAt)

  async function doRegister() {
    setConfirming(false)
    setBusy(true)
    setRowError('')
    try {
      await onRegister(slot.id)
    } catch (err) {
      console.error(err)
      setRowError(t('schedule.register_error'))
    } finally {
      setBusy(false)
    }
  }

  async function doUnregister() {
    setBusy(true)
    setRowError('')
    try {
      await onUnregister(slot.id)
    } catch (err) {
      console.error(err)
      setRowError(t('schedule.cancel_error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {confirming && (
        <RegisterConfirmDialog
          slot={slot}
          t={t}
          onConfirm={doRegister}
          onCancel={() => setConfirming(false)}
        />
      )}
      <div className={`flex items-center gap-3 px-4 py-3 ${isPast ? 'opacity-40' : ''}`}>
        {/* Time */}
        <span className="text-sm font-mono text-gray-500 w-11 shrink-0">{time}</span>

        {/* Product + notes + error */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isPast ? 'text-gray-400' : 'text-gray-800'}`}>
            {slot.products?.name ?? '—'}
          </p>
          {slot.notes && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{slot.notes}</p>
          )}
          {rowError && (
            <p className="text-xs text-red-500 mt-0.5">{rowError}</p>
          )}
        </div>

        {/* Action area */}
        <div className="shrink-0 flex items-center gap-2">
          {busy ? (
            <Spinner className="w-4 h-4 text-gray-400" />
          ) : isRegistered ? (
            canClientCancel(slot) ? (
              <button
                onClick={doUnregister}
                className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors px-2 py-0.5 rounded-full border border-red-200 hover:border-red-300"
              >
                {t('schedule.cancel_registration')}
              </button>
            ) : (
              <span className="text-xs text-gray-400 italic">
                {t('schedule.cancellation_closed')}
              </span>
            )
          ) : isFull ? (
            <span className="text-xs text-red-400 font-medium">{t('schedule.full')}</span>
          ) : isPast ? (
            <span className="text-xs tabular-nums text-gray-400">
              {t('schedule.spots_left', { count: spotsLeft })}
            </span>
          ) : registrationBlocked ? (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M4 6.5V5a4 4 0 1 1 8 0v1.5h.25A1.75 1.75 0 0 1 14 8.25v5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5A1.75 1.75 0 0 1 3.75 6.5H4Zm1.5-1.5a2.5 2.5 0 0 1 5 0v1.5h-5V5Z" clipRule="evenodd"/>
              </svg>
              {t('schedule.register_blocked_insufficient')}
            </span>
          ) : (
            <>
              <span className={`text-xs tabular-nums ${spotsLeft <= 3 ? 'text-amber-500 font-medium' : 'text-gray-400'}`}>
                {t('schedule.spots_left', { count: spotsLeft })}
              </span>
              <button
                onClick={() => setConfirming(true)}
                className="text-xs font-medium text-primary hover:text-primary-active transition-colors px-2 py-0.5 rounded-full border border-primary-light hover:border-primary-light"
              >
                {t('schedule.register')}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default function Schedule({ clientId, clientName }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-GB'

  const [weekStart, setWeekStart] = useState(() => sundayOf(new Date()))
  const [slots,     setSlots]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  const [policy, setPolicy] = useState('strict')
  const [remainingByProduct, setRemainingByProduct] = useState({})
  const [upcomingByProduct,  setUpcomingByProduct]  = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setSlots(await getSlotsByWeek(weekStart))
    } catch (err) {
      console.error(err)
      setError(t('schedule.load_error'))
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  const refreshCounts = useCallback(async () => {
    try {
      const [passes, futureRegs] = await Promise.all([
        getPassesForClient(clientId),
        getFutureRegistrationsForClient(clientId),
      ])
      setRemainingByProduct(Object.fromEntries(passes.map(p => [p.product_id, p.remaining])))
      const upcoming = {}
      for (const reg of futureRegs) {
        upcoming[reg.product_id] = (upcoming[reg.product_id] ?? 0) + 1
      }
      setUpcomingByProduct(upcoming)
    } catch (err) {
      console.error(err)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getSetting('registration_policy').then(setPolicy).catch(() => setPolicy('strict'))
  }, [])

  useEffect(() => { refreshCounts() }, [refreshCounts])

  function prevWeek() {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })
  }
  function nextWeek() {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })
  }

  async function handleRegister(slotId) {
    await registerClient(slotId, clientId)
    const slot = slots.find(s => s.id === slotId)
    if (slot) {
      const d = new Date(slot.starts_at)
      logEvent({
        eventType: 'class_registered',
        actor: 'client',
        clientName,
        metadata: {
          slot_date: d.toLocaleDateString('en-CA'),
          slot_time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
          activity: slot.products?.name ?? null,
        },
      })
    }
    await load()
    await refreshCounts()
  }

  async function handleUnregister(slotId) {
    await unregisterClient(slotId, clientId)
    const slot = slots.find(s => s.id === slotId)
    if (slot) {
      const d = new Date(slot.starts_at)
      logEvent({
        eventType: 'class_cancelled',
        actor: 'client',
        clientName,
        metadata: {
          slot_date: d.toLocaleDateString('en-CA'),
          slot_time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
          activity: slot.products?.name ?? null,
        },
      })
    }
    await load()
    await refreshCounts()
  }

  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' })
  const grouped = groupByDay(slots)

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex justify-center">
        <WeekNav startDate={weekStart} onPrev={prevWeek} onNext={nextWeek} />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="w-5 h-5 text-gray-400" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : grouped.size === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">{t('schedule.no_classes')}</p>
      ) : (
        [...grouped.entries()].map(([dayKey, daySlots]) => (
          <div key={dayKey} className="bg-card rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {dayFmt.format(new Date(dayKey + 'T00:00:00'))}
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {daySlots.map(slot => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  clientId={clientId}
                  locale={locale}
                  t={t}
                  onRegister={handleRegister}
                  onUnregister={handleUnregister}
                  policy={policy}
                  remainingByProduct={remainingByProduct}
                  upcomingByProduct={upcomingByProduct}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
