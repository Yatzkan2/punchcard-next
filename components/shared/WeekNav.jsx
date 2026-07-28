"use client"

import { useTranslation } from 'react-i18next'

function formatWeekRange(start, locale) {
  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'short' })
  const sameMonth = start.getMonth() === end.getMonth()
  const showYear  = start.getFullYear() !== new Date().getFullYear()

  if (sameMonth) {
    const label = `${start.getDate()}–${end.getDate()} ${monthFmt.format(start)}`
    return showYear ? `${label} ${start.getFullYear()}` : label
  }

  const startStr = `${start.getDate()} ${monthFmt.format(start)}`
  const endStr   = `${end.getDate()} ${monthFmt.format(end)}`
  const label    = `${startStr} – ${endStr}`
  return showYear ? `${label} ${end.getFullYear()}` : label
}

export default function WeekNav({ startDate, onPrev, onNext }) {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-GB'
  const label  = formatWeekRange(new Date(startDate), locale)

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Previous week"
      >
        <svg className="w-4 h-4 rtl:scale-x-[-1]" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
        </svg>
      </button>

      <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center tabular-nums">
        {label}
      </span>

      <button
        onClick={onNext}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Next week"
      >
        <svg className="w-4 h-4 rtl:scale-x-[-1]" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 11.78a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}
