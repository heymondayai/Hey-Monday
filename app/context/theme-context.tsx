'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  isDark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start with dark — will be overridden by localStorage on mount
  const [isDark, setIsDark] = useState(true)

  // On mount, read saved preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('heymonday-theme') as Theme | null
      if (saved === 'light') setIsDark(false)
      if (saved === 'dark')  setIsDark(true)
    } catch {}
  }, [])

  function toggle() {
    setIsDark(prev => {
      const next = !prev
      try {
        localStorage.setItem('heymonday-theme', next ? 'dark' : 'light')
      } catch {}
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}