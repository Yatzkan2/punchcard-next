"use client"

import { useState, useEffect, useRef, Fragment } from 'react'
import Link from 'next/link'
import { isValidElement, cloneElement } from 'react'

// langToggle: ReactNode — always visible on both mobile and desktop, never in dropdown
// nav:        array of ReactNode — inline on desktop, first items in mobile dropdown
// actions:    array of ReactNode | { label: string, onClick: fn } — inline on desktop, after nav in mobile dropdown
export default function Topbar({ title, subtitle, nav = [], actions = [], langToggle = null }) {
  const [open,    setOpen]    = useState(false)
  const menuRef               = useRef(null)
  const hasDropdown           = nav.length > 0 || actions.length > 0

  useEffect(() => {
    if (!open) return
    const onMouse = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false) }
    const onKey   = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown',   onKey)
    }
  }, [open])

  return (
    <header className="bg-card border-b border-gray-200 px-4 h-14 flex items-center justify-between">
      {/* Left: home + title + subtitle + nav (desktop only) */}
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/" className="text-gray-300 hover:text-gray-500 active:scale-95 transition-all duration-150 shrink-0">
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 8h1v5.5A1.5 1.5 0 0 0 4 15h2.5v-3.5h3V15H12a1.5 1.5 0 0 0 1.5-1.5V8h1a.5.5 0 0 0 .354-.854l-6-6Z"/>
          </svg>
        </Link>
        <span className="font-semibold text-gray-900 text-sm shrink-0">{title}</span>
        {subtitle && <span className="text-xs text-gray-400 shrink-0">{subtitle}</span>}
        {nav.length > 0 && (
          <div className="hidden sm:flex items-center gap-3">
            {nav.map((item, i) => <Fragment key={i}>{item}</Fragment>)}
          </div>
        )}
      </div>

      {/* Right desktop */}
      <div className="hidden sm:flex items-center gap-4 shrink-0">
        {langToggle}
        {actions.map((action, i) => renderInline(action, i))}
      </div>

      {/* Right mobile: langToggle always visible + optional hamburger */}
      <div className="sm:hidden flex items-center gap-1 shrink-0">
        {langToggle}
        {hasDropdown && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen(v => !v)}
              className="p-2 -mr-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 active:scale-90 rounded transition-all duration-150"
              aria-label="Menu"
            >
              {open ? (
                <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 3.75A.75.75 0 0 1 1.75 3h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 3.75ZM1 8a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 8Zm0 4.25a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1-.75-.75Z"/>
                </svg>
              )}
            </button>

            {open && (
              <div className="animate-modal-content absolute end-0 top-full mt-1 w-48 bg-card border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
                {nav.map((item, i) => renderDropdown(item, i, () => setOpen(false)))}
                {actions.map((action, i) => renderDropdown(action, nav.length + i, () => setOpen(false)))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

function renderInline(action, i) {
  if (isValidElement(action)) return <Fragment key={i}>{action}</Fragment>
  return (
    <button
      key={i}
      onClick={action.onClick}
      className="text-xs font-medium text-gray-500 hover:text-gray-900 active:scale-95 transition-all duration-150"
    >
      {action.label}
    </button>
  )
}

function renderDropdown(action, i, close) {
  if (isValidElement(action)) {
    const existing = action.props.className ?? ''
    return cloneElement(action, {
      key: i,
      className: `block w-full text-start px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150 border-b border-gray-100 last:border-0${existing ? ' ' + existing : ''}`,
      onClick: close,
    })
  }
  return (
    <button
      key={i}
      onClick={() => { action.onClick(); close() }}
      className="w-full text-start px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150 border-b border-gray-100 last:border-0"
    >
      {action.label}
    </button>
  )
}
