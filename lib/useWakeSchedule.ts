'use client'

import { useEffect, useState, useCallback } from 'react'

export type WakeWindow = {
  id: string
  days: number[]        // 0=Sun, 1=Mon ... 6=Sat
  offHour: number       // 24h
  offMin: number
  onHour: number
  onMin: number
}

const STORAGE_KEY = 'heymonday_wake_schedule_v1'

function nowInWindow(window: WakeWindow): boolean {
  const now = new Date()
  const day = now.getDay()
  if (!window.days.includes(day)) return false

  const nowMins = now.getHours() * 60 + now.getMinutes()
  const offMins = window.offHour * 60 + window.offMin
  const onMins  = window.onHour  * 60 + window.onMin

  if (offMins < onMins) {
    // same-day window e.g. 22:00 → 07:00 crossed midnight? No — 22 < 7 is false
    // e.g. 09:00 off → 17:00 on (daytime mute)
    return nowMins >= offMins && nowMins < onMins
  } else {
    // crosses midnight: e.g. off at 22:00, on at 07:00
    return nowMins >= offMins || nowMins < onMins
  }
}

export function isScheduledOff(windows: WakeWindow[]): boolean {
  return windows.some(nowInWindow)
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

  useEffect(() => {
    const loaded = loadWindows()
    setWindows(loaded)
    setScheduledOff(isScheduledOff(loaded))
  }, [])

  // Re-check every 30 seconds
  useEffect(() => {
    const tick = () => setScheduledOff(isScheduledOff(windows))
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

  return { windows, scheduledOff, addWindow, removeWindow, updateWindow }
}