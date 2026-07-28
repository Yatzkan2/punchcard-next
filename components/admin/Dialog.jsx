"use client"

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function Dialog({ title, children, confirmLabel = 'Confirm', danger = false, disabled = false, onConfirm, onCancel }) {
  const { t } = useTranslation()
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="animate-modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="animate-modal-content w-full max-w-xs bg-card rounded-2xl shadow-2xl border border-gray-100 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
        <div>{children}</div>
        <div className="flex gap-2 justify-end mt-6">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            >
              {t('passes.cancel')}
            </button>
          )}
          <button
            onClick={onConfirm}
            disabled={disabled}
            autoFocus
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              danger
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                : 'bg-primary hover:bg-primary-hover active:bg-primary-active'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
