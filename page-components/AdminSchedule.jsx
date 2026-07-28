"use client"

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import supabase from '../supabase'
import WeekNav from '../components/shared/WeekNav'
import SlotForm from '../components/admin/SlotForm'
import SlotList from '../components/admin/SlotList'
import LangToggle from '../components/shared/LangToggle'
import Topbar from '../components/shared/Topbar'
import { useSettings } from '../lib/SettingsContext'

function sundayOf(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

export default function AdminSchedule() {
  const { t } = useTranslation()
  const router = useRouter()
  const settings = useSettings()

  const [session,       setSession]       = useState(null)
  const [weekStart,     setWeekStart]     = useState(() => sundayOf(new Date()))
  const [editingSlot,   setEditingSlot]   = useState(null)
  const [creatingSlot,  setCreatingSlot]  = useState(false)
  const reloadListRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/admin')
      else setSession(data.session)
    })
  }, [router])

  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return
      if (editingSlot)  closeEdit()
      if (creatingSlot) setCreatingSlot(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editingSlot, creatingSlot])

  if (!session) return null

  function prevWeek() {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })
    setEditingSlot(null)
  }

  function nextWeek() {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })
    setEditingSlot(null)
  }

  function handleSlotCreated() {
    reloadListRef.current?.()
    setCreatingSlot(false)
  }

  function closeEdit() {
    reloadListRef.current?.()
    setEditingSlot(null)
  }

  function handleSlotSaved() {
    closeEdit()
  }

  function handleSlotDeleted() {
    closeEdit()
  }

  return (
    <div className="min-h-screen bg-app">
      <Topbar
        title={t('dashboard.brand')}
        subtitle={settings.studio_name || t('dashboard.studio')}
        nav={[
          <Link key="clients" href="/admin" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">{t('dashboard.nav_clients')}</Link>,
          <span key="schedule" className="text-xs font-medium text-primary">{t('dashboard.nav_schedule')}</span>,
          <Link key="settings"  href="/admin/settings"  className="text-xs text-gray-400 hover:text-gray-700 transition-colors">{t('dashboard.nav_settings')}</Link>,
          <Link key="activity" href="/admin/activity" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">{t('dashboard.nav_activity')}</Link>,
        ]}
        langToggle={<LangToggle />}
        actions={[{ label: t('auth.sign_out'), onClick: () => supabase.auth.signOut() }]}
      />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold text-gray-900">{t('dashboard.nav_schedule')}</h1>
            <WeekNav startDate={weekStart} onPrev={prevWeek} onNext={nextWeek} />
          </div>
          <button
            onClick={() => setCreatingSlot(true)}
            className="bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            {t('schedule.add_slot')}
          </button>
        </div>

        <SlotList weekStart={weekStart} onEdit={setEditingSlot} reloadRef={reloadListRef} />
      </main>

      {/* Create slot modal */}
      {creatingSlot && (
        <div
          className="animate-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setCreatingSlot(false) }}
        >
          <div className="animate-modal-content w-full max-w-sm max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl">
            <SlotForm
              onCreated={handleSlotCreated}
              onCancel={() => setCreatingSlot(false)}
            />
          </div>
        </div>
      )}

      {/* Edit slot modal */}
      {editingSlot && (
        <div
          className="animate-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) closeEdit() }}
        >
          <div className="animate-modal-content w-full max-w-sm max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl">
            <SlotForm
              key={editingSlot.id}
              slot={editingSlot}
              onSaved={handleSlotSaved}
              onDeleted={handleSlotDeleted}
              onCancel={closeEdit}
            />
          </div>
        </div>
      )}
    </div>
  )
}
