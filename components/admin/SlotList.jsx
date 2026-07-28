"use client"

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getSlotsByWeek } from '../../lib/slots'
import Spinner from '../shared/Spinner'

function localDateKey(isoString) {
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

function SlotRow({ slot, locale, onEdit }) {
  const time       = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(slot.starts_at))
  const count      = slot.slot_registrations?.length ?? 0
  const full       = count >= slot.capacity
  const near       = !full && count >= slot.capacity * 0.8
  const countColor = full  ? 'text-red-600 font-semibold'
                   : near  ? 'text-amber-600 font-semibold'
                   :         'text-gray-500'
  const names      = slot.slot_registrations?.map(r => r.clients?.name).filter(Boolean) ?? []

  return (
    <div
      onClick={() => onEdit(slot)}
      className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
    >
      <span className="text-sm font-mono text-gray-700 w-11 shrink-0 pt-px">{time}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {slot.products && (
            <span className="text-sm font-medium text-gray-800">{slot.products.name}</span>
          )}
          <span className={`text-xs ${countColor}`}>{count}/{slot.capacity}</span>
        </div>
        {names.length > 0 && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{names.join(', ')}</p>
        )}
        {slot.notes && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{slot.notes}</p>
        )}
      </div>
    </div>
  )
}

export default function SlotList({ weekStart, onEdit, reloadRef }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-GB'

  const [slots,          setSlots]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error,          setError]          = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setSlots(await getSlotsByWeek(weekStart))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }, [weekStart])

  useEffect(() => { load() }, [load])

  useEffect(() => { if (reloadRef) reloadRef.current = load }, [load, reloadRef])

  if (initialLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="w-5 h-5 text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">{t('schedule.no_slots')}</p>
    )
  }

  const dayFmt  = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' })
  const grouped = groupByDay(slots)

  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([dayKey, daySlots]) => (
        <div key={dayKey} className="bg-card rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {dayFmt.format(new Date(dayKey + 'T00:00:00'))}
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {daySlots.map(slot => (
              <SlotRow
                key={slot.id}
                slot={slot}
                locale={locale}
                onEdit={onEdit}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
