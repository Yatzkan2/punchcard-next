"use client"

import { createContext, useContext, useState, useEffect } from 'react'
import { getSettings } from './settings'

const Ctx = createContext({})

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({})
  useEffect(() => {
    getSettings().then(setSettings).catch(() => {})
  }, [])
  return <Ctx.Provider value={settings}>{children}</Ctx.Provider>
}

export function useSettings() {
  return useContext(Ctx)
}
