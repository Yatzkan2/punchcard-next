"use client"

import { useState, useEffect, useRef } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useTranslation, Trans } from 'react-i18next'
import supabase from '../supabase'
import { getAllClients, addClient as addClientFn, removeClient, setClientActive, incrementEntries } from '../lib/clients'
import { getProducts, addProduct, removeProduct, updateProductDefaults } from '../lib/products'
import { upsertPass, removePass, getClientNamesForProduct, punchPass } from '../lib/passes'
import { createDebt, getDebtCountForClientProduct, settleDebts } from '../lib/debts'
import { getSlotCountForProduct, getRegisteredSlotsForClient, getFutureRegistrationsForClient } from '../lib/slots'
import { getSetting } from '../lib/settings'
import { useSettings } from '../lib/SettingsContext'
import { logEvent } from '../lib/activityLog'
import Link from 'next/link'
import Dialog from '../components/admin/Dialog'
import Spinner from '../components/shared/Spinner'
import TrashIcon from '../components/shared/TrashIcon'
import LangToggle from '../components/shared/LangToggle'
import Topbar from '../components/shared/Topbar'

const UNAMBIGUOUS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateCode() {
  const arr = new Uint8Array(6)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => UNAMBIGUOUS[b % UNAMBIGUOUS.length]).join('')
}

function getInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginCard() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">{t('auth.title')}</h1>
        <p className="text-sm text-gray-500 mb-6">{t('auth.subtitle')}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover active:bg-primary-active text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth.signing_in') : t('auth.sign_in')}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Client row ───────────────────────────────────────────────────────────────

function ClientRow({ client, products, clientAppUrl, onUpdate, onRemove }) {
  const { t, i18n } = useTranslation()
  const entries = client.entries ?? 0
  const [copied, setCopied]             = useState(false)
  const [copiedMessage, setCopiedMessage] = useState(false)
  const [busy, setBusy]           = useState(false)
  const [rowError, setRowError]   = useState('')
  // dialog: null | { type: 'punch'|'refill'|'adjust'|'removePass'|'removeClient', pass? }
  const [dialog, setDialog]       = useState(null)
  const [editingPassId, setEditingPassId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [addProductId, setAddProductId]   = useState('')
  const [addCount, setAddCount]           = useState(10)
  const [addingPass, setAddingPass]       = useState(false)
  const [passListRef] = useAutoAnimate()
  const [registeredSlots, setRegisteredSlots] = useState(null)
  const [loadingSlots,    setLoadingSlots]    = useState(false)
  const [selectedSlotId,  setSelectedSlotId]  = useState('none')
  const [debtCount,           setDebtCount]           = useState(0)
  const [settleDebtChecked,   setSettleDebtChecked]   = useState(true)
  const [settleAmount,        setSettleAmount]        = useState(0)

  const assignedIds     = new Set(client.passes.map(p => p.product_id))
  const availableForAdd = products.filter(p => !assignedIds.has(p.id))

  function showError(e) {
    setRowError(typeof e === 'string' ? e : (e?.message ?? t('clients.something_wrong')))
    setTimeout(() => setRowError(''), 4000)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(client.code)
    } catch {
      // iOS Safari fallback
      const el = document.createElement('textarea')
      el.value = client.code
      el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      el.setSelectionRange(0, 99999)
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleCopyMessage() {
    const url  = clientAppUrl || (window.location.origin + '/client')
    const text = t('clients.copy_message', { name: client.name.split(' ')[0], code: client.code, url })
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      el.setSelectionRange(0, 99999)
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopiedMessage(true)
    setTimeout(() => setCopiedMessage(false), 1500)
  }

  useEffect(() => {
    if (dialog?.type !== 'punch') return
    setRegisteredSlots(null)
    setSelectedSlotId('none')
    setLoadingSlots(true)
    getRegisteredSlotsForClient(client.id, dialog.pass.product_id)
      .then(setRegisteredSlots)
      .catch(() => setRegisteredSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [dialog?.type, dialog?.pass?.product_id])

  useEffect(() => {
    if (dialog?.type !== 'refill') { setDebtCount(0); return }
    setSettleDebtChecked(true)
    getDebtCountForClientProduct(client.id, dialog.pass.product_id)
      .then(setDebtCount)
      .catch(() => setDebtCount(0))
  }, [dialog?.type, dialog?.pass?.product_id])

  useEffect(() => {
    if (dialog?.type !== 'settleDebt') return
    setSettleAmount(dialog.pass.debt)
  }, [dialog?.type, dialog?.pass?.debt])

  // ── Punch ────────────────────────────────────────────────────────────────────
  async function confirmPunch() {
    const pass = dialog.pass
    const linkedSlot = selectedSlotId !== 'none'
      ? registeredSlots?.find(s => s.id === selectedSlotId)
      : null
    const slotArg = linkedSlot ? {
      id:           linkedSlot.id,
      date:         new Date(linkedSlot.starts_at).toLocaleDateString('en-CA'),
      time:         `${String(new Date(linkedSlot.starts_at).getHours()).padStart(2, '0')}:${String(new Date(linkedSlot.starts_at).getMinutes()).padStart(2, '0')}`,
      product_name: linkedSlot.products?.name ?? null,
    } : null
    setDialog(null)
    setBusy(true)
    try {
      if (pass.remaining > 0) {
        await punchPass({ clientId: client.id, clientName: client.name, productId: pass.product_id, productName: pass.product_name, currentRemaining: pass.remaining, slot: slotArg, attended: false })
        await incrementEntries(client.id, entries)
      } else {
        await createDebt({ clientId: client.id, productId: pass.product_id, slotId: linkedSlot?.id ?? null })
        logEvent({ eventType: 'debt_created', actor: 'admin', clientName: client.name, metadata: { product_name: pass.product_name, slot_id: linkedSlot?.id ?? null } })
      }
      onUpdate()
    } catch (e) { showError(e) }
    setBusy(false)
  }

  // ── Refill ───────────────────────────────────────────────────────────────────
  async function confirmRefill() {
    const pass = dialog.pass
    const refillTarget = pass.default_refill ?? 10
    const shouldSettle = debtCount > 0 && settleDebtChecked
    const finalRemaining = shouldSettle ? Math.max(refillTarget - debtCount, 0) : refillTarget
    setDialog(null)
    setBusy(true)
    try {
      await upsertPass(client.id, pass.product_id, finalRemaining)
      if (shouldSettle) {
        await settleDebts(client.id, pass.product_id, debtCount)
        logEvent({ eventType: 'debt_settled', actor: 'admin', clientName: client.name, metadata: { product_name: pass.product_name, count: debtCount } })
      }
      logEvent({ eventType: 'pass_refilled', actor: 'admin', clientName: client.name, metadata: { product_name: pass.product_name, before: pass.remaining, after: finalRemaining } })
      onUpdate()
    } catch (e) { showError(e) }
    setBusy(false)
  }

  // ── Adjust ───────────────────────────────────────────────────────────────────
  function startEdit(pass) {
    setEditingPassId(pass.id)
    setEditValue(String(pass.remaining))
  }
  function cancelEdit() { setEditingPassId(null) }

  async function confirmAdjust() {
    const pass = dialog.pass
    const val  = Math.max(0, parseInt(editValue, 10) || 0)
    setDialog(null)
    setBusy(true)
    try {
      await upsertPass(client.id, pass.product_id, val)
      logEvent({ eventType: 'pass_adjusted', actor: 'admin', clientName: client.name, metadata: { product_name: pass.product_name, before: pass.remaining, after: val } })
      setEditingPassId(null)
      onUpdate()
    } catch (e) { showError(e) }
    setBusy(false)
  }

  // ── Settle debt ──────────────────────────────────────────────────────────────
  async function confirmSettleDebt() {
    const pass = dialog.pass
    const amount = Math.min(Math.max(1, settleAmount), pass.debt)
    setDialog(null)
    setBusy(true)
    try {
      await settleDebts(client.id, pass.product_id, amount)
      logEvent({ eventType: 'debt_settled', actor: 'admin', clientName: client.name, metadata: { product_name: pass.product_name, count: amount } })
      onUpdate()
    } catch (e) { showError(e) }
    setBusy(false)
  }

  // ── Remove pass ──────────────────────────────────────────────────────────────
  async function confirmRemovePass() {
    const pass = dialog.pass
    setDialog(null)
    try { await removePass(client.id, pass.product_id); onUpdate() } catch (e) { showError(e) }
  }

  // ── Remove client ────────────────────────────────────────────────────────────
  async function confirmRemoveClient() {
    setDialog(null)
    try { await removeClient(client.id); logEvent({ eventType: 'client_removed', actor: 'admin', clientName: client.name }); onRemove() } catch (e) { showError(e) }
  }

  // ── Deactivate / Reactivate ──────────────────────────────────────────────────
  async function handleDeactivateClick() {
    const blockedPasses = client.passes.filter(p => p.remaining > 0)
    let futureRegs = []
    try { futureRegs = await getFutureRegistrationsForClient(client.id) } catch { /* allow deactivation if fetch fails */ }

    const blockedDebt = client.passes.filter(p => p.debt > 0)

    const errors = []
    if (blockedPasses.length > 0) {
      errors.push(t('clients.deactivate_blocked_passes', { products: blockedPasses.map(p => p.product_name).join(', ') }))
    }
    if (blockedDebt.length > 0) {
      errors.push(t('clients.deactivate_blocked_debt', { products: blockedDebt.map(p => p.product_name).join(', ') }))
    }
    if (futureRegs.length > 0) {
      const locale = i18n.language === 'he' ? 'he-IL' : 'en-GB'
      const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
      const classes = futureRegs.map(s => `${s.products?.name ?? ''} (${fmt.format(new Date(s.starts_at))})`).join(', ')
      errors.push(t('clients.deactivate_blocked_registered', { classes }))
    }

    if (errors.length > 0) {
      setDialog({ type: 'deactivateBlocked', lines: errors })
    } else {
      setDialog({ type: 'deactivate' })
    }
  }

  async function confirmDeactivate() {
    setDialog(null)
    setBusy(true)
    try {
      await setClientActive(client.id, false)
      logEvent({ eventType: 'client_deactivated', actor: 'admin', clientName: client.name })
      onUpdate()
    } catch (e) { showError(e) }
    setBusy(false)
  }

  async function confirmReactivate() {
    setDialog(null)
    setBusy(true)
    try {
      await setClientActive(client.id, true)
      logEvent({ eventType: 'client_reactivated', actor: 'admin', clientName: client.name })
      onUpdate()
    } catch (e) { showError(e) }
    setBusy(false)
  }

  // ── Add product pass ─────────────────────────────────────────────────────────
  async function handleAddPass(e) {
    e.preventDefault()
    if (!addProductId) return
    setAddingPass(true)
    try {
      await upsertPass(client.id, addProductId, addCount)
      setAddProductId('')
      setAddCount(10)
      onUpdate()
    } catch (e) { showError(e) }
    setAddingPass(false)
  }

  const activePass = dialog?.pass

  return (
    <>
      <div className={`px-4 py-3 border-b border-gray-100 last:border-0 ${client.active === false ? 'opacity-60' : ''}`}>
        {/* Client header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-light text-primary font-semibold text-sm flex items-center justify-center shrink-0 select-none">
            {getInitials(client.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate leading-tight">{client.name}</p>
            <button
              onClick={handleCopy}
              className="mt-0.5 ltr:mr-1.5 rtl:ml-1.5 inline-flex items-center gap-1 font-mono text-xs bg-gray-100 hover:bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded transition-colors"
              title={t('clients.copy_title')}
            >
              {client.code}
              {copied
                ? <svg className="w-3 h-3 text-green-500" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>
                : <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>
              }
            </button>
            <button
              onClick={handleCopyMessage}
              className="mt-0.5 inline-flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded transition-colors"
              title={t('clients.copy_message_tooltip')}
            >
              {t('clients.copy_message_label')}
              {copiedMessage
                ? <svg className="w-3 h-3 text-green-500" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>
                : <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>
              }
            </button>
          </div>
          {client.active !== false ? (
            <button
              onClick={handleDeactivateClick}
              disabled={busy}
              className="text-gray-300 hover:text-amber-500 transition-colors p-1.5 shrink-0 disabled:opacity-40"
              title={t('clients.deactivate')}
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-2ZM9.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-2Z"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setDialog({ type: 'reactivate' })}
              disabled={busy}
              className="text-gray-300 hover:text-green-500 transition-colors p-1.5 shrink-0 disabled:opacity-40"
              title={t('clients.reactivate')}
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 2.5a.5.5 0 0 1 .795-.405l10 6.5a.5.5 0 0 1 0 .81l-10 6.5A.5.5 0 0 1 3 15.5v-13Z"/>
              </svg>
            </button>
          )}
          <button
            onClick={() => setDialog({ type: 'removeClient' })}
            className="text-gray-300 hover:text-red-500 transition-colors p-1.5 shrink-0"
            title={t('clients.remove_title')}
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Per-product pass rows */}
        <div ref={passListRef} className="mt-2 ltr:ml-12 rtl:mr-12 space-y-2">
          {client.passes.length === 0 && (
            <p className="text-xs text-gray-400">{t('passes.none_assigned')}</p>
          )}
          {[...client.passes].sort((a, b) => (a.remaining === 0) - (b.remaining === 0)).map(pass => {
            const isInactive = client.active === false
            const isEditing  = !isInactive && editingPassId === pass.id
            const passColor  = pass.remaining === 0 ? 'text-alert-red' : pass.remaining <= 2 ? 'text-alert-amber' : 'text-gray-800'

            return (
              <div key={pass.id} className="flex items-center gap-2 flex-wrap">
                {/* Product name */}
                <span className="text-xs text-gray-500 w-20 shrink-0 truncate">{pass.product_name}</span>

                {/* Count — static or editable */}
                {isEditing ? (
                  <input
                    type="number"
                    min={0}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') setDialog({ type: 'adjust', pass })
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    autoFocus
                    className="w-14 text-center border border-primary rounded-lg py-0.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <div className="flex items-center gap-1.5 w-28">
                    <span className={`w-14 text-center text-xs font-bold ${passColor}`}>{pass.remaining}</span>
                    {!isInactive && pass.debt > 0 && (
                      <button
                        onClick={() => setDialog({ type: 'settleDebt', pass })}
                        className="text-xs bg-debt-badge-bg hover:bg-alert-red/15 text-alert-red font-medium px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                      >{t('clients.owes_badge', { count: pass.debt })}</button>
                    )}
                  </div>
                )}

                {/* Action buttons — hidden for inactive clients */}
                {!isInactive && (
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => setDialog({ type: 'adjust', pass })}
                          disabled={busy}
                          className="text-xs font-semibold px-2 py-1 rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50"
                        >
                          {t('passes.save')}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-xs font-medium px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          {t('passes.cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setDialog({ type: 'punch', pass })}
                          disabled={busy}
                          className="flex items-center gap-1 bg-primary hover:bg-primary-hover active:bg-primary-active disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-2 py-1 rounded-lg transition-colors"
                        >
                          {busy
                            ? <Spinner className="w-3 h-3" />
                            : <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/></svg>
                          }
                          {t('passes.punch')}
                        </button>
                        <button
                          onClick={() => setDialog({ type: 'refill', pass })}
                          disabled={busy}
                          className="flex items-center gap-1 bg-refill-bg hover:bg-refill-hover active:bg-refill-active disabled:opacity-40 disabled:cursor-not-allowed text-refill-fg text-xs font-semibold px-2 py-1 rounded-lg transition-colors"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/></svg>
                          {t('passes.refill')}
                        </button>
                        <button
                          onClick={() => startEdit(pass)}
                          className="text-xs font-medium px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-800 transition-colors"
                        >
                          {t('passes.adjust')}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setDialog({ type: 'removePass', pass })}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      title={t('passes.remove_title')}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add product pass */}
          {client.active !== false && availableForAdd.length > 0 && (
            <form onSubmit={handleAddPass} className="flex items-center gap-2 pt-0.5">
              <select
                value={addProductId}
                onChange={e => setAddProductId(e.target.value)}
                className="flex-1 border border-gray-200 rounded-md px-2 py-0.5 text-xs text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">{t('passes.add_product_placeholder')}</option>
                {availableForAdd.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {addProductId && (
                <input
                  type="number"
                  min={0}
                  value={addCount}
                  onChange={e => setAddCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-14 text-center border border-gray-200 rounded-md py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              )}
              {addProductId && (
                <button
                  type="submit"
                  disabled={addingPass}
                  className="text-xs font-semibold text-primary hover:text-primary-active disabled:opacity-50 transition-colors"
                >
                  {addingPass ? '…' : t('passes.add')}
                </button>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Row error */}
      {rowError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100">
          <p className="text-xs text-red-700 whitespace-pre-line">{rowError}</p>
        </div>
      )}

      {/* ── Punch confirm ── */}
      {dialog?.type === 'punch' && (
        <Dialog title={t('passes.punch_dialog_title')} confirmLabel={t('passes.punch_confirm')} onConfirm={confirmPunch} onCancel={() => setDialog(null)}>
          <p className="text-sm text-gray-500 mb-4">{t('passes.punch_dialog_body', { name: client.name, product: activePass?.product_name })}</p>
          {activePass?.remaining === 0 ? (
            <p className="text-xs text-alert-amber font-medium mb-3">{t('passes.punch_debt_warning', { product: activePass?.product_name })}</p>
          ) : (
            <div className="flex items-center justify-center gap-6 py-4 bg-gray-50 rounded-xl">
              <div className="text-center">
                <p className="text-3xl font-semibold text-gray-300 leading-none">{activePass?.remaining}</p>
                <p className="text-xs text-gray-400 mt-1">{t('passes.punch_now')}</p>
              </div>
              <svg className="w-5 h-5 text-gray-300 rtl:scale-x-[-1]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd"/>
              </svg>
              <div className="text-center">
                <p className={`text-3xl font-semibold leading-none ${
                  (activePass?.remaining ?? 1) - 1 === 0 ? 'text-alert-red' :
                  (activePass?.remaining ?? 1) - 1 <= 2 ? 'text-alert-amber' : 'text-primary'
                }`}>{(activePass?.remaining ?? 1) - 1}</p>
                <p className="text-xs text-gray-400 mt-1">{t('passes.punch_after')}</p>
              </div>
            </div>
          )}
          {(loadingSlots || (registeredSlots && registeredSlots.length > 0)) && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-500 mb-1.5">{t('passes.link_to_class')}</p>
              {loadingSlots ? (
                <p className="text-xs text-gray-400">{t('passes.link_loading')}</p>
              ) : (
                <select
                  value={selectedSlotId}
                  onChange={e => setSelectedSlotId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="none">{t('passes.link_no_class')}</option>
                  {registeredSlots.map(s => {
                    const d = new Date(s.starts_at)
                    const label = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
                    return <option key={s.id} value={s.id}>{label}</option>
                  })}
                </select>
              )}
            </div>
          )}
        </Dialog>
      )}

      {/* ── Refill confirm ── */}
      {dialog?.type === 'refill' && (
        <Dialog title={t('passes.refill_dialog_title')} confirmLabel={t('passes.refill_confirm')} onConfirm={confirmRefill} onCancel={() => setDialog(null)}>
          <p className="text-sm text-gray-500">
            {t('passes.refill_dialog_body', { name: client.name, product: activePass?.product_name })}
          </p>
          {(activePass?.remaining ?? 0) > 0 && (
            <p className="mt-1.5 text-xs text-gray-400">{t('passes.refill_current_count', { count: activePass?.remaining })}</p>
          )}
          {debtCount > 0 && (
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={settleDebtChecked}
                onChange={e => setSettleDebtChecked(e.target.checked)}
                className="rounded"
              />
              {t('passes.settle_debt_label', { count: debtCount })}
            </label>
          )}
        </Dialog>
      )}

      {/* ── Adjust confirm ── */}
      {dialog?.type === 'adjust' && (
        <Dialog title={t('passes.adjust_dialog_title')} confirmLabel={t('passes.adjust_confirm')} onConfirm={confirmAdjust} onCancel={() => { setDialog(null); cancelEdit() }}>
          <p className="text-sm text-gray-500">
            {t('passes.adjust_dialog_body', {
              name: client.name,
              product: activePass?.product_name,
              value: Math.max(0, parseInt(editValue, 10) || 0),
            })}
          </p>
          {Math.max(0, parseInt(editValue, 10) || 0) !== activePass?.remaining && (
            <p className="mt-1.5 text-xs text-gray-400">
              {t('passes.adjust_dialog_detail', {
                from: activePass?.remaining,
                to: Math.max(0, parseInt(editValue, 10) || 0),
              })}
            </p>
          )}
        </Dialog>
      )}

      {/* ── Remove pass confirm ── */}
      {dialog?.type === 'removePass' && (
        <Dialog title={t('passes.remove_dialog_title')} confirmLabel={t('passes.remove_confirm')} danger onConfirm={confirmRemovePass} onCancel={() => setDialog(null)}>
          <p className="text-sm text-gray-500">
            {t('passes.remove_dialog_body', { product: activePass?.product_name, name: client.name })}
          </p>
        </Dialog>
      )}

      {/* ── Settle debt confirm ── */}
      {dialog?.type === 'settleDebt' && (
        <Dialog title={t('clients.settle_dialog_title')} confirmLabel={t('clients.settle_confirm')} onConfirm={confirmSettleDebt} onCancel={() => setDialog(null)}>
          <p className="text-sm text-gray-500 mb-3">
            {t('clients.settle_dialog_body', { product: activePass?.product_name, total: activePass?.debt })}
          </p>
          <input
            type="number"
            min={1}
            max={activePass?.debt}
            value={settleAmount}
            onChange={e => setSettleAmount(Math.min(Math.max(1, parseInt(e.target.value, 10) || 1), activePass?.debt ?? 1))}
            className="w-24 text-center border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Dialog>
      )}

      {/* ── Remove client confirm ── */}
      {dialog?.type === 'removeClient' && (
        <Dialog title={t('clients.remove_dialog_title')} confirmLabel={t('clients.remove_confirm')} danger onConfirm={confirmRemoveClient} onCancel={() => setDialog(null)}>
          <p className="text-sm text-gray-500">
            {t('clients.remove_dialog_body', { name: client.name })}
          </p>
        </Dialog>
      )}

      {/* ── Deactivate blocked info ── */}
      {dialog?.type === 'deactivateBlocked' && (
        <Dialog title={t('clients.deactivate_blocked_title')} confirmLabel={t('schedule.debt_summary_ok')} onConfirm={() => setDialog(null)}>
          <div className="space-y-2">
            {dialog.lines.map((line, i) => (
              <p key={i} className="text-sm text-gray-500">{line}</p>
            ))}
          </div>
        </Dialog>
      )}

      {/* ── Deactivate confirm ── */}
      {dialog?.type === 'deactivate' && (
        <Dialog title={t('clients.deactivate_dialog_title')} confirmLabel={t('clients.deactivate_confirm')} danger onConfirm={confirmDeactivate} onCancel={() => setDialog(null)}>
          <p className="text-sm text-gray-500">
            {t('clients.deactivate_dialog_body', { name: client.name })}
          </p>
        </Dialog>
      )}

      {/* ── Reactivate confirm ── */}
      {dialog?.type === 'reactivate' && (
        <Dialog title={t('clients.reactivate_dialog_title')} confirmLabel={t('clients.reactivate_confirm')} onConfirm={confirmReactivate} onCancel={() => setDialog(null)}>
          <p className="text-sm text-gray-500">
            {t('clients.reactivate_dialog_body', { name: client.name })}
          </p>
        </Dialog>
      )}
    </>
  )
}

// ─── Products section ─────────────────────────────────────────────────────────

function ProductsSection({ products, onProductsChange }) {
  const { t } = useTranslation()
  const [newName, setNewName]             = useState('')
  const [newCapacity, setNewCapacity]     = useState(10)
  const [newRefill, setNewRefill]         = useState(10)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')
  const [errorVisible, setErrorVisible]   = useState(false)
  const [pendingRemove, setPendingRemove] = useState(null) // { id, name }
  const containerRef  = useRef(null)
  const errorTimer    = useRef(null)

  function showError(msg) {
    clearTimeout(errorTimer.current)
    setError(msg)
    setErrorVisible(true)
    errorTimer.current = setTimeout(dismissError, 5000)
  }

  function dismissError() {
    setErrorVisible(false)
    setTimeout(() => setError(''), 300)
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (errorVisible && containerRef.current && !containerRef.current.contains(e.target)) {
        dismissError()
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [errorVisible])

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    dismissError()
    try {
      await addProduct(name, { default_capacity: newCapacity, default_refill: newRefill })
      setNewName('')
      setNewCapacity(10)
      setNewRefill(10)
      onProductsChange()
    } catch (err) {
      showError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDefaultBlur(id, field, value) {
    const parsed = Math.max(1, parseInt(value, 10) || 1)
    try {
      await updateProductDefaults(id, { [field]: parsed })
      onProductsChange()
    } catch (err) {
      showError(err.message)
    }
  }

  async function confirmRemove() {
    const { id, name } = pendingRemove
    setPendingRemove(null)
    try {
      const [holders, slotCount] = await Promise.all([
        getClientNamesForProduct(id),
        getSlotCountForProduct(id),
      ])
      if (slotCount > 0) {
        showError(
          slotCount === 1
            ? t('products.delete_blocked_slots_one', { name })
            : t('products.delete_blocked_slots_many', { name, count: slotCount })
        )
        return
      }
      if (holders.length > 0) {
        showError(
          holders.length === 1
            ? t('products.delete_blocked_one', { name, holders: holders.join(', ') })
            : t('products.delete_blocked_many', { name, count: holders.length, holders: holders.join(', ') })
        )
        return
      }
      await removeProduct(id)
      onProductsChange()
    } catch (err) {
      showError(err.message)
    }
  }

  const numInput = 'w-14 text-center border border-gray-200 rounded-lg px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'

  return (
    <>
    {pendingRemove && (
      <Dialog title={t('products.remove_dialog_title')} confirmLabel={t('products.remove_confirm')} danger onConfirm={confirmRemove} onCancel={() => setPendingRemove(null)}>
        <p className="text-sm text-gray-500">
          <Trans i18nKey="products.remove_dialog_body" values={{ name: pendingRemove.name }} />
        </p>
      </Dialog>
    )}
    <div ref={containerRef} className="bg-card rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('products.section_title')}</p>
      <div className="space-y-2 mb-3">
        {products.length === 0 && (
          <span className="text-xs text-gray-400">{t('products.empty')}</span>
        )}
        {products.map(p => (
          <div key={p.id} className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-700 min-w-0 flex-1 truncate">{p.name}</span>
            <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
              {t('products.default_capacity')}
              <input
                type="number"
                min={1}
                defaultValue={p.default_capacity ?? 10}
                onBlur={e => handleDefaultBlur(p.id, 'default_capacity', e.target.value)}
                className={numInput}
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
              {t('products.default_refill')}
              <input
                type="number"
                min={1}
                defaultValue={p.default_refill ?? 10}
                onBlur={e => handleDefaultBlur(p.id, 'default_refill', e.target.value)}
                className={numInput}
              />
            </label>
            <button
              onClick={() => setPendingRemove({ id: p.id, name: p.name })}
              className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
              title={t('products.remove_confirm')}
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder={t('products.placeholder')}
          value={newName}
          onChange={e => { setNewName(e.target.value); dismissError() }}
          className="flex-1 min-w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
          {t('products.default_capacity')}
          <input
            type="number"
            min={1}
            value={newCapacity}
            onChange={e => setNewCapacity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className={numInput}
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
          {t('products.default_refill')}
          <input
            type="number"
            min={1}
            value={newRefill}
            onChange={e => setNewRefill(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className={numInput}
          />
        </label>
        <button
          type="submit"
          disabled={saving || !newName.trim()}
          className="bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('products.adding') : t('products.add')}
        </button>
      </form>
      <div className={`overflow-hidden transition-all duration-300 ${errorVisible ? 'max-h-20 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
        <p className="text-xs text-red-600">{error}</p>
      </div>
    </div>
    </>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ session }) {
  const { t } = useTranslation()
  const settings = useSettings()
  const [clients,       setClients]       = useState([])
  const [fetchError,    setFetchError]    = useState('')
  const [products,      setProducts]      = useState([])
  const [clientAppUrl,  setClientAppUrl]  = useState('')

  async function fetchProducts() {
    try { setProducts(await getProducts()) } catch { /* non-critical */ }
  }

  useEffect(() => {
    getSetting('client_app_url')
      .then(val => setClientAppUrl(val || ''))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchProducts() }, [])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [selectedProducts, setSelectedProducts] = useState({}) // { [productId]: count }
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [addErrorFading, setAddErrorFading] = useState(false)

  useEffect(() => {
    if (!addError) return
    function dismiss() {
      setAddErrorFading(true)
      setTimeout(() => { setAddError(''); setAddErrorFading(false) }, 500)
    }
    const autoTimer = setTimeout(dismiss, 5000)
    const attachTimer = setTimeout(() => document.addEventListener('click', dismiss), 100)
    return () => {
      clearTimeout(autoTimer)
      clearTimeout(attachTimer)
      document.removeEventListener('click', dismiss)
    }
  }, [addError])

  const [statusFilter, setStatusFilter] = useState('active')

  async function fetchClients() {
    try {
      setFetchError('')
      setClients(await getAllClients(statusFilter))
    } catch (e) {
      setFetchError(e.message ?? t('dashboard.failed_to_load'))
    }
  }

  useEffect(() => { fetchClients() }, [statusFilter])

  async function handleAdd(e) {
    e.preventDefault()
    const fullName = `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ')
    if (!/\p{L}/u.test(fullName)) {
      setAddError(t('clients.name_invalid'))
      return
    }
    const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const duplicate = clients.some(c => norm(c.name) === norm(fullName))
    if (duplicate) {
      setAddError(t('clients.already_exists', { name: fullName }))
      return
    }
    setAdding(true)
    setAddError('')
    try {
      const newClient = await addClientFn(fullName, generateCode())
      await Promise.all(
        Object.entries(selectedProducts).map(([productId, count]) =>
          upsertPass(newClient.id, productId, count)
        )
      )
      setFirstName('')
      setLastName('')
      setSelectedProducts({})
      await fetchClients()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const [search, setSearch] = useState('')

  const filteredClients = search.trim()
    ? clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : clients

  const totalClients = clients.length
  const activePasses = clients.filter(c => c.passes.some(p => p.remaining > 0)).length
  const needRenewal  = clients.filter(c => c.passes.some(p => p.remaining <= 2)).length

  const stats = [
    { label: t('dashboard.stat_total_clients'), value: totalClients },
    { label: t('dashboard.stat_active_passes'), value: activePasses },
    { label: t('dashboard.stat_need_renewal'),  value: needRenewal,  alert: needRenewal > 0 },
  ]

  return (
    <div className="min-h-screen bg-app">
      <Topbar
        title={t('dashboard.brand')}
        subtitle={settings.studio_name || t('dashboard.studio')}
        nav={[
          <span key="clients" className="text-xs font-medium text-primary">{t('dashboard.nav_clients')}</span>,
          <Link key="schedule" href="/admin/schedule" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">{t('dashboard.nav_schedule')}</Link>,
          <Link key="settings"  href="/admin/settings"  className="text-xs text-gray-400 hover:text-gray-700 transition-colors">{t('dashboard.nav_settings')}</Link>,
          <Link key="activity" href="/admin/activity" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">{t('dashboard.nav_activity')}</Link>,
        ]}
        langToggle={<LangToggle />}
        actions={[{ label: t('auth.sign_out'), onClick: () => supabase.auth.signOut() }]}
      />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map(({ label, value, alert }) => (
            <div key={label} className="bg-card rounded-xl border border-gray-200 p-4 text-center">
              <p className={`text-2xl font-bold ${alert ? 'text-alert-amber' : 'text-gray-900'}`}>
                {value}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* Products */}
        <ProductsSection products={products} onProductsChange={() => { fetchProducts(); fetchClients() }} />

        {/* Add client */}
        <div className="bg-card rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('clients.add_section_title')}</p>
          <form onSubmit={handleAdd}>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder={t('clients.first_name')}
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder={t('clients.last_name')}
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
              <button
                type="submit"
                disabled={adding}
                className="bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? t('clients.adding') : t('clients.add')}
              </button>
            </div>
            {products.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-400">{t('clients.assign_passes_optional')}</p>
                {products.map(p => {
                  const checked = p.id in selectedProducts
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`np-${p.id}`}
                        checked={checked}
                        onChange={e => setSelectedProducts(prev => {
                          if (e.target.checked) return { ...prev, [p.id]: 10 }
                          const copy = { ...prev }; delete copy[p.id]; return copy
                        })}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor={`np-${p.id}`} className="text-sm text-gray-700 flex-1 cursor-pointer">{p.name}</label>
                      {checked && (
                        <input
                          type="number"
                          min={0}
                          value={selectedProducts[p.id]}
                          onChange={e => setSelectedProducts(prev => ({ ...prev, [p.id]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                          className="w-16 text-center border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </form>
          {addError && (
            <div className={`overflow-hidden transition-all duration-500 ${addErrorFading ? 'max-h-0 mt-0 opacity-0' : 'max-h-24 mt-3 opacity-100'}`}>
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <p className="text-sm text-red-700">{addError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Client list */}
        <div className="bg-card rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">{t('clients.section_title')}</p>
            <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
              {['active', 'inactive', 'all'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t(`clients.filter_${s}`)}
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <svg className="absolute ltr:left-2.5 rtl:right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" viewBox="0 0 16 16" fill="currentColor">
                <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/>
              </svg>
              <input
                type="text"
                placeholder={t('clients.search_placeholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full ltr:pl-8 ltr:pr-3 rtl:pr-8 rtl:pl-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <span className="text-xs text-gray-400 shrink-0">
              {search.trim()
                ? t('clients.count_filtered', { filtered: filteredClients.length, total: clients.length })
                : t('clients.count_total', { count: clients.length })}
            </span>
          </div>
          {fetchError ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-red-600 font-medium mb-1">{t('clients.load_error_title')}</p>
              <p className="text-xs text-gray-400 mb-4">{fetchError}</p>
              <button
                onClick={fetchClients}
                className="text-xs font-medium text-primary hover:text-primary-active transition-colors"
              >
                {t('clients.try_again')}
              </button>
            </div>
          ) : clients.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">{t('clients.empty')}</p>
          ) : filteredClients.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">{t('clients.no_match', { search })}</p>
          ) : (
            filteredClients.map(client => (
              <ClientRow
                key={client.id}
                client={client}
                products={products}
                clientAppUrl={clientAppUrl}
                onUpdate={fetchClients}
                onRemove={fetchClients}
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null  // initial load — avoid flash
  if (!session) return <LoginCard />
  return <Dashboard session={session} />
}
