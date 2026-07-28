"use client"

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getProducts } from '../../lib/products'
import { getClientsWithPass, getPassesForClient, punchPass, refundPass } from '../../lib/passes'
import { registerClient, unregisterClient, markAttended, setPunched, getRegistrationsForSlot } from '../../lib/registrations'
import { createSlot, updateSlot, deleteSlot, getSlotWithRegistrations } from '../../lib/slots'
import { getSetting } from '../../lib/settings'
import { logEvent } from '../../lib/activityLog'
import { shouldPunch, shouldCreateDebt } from '../../lib/attendance'
import { createDebt } from '../../lib/debts'
import Dialog from './Dialog'
import Spinner from '../shared/Spinner'
import TrashIcon from '../shared/TrashIcon'

const INPUT = 'w-full min-w-0 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white'
const LABEL = 'block text-xs font-medium text-gray-500 mb-1'

function today() {
  return new Date().toISOString().split('T')[0]
}

function slotToFields(slot) {
  const d = new Date(slot.starts_at)
  return {
    date:                    d.toLocaleDateString('en-CA'),
    time:                    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    productId:               slot.product_id ?? '',
    capacity:                slot.capacity,
    notes:                   slot.notes ?? '',
    cancellationCutoffHours: slot.cancellation_cutoff_hours ?? 0,
  }
}

// slot prop = edit mode; omit for create mode
export default function SlotForm({ slot, onCreated, onSaved, onCancel, onDeleted }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-GB'
  const isEdit = !!slot

  const init = isEdit ? slotToFields(slot) : { date: today(), time: '09:00', productId: '', capacity: '', notes: '', cancellationCutoffHours: 12 }

  const [date,                    setDate]                    = useState(init.date)
  const [time,                    setTime]                    = useState(init.time)
  const [productId,               setProductId]               = useState(init.productId)
  const [capacity,                setCapacity]                = useState(init.capacity)
  const [notes,                   setNotes]                   = useState(init.notes)
  const [cancellationCutoffHours, setCancellationCutoffHours] = useState(init.cancellationCutoffHours)
  const [products,       setProducts]       = useState([])
  const [capacityTouched, setCapacityTouched] = useState(false)
  const [saving,         setSaving]          = useState(false)
  const [error,          setError]           = useState('')

  // Delete state (edit mode only)
  const [confirmingDelete,  setConfirmingDelete]  = useState(false)
  const [deleting,          setDeleting]          = useState(false)

  // Unregister confirmation state (edit mode only)
  const [pendingUnregister, setPendingUnregister] = useState(null) // { clientId, registrationId, name }

  // Registration state (edit mode only)
  const [registrations,     setRegistrations]     = useState(slot?.slot_registrations ?? [])
  const [eligibleClients,   setEligibleClients]   = useState(null)
  const [loadingClients,    setLoadingClients]    = useState(false)
  const [regBusy,           setRegBusy]           = useState({})
  const [regError,          setRegError]          = useState('')
  const [attendanceBusy,    setAttendanceBusy]    = useState({})
  const [committing,        setCommitting]        = useState(false)
  const [debtSummaryNames, setDebtSummaryNames]  = useState(null)
  const [activeTab,         setActiveTab]         = useState('details')
  const [freshSlot,         setFreshSlot]         = useState(null)
  const [loadingSlot,       setLoadingSlot]       = useState(isEdit)
  const [attendanceDraft,   setAttendanceDraft]   = useState(() => {
    const draft = {}
    for (const r of slot?.slot_registrations ?? []) {
      draft[r.id] = {
        status:      r.attended === true ? 'attended' : r.attended === false ? 'absent' : null,
        punchAnyway: false,
      }
    }
    return draft
  })

  function setDraft(regId, partial) {
    setAttendanceDraft(prev => ({ ...prev, [regId]: { ...prev[regId], ...partial } }))
  }

  const s = freshSlot ?? slot
  const isFuture = isEdit && new Date(s.starts_at) > new Date()

  const slotRef = isEdit ? (() => {
    const d = new Date(s.starts_at)
    return {
      id:           slot.id,
      date:         d.toLocaleDateString('en-CA'),
      time:         `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      product_name: s.products?.name ?? null,
    }
  })() : null

  useEffect(() => {
    if (!isEdit) return
    getSlotWithRegistrations(slot.id)
      .then(result => {
        setFreshSlot(result)
        const regs = result.slot_registrations ?? []
        setRegistrations(regs)
        setAttendanceDraft(
          Object.fromEntries(regs.map(r => [
            r.id,
            { status: r.attended === true ? 'attended' : r.attended === false ? 'absent' : null, punchAnyway: false },
          ]))
        )
        const fields = slotToFields(result)
        setDate(fields.date)
        setTime(fields.time)
        setProductId(fields.productId)
        setCapacity(fields.capacity)
        setNotes(fields.notes)
        setCancellationCutoffHours(fields.cancellationCutoffHours)
      })
      .catch(() => {})
      .finally(() => setLoadingSlot(false))
  }, [])

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(err => setError(err.message))
  }, [])

  useEffect(() => {
    if (isEdit || capacityTouched || products.length === 0) return
    const p = products.find(p => p.id === productId)
    setCapacity(p?.default_capacity ?? 10)
  }, [products, productId])

  useEffect(() => {
    if (!isEdit || activeTab !== 'attendance') return
    getRegistrationsForSlot(slot.id)
      .then(fresh => {
        setRegistrations(fresh)
        setAttendanceDraft(
          Object.fromEntries(fresh.map(r => [
            r.id,
            {
              status: r.attended === true ? 'attended' : r.attended === false ? 'absent' : null,
              punchAnyway: false,
            },
          ]))
        )
      })
      .catch(() => {})
  }, [activeTab])

  useEffect(() => {
    if (isEdit) return
    getSetting('cancellation_cutoff_default')
      .then(val => {
        const n = parseInt(val, 10)
        if (!isNaN(n)) setCancellationCutoffHours(n)
      })
      .catch(() => {})
    getSetting('default_product_id')
      .then(val => { if (val) setProductId(val) })
      .catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!productId) { setError(t('schedule.product_required')); return }
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        const starts_at = new Date(`${date}T${time}`).toISOString()
        const updated = await updateSlot(slot.id, {
          starts_at,
          product_id:                productId || null,
          capacity:                  Number(capacity),
          notes:                     notes.trim() || null,
          cancellation_cutoff_hours: Number(cancellationCutoffHours),
        })
        onSaved?.(updated)
      } else {
        const created = await createSlot(date, time, productId || null, Number(capacity), notes.trim() || null, Number(cancellationCutoffHours))
        setDate(today())
        setTime('09:00')
        setProductId('')
        setCapacity(10)
        setNotes('')
        setCancellationCutoffHours(12)
        onCreated?.(created)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete (edit mode) ────────────────────────────────────────────────────

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteSlot(slot.id)
      const d = new Date(s.starts_at)
      logEvent({ eventType: 'slot_deleted', actor: 'admin', metadata: { slot_date: d.toLocaleDateString('en-CA'), slot_time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` } })
      onDeleted?.()
    } catch (err) {
      setError(err.message)
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  // ── Registration helpers (edit mode) ──────────────────────────────────────

  async function fetchEligible() {
    if (eligibleClients !== null || !s.product_id || loadingClients) return
    setLoadingClients(true)
    try {
      setEligibleClients(await getClientsWithPass(s.product_id))
    } catch (err) {
      setRegError(err.message)
    } finally {
      setLoadingClients(false)
    }
  }

  const registeredIds      = new Set(registrations.map(r => r.clients?.id).filter(Boolean))
  const unregisteredClients = eligibleClients?.filter(c => !registeredIds.has(c.id)) ?? []
  const full               = registrations.length >= Number(capacity)

  async function handleRegister(clientId) {
    const client = eligibleClients?.find(c => c.id === clientId)
    if (!client) return
    setRegBusy(b => ({ ...b, [clientId]: true }))
    setRegError('')
    try {
      const reg = await registerClient(slot.id, clientId)
      setRegistrations(prev => [...prev, { id: reg.id, attended: false, clients: { id: client.id, name: client.name } }])
    } catch (err) {
      setRegError(err.message)
    } finally {
      setRegBusy(b => ({ ...b, [clientId]: false }))
    }
  }

  async function confirmUnregister() {
    const { clientId, registrationId } = pendingUnregister
    setPendingUnregister(null)
    setRegBusy(b => ({ ...b, [clientId]: true }))
    setRegError('')
    try {
      await unregisterClient(slot.id, clientId)
      setRegistrations(prev => prev.filter(r => r.id !== registrationId))
    } catch (err) {
      setRegError(err.message)
    } finally {
      setRegBusy(b => ({ ...b, [clientId]: false }))
    }
  }

  async function commitAttendance() {
    const changes = []
    for (const r of registrations) {
      if (!r.clients) continue
      const draft    = attendanceDraft[r.id] ?? { status: null, punchAnyway: false }
      const original = r.attended
      const { id: regId, clients: { id: clientId, name: clientName } } = r

      if (draft.status === 'attended' && original !== true) {
        changes.push({ regId, clientId, clientName, action: 'attend', punched: r.punched ?? false })
      } else if (draft.status === 'absent' && original !== false) {
        changes.push({ regId, clientId, clientName, action: 'absent', punchAnyway: draft.punchAnyway, punched: r.punched ?? false })
      }
    }
    if (!changes.length) return

    setCommitting(true)
    setRegError('')
    const newlyPunchedIds = new Set()
    const debtsCreated = []
    try {
      for (const change of changes) {
        const { regId, clientId, clientName, action, punchAnyway, punched } = change
        const draftStatus = action === 'attend' ? 'attended' : 'absent'
        await markAttended(slot.id, clientId, action === 'attend')
        if (shouldPunch({ draftStatus, alreadyPunched: punched, punchAnyway })) {
          const passes = await getPassesForClient(clientId)
          const pass   = passes.find(p => p.product_id === s.product_id)
          const hasPassRemaining = pass != null && pass.remaining > 0
          if (hasPassRemaining) {
            await punchPass({ clientId, clientName, productId: s.product_id, productName: s.products?.name, currentRemaining: pass.remaining, slot: slotRef, attended: action === 'attend' })
            await setPunched(slot.id, clientId, true)
            newlyPunchedIds.add(regId)
          } else if (shouldCreateDebt({ shouldPunch: true, hasPassRemaining })) {
            await createDebt({ clientId, productId: s.product_id, slotId: slot.id })
            logEvent({ eventType: 'debt_created', actor: 'admin', clientName, metadata: { product_name: s.products?.name, slot_id: slot.id } })
            debtsCreated.push(clientName)
          }
        }
      }
      const attendedMap = Object.fromEntries(
        changes.map(c => [c.regId, c.action === 'attend'])
      )
      setRegistrations(prev => prev.map(r => {
        if (!(r.id in attendedMap)) return r
        return { ...r, attended: attendedMap[r.id], punched: newlyPunchedIds.has(r.id) ? true : r.punched }
      }))
      if (debtsCreated.length) setDebtSummaryNames(debtsCreated)
    } catch (err) {
      setRegError(err.message)
    } finally {
      setCommitting(false)
    }
  }

  if (loadingSlot) {
    return (
      <div className="bg-card rounded-xl border border-gray-200 p-4 h-[32rem] flex flex-col animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 shrink-0" />
        <div className="flex gap-1 mt-4 shrink-0">
          <div className="h-7 bg-gray-200 rounded-lg flex-1" />
          <div className="h-7 bg-gray-200 rounded-lg flex-1" />
        </div>
        <div className="mt-4 space-y-3 flex-1">
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-10 bg-gray-200 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <>
    {pendingUnregister && (
      <Dialog
        title={t('schedule.unregister_title')}
        confirmLabel={t('schedule.unregister_confirm')}
        danger
        onConfirm={confirmUnregister}
        onCancel={() => setPendingUnregister(null)}
      >
        <p className="text-sm text-gray-500">
          {t('schedule.unregister_body', { name: pendingUnregister.name })}
        </p>
      </Dialog>
    )}
    {debtSummaryNames && (
      <Dialog
        title={t('schedule.debt_summary_title')}
        confirmLabel={t('schedule.debt_summary_ok')}
        onConfirm={() => setDebtSummaryNames(null)}
        onCancel={() => setDebtSummaryNames(null)}
      >
        <p className="text-sm text-gray-500">
          {t('schedule.debt_summary_body', { names: debtSummaryNames.join(', ') })}
        </p>
      </Dialog>
    )}
    {confirmingDelete && (
      <Dialog
        title={t('schedule.delete_title')}
        confirmLabel={t('schedule.delete_confirm')}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      >
        <p className="text-sm text-gray-500">
          {t('schedule.delete_body', {
            datetime: new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(s.starts_at)),
          })}
        </p>
      </Dialog>
    )}

    <form onSubmit={handleSubmit} className={`bg-card rounded-xl border border-gray-200 p-4 min-w-0 ${isEdit ? 'h-[32rem] flex flex-col' : 'space-y-3'}`}>
      <div className="flex items-center justify-between shrink-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {isEdit ? t('schedule.edit_slot') : t('schedule.new_slot')}
        </p>
        <div className="flex items-center gap-2">
          {isEdit && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={deleting}
              className="p-1 rounded text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
              title={t('schedule.delete')}
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              {t('passes.cancel')}
            </button>
          )}
        </div>
      </div>

      {isEdit && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 shrink-0 mt-3">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeTab === 'details' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('schedule.tab_details')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeTab === 'attendance' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('schedule.tab_attendance')}
          </button>
        </div>
      )}

      {(!isEdit || activeTab === 'details') && (
        <div className={isEdit ? 'flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 mt-3' : ''}>
        <div className="space-y-3 min-w-0">
          <div className="flex flex-col gap-3 min-w-0">
            <div className="min-w-0">
              <label className={LABEL}>{t('schedule.label_date')}</label>
              <input type="date" dir="ltr" value={date} onChange={e => setDate(e.target.value)} required className={`${INPUT} box-border`} style={{ maxWidth: '100%' }} />
            </div>
            <div className="min-w-0">
              <label className={LABEL}>{t('schedule.label_time')}</label>
              <input type="time" dir="ltr" value={time} onChange={e => setTime(e.target.value)} required className={`${INPUT} box-border`} style={{ maxWidth: '100%' }} />
            </div>
          </div>

          <div>
            <label className={LABEL}>{t('schedule.label_activity')}</label>
            <select value={productId} onChange={e => {
              const id = e.target.value
              setProductId(id)
              if (!isEdit) {
                const p = products.find(p => p.id === id)
                if (p?.default_capacity != null) setCapacity(p.default_capacity)
              }
            }} required className={INPUT}>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL}>{t('schedule.label_capacity')}</label>
            <input
              type="number" min={1} max={999} value={capacity}
              onChange={e => { setCapacity(e.target.value); setCapacityTouched(true) }} required className={INPUT}
            />
          </div>

          <div>
            <label className={LABEL}>{t('schedule.cancellation_cutoff_label')}</label>
            <input
              type="number" min={0} value={cancellationCutoffHours}
              onChange={e => setCancellationCutoffHours(e.target.value)} required className={INPUT}
            />
            <p className="text-xs text-gray-400 mt-1">{t('schedule.cancellation_cutoff_hint')}</p>
          </div>

          <div>
            <label className={LABEL}>{t('schedule.label_notes')} <span className="font-normal text-gray-400">{t('schedule.optional')}</span></label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder={t('schedule.notes_placeholder')} className={`${INPUT} resize-none`}
            />
          </div>

          {isEdit && s.product_id && (
            <div>
              <label className={LABEL}>{t('schedule.participants')} <span className="font-normal text-gray-400 ms-1">{registrations.length}/{capacity}</span></label>
              {registrations.map(r => r.clients && (
                <div key={r.id} className="flex items-center gap-2 mt-1">
                  <span className="flex-1 text-xs truncate text-gray-700">{r.clients.name}</span>
                  <button type="button" onClick={() => setPendingUnregister({ clientId: r.clients.id, registrationId: r.id, name: r.clients.name })} className="shrink-0 text-gray-300 hover:text-red-500 transition-colors leading-none" aria-label="Remove">×</button>
                </div>
              ))}
              {!full && (
                <select
                  defaultValue=""
                  onFocus={fetchEligible}
                  onChange={e => { if (e.target.value) { handleRegister(e.target.value); e.target.value = '' } }}
                  disabled={loadingClients}
                  className="mt-1 text-xs text-primary bg-transparent border border-dashed border-primary-light rounded-full px-2 py-0.5 outline-none cursor-pointer hover:border-primary transition-colors disabled:opacity-50"
                >
                  <option value="">{loadingClients ? t('schedule.loading') : t('schedule.add_client')}</option>
                  {unregisteredClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit" disabled={saving}
            className="w-full bg-primary hover:bg-primary-hover active:bg-primary-active text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? (isEdit ? t('schedule.saving') : t('schedule.creating')) : (isEdit ? t('schedule.save') : t('schedule.create'))}
          </button>
        </div>
        </div>
      )}

      {/* Participants — attendance tab, edit mode only */}
      {isEdit && activeTab === 'attendance' && s.product_id && (
        <div className="flex-1 flex flex-col min-h-0 min-w-0 mt-3">
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0">
          <label className={LABEL}>
            {t('schedule.participants')}
            <span className="font-normal text-gray-400 ms-1">{registrations.length}/{capacity}</span>
          </label>
          <div className="space-y-1 mt-1">
            {registrations.map(r => r.clients && (() => {
              const draft  = attendanceDraft[r.id] ?? { status: null, punchAnyway: false }
              const status = draft.status
              return (
                <div key={r.id}>
                  <div className="flex items-center gap-2">
                    {/* Name */}
                    <span className="flex-1 text-xs truncate text-gray-700">{r.clients.name}</span>

                    {/* Attended button */}
                    <button
                      type="button"
                      onClick={() => setDraft(r.id, { status: 'attended' })}
                      disabled={attendanceBusy[r.clients.id] || regBusy[r.clients.id] || isFuture}
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        status === 'attended'
                          ? 'bg-green-100 text-green-700 border-green-300'
                          : 'text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                      }`}
                    >
                      {t('schedule.attended')}
                    </button>

                    {/* Not attended button */}
                    <button
                      type="button"
                      onClick={() => setDraft(r.id, { status: 'absent' })}
                      disabled={attendanceBusy[r.clients.id] || regBusy[r.clients.id] || isFuture}
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        status === 'absent'
                          ? 'bg-red-50 text-red-600 border-red-200'
                          : 'text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                      }`}
                    >
                      {t('schedule.not_attended')}
                    </button>

                    {(attendanceBusy[r.clients.id] || regBusy[r.clients.id]) && (
                      <Spinner className="w-3 h-3 shrink-0" />
                    )}
                  </div>

                  {/* Punch anyway checkbox — shown when absent */}
                  {status === 'absent' && (
                    <label className="flex items-center gap-1.5 mt-0.5 ltr:pl-0 rtl:pr-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.punchAnyway}
                        onChange={e => setDraft(r.id, { punchAnyway: e.target.checked })}
                        className="w-3 h-3 accent-primary"
                      />
                      <span className="text-xs text-gray-400">{t('schedule.punch_anyway_label')}</span>
                    </label>
                  )}
                </div>
              )
            })())}


          </div>
          {regError && <p className="text-xs text-red-500 mt-1">{regError}</p>}
          {isFuture && <p className="text-xs text-amber-600 mt-2">{t('schedule.attendance_future_locked')}</p>}
          </div>
          <button
            type="button"
            onClick={commitAttendance}
            disabled={committing || isFuture}
            className="shrink-0 mt-3 w-full bg-primary hover:bg-primary-hover active:bg-primary-active text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {committing && <Spinner className="w-4 h-4" />}
            {t('schedule.confirm_attendance')}
          </button>
        </div>
      )}

    </form>
    </>
  )
}
