"use client"

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getClientsWithPass } from '../../lib/passes'
import { getSlotWithRegistrations } from '../../lib/slots'
import { registerClient, unregisterClient, markAttended } from '../../lib/registrations'
import { upsertPass } from '../../lib/passes'
import Spinner from '../shared/Spinner'

function buildClientMap(allClients, registrations) {
  const regByClient = new Map(
    registrations.map(r => [r.clients.id, { registrationId: r.id, attended: r.attended }])
  )
  return allClients.map(c => {
    const reg = regByClient.get(c.id)
    return {
      id:             c.id,
      name:           c.name,
      remaining:      c.remaining,
      registered:     !!reg,
      attended:       reg?.attended ?? false,
      registrationId: reg?.registrationId ?? null,
    }
  })
}

function CheckBox({ label, checked, disabled, onChange }) {
  return (
    <label className={`flex items-center gap-1.5 text-xs select-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded accent-primary"
      />
      {label}
    </label>
  )
}

export default function AttendancePanel({ slot }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-GB'
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [busy,    setBusy]    = useState({})

  useEffect(() => {
    if (!slot) return
    setLoading(true)
    setError('')

    Promise.all([
      getClientsWithPass(slot.product_id),
      getSlotWithRegistrations(slot.id),
    ])
      .then(([clients, slotData]) => {
        setRows(buildClientMap(clients, slotData.slot_registrations))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [slot?.id])

  function setClientField(clientId, fields) {
    setRows(prev => prev.map(r => r.id === clientId ? { ...r, ...fields } : r))
  }

  async function toggleRegistered(client) {
    setBusy(b => ({ ...b, [client.id]: true }))
    try {
      if (client.registered) {
        await unregisterClient(slot.id, client.id)
        setClientField(client.id, { registered: false, attended: false, registrationId: null })
      } else {
        const reg = await registerClient(slot.id, client.id)
        setClientField(client.id, { registered: true, registrationId: reg.id })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(b => ({ ...b, [client.id]: false }))
    }
  }

  async function toggleAttended(client) {
    const nowAttended = !client.attended
    setBusy(b => ({ ...b, [client.id]: true }))
    try {
      await markAttended(slot.id, client.id, nowAttended)

      // Deduct one pass only when marking attended for the first time
      if (nowAttended) {
        const newRemaining = Math.max(0, client.remaining - 1)
        await upsertPass(client.id, slot.product_id, newRemaining)
        setClientField(client.id, { attended: true, remaining: newRemaining })
      } else {
        setClientField(client.id, { attended: false })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(b => ({ ...b, [client.id]: false }))
    }
  }

  const registeredCount = rows.filter(r => r.registered).length
  const attendedCount   = rows.filter(r => r.attended).length

  if (!slot) return null

  const slotTime = new Intl.DateTimeFormat(locale, {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(slot.starts_at))

  return (
    <div className="bg-card rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('schedule.attendance_title')}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <p className="text-sm font-medium text-gray-800">
            {slot.products?.name ?? t('schedule.unnamed')} · {slotTime}
          </p>
        </div>
        {!loading && (
          <p className="text-xs text-gray-400 mt-0.5">
            {t('schedule.stats', { registered: registeredCount, attended: attendedCount })}
          </p>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="w-5 h-5 text-gray-400" />
        </div>
      ) : error ? (
        <div className="px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{t('schedule.no_clients')}</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {rows.map(client => (
            <li key={client.id} className="flex items-center gap-3 px-4 py-2.5">
              {/* Name + remaining */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{client.name}</p>
                <p className={`text-xs ${client.remaining === 0 ? 'text-alert-red' : client.remaining <= 2 ? 'text-alert-amber' : 'text-gray-400'}`}>
                  {t('schedule.passes_left', { count: client.remaining })}
                </p>
              </div>

              {/* Spinner or checkboxes */}
              {busy[client.id] ? (
                <Spinner className="w-4 h-4 text-gray-400" />
              ) : (
                <div className="flex items-center gap-4">
                  <CheckBox
                    label={t('schedule.registered')}
                    checked={client.registered}
                    disabled={false}
                    onChange={() => toggleRegistered(client)}
                  />
                  <CheckBox
                    label={t('schedule.attended')}
                    checked={client.attended}
                    disabled={!client.registered}
                    onChange={() => toggleAttended(client)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
