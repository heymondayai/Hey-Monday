'use client'

import { useEffect, useState, useCallback } from 'react'

export type WakeWindowType = 'off' | 'on'

export type WakeWindow = {
  id: string
  type?: WakeWindowType  // 'off' = quiet window, 'on' = active window; defaults 'off' for back-compat
  days: number[]         // 0=Sun, 1=Mon ... 6=Sat
  offHour: number        // window START hour (24h) — "off at" for quiet, "on at" for active
  offMin: number
  onHour: number         // window END hour (24h) — "on at" for quiet, "off at" for active
  onMin: number
}

const STORAGE_KEY = 'heymonday_wake_schedule_v1'

function nowInWindow(win: WakeWindow): boolean {
  const now = new Date()
  const day = now.getDay()
  if (!win.days.includes(day)) return false

  const nowMins  = now.getHours() * 60 + now.getMinutes()
  const startMins = win.offHour * 60 + win.offMin
  const endMins   = win.onHour  * 60 + win.onMin

  if (startMins < endMins) {
    return nowMins >= startMins && nowMins < endMins
  } else {
    // crosses midnight
    return nowMins >= startMins || nowMins < endMins
  }
}

export function isScheduledOff(windows: WakeWindow[]): boolean {
  return windows.filter(w => (w.type ?? 'off') === 'off').some(nowInWindow)
}

export function isScheduledOn(windows: WakeWindow[]): boolean {
  return windows.filter(w => w.type === 'on').some(nowInWindow)
}

export function loadWindows(): WakeWindow[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as WakeWindow[]) : []
  } catch {
    return []
  }
}

export function saveWindows(windows: WakeWindow[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(windows))
}

export function useWakeSchedule() {
  const [windows, setWindows] = useState<WakeWindow[]>([])
  const [scheduledOff, setScheduledOff] = useState(false)
  const [scheduledOn, setScheduledOn]   = useState(false)

  useEffect(() => {
    const loaded = loadWindows()
    setWindows(loaded)
    setScheduledOff(isScheduledOff(loaded))
    setScheduledOn(isScheduledOn(loaded))
  }, [])

  // Re-check every 30 seconds
  useEffect(() => {
    const tick = () => {
      setScheduledOff(isScheduledOff(windows))
      setScheduledOn(isScheduledOn(windows))
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [windows])

  const addWindow = useCallback((w: Omit<WakeWindow, 'id'>) => {
    const next = [...windows, { ...w, id: crypto.randomUUID() }]
    setWindows(next)
    saveWindows(next)
  }, [windows])

  const removeWindow = useCallback((id: string) => {
    const next = windows.filter(w => w.id !== id)
    setWindows(next)
    saveWindows(next)
  }, [windows])

  const updateWindow = useCallback((id: string, patch: Partial<WakeWindow>) => {
    const next = windows.map(w => w.id === id ? { ...w, ...patch } : w)
    setWindows(next)
    saveWindows(next)
  }, [windows])

  return { windows, scheduledOff, scheduledOn, addWindow, removeWindow, updateWindow }
}
