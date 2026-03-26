'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { EventsPanel, CalendarModal } from '@/components/EventsCalendar'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import WakeWordListener from '@/components/WakeWordListener'

function useIsMobile(breakpoint = 960) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}


// ─── Theme tokens ─────────────────────────────────────────────────────────────
const DARK = {
  // backgrounds
  pageBg:       '#080808',
  sideBg:       '#0a0a0a',
  panelBg:      '#080808',
  cardBg:       '#0b0b0b',
  headerBg:     '#0a0a0a',
  tickerBg:     '#0d0d0d',
  inputBg:      'rgba(255,255,255,0.04)',
  overlayBg:    '#0d0d0d',
  // borders
  border:       'rgba(232,184,75,0.18)',
  borderFaint:  'rgba(232,184,75,0.12)',
  borderFaint2: 'rgba(232,184,75,0.07)',
  borderFaint3: 'rgba(232,184,75,0.08)',
  borderInput:  'rgba(232,184,75,0.22)',
  borderItem:   'rgba(255,255,255,0.04)',
  // gold accents
  gold:         '#e8b84b',
  goldFaint:    'rgba(232,184,75,0.06)',
  goldFaint2:   'rgba(232,184,75,0.08)',
  goldFaint3:   'rgba(232,184,75,0.10)',
  goldFaint4:   'rgba(232,184,75,0.12)',
  goldFaint5:   'rgba(232,184,75,0.15)',
  goldFaint6:   'rgba(232,184,75,0.18)',
  goldFaint7:   'rgba(232,184,75,0.25)',
  goldFaint8:   'rgba(232,184,75,0.35)',
  goldFaint9:   'rgba(232,184,75,0.45)',
  goldFaint10:  'rgba(232,184,75,0.50)',
  goldText:     'rgba(232,184,75,0.6)',
  goldText2:    'rgba(232,184,75,0.5)',
  goldText3:    'rgba(232,184,75,0.4)',
  goldText4:    'rgba(232,184,75,0.7)',
  // text
  text:         '#ffffff',
  text2:        'rgba(255,255,255,0.85)',
  text3:        'rgba(255,255,255,0.6)',
  text4:        'rgba(255,255,255,0.45)',
  text5:        'rgba(255,255,255,0.35)',
  text6:        'rgba(255,255,255,0.3)',
  text7:        'rgba(255,255,255,0.25)',
  text8:        'rgba(255,255,255,0.2)',
  text9:        'rgba(255,255,255,0.18)',
  text10:       'rgba(255,255,255,0.4)',
  textMuted:    'rgba(255,255,255,0.55)',
  // semantic
  green:        '#4ade80',
  greenFaint:   'rgba(74,222,128,0.06)',
  greenFaint2:  'rgba(74,222,128,0.07)',
  greenFaint3:  'rgba(74,222,128,0.08)',
  greenFaint4:  'rgba(74,222,128,0.12)',
  greenBorder:  'rgba(74,222,128,0.28)',
  greenBorder2: 'rgba(74,222,128,0.3)',
  greenBorder3: 'rgba(74,222,128,0.35)',
  greenGlow:    'rgba(74,222,128,0.8)',
  greenGlow2:   'rgba(74,222,128,0.9)',
  red:          '#f87171',
  redFaint:     'rgba(248,113,113,0.06)',
  redFaint2:    'rgba(248,113,113,0.07)',
  redFaint3:    'rgba(248,113,113,0.08)',
  redFaint4:    'rgba(248,113,113,0.12)',
  redBorder:    'rgba(248,113,113,0.15)',
  redBorder2:   'rgba(248,113,113,0.2)',
  redBorder3:   'rgba(248,113,113,0.35)',
  redBorder4:   'rgba(248,113,113,0.4)',
  redBorder5:   'rgba(248,113,113,0.45)',
  blue:         '#7ab8e8',
  blueFaint:    'rgba(122,184,232,0.4)',
  blueFaint2:   'rgba(122,184,232,0.8)',
  purple:       '#a78bfa',
  purpleFaint:  'rgba(167,139,250,0.08)',
  purpleBorder: 'rgba(167,139,250,0.2)',
  cyan:         '#22d3ee',
  cyanFaint:    'rgba(34,211,238,0.08)',
  cyanBorder:   'rgba(34,211,238,0.25)',
  // ticker
  tickerText:   '#e8b84b',
  tickerPrice:  'rgba(255,255,255,0.6)',
  tickerBorder: 'rgba(232,184,75,0.1)',
  // misc
  wlActive:     'rgba(232,184,75,0.06)',
  wlRemoveBg:   '#0a0a0a',
  newsAiBorder: 'rgba(232,184,75,0.25)',
  pulseHero:    'linear-gradient(135deg,rgba(232,184,75,0.07) 0%,rgba(232,184,75,0.02) 60%,transparent 100%)',
  waveBar:      '#e8b84b',
  avatarBg:     'linear-gradient(135deg,rgba(232,184,75,0.35),rgba(232,184,75,0.1))',
  avatarBorder: 'rgba(232,184,75,0.5)',
  scrollColor:  'rgba(232,184,75,0.12)',
  modalOverlay: 'rgba(0,0,0,0.88)',
  backdropBlur: 'rgba(0,0,0,0.85)',
  suggestBg:    'rgba(255,255,255,0.02)',
  suggestBorder:'rgba(232,184,75,0.1)',
  suggestHover: 'rgba(232,184,75,0.06)',
  suggestBorderHover: 'rgba(232,184,75,0.25)',
  chatUserBg:   'rgba(255,255,255,0.05)',
  chatUserBorder:'rgba(255,255,255,0.1)',
  chatAiBg:     'rgba(232,184,75,0.06)',
  chatAiBorder: 'rgba(232,184,75,0.18)',
  thinkingText: 'rgba(232,184,75,0.5)',
  gridBg:       'rgba(232,184,75,0.1)',
  dayHeaderBg:  '#080808',
  pastHover:    'rgba(232,184,75,0.03)',
  alertRemoveBg:'#0a0a0a',
  pricingToggle:'rgba(255,255,255,0.03)',
}

const LIGHT = {
  // backgrounds — warm parchment matching marketing page
  pageBg:       '#f6f0e4',
  sideBg:       '#ede5d2',
  panelBg:      '#f6f0e4',
  cardBg:       '#e8dfc8',
  headerBg:     '#ede5d2',
  tickerBg:     '#241a08',
  inputBg:      'rgba(154,100,18,.06)',
  overlayBg:    '#f0e8d8',
  // borders
  border:       'rgba(154,100,18,0.28)',
  borderFaint:  'rgba(154,100,18,0.20)',
  borderFaint2: 'rgba(154,100,18,0.13)',
  borderFaint3: 'rgba(154,100,18,0.12)',
  borderInput:  'rgba(154,100,18,0.30)',
  borderItem:   'rgba(154,100,18,0.10)',
  borderItem2:  'rgba(154,100,18,0.08)',
  // gold accents (deeper for light bg)
  gold:         '#9a6412',
  goldFaint:    'rgba(154,100,18,.05)',
  goldFaint2:   'rgba(154,100,18,.08)',
  goldFaint3:   'rgba(154,100,18,.10)',
  goldFaint4:   'rgba(154,100,18,.12)',
  goldFaint5:   'rgba(154,100,18,.16)',
  goldFaint6:   'rgba(154,100,18,.20)',
  goldFaint7:   'rgba(154,100,18,.28)',
  goldFaint8:   'rgba(154,100,18,.38)',
  goldFaint9:   'rgba(154,100,18,.48)',
  goldFaint10:  'rgba(154,100,18,.55)',
  goldText:     'rgba(154,100,18,0.7)',
  goldText2:    'rgba(154,100,18,0.6)',
  goldText3:    'rgba(154,100,18,0.5)',
  goldText4:    'rgba(154,100,18,0.8)',
  // text — deep espresso
  text:         '#180e02',
  text2:        '#2a1808',
  text3:        '#4a3010',
  text4:        '#6a4820',
  text5:        '#7a5828',
  text6:        '#8a6830',
  text7:        '#9a7838',
  text8:        '#aa8848',
  text9:        '#ba9858',
  text10:       '#6a4820',
  textMuted:    '#5a4018',
  // semantic (slightly muted for parchment)
  green:        '#2a7a38',
  greenFaint:   'rgba(42,122,56,0.06)',
  greenFaint2:  'rgba(42,122,56,0.07)',
  greenFaint3:  'rgba(42,122,56,0.08)',
  greenFaint4:  'rgba(42,122,56,0.12)',
  greenBorder:  'rgba(42,122,56,0.30)',
  greenBorder2: 'rgba(42,122,56,0.35)',
  greenBorder3: 'rgba(42,122,56,0.40)',
  greenGlow:    'rgba(42,122,56,0.7)',
  greenGlow2:   'rgba(42,122,56,0.9)',
  red:          '#a82020',
  redFaint:     'rgba(168,32,32,0.06)',
  redFaint2:    'rgba(168,32,32,0.07)',
  redFaint3:    'rgba(168,32,32,0.08)',
  redFaint4:    'rgba(168,32,32,0.12)',
  redBorder:    'rgba(168,32,32,0.18)',
  redBorder2:   'rgba(168,32,32,0.25)',
  redBorder3:   'rgba(168,32,32,0.38)',
  redBorder4:   'rgba(168,32,32,0.45)',
  redBorder5:   'rgba(168,32,32,0.50)',
  blue:         '#1e5c8a',
  blueFaint:    'rgba(30,92,138,0.35)',
  blueFaint2:   'rgba(30,92,138,0.8)',
  purple:       '#5a3a9a',
  purpleFaint:  'rgba(90,58,154,0.08)',
  purpleBorder: 'rgba(90,58,154,0.25)',
  cyan:         '#0e6a7a',
  cyanFaint:    'rgba(14,106,122,0.08)',
  cyanBorder:   'rgba(14,106,122,0.28)',
  // ticker
  tickerText:   '#e8b84b',
  tickerPrice:  'rgba(248,240,224,0.75)',
  tickerBorder: 'rgba(232,184,75,0.15)',
  // misc
  wlActive:     'rgba(154,100,18,0.08)',
  wlRemoveBg:   '#ede5d2',
  newsAiBorder: 'rgba(154,100,18,0.28)',
  pulseHero:    'linear-gradient(135deg,rgba(154,100,18,0.09) 0%,rgba(154,100,18,0.03) 60%,transparent 100%)',
  waveBar:      '#9a6412',
  avatarBg:     'linear-gradient(135deg,rgba(154,100,18,0.40),rgba(154,100,18,0.15))',
  avatarBorder: 'rgba(154,100,18,0.55)',
  scrollColor:  'rgba(154,100,18,0.18)',
  modalOverlay: 'rgba(60,30,5,0.82)',
  backdropBlur: 'rgba(60,30,5,0.78)',
  suggestBg:    'rgba(154,100,18,0.04)',
  suggestBorder:'rgba(154,100,18,0.14)',
  suggestHover: 'rgba(154,100,18,0.08)',
  suggestBorderHover:'rgba(154,100,18,0.30)',
  chatUserBg:   'rgba(154,100,18,0.06)',
  chatUserBorder:'rgba(154,100,18,0.18)',
  chatAiBg:     'rgba(154,100,18,0.08)',
  chatAiBorder: 'rgba(154,100,18,0.22)',
  thinkingText: 'rgba(154,100,18,0.6)',
  gridBg:       'rgba(154,100,18,0.14)',
  dayHeaderBg:  '#f6f0e4',
  pastHover:    'rgba(154,100,18,0.04)',
  alertRemoveBg:'#ede5d2',
  pricingToggle:'rgba(154,100,18,0.04)',
}

type PanelId = 'pulse' | 'events' | 'news' | 'summaries'| 'chat'
type LayoutId = '2x2' | 'focus' | '2col' | '2row'
const DASHBOARD_PREFS_KEY = 'heymonday_dashboard_prefs_v1'

type DashboardPrefs = {
  isDark: boolean
  layout: LayoutId
  slotPanels: PanelId[]
  newsTab: 'watchlist' | 'general'
}

const DEFAULT_WATCHLIST_TICKERS = ['NVDA', 'AAPL', 'TSLA', 'META', 'AMD', 'SPY', 'GLD']
const CRYPTO_SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'MATIC', 'LINK'])
const FUTURES_SYMBOLS: Record<string, string> = {
  GLD: 'Gold ETF', SLV: 'Silver ETF', USO: 'Oil ETF', UNG: 'Nat Gas ETF',
  SPY: 'S&P 500 ETF', QQQ: 'Nasdaq 100 ETF', IWM: 'Russell 2000 ETF',
  DIA: 'Dow Jones ETF', TLT: 'Treasury Bond ETF', GDX: 'Gold Miners ETF',
}

function tickerType(sym: string): 'crypto' | 'etf' | 'stock' {
  if (CRYPTO_SYMBOLS.has(sym.toUpperCase())) return 'crypto'
  if (FUTURES_SYMBOLS[sym.toUpperCase()]) return 'etf'
  return 'stock'
}

function makeWlItem(
  ticker: string,
  companyName?: string
): { ticker: string; company_name?: string; bars: number[] } {
  const seed = ticker.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const bars = Array.from({ length: 7 }, (_, i) => 20 + ((seed * (i + 3) * 17) % 80))
  return {
    ticker: ticker.toUpperCase(),
    company_name: companyName,
    bars,
  }
}

const DEFAULT_TICKER_DATA = [
  { sym: 'SPY' }, { sym: 'QQQ' }, { sym: 'NVDA' }, { sym: 'AAPL' },
  { sym: 'TSLA' }, { sym: 'MSFT' }, { sym: 'META' }, { sym: 'AMD' },
  { sym: 'GLD' }, { sym: 'BTC' },
]

type ScheduledSummary = {
  id: string; user_id: string; name: string; run_at: string; prompt: string;
  icon: string; top_color: string; type: 'preset' | 'custom'; enabled: boolean;
  created_at?: string; updated_at?: string;
}

type PastBriefing = {
  id: string; user_id: string; title: string; content: string;
  audio_url?: string | null; briefing_date: string;
}

const SUMMARY_ICON_OPTIONS = ['🌅', '🔔', '☀️', '⚡', '🌙', '📊', '🧠', '🚨', '📈', '📝']

const SUMMARY_PRESETS = [
  { name: 'Pre-Market',  prompt: 'Give me a pre-market briefing for today focused on my watchlist, biggest catalysts, and macro risks.', icon: '🌅', top_color: '#e8b84b', type: 'preset' as const },
  { name: 'Open Pulse',  prompt: 'Give me a market open pulse with the strongest and weakest names on my watchlist plus the biggest early driver.', icon: '🔔', top_color: '#4ade80', type: 'preset' as const },
  { name: 'Midday',      prompt: 'Give me a midday summary of my watchlist, sector rotation, and what matters most into the afternoon.', icon: '☀️', top_color: '#7ab8e8', type: 'preset' as const },
  { name: 'Power Hour',  prompt: 'Give me a power hour summary with strongest movers, closing themes, and any setups into the close.', icon: '⚡', top_color: '#e8b84b', type: 'preset' as const },
  { name: 'End of Day',  prompt: 'Give me an end of day recap focused on my watchlist, major catalysts, and what matters for tomorrow.', icon: '🌙', top_color: '#c084fc', type: 'preset' as const },
]

function formatCountdown(ms: number) {
  if (ms <= 0) return 'Ready'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `In ${minutes}m`
  return `In ${hours}h ${minutes}m`
}

function formatSummaryRunAt(iso: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso))
}

function formatSummaryTimeOnly(iso: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso))
}

const SUGGESTED_QUESTIONS = [
  { emoji: '📊', text: "What's moving in my watchlist right now?" },
  { emoji: '🌅', text: 'Give me a pre-market briefing for today' },
  { emoji: '🏦', text: "How does today's macro data affect my portfolio?" },
  { emoji: '📈', text: 'Which of my stocks has the best setup this week?' },
  { emoji: '⚡', text: 'Any unusual options activity on my watchlist?' },
  { emoji: '🔄', text: 'Where is money rotating in the market today?' },
  { emoji: '📉', text: 'What are the biggest risks to my watchlist right now?' },
  { emoji: '🎯', text: 'Give me key support and resistance levels for NVDA' },
  { emoji: '🌍', text: 'What global macro events should I be watching?' },
  { emoji: '💡', text: 'What would change your mind on the current market trend?' },
]

const TRADER_TYPES = [
  { id: 'day',      icon: '⚡', label: 'Day Trader',         color: '#f87171', borderColor: 'rgba(248,113,113,0.4)', bgColor: 'rgba(248,113,113,0.06)' },
  { id: 'swing',    icon: '📈', label: 'Swing Trader',       color: '#e8b84b', borderColor: 'rgba(232,184,75,0.4)',  bgColor: 'rgba(232,184,75,0.06)'  },
  { id: 'longterm', icon: '🏦', label: 'Long-Term Investor',  color: '#7ab8e8', borderColor: 'rgba(122,184,232,0.4)', bgColor: 'rgba(122,184,232,0.06)' },
]

const PULSE_LABEL: Record<string, string> = {
  day: '⚡ Intraday Pulse', swing: '📈 Swing Pulse', longterm: '🏦 Portfolio Pulse',
}

function MondayText({ text }: { text: string }) {
  const parts = text.split(/(\[gold\].*?\[\/gold\]|\[green\].*?\[\/green\]|\[red\].*?\[\/red\]|\n)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('[gold]'))  return <span key={i} style={{ color: '#e8b84b', fontWeight: 600 }}>{part.replace(/\[\/?(gold)\]/g, '')}</span>
        if (part.startsWith('[green]')) return <span key={i} style={{ color: '#4ade80', fontWeight: 600 }}>{part.replace(/\[\/?(green)\]/g, '')}</span>
        if (part.startsWith('[red]'))   return <span key={i} style={{ color: '#f87171', fontWeight: 600 }}>{part.replace(/\[\/?(red)\]/g, '')}</span>
        if (part === '\n') return <br key={i} />
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function getStartOfTodayETUtcIso(): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  if (!year || !month || !day) return new Date(0).toISOString()
  const asEST = new Date(`${year}-${month}-${day}T05:00:00.000Z`)
  const estHourInET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(asEST)
  if (estHourInET === '0' || estHourInET === '00') return asEST.toISOString()
  return new Date(`${year}-${month}-${day}T04:00:00.000Z`).toISOString()
}

function getSummaryWeekBounds(offsetWeeks: number = 0) {
  const etNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = etNow.getDay()
  const monday = new Date(etNow)
  monday.setDate(etNow.getDate() - (day === 0 ? 6 : day - 1) + offsetWeeks * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  const label = `${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(monday)} – ${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(sunday)}`
  return { start: monday, end: sunday, label }
}

function getSummaryDayBounds(offsetDays: number = 0) {
  const etNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = new Date(etNow)
  day.setDate(etNow.getDate() + offsetDays)
  day.setHours(0, 0, 0, 0)
  const jsDay = day.getDay()
  if (jsDay === 0) day.setDate(day.getDate() + 1)
  if (jsDay === 6) day.setDate(day.getDate() + 2)
  const start = new Date(day); start.setHours(0, 0, 0, 0)
  const end = new Date(day); end.setHours(23, 59, 59, 999)
  const label = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric' }).format(day)
  return { start, end, label }
}

function isIsoInRange(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

function formatSummaryRunAtLocal(iso: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso))
}

function getEtDateKeyFromIso(iso: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000'
  const month = parts.find((p) => p.type === 'month')?.value ?? '00'
  const day = parts.find((p) => p.type === 'day')?.value ?? '00'
  return `${year}-${month}-${day}`
}

function buildRunAtIsoFromLocalInput(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hour, minute] = timeValue.split(':').map(Number)
  const probeUtc = Date.UTC(year, month - 1, day, hour + 5, minute, 0)
  for (let offset = -12; offset <= 14; offset++) {
    const candidate = new Date(Date.UTC(year, month - 1, day, hour - offset, minute, 0))
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(candidate)
    const y = Number(parts.find((p) => p.type === 'year')?.value)
    const m = Number(parts.find((p) => p.type === 'month')?.value)
    const d = Number(parts.find((p) => p.type === 'day')?.value)
    const h = Number(parts.find((p) => p.type === 'hour')?.value)
    const min = Number(parts.find((p) => p.type === 'minute')?.value)
    if (y === year && m === month && d === day && h === hour && min === minute) return candidate.toISOString()
  }
  return new Date(probeUtc).toISOString()
}

function getDateTimeInputDefaults() {
  const now = new Date()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '09'
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '30'
  return { date, time: `${hh}:${mm}` }
}

// ─── News Modal ───────────────────────────────────────────────────────────────
function NewsModal({ watchlistNews, generalNews, onClose, watchlistTickers, defaultTab, T }: {
  watchlistNews: any[]; generalNews: any[]; onClose: () => void;
  watchlistTickers: string[]; defaultTab: 'watchlist' | 'general'; T: typeof DARK;
}) {
  const [tab, setTab] = React.useState<'watchlist' | 'general'>(defaultTab)
  const [search, setSearch] = React.useState('')
  const [sentiment, setSentiment] = React.useState<'all' | 'bullish' | 'bearish'>('all')
  const [activeTicker, setActiveTicker] = React.useState<string | null>(null)

  const baseNews = tab === 'watchlist' ? watchlistNews : generalNews
  const allTickers = Array.from(new Set(baseNews.map((n) => n.ticker))).sort()

  const filtered = baseNews.filter((n) => {
    const matchSearch = !search || n.headline.toLowerCase().includes(search.toLowerCase()) || n.ai?.toLowerCase().includes(search.toLowerCase())
    const matchSentiment = sentiment === 'all' || (sentiment === 'bullish' && n.up) || (sentiment === 'bearish' && !n.up)
    const matchTicker = !activeTicker || n.ticker === activeTicker
    return matchSearch && matchSentiment && matchTicker
  })

  function switchTab(t: 'watchlist' | 'general') { setTab(t); setActiveTicker(null); setSearch('') }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: T.modalOverlay, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: T.overlayBg, border: `1px solid ${T.border}`, width: '920px', maxWidth: '96vw', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: T.gold, boxShadow: `0 0 8px ${T.goldFaint8}` }} />
            <span style={{ fontSize: '13px', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.gold, fontWeight: 600 }}>Market Intelligence Feed</span>
            <span style={{ fontSize: '11px', color: T.text7, fontFamily: "'DM Mono', monospace", background: T.inputBg, padding: '2px 8px', border: `1px solid ${T.borderItem}` }}>{filtered.length} articles</span>
          </div>
          <div onClick={onClose} style={{ fontSize: '16px', color: T.text7, cursor: 'pointer', padding: '4px 8px', border: '1px solid transparent', transition: 'all 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.text3; e.currentTarget.style.borderColor = T.borderFaint }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.text7; e.currentTarget.style.borderColor = 'transparent' }}>✕</div>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${T.goldFaint}` }}>
          {(['watchlist', 'general'] as const).map((t) => (
            <div key={t} onClick={() => switchTab(t)} style={{ padding: '12px 24px', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', color: tab === t ? T.gold : T.text6, borderBottom: `2px solid ${tab === t ? T.gold : 'transparent'}`, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '7px' }}>
              {t === 'watchlist' ? '📋 Watchlist' : '🌐 General Market'}
              <span style={{ fontSize: '10px', color: tab === t ? T.goldText2 : T.text8, background: T.inputBg, padding: '1px 6px' }}>
                {t === 'watchlist' ? watchlistNews.length : generalNews.length}
              </span>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${T.goldFaint2}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px', background: T.inputBg }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search headlines and AI summaries..." autoFocus
            style={{ background: T.inputBg, border: `1px solid ${T.borderFaint}`, color: T.text, padding: '9px 14px', fontSize: '13px', fontFamily: "'DM Mono', monospace", outline: 'none', width: '100%', transition: 'border-color 0.15s' }}
            onFocus={(e) => (e.target.style.borderColor = T.goldFaint9)}
            onBlur={(e) => (e.target.style.borderColor = T.borderFaint)} />
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {(['all', 'bullish', 'bearish'] as const).map((s) => (
              <div key={s} onClick={() => setSentiment(s)} style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 11px', cursor: 'pointer', fontWeight: 600, border: `1px solid ${sentiment === s ? (s === 'bullish' ? T.greenBorder3 : s === 'bearish' ? T.redBorder4 : T.goldFaint9) : T.borderItem}`, color: sentiment === s ? (s === 'bullish' ? T.green : s === 'bearish' ? T.red : T.gold) : T.text6, background: sentiment === s ? (s === 'bullish' ? T.greenFaint3 : s === 'bearish' ? T.redFaint3 : T.goldFaint2) : 'transparent', transition: 'all 0.15s' }}>
                {s === 'all' ? 'All' : s === 'bullish' ? '▲ Bullish' : '▼ Bearish'}
              </div>
            ))}
            {allTickers.length > 0 && <div style={{ width: '1px', height: '16px', background: T.borderFaint }} />}
            {allTickers.map((tk) => (
              <div key={tk} onClick={() => setActiveTicker(activeTicker === tk ? null : tk)} style={{ fontSize: '10px', padding: '3px 9px', cursor: 'pointer', fontWeight: 700, fontFamily: "'DM Mono', monospace", border: `1px solid ${activeTicker === tk ? T.goldFaint9 : T.borderItem}`, color: activeTicker === tk ? T.gold : T.text6, background: activeTicker === tk ? T.goldFaint2 : 'transparent', transition: 'all 0.15s' }}>{tk}</div>
            ))}
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: T.text9, fontSize: '13px', fontStyle: 'italic' }}>No articles match your filters</div>
          ) : (
            filtered.map((n, i) => (
              <div key={i} style={{ padding: '18px 24px', borderBottom: `1px solid ${T.goldFaint2}`, cursor: n.url ? 'pointer' : 'default', transition: 'background 0.12s', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 16px' }}
                onClick={() => n.url && window.open(n.url, '_blank', 'noopener')}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.goldFaint)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', fontWeight: 700, letterSpacing: '0.08em', color: n.up ? T.green : T.red, border: `1px solid ${n.up ? T.greenBorder2 : T.redBorder2}`, background: n.up ? T.greenFaint : T.redFaint, fontFamily: "'DM Mono', monospace" }}>{n.ticker}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: n.up ? T.green : T.red }}>{n.sent}</span>
                    {n.source && <span style={{ fontSize: '10px', color: T.text8, fontFamily: "'DM Mono', monospace" }}>{n.source}</span>}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 500, color: T.text, marginBottom: '8px', lineHeight: 1.55, fontFamily: "'Playfair Display', serif" }}>{n.headline}</div>
                  {n.ai && <div style={{ fontSize: '12.5px', color: T.goldText, lineHeight: 1.65, borderLeft: `2px solid ${T.goldFaint6}`, paddingLeft: '10px', fontStyle: 'italic' }}>{n.ai}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: '2px', minWidth: '48px' }}>
                  <span style={{ fontSize: '11px', color: T.text8, fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>{n.time}</span>
                  {n.url && <span style={{ fontSize: '14px', color: T.goldText3 }}>↗</span>}
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ padding: '10px 24px', borderTop: `1px solid ${T.goldFaint2}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.inputBg }}>
          <span style={{ fontSize: '10px', color: T.text9, fontFamily: "'DM Mono', monospace" }}>Powered by Finnhub · Refreshes every 90s</span>
          <span style={{ fontSize: '10px', color: T.text9, fontFamily: "'DM Mono', monospace" }}>ESC to close</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [traderType, setTraderType] = useState<string>('swing')
  const [activeWl, setActiveWl] = useState(0)
  const [chatInput, setChatInput] = useState('')
  const [wakeOn, setWakeOn] = useState(true)
  const [speechOn, setSpeechOn] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [isDark, setIsDark] = useState<boolean>(() => {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(DASHBOARD_PREFS_KEY)
    if (!raw) return true
    const parsed = JSON.parse(raw) as Partial<DashboardPrefs>
    return typeof parsed.isDark === 'boolean' ? parsed.isDark : true
  } catch {
    return true
  }
})

const [layout, setLayout] = useState<LayoutId>(() => {
  if (typeof window === 'undefined') return '2x2'
  try {
    const raw = window.localStorage.getItem(DASHBOARD_PREFS_KEY)
    if (!raw) return '2x2'
    const parsed = JSON.parse(raw) as Partial<DashboardPrefs>
    return parsed.layout && ['2x2', 'focus', '2col', '2row'].includes(parsed.layout)
      ? parsed.layout
      : '2x2'
  } catch {
    return '2x2'
  }
})

// slotPanels: which panel shows in each slot [slot0, slot1, slot2, slot3]
const [slotPanels, setSlotPanels] = useState<PanelId[]>(() => {
  if (typeof window === 'undefined') return ['pulse', 'events', 'news', 'summaries']
  try {
    const raw = window.localStorage.getItem(DASHBOARD_PREFS_KEY)
    if (!raw) return ['pulse', 'events', 'news', 'summaries']
    const parsed = JSON.parse(raw) as Partial<DashboardPrefs>
    const validPanels = ['pulse', 'events', 'news', 'summaries']
    const arr = Array.isArray(parsed.slotPanels) ? parsed.slotPanels.filter((p): p is PanelId => validPanels.includes(p)) : []
    return arr.length === 4 ? arr : ['pulse', 'events', 'news', 'summaries']
  } catch {
    return ['pulse', 'events', 'news', 'summaries']
  }
})

const [newsTab, setNewsTab] = useState<'watchlist' | 'general'>(() => {
  if (typeof window === 'undefined') return 'watchlist'
  try {
    const raw = window.localStorage.getItem(DASHBOARD_PREFS_KEY)
    if (!raw) return 'watchlist'
    const parsed = JSON.parse(raw) as Partial<DashboardPrefs>
    return parsed.newsTab === 'general' ? 'general' : 'watchlist'
  } catch {
    return 'watchlist'
  }
})
  const [voiceTriggered, setVoiceTriggered] = useState(false)

  const isMobile = useIsMobile(960)
  const [mobilePanel, setMobilePanel] = useState<PanelId>('pulse')
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const touchStartXRef = useRef<number>(0)
const touchStartYRef = useRef<number>(0)

const MOBILE_PANELS: PanelId[] = ['pulse', 'events', 'news', 'summaries', 'chat']
const MOBILE_PANEL_LABELS: Record<PanelId, { emoji: string; label: string }> = {
  pulse:     { emoji: '📊', label: 'Pulse' },
  events:    { emoji: '📅', label: 'Events' },
  news:      { emoji: '📰', label: 'News' },
  summaries: { emoji: '⏱', label: 'Briefs' },
  chat:      { emoji: '💬', label: 'Chat' },
}

function handleTouchStart(e: React.TouchEvent) {
  touchStartXRef.current = e.touches[0].clientX
  touchStartYRef.current = e.touches[0].clientY
}

function handleTouchEnd(e: React.TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchStartXRef.current
  const dy = e.changedTouches[0].clientY - touchStartYRef.current
  if (Math.abs(dx) < 44 || Math.abs(dy) > Math.abs(dx) * 0.8) return
  const idx = MOBILE_PANELS.indexOf(mobilePanel)
  if (dx < 0 && idx < MOBILE_PANELS.length - 1) setMobilePanel(MOBILE_PANELS[idx + 1])
  if (dx > 0 && idx > 0) setMobilePanel(MOBILE_PANELS[idx - 1])
}

  // activeBriefing: summary that has just auto-played, sits on top bar for 30min
  const [activeBriefing, setActiveBriefing] = useState<{ id: string; name: string; content: string; expiresAt: number; manualPlayUsed: boolean } | null>(null)

  const T = isDark ? DARK : LIGHT

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recordedChunksRef = useRef<BlobPart[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const autoSendRef = useRef<string | null>(null)
  const stopThinkingChimesRef = useRef<(() => void) | null>(null)

  const [tickerData, setTickerData] = useState<{ sym: string; price?: string; change?: string; up?: boolean }[]>(DEFAULT_TICKER_DATA)
  const [watchlist, setWatchlist] = useState<{ ticker: string; bars: number[]; price?: string; change?: string; up?: boolean }[]>(DEFAULT_WATCHLIST_TICKERS.map((ticker) => makeWlItem(ticker)))
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [currentEtDate, setCurrentEtDate] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsType, setSettingsType] = useState<string>('swing')
  const [savingType, setSavingType] = useState(false)
  const [messages, setMessages] = useState<{ role: string; time: string; text: string; dbId?: string }[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [watchlistNews, setWatchlistNews] = useState<any[]>([])
  const [generalNews, setGeneralNews] = useState<any[]>([])
  const [pulse, setPulse] = useState<{ headline: string; summary: string; riskNote: string } | null>(null)
  const [pulseLoading, setPulseLoading] = useState(false)
  const [marketState, setMarketState] = useState<any | null>(null)
  const [marketStateLoading, setMarketStateLoading] = useState(false)
  const [intraday, setIntraday] = useState<any[]>([])
  const [marketSession, setMarketSession] = useState<'open' | 'pre' | 'after' | 'closed'>('closed')
  const [showCalendar, setShowCalendar] = useState(false)
  const [showNewsModal, setShowNewsModal] = useState(false)
  const [showWlEditor, setShowWlEditor] = useState(false)
  const [wlSearch, setWlSearch] = useState('')
  const [wlSearchResults, setWlSearchResults] = useState<{ sym: string; name: string; type: string }[]>([])
  const [wlSearching, setWlSearching] = useState(false)

  const initialDateTime = getDateTimeInputDefaults()
  const [scheduledSummaries, setScheduledSummaries] = useState<ScheduledSummary[]>([])
  const [pastBriefings, setPastBriefings] = useState<PastBriefing[]>([])
  const [showSummaryEditor, setShowSummaryEditor] = useState(false)
  const [summaryWeekOffset, setSummaryWeekOffset] = useState(0)
  const [summaryDayOffset, setSummaryDayOffset] = useState(0)
  const [summaryView, setSummaryView] = useState<'day' | 'week'>('week')
  const [summaryTab, setSummaryTab] = useState<'scheduled' | 'past'>('scheduled')
  const [selectedPastSummary, setSelectedPastSummary] = useState<PastBriefing | null>(null)
  const [summaryName, setSummaryName] = useState('')
  const [summaryDate, setSummaryDate] = useState(initialDateTime.date)
  const [summaryTime, setSummaryTime] = useState(initialDateTime.time)
  const [summaryPrompt, setSummaryPrompt] = useState('')
  const [summaryIcon, setSummaryIcon] = useState('🌅')
  const [summaryTopColor, setSummaryTopColor] = useState('#e8b84b')
  const [countdownTick, setCountdownTick] = useState(Date.now())
  const processedSummaryIdsRef = useRef<Set<string>>(new Set())

  // Expire activeBriefing 30 min after it auto-played
  useEffect(() => {
    if (!activeBriefing) return
    const msLeft = activeBriefing.expiresAt - Date.now()
    if (msLeft <= 0) { setActiveBriefing(null); return }
    const t = setTimeout(() => setActiveBriefing(null), msLeft)
    return () => clearTimeout(t)
  }, [activeBriefing])

  const [alerts, setAlerts] = useState<{ id: string; ticker: string; condition: string; target_price: number; triggered: boolean }[]>([])
  const [showAlertEditor, setShowAlertEditor] = useState(false)
  const [alertTicker, setAlertTicker] = useState('')
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above')
  const [alertPrice, setAlertPrice] = useState('')
  const [alertSaving, setAlertSaving] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const wlSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const watchlistRef = useRef(watchlist)

  useEffect(() => { watchlistRef.current = watchlist }, [watchlist])

  // Auto-send after voice recording stops and transcript is ready
  useEffect(() => {
    if (!isRecordingVoice && autoSendRef.current) {
      const pending = autoSendRef.current
      autoSendRef.current = null
      setChatInput(pending)
      // Small delay so React can flush the chatInput state before handleSend reads it
      setTimeout(() => {
        handleSendWithText(pending, true)
      }, 50)
    }
  }, [isRecordingVoice])
  useEffect(() => {
    const timer = setInterval(() => setCountdownTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!user || !scheduledSummaries.length) return
    const interval = setInterval(async () => {
      const now = Date.now()
      const due = scheduledSummaries.filter((s) => s.enabled).filter((s) => new Date(s.run_at).getTime() <= now).filter((s) => !processedSummaryIdsRef.current.has(s.id)).sort((a, b) => new Date(a.run_at).getTime() - new Date(b.run_at).getTime())
      if (!due.length) return
      const nextDue = due[0]
      processedSummaryIdsRef.current.add(nextDue.id)
      await runScheduledSummary(nextDue)
    }, 15000)
    return () => clearInterval(interval)
  }, [user, scheduledSummaries, speechOn, watchlist, traderType, tickerData, messages, watchlistNews, generalNews, intraday])

  useEffect(() => {
    return () => {
      stopCurrentAudio()
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      audioContextRef.current?.close()
    }
  }, [])

  useEffect(() => {
  if (typeof window === 'undefined') return

  const prefs: DashboardPrefs = {
    isDark,
    layout,
    slotPanels,
    newsTab,
  }

  try {
    window.localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(prefs))
  } catch {}
}, [isDark, layout, slotPanels, newsTab])

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('trader_type').eq('id', user.id).single()
      if (!profile?.trader_type) { router.push('/onboarding'); return }
      if (profile?.trader_type) { setTraderType(profile.trader_type); setSettingsType(profile.trader_type) }
      const { data: wlRows } = await supabase.from('watchlist').select('ticker, company_name, added_at').eq('user_id', user.id).order('added_at', { ascending: true })
      let resolvedWl: typeof watchlist
      if (wlRows?.length) {
      resolvedWl = wlRows.map((r) => makeWlItem(r.ticker, r.company_name))
      setWatchlist(resolvedWl)
      }
      else {
        resolvedWl = watchlist
        const seedRows = resolvedWl.map((w, i) => ({ user_id: user.id, ticker: w.ticker, company_name: w.ticker, added_at: new Date(Date.now() + i).toISOString() }))
        await supabase.from('watchlist').upsert(seedRows, { onConflict: 'user_id,ticker' })
      }
      const { data: alertRows } = await supabase.from('alerts').select('id, ticker, condition, target_price, triggered').eq('user_id', user.id).order('created_at', { ascending: true })
      if (alertRows) setAlerts(alertRows)
      const midnightUTC = getStartOfTodayETUtcIso()
      const { data: convos } = await supabase.from('conversations').select('id, role, content, created_at').eq('user_id', user.id).gte('created_at', midnightUTC).order('created_at', { ascending: true })
      setMessages((convos ?? []).map((c) => ({ role: c.role === 'assistant' ? 'monday' : 'user', time: new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(c.created_at)), text: c.content, dbId: c.id })))
      await doFetchPrices(resolvedWl, profile?.trader_type ?? traderType, true)
      fetchBothNews(resolvedWl.map((w) => w.ticker))
      await loadScheduledSummariesFromSupabase(user.id)
      await loadPastBriefingsFromSupabase(user.id)
    }
    getUser()

    function getSession(): 'open' | 'pre' | 'after' | 'closed' {
      const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const day = et.getDay(); const t = et.getHours() * 60 + et.getMinutes()
      if (day === 0 || day === 6) return 'closed'
      if (t >= 570 && t < 960) return 'open'
      if (t >= 240 && t < 570) return 'pre'
      if (t >= 960 && t < 1200) return 'after'
      return 'closed'
    }
    function getEtDateLabel() {
      return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
    }
    setCurrentEtDate(getEtDateLabel()); setMarketSession(getSession())

    const timer = setInterval(() => {
      const el = document.getElementById('mktTime')
      if (el) {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).formatToParts(new Date())
        const h = parts.find((p) => p.type === 'hour')?.value; const m = parts.find((p) => p.type === 'minute')?.value; const s = parts.find((p) => p.type === 'second')?.value; const ap = parts.find((p) => p.type === 'dayPeriod')?.value
        el.textContent = `${h}:${m}:${s} ${ap} ET`
      }
      setCurrentEtDate(getEtDateLabel()); setMarketSession(getSession())
    }, 1000)

    async function fetchNews(tab = 'watchlist', tickersOverride?: string[]) {
      try {
        const symbols = tickersOverride ?? watchlistRef.current.map((w) => w.ticker)
        const tickers = symbols.join(',')
        const url = tab === 'watchlist' && tickers ? `/api/news?type=watchlist&tickers=${encodeURIComponent(tickers)}` : `/api/news?type=general`
        const res = await fetch(url); const data = await res.json()
        if (data.news?.length) { if (tab === 'watchlist') setWatchlistNews(data.news); else setGeneralNews(data.news) }
      } catch (err) { console.error('Failed to fetch news:', err) }
    }
    async function fetchBothNews(tickersOverride?: string[]) {
      const symbols = tickersOverride ?? watchlistRef.current.map((w) => w.ticker)
      fetchNews('watchlist', symbols); fetchNews('general')
    }
    async function fetchIntraday() {
      try { const res = await fetch('/api/intraday'); const data = await res.json(); if (data.intraday?.length) setIntraday(data.intraday) } catch {}
    }
    fetchIntraday(); fetchMarketState()
    const newsInterval = setInterval(() => fetchBothNews(), 90 * 1000)
    const intradayInterval = setInterval(fetchIntraday, 2 * 60 * 1000)
    const marketStateInterval = setInterval(fetchMarketState, 60 * 1000)
    return () => { clearInterval(timer); clearInterval(newsInterval); clearInterval(intradayInterval); clearInterval(marketStateInterval) }
  }, [])

  async function fetchMarketState() {
    setMarketStateLoading(true)
    try { const res = await fetch('/api/market-state/latest', { cache: 'no-store' }); const data = await res.json(); if (data?.ok && data?.snapshot) setMarketState(data.snapshot) }
    catch {} finally { setMarketStateLoading(false) }
  }

  useEffect(() => {
    const priceInterval = setInterval(() => doFetchPrices(watchlistRef.current), 60000)
    return () => clearInterval(priceInterval)
  }, [])

  async function doFetchPrices(wl: typeof watchlist, type?: string, triggerPulse = false) {
    try {
      const tickers = wl.map((w) => w.ticker).join(',')
      const res = await fetch(`/api/prices?tickers=${tickers}`); const data = await res.json()
      if (!data.tickers?.length) return
      setWatchlist((prev) => prev.map((item) => { const live = data.tickers.find((t: any) => t.sym === item.ticker); return live ? { ...item, price: live.price, change: live.change, up: live.up } : item }))
      setTickerData(data.tickers)
      const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).formatToParts(new Date())
      setLastUpdated(`${p.find((x) => x.type === 'hour')?.value}:${p.find((x) => x.type === 'minute')?.value}:${p.find((x) => x.type === 'second')?.value} ${p.find((x) => x.type === 'dayPeriod')?.value} ET`)
      const enrichedWl = wl.map((item) => { const live = data.tickers.find((t: any) => t.sym === item.ticker); return live ? { ...item, price: live.price, change: live.change, up: live.up } : item })
      if (triggerPulse) fetchPulse(type ?? traderType, enrichedWl)
    } catch {}
  }

  async function fetchPulse(type: string, wl: typeof watchlist) {
    setPulseLoading(true)
    try { const res = await fetch('/api/pulse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ watchlist: wl, traderType: type, prices: tickerData }) }); const data = await res.json(); if (data.pulse) setPulse(data.pulse) }
    catch {} finally { setPulseLoading(false) }
  }

  async function handleNewsTab(tab: 'watchlist' | 'general') {
    setNewsTab(tab)
    try {
      const tickers = watchlistRef.current.map((w) => w.ticker).join(',')
      const url = tab === 'watchlist' && tickers ? `/api/news?type=watchlist&tickers=${encodeURIComponent(tickers)}` : `/api/news?type=general`
      const res = await fetch(url); const data = await res.json()
      if (data.news?.length) { if (tab === 'watchlist') setWatchlistNews(data.news); else setGeneralNews(data.news) }
    } catch {}
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isThinking])

  function stopCurrentAudio() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current = null }
    setIsSpeaking(false)
  }

  function playChime(type: 'alert' | 'tick') {
  try {
    const AudioCtx = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext
    if (!AudioCtx) return
    const actx = new AudioCtx()
    if (actx.state === 'suspended') actx.resume()
    if (type === 'alert') {
      const osc1 = actx.createOscillator()
      const osc2 = actx.createOscillator()
      const gain = actx.createGain()
      osc1.type = 'sine'; osc2.type = 'sine'
      osc1.frequency.setValueAtTime(440, actx.currentTime)
      osc2.frequency.setValueAtTime(587, actx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.0, actx.currentTime)
      gain.gain.linearRampToValueAtTime(0.18, actx.currentTime + 0.03)
      gain.gain.setValueAtTime(0.18, actx.currentTime + 0.10)
      gain.gain.linearRampToValueAtTime(0.0, actx.currentTime + 0.38)
      osc1.connect(gain); osc2.connect(gain); gain.connect(actx.destination)
      osc1.start(actx.currentTime); osc1.stop(actx.currentTime + 0.14)
      osc2.start(actx.currentTime + 0.12); osc2.stop(actx.currentTime + 0.38)
      osc2.onended = () => void actx.close()
    } else {
      const osc = actx.createOscillator()
      const gain = actx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, actx.currentTime)
      gain.gain.setValueAtTime(0.0, actx.currentTime)
      gain.gain.linearRampToValueAtTime(0.06, actx.currentTime + 0.02)
      gain.gain.linearRampToValueAtTime(0.0, actx.currentTime + 0.10)
      osc.connect(gain); gain.connect(actx.destination)
      osc.start(actx.currentTime); osc.stop(actx.currentTime + 0.10)
      osc.onended = () => void actx.close()
    }
  } catch {}
}

function startThinkingChimes(): () => void {
  let cancelled = false
  async function loop() {
    if (cancelled) return
    playChime('tick')
    await new Promise(r => setTimeout(r, 360))
    if (cancelled) return
    playChime('tick')
    await new Promise(r => setTimeout(r, 360))
    if (cancelled) return
    playChime('tick')
    await new Promise(r => setTimeout(r, 1000))
    if (!cancelled) loop()
  }
  loop()
  return () => { cancelled = true }
}
  
  async function speakText(text: string, onEnded?: () => void) {
    try {
      stopCurrentAudio()
      const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
    text,
    watchlist: watchlist.map((w: any) => ({
      ticker: w.ticker,
      company_name: w.company_name,
    })),
  }),
})
      if (!res.ok) { console.error('TTS failed:', res.status); return }
      const blob = await res.blob(); const url = URL.createObjectURL(blob); const audio = new Audio(url)
      audioRef.current = audio; setIsSpeaking(true)
      audio.onended = () => { URL.revokeObjectURL(url); setIsSpeaking(false); if (audioRef.current === audio) audioRef.current = null; onEnded?.() }
      audio.onerror = () => { URL.revokeObjectURL(url); setIsSpeaking(false); if (audioRef.current === audio) audioRef.current = null }
      await audio.play()
    } catch { setIsSpeaking(false) }
  }

  async function startVoiceRecording() {
    try {
      if (isRecordingVoice) return
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' })
      recordedChunksRef.current = []
      mediaRecorderRef.current = recorder

      // ── Silence detection via Web Audio analyser ──────────────────────────
      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const SILENCE_THRESHOLD = 8   // RMS below this = silence
      const SILENCE_DELAY_MS = 2000 // stop after 2s of continuous silence

      function checkSilence() {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return
        analyser.getByteTimeDomainData(dataArray)
        // RMS amplitude
        const rms = Math.sqrt(dataArray.reduce((sum, v) => sum + (v - 128) ** 2, 0) / dataArray.length)
        if (rms < SILENCE_THRESHOLD) {
          // Start silence countdown if not already running
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              stopVoiceRecording()
            }, SILENCE_DELAY_MS)
          }
        } else {
          // Reset timer on any sound
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
        }
        requestAnimationFrame(checkSilence)
      }
      requestAnimationFrame(checkSilence)
      // ──────────────────────────────────────────────────────────────────────

      recorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunksRef.current.push(event.data) }

      recorder.onstop = async () => {
        // Clean up silence detection
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
        audioContextRef.current?.close(); audioContextRef.current = null
        try {
          const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          const form = new FormData(); form.append('audio', blob, 'monday-chat.webm')
          const res = await fetch('/api/transcribe', { method: 'POST', body: form }); const data = await res.json()
          const transcript = (data?.transcript || '').trim()
          if (transcript) {
            setVoiceTriggered(true)
            // Auto-send: set input then immediately trigger send via a ref flag
            setChatInput(transcript)
            autoSendRef.current = transcript
          }
        } catch {} finally {
          mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
          mediaStreamRef.current = null; mediaRecorderRef.current = null; recordedChunksRef.current = []; setIsRecordingVoice(false)
        }
      }

      recorder.start()
      setIsRecordingVoice(true)
    } catch { setIsRecordingVoice(false) }
  }

  function stopVoiceRecording() {
  if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
    mediaRecorderRef.current.stop()
    playChime('alert')
  }
}

  async function handleSendWithText(text: string, isVoice = false) {
    if (!text.trim() || isThinking) return
    setChatInput(''); const textarea = document.querySelector('textarea'); if (textarea) textarea.style.height = 'auto'
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date())
    const timeStr = `${p.find((x) => x.type === 'hour')?.value}:${p.find((x) => x.type === 'minute')?.value} ${p.find((x) => x.type === 'dayPeriod')?.value}`
    if (user) await supabase.from('conversations').insert({ user_id: user.id, role: 'user', content: text })
    setMessages((prev) => [...prev, { role: 'user', time: timeStr, text }])
    setIsThinking(true)
    stopThinkingChimesRef.current = startThinkingChimes()
    const history = messages.map((m) => ({ role: m.role === 'monday' ? 'assistant' : 'user', content: m.text }))
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, mode: 'chat', watchlist, traderType, prices: tickerData, history, news: [...watchlistNews, ...generalNews], intraday, userId: user?.id ?? 'anonymous' }) })
      const data = await res.json(); const reply = data.reply || 'Sorry, I could not get a response.'
      if (user) await supabase.from('conversations').insert({ user_id: user.id, role: 'assistant', content: reply })
      setMessages((prev) => [...prev, { role: 'monday', time: timeStr, text: reply }])
      if (isVoice && speechOn) {
        const endsWithQuestion = /\?\s*$/.test(reply.replace(/\[\/?(gold|green|red)\]/g, '').trim())
        void speakText(reply, endsWithQuestion ? () => startVoiceRecording() : undefined)
      }
    } catch {
      const errorReply = 'Connection error. Please try again.'
      setMessages((prev) => [...prev, { role: 'monday', time: timeStr, text: errorReply }])
      if (isVoice && speechOn) void speakText(errorReply)
    } finally {
  stopThinkingChimesRef.current?.()
  stopThinkingChimesRef.current = null
  setIsThinking(false)
}
  }

  async function handleSend() {
    const text = chatInput.trim(); if (!text || isThinking) return
    const wasVoice = voiceTriggered
    setVoiceTriggered(false)
    await handleSendWithText(text, wasVoice)
  }

  async function handleLogout() {
  await supabase.auth.signOut()
  router.replace('/login')
  router.refresh()
}

  async function addToWatchlist(sym: string, name?: string) {
    const upper = sym.toUpperCase(); if (watchlist.some((w) => w.ticker === upper)) return; if (watchlist.length >= 20) return
    const newItem = makeWlItem(upper, name ?? upper)
    setWatchlist((prev) => [...prev, newItem])
    await supabase.from('watchlist').insert({ user_id: user?.id, ticker: upper, company_name: name ?? upper, added_at: new Date().toISOString() })
    try { const res = await fetch(`/api/prices?tickers=${upper}`); const data = await res.json(); if (data.tickers?.length) { const live = data.tickers.find((t: any) => t.sym === upper); if (live) setWatchlist((prev) => prev.map((w) => (w.ticker === upper ? { ...w, price: live.price, change: live.change, up: live.up } : w))) } } catch {}
  }

  async function removeFromWatchlist(sym: string) {
    const upper = sym.toUpperCase(); setWatchlist((prev) => prev.filter((w) => w.ticker !== upper)); setActiveWl(0)
    await supabase.from('watchlist').delete().eq('user_id', user?.id).eq('ticker', upper)
  }

  async function searchTickers(query: string) {
    if (!query.trim()) { setWlSearchResults([]); return }; setWlSearching(true)
    try { const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`); const data = await res.json(); setWlSearchResults(data.results ?? []) }
    catch { setWlSearchResults([{ sym: query.toUpperCase(), name: query.toUpperCase(), type: tickerType(query) }]) }
    finally { setWlSearching(false) }
  }

  function handleWlSearchInput(val: string) {
    setWlSearch(val); if (wlSearchRef.current) clearTimeout(wlSearchRef.current)
    wlSearchRef.current = setTimeout(() => searchTickers(val), 350)
  }

  async function saveTraderType() {
    if (!user || settingsType === traderType) { setShowSettings(false); return }
    setSavingType(true); await supabase.from('profiles').update({ trader_type: settingsType, updated_at: new Date().toISOString() }).eq('id', user.id)
    setTraderType(settingsType); setSavingType(false); setShowSettings(false)
  }

  async function addAlert() {
    if (!user || !alertTicker || !alertPrice || alerts.length >= 10) return
    const price = parseFloat(alertPrice.replace(/[^0-9.]/g, '')); if (isNaN(price)) return
    setAlertSaving(true)
    const { data } = await supabase.from('alerts').insert({ user_id: user.id, ticker: alertTicker.toUpperCase(), condition: alertCondition, target_price: price, triggered: false, created_at: new Date().toISOString() }).select().single()
    if (data) setAlerts((prev) => [...prev, data]); setAlertTicker(''); setAlertPrice(''); setAlertSaving(false); setShowAlertEditor(false)
  }

  async function removeAlert(id: string) { setAlerts((prev) => prev.filter((a) => a.id !== id)); await supabase.from('alerts').delete().eq('id', id) }

  async function loadScheduledSummariesFromSupabase(userId: string) {
    const { data } = await supabase.from('scheduled_summaries').select('*').eq('user_id', userId).eq('enabled', true).order('run_at', { ascending: true })
    setScheduledSummaries((data as ScheduledSummary[]) ?? [])
  }

  async function loadPastBriefingsFromSupabase(userId: string) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase.from('briefings').select('id, user_id, title, content, audio_url, briefing_date').eq('user_id', userId).gte('briefing_date', cutoff).order('briefing_date', { ascending: false })
    setPastBriefings((data as PastBriefing[]) ?? [])
  }

  async function canScheduleOnEtDate(userId: string, runAtIso: string) {
    const targetEtDate = getEtDateKeyFromIso(runAtIso)
    const { data } = await supabase.from('scheduled_summaries').select('id, run_at').eq('user_id', userId).eq('enabled', true)
    const sameDayCount = (data ?? []).filter((row: any) => getEtDateKeyFromIso(row.run_at) === targetEtDate).length
    return sameDayCount < 6
  }

  async function addPresetSummary(preset: (typeof SUMMARY_PRESETS)[number], runAtIso: string) {
    if (!user) return
    if (new Date(runAtIso).getTime() <= Date.now()) { alert('Please choose a future date and time.'); return }
    const scheduledJsDay = new Date(new Date(runAtIso).toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay()
    if (scheduledJsDay === 0 || scheduledJsDay === 6) { alert('Scheduled summaries can only be created for Monday through Friday.'); return }
    const ok = await canScheduleOnEtDate(user.id, runAtIso)
    if (!ok) { alert('You can only have up to 6 scheduled summaries on the same day.'); return }
    await supabase.from('scheduled_summaries').insert({ user_id: user.id, name: preset.name, run_at: runAtIso, prompt: preset.prompt, icon: preset.icon, top_color: preset.top_color, type: preset.type, enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    await loadScheduledSummariesFromSupabase(user.id)
  }

  async function addCustomSummary() {
    if (!user || !summaryName.trim() || !summaryPrompt.trim()) return
    const runAtIso = buildRunAtIsoFromLocalInput(summaryDate, summaryTime)
    if (new Date(runAtIso).getTime() <= Date.now()) { alert('Please choose a future date and time.'); return }
    const scheduledJsDay = new Date(new Date(runAtIso).toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay()
    if (scheduledJsDay === 0 || scheduledJsDay === 6) { alert('Scheduled summaries can only be created for Monday through Friday.'); return }
    const ok = await canScheduleOnEtDate(user.id, runAtIso); if (!ok) { alert('You can only have up to 6 scheduled summaries on the same day.'); return }
    await supabase.from('scheduled_summaries').insert({ user_id: user.id, name: summaryName.trim(), run_at: runAtIso, prompt: summaryPrompt.trim(), icon: summaryIcon, top_color: summaryTopColor, type: 'custom', enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    setSummaryName(''); const rd = getDateTimeInputDefaults(); setSummaryDate(rd.date); setSummaryTime(rd.time); setSummaryPrompt(''); setSummaryIcon('🌅'); setSummaryTopColor('#e8b84b'); setShowSummaryEditor(false)
    await loadScheduledSummariesFromSupabase(user.id)
  }

  async function removeScheduledSummary(id: string) {
    if (!user) return
    await supabase.from('scheduled_summaries').update({ enabled: false, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
    await loadScheduledSummariesFromSupabase(user.id)
  }

  async function runScheduledSummary(summary: ScheduledSummary) {
    if (!user) return
    try {
      const history = messages.map((m) => ({ role: m.role === 'monday' ? 'assistant' : 'user', content: m.text }))
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Please deliver the following briefing now, speaking directly to the user based on current market data: ${summary.prompt}`, mode: 'summary', watchlist, traderType, prices: tickerData, history, news: [...watchlistNews, ...generalNews], intraday, userId: user.id }) })
      const data = await res.json(); const reply = data.reply || 'Scheduled summary could not be generated.'; const nowIso = new Date().toISOString()
      await supabase.from('briefings').insert({ user_id: user.id, title: summary.name, content: reply, audio_url: null, briefing_date: nowIso })
      await supabase.from('scheduled_summaries').update({ enabled: false, updated_at: nowIso }).eq('id', summary.id).eq('user_id', user.id)
      const timeStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date())
      setMessages((prev) => [...prev, { role: 'monday', time: timeStr, text: reply }])
      // Auto-play the briefing
      await speakText(reply)
      // Set activeBriefing: stays on top bar for 30 min, one manual replay allowed
      setActiveBriefing({ id: summary.id, name: summary.name, content: reply, expiresAt: Date.now() + 30 * 60 * 1000, manualPlayUsed: false })
      await loadScheduledSummariesFromSupabase(user.id); await loadPastBriefingsFromSupabase(user.id)
    } catch {}
  }

  const showSuggestions = messages.length === 0 && !isThinking
  const pulseLabel = PULSE_LABEL[traderType] || '📊 Portfolio Pulse'
  const enabledSummaries = scheduledSummaries.filter((s) => s.enabled)

  const nextSummary = useMemo(() => {
    const future = enabledSummaries.filter((s) => new Date(s.run_at).getTime() > Date.now()).sort((a, b) => new Date(a.run_at).getTime() - new Date(b.run_at).getTime())
    return future[0] ?? null
  }, [enabledSummaries, countdownTick])

  const nextSummaryCountdown = nextSummary ? formatCountdown(new Date(nextSummary.run_at).getTime() - countdownTick) : null

  // Minutes remaining for activeBriefing window
  const activeBriefingMinsLeft = activeBriefing ? Math.max(0, Math.ceil((activeBriefing.expiresAt - countdownTick) / 60000)) : 0

  const activeTrader = TRADER_TYPES.find((t) => t.id === traderType) || TRADER_TYPES[1]
  const summaryWeek = useMemo(() => getSummaryWeekBounds(summaryWeekOffset), [summaryWeekOffset])
  const summaryDay = useMemo(() => getSummaryDayBounds(summaryDayOffset), [summaryDayOffset])

  const visibleScheduledSummaries = useMemo(() => {
    const rangeStart = summaryView === 'week' ? summaryWeek.start : summaryDay.start
    const rangeEnd = summaryView === 'week' ? summaryWeek.end : summaryDay.end
    return [...enabledSummaries].filter((s) => { const etDate = new Date(new Date(s.run_at).toLocaleString('en-US', { timeZone: 'America/New_York' })); const jsDay = etDate.getDay(); if (jsDay === 0 || jsDay === 6) return false; return isIsoInRange(s.run_at, rangeStart, rangeEnd) }).sort((a, b) => new Date(a.run_at).getTime() - new Date(b.run_at).getTime())
  }, [enabledSummaries, summaryWeek, summaryDay, summaryView])

  const visibleDaySummaries = useMemo(() => {
    return [...enabledSummaries].filter((s) => { const etDate = new Date(new Date(s.run_at).toLocaleString('en-US', { timeZone: 'America/New_York' })); const jsDay = etDate.getDay(); if (jsDay === 0 || jsDay === 6) return false; return isIsoInRange(s.run_at, summaryDay.start, summaryDay.end) }).sort((a, b) => new Date(a.run_at).getTime() - new Date(b.run_at).getTime())
  }, [enabledSummaries, summaryDay])

  const scheduledSummariesByDay = useMemo(() => {
    const dayBuckets: Record<number, ScheduledSummary[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] }
    visibleScheduledSummaries.forEach((summary) => {
      const etDate = new Date(new Date(summary.run_at).toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const jsDay = etDate.getDay(); if (jsDay === 0 || jsDay === 6) return
      dayBuckets[jsDay - 1].push(summary)
    })
    Object.values(dayBuckets).forEach((items) => items.sort((a, b) => new Date(a.run_at).getTime() - new Date(b.run_at).getTime()))
    return dayBuckets
  }, [visibleScheduledSummaries])

  const orderedPastBriefings = useMemo(() => [...pastBriefings].sort((a, b) => new Date(b.briefing_date).getTime() - new Date(a.briefing_date).getTime()), [pastBriefings])
  const selectedPastSummaryIndex = selectedPastSummary ? orderedPastBriefings.findIndex((b) => b.id === selectedPastSummary.id) : -1
  const previousPastSummary = selectedPastSummaryIndex >= 0 && selectedPastSummaryIndex < orderedPastBriefings.length - 1 ? orderedPastBriefings[selectedPastSummaryIndex + 1] : null
  const summaryDayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

  

  if (!user) {
    return (
      <div style={{ background: T.pageBg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.gold, fontFamily: 'Georgia, serif', fontSize: '12px', letterSpacing: '0.2em' }}>
        LOADING
      </div>
    )
  }

  // Session badge colors — adjust for light mode
  const sessionColor = marketSession === 'open' ? T.green : marketSession === 'pre' ? T.gold : marketSession === 'after' ? T.blue : T.text7
  const sessionGlow  = marketSession === 'open' ? T.greenGlow : marketSession === 'pre' ? T.goldFaint8 : marketSession === 'after' ? T.blueFaint2 : 'none'



  return (
    <>
      <WakeWordListener
        enabled={wakeOn}
        onDetected={() => {
          if (!isRecordingVoice && !isThinking) {
            startVoiceRecording()
          }
        }}
      />
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* ── MOBILE LAYOUT ── */}
      {isMobile && (
        <div style={{ background: T.pageBg, height: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif", color: T.text, overflow: 'hidden' }}>

          {/* Mobile ticker tape */}
          <div style={{ background: T.tickerBg, borderBottom: `1px solid ${T.border}`, height: '30px', display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30px', background: `linear-gradient(90deg,${T.tickerBg},transparent)`, zIndex: 2 }} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '30px', background: `linear-gradient(-90deg,${T.tickerBg},transparent)`, zIndex: 2 }} />
            <div style={{ display: 'flex', animation: 'scrollTicker 55s linear infinite', whiteSpace: 'nowrap' }}>
              {[...watchlist, ...watchlist].map((t, i) => (
                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0 14px', borderRight: `1px solid ${T.tickerBorder}`, fontSize: '11px', height: '30px', fontFamily: "'DM Mono', monospace" }}>
                  <span style={{ fontWeight: 600, color: T.tickerText }}>{t.ticker}</span>
                  <span style={{ color: t.price ? (t.up ? T.green : T.red) : T.text8, fontWeight: 500 }}>{t.change ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile top bar */}
          <div style={{ background: T.headerBg, borderBottom: `1px solid ${T.border}`, height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', flexShrink: 0 }}>
            {/* Hamburger button */}
            <div onClick={() => setMobileDrawerOpen(true)} style={{ width: '36px', height: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer', border: `1px solid ${T.borderFaint}`, background: T.inputBg, flexShrink: 0 }}>
              <div style={{ width: '14px', height: '1.5px', background: T.gold }} />
              <div style={{ width: '14px', height: '1.5px', background: T.gold }} />
              <div style={{ width: '14px', height: '1.5px', background: T.gold }} />
            </div>
            {/* Logo */}
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '17px', fontWeight: 600, fontStyle: 'italic', color: T.text }}>
              Hey <span style={{ color: T.gold }}>Monday</span>
            </div>
            {/* Right: session dot + theme */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: marketSession === 'open' ? T.green : marketSession === 'pre' ? T.gold : T.text7, boxShadow: marketSession === 'open' ? `0 0 6px ${T.greenGlow}` : 'none' }} />
              <div onClick={() => setIsDark(d => !d)} style={{ fontSize: '15px', cursor: 'pointer', color: T.gold }}>{isDark ? '☀' : '☾'}</div>
            </div>
          </div>

          {/* Panel tab bar */}
          <div style={{ background: T.headerBg, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', height: '40px', flexShrink: 0, overflowX: 'auto', padding: '0 6px', gap: '2px' }}>
            {MOBILE_PANELS.map(pid => (
              <div key={pid} onClick={() => setMobilePanel(pid)} style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', color: mobilePanel === pid ? T.gold : T.text6, background: mobilePanel === pid ? T.goldFaint2 : 'transparent', border: `1px solid ${mobilePanel === pid ? T.goldFaint7 : 'transparent'}`, borderRadius: '4px', transition: 'all 0.15s', letterSpacing: '0.05em', flexShrink: 0 }}>
                {MOBILE_PANEL_LABELS[pid].emoji} {MOBILE_PANEL_LABELS[pid].label}
              </div>
            ))}
            {/* Progress dots */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', paddingRight: '8px', alignItems: 'center', flexShrink: 0 }}>
              {MOBILE_PANELS.map(pid => (
                <div key={pid} style={{ width: mobilePanel === pid ? '14px' : '5px', height: '5px', borderRadius: '3px', background: mobilePanel === pid ? T.gold : T.text7, transition: 'all 0.2s' }} />
              ))}
            </div>
          </div>

          {/* Swipeable panel */}
          <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {mobilePanel === 'pulse' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.panelBg }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.gold, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: T.gold }} />
                    {PULSE_LABEL[traderType] || '📊 Portfolio Pulse'}
                  </div>
                  <div onClick={() => fetchPulse(traderType, watchlist)} style={{ fontSize: '10px', color: T.goldText2, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: '2px 8px', border: `1px solid ${T.goldFaint5}` }}>{pulseLoading ? '...' : '↻'}</div>
                </div>
                <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                  {pulseLoading && !pulse ? (
                    <div style={{ fontSize: '13px', color: T.goldText3, fontStyle: 'italic', fontFamily: "'Playfair Display', serif" }}>Analyzing your watchlist…</div>
                  ) : pulse ? (
                    <>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '17px', color: T.text, lineHeight: 1.75 }}>{pulse.headline}</div>
                      {pulse.summary && <div style={{ fontSize: '14px', color: T.textMuted, lineHeight: 1.65 }}>{pulse.summary}</div>}
                      {pulse.riskNote && <div style={{ fontSize: '13px', color: T.red, lineHeight: 1.55, borderLeft: `2px solid ${T.redBorder2}`, paddingLeft: '10px' }}>⚠ {pulse.riskNote}</div>}
                    </>
                  ) : null}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {watchlist.map((s, i) => (
                      <div key={i} style={{ background: s.change ? (s.up ? T.greenFaint3 : T.redFaint3) : T.inputBg, border: `1px solid ${s.change ? (s.up ? T.greenBorder2 : T.redBorder2) : T.borderItem}`, padding: '6px 10px', minWidth: '64px' }}>
                        <div style={{ fontSize: '10px', color: T.text5, fontFamily: "'DM Mono', monospace", marginBottom: '2px' }}>{s.ticker}</div>
                        <div style={{ fontSize: '13px', color: s.change ? (s.up ? T.green : T.red) : T.text8, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{s.change ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {mobilePanel === 'events' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.panelBg }}>
                <EventsPanel watchlistTickers={watchlist.map(s => s.ticker)} onOpenCalendar={() => setShowCalendar(true)} T={T} isDark={isDark} />
              </div>
            )}

            {mobilePanel === 'news' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.panelBg }}>
                <div style={{ padding: '0 14px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ display: 'flex' }}>
                    {(['watchlist', 'general'] as const).map(tab => (
                      <div key={tab} onClick={() => handleNewsTab(tab)} style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, padding: '12px 12px', cursor: 'pointer', color: newsTab === tab ? T.gold : T.text6, borderBottom: `2px solid ${newsTab === tab ? T.gold : 'transparent'}` }}>
                        {tab === 'watchlist' ? '📋 Mine' : '🌐 General'}
                      </div>
                    ))}
                  </div>
                  <div onClick={() => setShowNewsModal(true)} style={{ fontSize: '11px', color: T.goldText, cursor: 'pointer', padding: '4px 8px', border: `1px solid ${T.goldFaint6}` }}>All →</div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {(newsTab === 'watchlist' ? watchlistNews : generalNews).length === 0 ? (
                    <div style={{ padding: '24px 16px', fontSize: '12px', color: T.text7, fontStyle: 'italic' }}>Loading news…</div>
                  ) : (newsTab === 'watchlist' ? watchlistNews : generalNews).map((n, i) => (
                    <div key={i} style={{ padding: '12px 14px', borderBottom: `1px solid ${T.borderFaint2}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                        <span style={{ fontSize: '10px', padding: '2px 6px', fontWeight: 600, color: n.up ? T.green : T.red, border: `1px solid ${n.up ? T.greenBorder2 : T.redBorder2}` }}>{n.ticker}</span>
                        <span style={{ fontSize: '10px', color: n.up ? T.green : T.red, fontWeight: 600 }}>{n.sent}</span>
                        <span style={{ fontSize: '10px', color: T.text8, marginLeft: 'auto', fontFamily: "'DM Mono', monospace" }}>{n.time}</span>
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: T.text, marginBottom: '5px', lineHeight: 1.5, fontFamily: "'Playfair Display', serif" }}>{n.headline}</div>
                      <div style={{ fontSize: '12px', color: T.goldText4, lineHeight: 1.6, borderLeft: `2px solid ${T.newsAiBorder}`, paddingLeft: '7px', fontStyle: 'italic' }}>{n.ai}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mobilePanel === 'summaries' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.panelBg }}>
                <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.gold, fontWeight: 600 }}>Briefs</div>
                  <div onClick={() => setShowSummaryEditor(true)} style={{ fontSize: '11px', color: T.goldText, cursor: 'pointer' }}>Configure →</div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {scheduledSummaries.length === 0 ? (
                    <div style={{ color: T.text6, fontStyle: 'italic', paddingTop: '10px', fontSize: '13px' }}>No upcoming summaries. Tap Configure →</div>
                  ) : scheduledSummaries.sort((a, b) => new Date(a.run_at).getTime() - new Date(b.run_at).getTime()).map(s => {
                    const msUntil = new Date(s.run_at).getTime() - countdownTick
                    return (
                      <div key={s.id} style={{ background: T.cardBg, padding: '14px', borderTop: `3px solid ${s.top_color}`, border: `1px solid ${T.borderFaint3}` }}>
                        <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: T.text, marginBottom: '4px' }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: T.text5, fontFamily: "'DM Mono', monospace", marginBottom: '8px' }}>{formatSummaryRunAt(s.run_at)}</div>
                        <div style={{ display: 'inline-block', padding: '4px 10px', border: `1px solid ${T.goldFaint7}`, background: T.goldFaint2, color: T.gold, fontSize: '11px', fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>
                          {msUntil <= 0 ? 'READY' : formatCountdown(msUntil)}
                        </div>
                      </div>
                    )
                  })}
                  {pastBriefings.length > 0 && (
                    <>
                      <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldText2, marginTop: '8px', fontWeight: 600 }}>Past Briefs</div>
                      {pastBriefings.slice(0, 5).map(item => (
                        <div key={item.id} onClick={() => setSelectedPastSummary(item)} style={{ padding: '12px', borderBottom: `1px solid ${T.borderFaint3}`, cursor: 'pointer' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: T.text, marginBottom: '3px' }}>{item.title}</div>
                          <div style={{ fontSize: '10px', color: T.text5, fontFamily: "'DM Mono', monospace", marginBottom: '4px' }}>{formatSummaryRunAt(item.briefing_date)}</div>
                          <div style={{ fontSize: '12px', color: T.text4, lineHeight: 1.5, maxHeight: '36px', overflow: 'hidden' }}>{item.content}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {mobilePanel === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.panelBg }}>
                {/* Chat header */}
                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', background: T.avatarBg, border: `1px solid ${T.avatarBorder}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, color: T.gold, fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}>M</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: T.text, fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}>Monday</div>
                      <div style={{ fontSize: '9px', color: T.green, letterSpacing: '0.1em', textTransform: 'uppercase' }}>AI Market Intelligence</div>
                    </div>
                  </div>
                  <div onClick={() => { if (speechOn && isSpeaking) stopCurrentAudio(); setSpeechOn(v => !v) }} style={{ fontSize: '11px', color: speechOn ? T.green : T.text6, border: `1px solid ${speechOn ? T.greenBorder : T.borderItem}`, padding: '5px 10px', cursor: 'pointer' }}>
                    {speechOn ? (isSpeaking ? '🔊 Speaking' : '🔊 Voice On') : '🔇 Voice Off'}
                  </div>
                </div>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {messages.length === 0 && !isThinking ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldText3, marginBottom: '8px' }}>Ask Monday anything</div>
                      {SUGGESTED_QUESTIONS.slice(0, 6).map((q, i) => (
                        <div key={i} onClick={() => setChatInput(q.text)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: T.suggestBg, border: `1px solid ${T.suggestBorder}`, cursor: 'pointer' }}>
                          <span style={{ fontSize: '14px', flexShrink: 0 }}>{q.emoji}</span>
                          <span style={{ fontSize: '13px', color: T.text4, lineHeight: 1.4 }}>{q.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {messages.map((m, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '3px' }}>
                          <div style={{ maxWidth: '88%', padding: '9px 12px', fontSize: '13px', lineHeight: 1.7, background: m.role === 'monday' ? T.chatAiBg : T.chatUserBg, border: `1px solid ${m.role === 'monday' ? T.chatAiBorder : T.chatUserBorder}`, color: T.text }}>
                            <MondayText text={m.text} />
                          </div>
                          <div style={{ fontSize: '9px', color: T.text8, fontFamily: "'DM Mono', monospace" }}>
                            {m.role === 'monday' ? 'Monday' : 'You'} · {m.time}
                          </div>
                        </div>
                      ))}
                      {isThinking && (
                        <div style={{ padding: '9px 12px', fontSize: '13px', background: T.chatAiBg, border: `1px solid ${T.chatAiBorder}`, color: T.thinkingText, fontStyle: 'italic', width: 'fit-content' }}>
                          Monday is thinking…
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </>
                  )}
                </div>
                {/* Chat input */}
                <div style={{ padding: '10px 12px', borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
                    <textarea value={chatInput} onChange={(e) => { setChatInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} placeholder="Ask Monday anything..." rows={1} style={{ flex: 1, background: T.inputBg, border: `1px solid ${T.borderInput}`, color: T.text, padding: '10px 12px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none', resize: 'none', overflowY: 'hidden', lineHeight: '1.5', maxHeight: '100px' }} />
                    <div onClick={() => { if (isRecordingVoice) stopVoiceRecording(); else startVoiceRecording() }} style={{ width: '40px', height: '40px', background: isRecordingVoice ? T.redFaint4 : T.inputBg, border: `1px solid ${isRecordingVoice ? T.redBorder4 : T.borderItem}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      {isRecordingVoice ? <span style={{ color: T.red, fontSize: '14px' }}>◼</span> : <div style={{ width: '13px', height: '13px', borderRadius: '50%', background: '#f87171' }} />}
                    </div>
                    <div onClick={handleSend} style={{ width: '40px', height: '40px', background: T.goldFaint3, border: `1px solid ${T.goldFaint9}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', color: T.gold, flexShrink: 0 }}>➤</div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Mobile drawer */}
          {mobileDrawerOpen && (
            <>
              <div onClick={() => setMobileDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: T.backdropBlur, backdropFilter: 'blur(3px)', zIndex: 400 }} />
              <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '280px', background: T.sideBg, borderRight: `1px solid ${T.border}`, zIndex: 500, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '8px 0 40px rgba(0,0,0,0.4)', animation: 'slideInDrawer 0.22s ease' }}>
                <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontStyle: 'italic', color: T.text }}>Hey <span style={{ color: T.gold }}>Monday</span></div>
                  <div onClick={() => setMobileDrawerOpen(false)} style={{ fontSize: '18px', color: T.text6, cursor: 'pointer', padding: '4px 6px' }}>✕</div>
                </div>
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.borderFaint}` }}>
                  <div onClick={() => { router.push('/dashboard/settings'); setMobileDrawerOpen(false) }} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 11px', background: activeTrader.bgColor, border: `1px solid ${activeTrader.borderColor}`, cursor: 'pointer' }}>
                    <span style={{ fontSize: '13px' }}>{activeTrader.icon}</span>
                    <span style={{ fontSize: '11px', color: activeTrader.color, fontWeight: 600 }}>{activeTrader.label}</span>
                    <span style={{ fontSize: '10px', color: T.text6, marginLeft: '2px' }}>✎</span>
                  </div>
                </div>
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.borderFaint}` }}>
                  <div onClick={() => setWakeOn(!wakeOn)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: wakeOn ? T.greenFaint3 : T.inputBg, border: `1px solid ${wakeOn ? T.greenBorder : T.borderItem}`, cursor: 'pointer' }}>
                    <div style={{ width: '26px', height: '15px', borderRadius: '8px', background: wakeOn ? T.green : T.text7, position: 'relative', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: '1.5px', left: wakeOn ? '13px' : '1.5px', width: '12px', height: '12px', borderRadius: '50%', background: '#fff', transition: 'left 0.25s' }} />
                    </div>
                    <span style={{ fontSize: '10px', color: wakeOn ? T.green : T.text6, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}>
                      {wakeOn ? 'Hey Monday On' : 'Wake Word Off'}
                    </span>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                  <div style={{ padding: '8px 16px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: T.goldText, fontWeight: 600 }}>Watchlist</div>
                    <div onClick={() => { setShowWlEditor(true); setMobileDrawerOpen(false) }} style={{ color: T.goldText, cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>+</div>
                  </div>
                  {watchlist.map((s, i) => (
                    <div key={s.ticker} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: '8px', borderLeft: i === activeWl ? `2px solid ${T.gold}` : '2px solid transparent', background: i === activeWl ? T.wlActive : 'transparent' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', width: '42px', color: i === activeWl ? T.gold : T.text3, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{s.ticker}</div>
                      <div style={{ flex: 1 }} />
                      <div style={{ fontSize: '12px', color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>{s.price ?? '—'}</div>
                      <div style={{ fontSize: '12px', color: s.change ? (s.up ? T.green : T.red) : T.text8, fontFamily: "'DM Mono', monospace", fontWeight: 600, minWidth: '46px', textAlign: 'right' }}>{s.change ?? '—'}</div>
                    </div>
                  ))}
                  {/* Alerts */}
                  {alerts.length > 0 && (
                    <div style={{ padding: '12px 16px 6px', borderTop: `1px solid ${T.borderFaint}`, marginTop: '8px' }}>
                      <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: T.goldText, fontWeight: 600, marginBottom: '8px' }}>Alerts</div>
                      {alerts.map(a => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: a.triggered ? T.green : T.text6, flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", color: T.text5, flex: 1 }}>
                            <span style={{ color: T.text3, fontWeight: 600 }}>{a.ticker}</span> {a.condition} ${a.target_price}
                          </span>
                          {a.triggered && <span style={{ fontSize: '11px', color: T.green }}>✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div onClick={() => { router.push('/dashboard/settings'); setMobileDrawerOpen(false) }} style={{ fontSize: '11px', color: T.goldText, cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>⚙ Settings</div>
                  <div onClick={handleLogout} style={{ fontSize: '11px', color: T.text6, cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sign Out</div>
                </div>
              </div>
            </>
          )}

          {/* Shared modals — work on both mobile and desktop */}
          {showWlEditor && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div onClick={() => setShowWlEditor(false)} style={{ position: 'absolute', inset: 0, background: T.backdropBlur, backdropFilter: 'blur(4px)' }} />
              <div style={{ position: 'relative', zIndex: 1, background: T.overlayBg, border: `1px solid ${T.border}`, width: '100%', maxWidth: '500px', margin: '0 16px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${T.borderFaint}`, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontStyle: 'italic', color: T.text }}>Edit Watchlist</div>
                    <div onClick={() => setShowWlEditor(false)} style={{ fontSize: '18px', color: T.text6, cursor: 'pointer', padding: '4px' }}>✕</div>
                  </div>
                  <input autoFocus value={wlSearch} onChange={(e) => handleWlSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && wlSearch.trim()) { const top = wlSearchResults[0]; if (top) { addToWatchlist(top.sym, top.name); setWlSearch(''); setWlSearchResults([]) } else { addToWatchlist(wlSearch.trim()); setWlSearch(''); setWlSearchResults([]) } } }}
                    placeholder="Search ticker or company name…"
                    style={{ width: '100%', background: T.inputBg, border: `1px solid ${T.goldFaint7}`, color: T.text, padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }} />
                  {wlSearchResults.length > 0 && (
                    <div style={{ background: T.overlayBg, border: `1px solid ${T.borderFaint}`, borderTop: 'none', maxHeight: '200px', overflowY: 'auto' }}>
                      {wlSearchResults.slice(0, 8).map(r => {
                        const alreadyIn = watchlist.some(w => w.ticker === r.sym)
                        return (
                          <div key={r.sym} onClick={() => { if (!alreadyIn && watchlist.length < 20) { addToWatchlist(r.sym, r.name); setWlSearch(''); setWlSearchResults([]) } }} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: alreadyIn ? 'default' : 'pointer', gap: '10px', borderBottom: `1px solid ${T.borderItem}`, opacity: alreadyIn ? 0.4 : 1 }}
                            onMouseEnter={e => { if (!alreadyIn) (e.currentTarget as HTMLDivElement).style.background = T.goldFaint }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: '14px', color: T.gold, width: '52px', flexShrink: 0 }}>{r.sym}</div>
                            <div style={{ flex: 1, fontSize: '13px', color: T.text4 }}>{r.name}</div>
                            {alreadyIn ? <span style={{ fontSize: '10px', color: T.green }}>✓</span> : <span style={{ fontSize: '11px', color: T.goldText }}>+ Add</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {watchlist.map(w => (
                    <div key={w.ticker} style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', gap: '12px', borderBottom: `1px solid ${T.borderItem}` }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: '14px', color: T.gold, width: '52px', flexShrink: 0 }}>{w.ticker}</div>
                      <div style={{ flex: 1, fontSize: '12px', color: T.text5, fontFamily: "'DM Mono', monospace" }}>
                        {w.price && <span style={{ color: T.text3 }}>{w.price}</span>}
                        {w.change && <span style={{ marginLeft: '8px', color: w.up ? T.green : T.red, fontWeight: 600 }}>{w.change}</span>}
                      </div>
                      <div onClick={() => removeFromWatchlist(w.ticker)} style={{ fontSize: '12px', color: T.red, cursor: 'pointer', padding: '4px 8px', border: `1px solid ${T.redBorder}` }}>Remove</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'flex-end' }}>
                  <div onClick={() => setShowWlEditor(false)} style={{ padding: '8px 20px', background: T.goldFaint3, border: `1px solid ${T.goldFaint8}`, color: T.gold, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Done</div>
                </div>
              </div>
            </div>
          )}
          {showSummaryEditor && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div onClick={() => setShowSummaryEditor(false)} style={{ position: 'absolute', inset: 0, background: T.backdropBlur, backdropFilter: 'blur(4px)' }} />
              <div style={{ position: 'relative', zIndex: 1, background: T.overlayBg, border: `1px solid ${T.border}`, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
                <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontStyle: 'italic', color: T.text }}>Configure Summaries</div>
                  <div onClick={() => setShowSummaryEditor(false)} style={{ fontSize: '18px', color: T.text6, cursor: 'pointer', padding: '4px' }}>✕</div>
                </div>
                <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input type="date" value={summaryDate} onChange={e => setSummaryDate(e.target.value)} style={{ background: T.inputBg, border: `1px solid ${T.goldFaint7}`, color: T.text, padding: '10px 12px', outline: 'none', fontSize: '14px' }} />
                    <input type="time" value={summaryTime} onChange={e => setSummaryTime(e.target.value)} style={{ background: T.inputBg, border: `1px solid ${T.goldFaint7}`, color: T.text, padding: '10px 12px', outline: 'none', fontSize: '14px' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: T.gold, marginBottom: '10px', fontWeight: 600 }}>Quick Presets</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {SUMMARY_PRESETS.map((preset, i) => (
                        <div key={i} onClick={() => { const iso = buildRunAtIsoFromLocalInput(summaryDate, summaryTime); void addPresetSummary(preset, iso) }} style={{ padding: '12px', border: `1px solid ${T.borderFaint}`, background: T.inputBg, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>{preset.icon}</span>
                          <span style={{ fontSize: '14px', color: T.text, fontWeight: 600 }}>{preset.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {scheduledSummaries.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: T.gold, marginBottom: '10px', fontWeight: 600 }}>Upcoming</div>
                      {scheduledSummaries.sort((a, b) => new Date(a.run_at).getTime() - new Date(b.run_at).getTime()).map(item => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.borderFaint3}` }}>
                          <div>
                            <div style={{ color: T.text, fontWeight: 600, fontSize: '13px' }}>{item.icon} {item.name}</div>
                            <div style={{ fontSize: '11px', color: T.text5, fontFamily: "'DM Mono', monospace" }}>{formatSummaryRunAt(item.run_at)}</div>
                          </div>
                          <div onClick={() => void removeScheduledSummary(item.id)} style={{ color: T.red, cursor: 'pointer', padding: '5px 10px', border: `1px solid ${T.redBorder2}`, fontSize: '12px' }}>Remove</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {selectedPastSummary && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 240, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div onClick={() => setSelectedPastSummary(null)} style={{ position: 'absolute', inset: 0, background: T.backdropBlur, backdropFilter: 'blur(4px)' }} />
              <div style={{ position: 'relative', zIndex: 1, background: T.overlayBg, border: `1px solid ${T.border}`, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
                <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '17px', fontStyle: 'italic', color: T.text }}>{selectedPastSummary.title}</div>
                    <div style={{ fontSize: '11px', color: T.text5, fontFamily: "'DM Mono', monospace", marginTop: '4px' }}>{formatSummaryRunAt(selectedPastSummary.briefing_date)}</div>
                  </div>
                  <div onClick={() => setSelectedPastSummary(null)} style={{ fontSize: '18px', color: T.text6, cursor: 'pointer', padding: '4px' }}>✕</div>
                </div>
                <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
                  <div style={{ fontSize: '14px', color: T.text3, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{selectedPastSummary.content}</div>
                </div>
              </div>
            </div>
          )}
          {showNewsModal && <NewsModal watchlistNews={watchlistNews} generalNews={generalNews} onClose={() => setShowNewsModal(false)} watchlistTickers={watchlist.map(s => s.ticker)} defaultTab={newsTab} T={T} />}
          {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} watchlistTickers={watchlist.map(s => s.ticker)} T={T} isDark={isDark} />}

          <style>{`
            @keyframes scrollTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
            @keyframes slideInDrawer { from { transform: translateX(-100%); } to { transform: translateX(0); } }
            * { scrollbar-width: thin; scrollbar-color: ${T.scrollColor} transparent; }
            input::placeholder { color: ${T.text8}; }
            textarea::placeholder { color: ${T.text8}; }
          `}</style>
        </div>
      )}

      {/* ── DESKTOP LAYOUT (unchanged) ── */}
      {!isMobile && (
        <div style={{ background: T.pageBg, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif", color: T.text, transition: 'background 0.35s, color 0.35s' }}>
      <div style={{ background: T.pageBg, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif", color: T.text, transition: 'background 0.35s, color 0.35s' }}>

        {/* ── Ticker bar ── */}
        <div style={{ background: T.tickerBg, borderBottom: `1px solid ${T.border}`, height: '32px', display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0, position: 'relative', transition: 'background 0.35s' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50px', background: `linear-gradient(90deg,${T.tickerBg},transparent)`, zIndex: 2 }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50px', background: `linear-gradient(-90deg,${T.tickerBg},transparent)`, zIndex: 2 }} />
          <div style={{ display: 'flex', animation: 'scrollTicker 55s linear infinite', whiteSpace: 'nowrap' }}>
            {[...watchlist, ...watchlist].map((t, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '0 18px', borderRight: `1px solid ${T.tickerBorder}`, fontSize: '12.5px', height: '32px', fontFamily: "'DM Mono', monospace" }}>
                <span style={{ fontWeight: 600, color: T.tickerText, letterSpacing: '0.1em' }}>{t.ticker}</span>
                <span style={{ color: T.tickerPrice }}>{t.price ?? '—'}</span>
                <span style={{ color: t.price ? (t.up ? T.green : T.red) : T.text8, fontWeight: 500 }}>{t.change ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main 3-column grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '225px 1fr 300px', flex: 1, overflow: 'hidden' }}>

          {/* ── LEFT SIDEBAR ── */}
          <div style={{ background: T.sideBg, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'background 0.35s' }}>
            <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '21px', fontWeight: 600, fontStyle: 'italic', color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
  <svg width="20" height="20" viewBox="0 0 340 340" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(224,178)">
      <rect x="-162" y="-12" width="20" height="50" rx="10" fill="#c9922a" opacity="0.20"/>
      <rect x="-134" y="-46" width="20" height="110" rx="10" fill="#c9922a" opacity="0.38"/>
      <rect x="-106" y="-80" width="20" height="172" rx="10" fill="#c9922a" opacity="0.60"/>
      <rect x="-78" y="-58" width="20" height="116" rx="10" fill="#c9922a" opacity="0.68"/>
      <rect x="-50" y="-100" width="20" height="210" rx="10" fill="#c9922a"/>
      <rect x="-22" y="-72" width="20" height="148" rx="10" fill="#c9922a" opacity="0.72"/>
      <rect x="6" y="-56" width="20" height="118" rx="10" fill="#c9922a" opacity="0.55"/>
      <rect x="34" y="-28" width="20" height="68" rx="10" fill="#c9922a" opacity="0.35"/>
    </g>
  </svg>
  Hey <span style={{ color: T.gold }}>Monday</span>
</div>
              <div
  onClick={() => setWakeOn(!wakeOn)}
  style={{
    display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px',
    padding: '6px 10px 6px 8px',
    background: wakeOn ? T.greenFaint3 : T.inputBg,
    border: `1px solid ${wakeOn ? T.greenBorder : T.borderItem}`,
    cursor: 'pointer', transition: 'all 0.25s', width: 'fit-content',
  }}
>
  {/* Toggle track */}
  <div style={{
    width: '28px', height: '16px', borderRadius: '8px',
    background: wakeOn ? T.green : T.text7,
    position: 'relative', flexShrink: 0, transition: 'background 0.25s',
  }}>
    <div style={{
      position: 'absolute', top: '2px',
      left: wakeOn ? '14px' : '2px',
      width: '12px', height: '12px', borderRadius: '50%',
      background: '#fff', transition: 'left 0.25s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    }} />
  </div>
  {/* Status dot */}
  <div style={{
    width: '5px', height: '5px', borderRadius: '50%',
    background: wakeOn ? T.green : T.text6,
    boxShadow: wakeOn ? `0 0 6px ${T.greenGlow2}` : 'none',
    flexShrink: 0, transition: 'all 0.25s',
    animation: wakeOn ? 'pulse 2s ease infinite' : 'none',
  }} />
  <span style={{
    fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
    color: wakeOn ? T.green : T.text6, fontWeight: 600, transition: 'color 0.25s',
    fontFamily: "'DM Mono', monospace",
  }}>
    {wakeOn ? 'Hey Monday' : 'Wake Word Off'}
  </span>
</div>
              <div onClick={() => router.push('/dashboard/settings')} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '10px', padding: '5px 11px', background: activeTrader.bgColor, border: `1px solid ${activeTrader.borderColor}`, cursor: 'pointer' }}>
                <span style={{ fontSize: '14px' }}>{activeTrader.icon}</span>
                <span style={{ fontSize: '11px', color: activeTrader.color, fontWeight: 600, letterSpacing: '0.08em' }}>{activeTrader.label}</span>
                <span style={{ fontSize: '10px', color: T.text6, marginLeft: '2px' }}>✎</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
              <div style={{ padding: '8px 18px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: T.goldText, fontWeight: 600 }}>Watchlist</div>
                <div onClick={() => { setWlSearch(''); setWlSearchResults([]); setShowWlEditor(true) }} style={{ color: T.goldText, cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 2px' }}>+</div>
              </div>

              {watchlist.map((s, i) => (
                <div key={s.ticker} onClick={() => setActiveWl(i)}
                  style={{ display: 'flex', alignItems: 'center', padding: '8px 18px', cursor: 'pointer', gap: '7px', borderLeft: i === activeWl ? `2px solid ${T.gold}` : '2px solid transparent', background: i === activeWl ? T.wlActive : 'transparent', transition: 'all 0.15s', position: 'relative' }}
                  onMouseEnter={(e) => { const rm = (e.currentTarget as HTMLDivElement).querySelector('.wl-remove') as HTMLElement; if (rm) rm.style.opacity = '1' }}
                  onMouseLeave={(e) => { const rm = (e.currentTarget as HTMLDivElement).querySelector('.wl-remove') as HTMLElement; if (rm) rm.style.opacity = '0' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', width: '40px', color: i === activeWl ? T.gold : T.text3, fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em', flexShrink: 0 }}>{s.ticker}</div>
                  <div style={{ flex: 1, height: '20px', display: 'flex', alignItems: 'flex-end', gap: '1px' }}>
                    {s.bars.map((h, j) => (
                      <div key={j} style={{ flex: 1, height: `${h}%`, background: s.up !== undefined ? (s.up ? T.green : T.red) : T.text7, opacity: j === 6 ? 0.9 : 0.15 + j * 0.11, borderRadius: '1px' }} />
                    ))}
                  </div>
                  <div style={{ fontSize: '12.5px', color: T.textMuted, fontFamily: "'DM Mono', monospace", minWidth: '46px', textAlign: 'right' }}>{s.price ?? '—'}</div>
                  <div style={{ fontSize: '12.5px', color: s.change ? (s.up ? T.green : T.red) : T.text8, fontFamily: "'DM Mono', monospace", minWidth: '48px', textAlign: 'right', fontWeight: 600 }}>{s.change ?? '—'}</div>
                  <div className="wl-remove" onClick={(e) => { e.stopPropagation(); removeFromWatchlist(s.ticker) }} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: T.red, cursor: 'pointer', padding: '2px 5px', opacity: 0, transition: 'opacity 0.15s', background: T.wlRemoveBg, border: `1px solid ${T.redBorder2}` }}>✕</div>
                </div>
              ))}
              {watchlist.length === 0 && <div onClick={() => setShowWlEditor(true)} style={{ padding: '14px 18px', fontSize: '12px', color: T.goldText3, cursor: 'pointer', fontStyle: 'italic' }}>+ Add your first symbol</div>}
            </div>

            {/* Alerts */}
            <div style={{ borderTop: `1px solid ${T.border}`, padding: '10px 18px', flexShrink: 0, maxHeight: '260px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: T.goldText, fontWeight: 600 }}>Price Alerts</div>
                {alerts.length < 10 && <div onClick={() => { setAlertTicker(watchlist[activeWl]?.ticker || ''); setAlertCondition('above'); setAlertPrice(''); setShowAlertEditor((v) => !v) }} style={{ fontSize: '18px', color: T.goldText, cursor: 'pointer', lineHeight: 1 }}>+</div>}
              </div>

              {showAlertEditor && (
                <div style={{ marginBottom: '10px', padding: '10px', background: T.goldFaint, border: `1px solid ${T.goldFaint5}`, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <select value={alertTicker} onChange={(e) => setAlertTicker(e.target.value)} style={{ background: T.inputBg, border: `1px solid ${T.goldFaint6}`, color: T.gold, padding: '5px 8px', fontSize: '12px', fontFamily: "'DM Mono', monospace", outline: 'none', width: '100%' }}>
                    <option value="">Select ticker...</option>
                    {watchlist.map((w) => <option key={w.ticker} value={w.ticker}>{w.ticker}{w.price ? ` — ${w.price}` : ''}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {(['above', 'below'] as const).map((c) => (
                      <div key={c} onClick={() => setAlertCondition(c)} style={{ flex: 1, textAlign: 'center', padding: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em', border: `1px solid ${alertCondition === c ? T.goldFaint10 : T.borderItem}`, color: alertCondition === c ? T.gold : T.text6, background: alertCondition === c ? T.goldFaint3 : 'transparent', transition: 'all 0.15s' }}>
                        {c === 'above' ? '▲ Above' : '▼ Below'}
                      </div>
                    ))}
                  </div>
                  <input value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addAlert() }} placeholder="Target price e.g. 950.00" style={{ background: T.inputBg, border: `1px solid ${T.goldFaint6}`, color: T.text, padding: '6px 8px', fontSize: '12px', fontFamily: "'DM Mono', monospace", outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
                  <div onClick={addAlert} style={{ padding: '6px', textAlign: 'center', background: alertTicker && alertPrice ? T.goldFaint3 : T.inputBg, border: `1px solid ${alertTicker && alertPrice ? T.goldFaint9 : T.borderItem}`, color: alertTicker && alertPrice ? T.gold : T.text6, fontSize: '12px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.08em' }}>
                    {alertSaving ? 'Saving...' : 'Set Alert'}
                  </div>
                </div>
              )}

              {alerts.length === 0 && !showAlertEditor && <div style={{ fontSize: '11px', color: T.text8, fontStyle: 'italic', marginBottom: '6px' }}>No alerts set</div>}
              {alerts.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}
                  onMouseEnter={(e) => { const rm = (e.currentTarget as HTMLDivElement).querySelector('.alert-remove') as HTMLElement; if (rm) rm.style.opacity = '1' }}
                  onMouseLeave={(e) => { const rm = (e.currentTarget as HTMLDivElement).querySelector('.alert-remove') as HTMLElement; if (rm) rm.style.opacity = '0' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: a.triggered ? T.green : T.text6, flexShrink: 0, boxShadow: a.triggered ? `0 0 6px ${T.greenGlow}` : 'none' }} />
                  <span style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", color: a.triggered ? T.text2 : T.text5, flex: 1 }}>
                    <span style={{ color: a.triggered ? T.gold : T.text3, fontWeight: 600 }}>{a.ticker}</span> {a.condition} ${a.target_price.toLocaleString()}
                  </span>
                  {a.triggered && <span style={{ fontSize: '11px', color: T.green }}>✓</span>}
                  <div className="alert-remove" onClick={() => removeAlert(a.id)} style={{ fontSize: '10px', color: T.red, cursor: 'pointer', padding: '1px 5px', border: `1px solid ${T.redBorder}`, opacity: 0, transition: 'opacity 0.15s', background: T.alertRemoveBg, flexShrink: 0 }}>✕</div>
                </div>
              ))}
              {alerts.length >= 10 && <div style={{ fontSize: '10px', color: T.text8, fontStyle: 'italic', marginTop: '4px' }}>Max 10 alerts reached</div>}
            </div>

            <div style={{ padding: '10px 18px', borderTop: `1px solid ${T.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div onClick={() => router.push('/dashboard/settings')} style={{ fontSize: '11px', color: T.goldText, cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>⚙ Settings</div>
              <div onClick={handleLogout} style={{ fontSize: '11px', color: T.text6, cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sign Out</div>
            </div>
          </div>

          {/* ── CENTER PANEL ── */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.panelBg, transition: 'background 0.35s' }}>
            {/* Header bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: `1px solid ${T.border}`, background: T.headerBg, flexShrink: 0, height: '50px', transition: 'background 0.35s' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', fontStyle: 'italic', color: T.text5 }}>{currentEtDate}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, color: sessionColor }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: sessionColor, boxShadow: marketSession !== 'closed' ? `0 0 8px ${sessionGlow}` : 'none' }} />
                  {marketSession === 'open' ? 'Market Open' : marketSession === 'pre' ? 'Pre-Market' : marketSession === 'after' ? 'After Hours' : 'Market Closed'}
                </div>
                {/* Theme toggle — next to After Hours */}
                <div onClick={() => setIsDark(d => !d)} title={isDark ? 'Light mode' : 'Dark mode'} style={{ width: '26px', height: '26px', borderRadius: '50%', border: `1px solid ${T.border}`, background: T.goldFaint2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '12px', color: T.gold, transition: 'all 0.2s', flexShrink: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'rotate(18deg) scale(1.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none' }}>
                  {isDark ? '☀' : '☾'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <div style={{ fontSize: '14px', color: T.text5, fontFamily: "'DM Mono', monospace" }} id="mktTime">--:--:-- ET</div>
                  {lastUpdated && <div style={{ fontSize: '10px', color: T.goldText2, fontFamily: "'DM Mono', monospace" }}>prices {lastUpdated}</div>}
                </div>
              </div>
            </div>

            {/* Now playing / next summary bar */}
            <div style={{ background: T.pulseHero, borderBottom: `1px solid ${T.border}`, padding: '18px 24px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                {/* Play button: locked for future summaries; replay-once for activeBriefing */}
                {activeBriefing ? (
                  <div
                    onClick={() => {
                      if (isSpeaking) { stopCurrentAudio(); return }
                      if (activeBriefing.manualPlayUsed) return
                      setActiveBriefing((prev) => prev ? { ...prev, manualPlayUsed: true } : null)
                      speakText(activeBriefing.content).then(() => setActiveBriefing(null))
                    }}
                    title={activeBriefing.manualPlayUsed ? 'Already replayed' : 'Replay once'}
                    style={{ width: '50px', height: '50px', borderRadius: '50%', border: `1px solid ${isSpeaking || !activeBriefing.manualPlayUsed ? T.goldFaint9 : T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isSpeaking || !activeBriefing.manualPlayUsed ? 'pointer' : 'default', fontSize: '18px', color: isSpeaking || !activeBriefing.manualPlayUsed ? T.gold : T.text7, flexShrink: 0, background: isSpeaking || !activeBriefing.manualPlayUsed ? T.goldFaint2 : T.inputBg, opacity: activeBriefing.manualPlayUsed && !isSpeaking ? 0.4 : 1, transition: 'all 0.2s' }}>
                    {isSpeaking ? '⏸' : '▶'}
                  </div>
                ) : (
                  <div
                    title="Plays automatically at scheduled time"
                    style={{ width: '50px', height: '50px', borderRadius: '50%', border: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', fontSize: '18px', color: T.text7, flexShrink: 0, background: T.inputBg, opacity: 0.4 }}>
                    ▶
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '19px', fontWeight: 500, fontStyle: 'italic', color: T.text }}>
                      {activeBriefing ? activeBriefing.name : nextSummary ? nextSummary.name : 'No Scheduled Summary'}
                    </div>
                    {activeBriefing && !activeBriefing.manualPlayUsed && (
                      <div style={{ fontSize: '11px', color: T.green, background: T.greenFaint3, border: `1px solid ${T.greenBorder2}`, padding: '2px 8px', letterSpacing: '0.1em', fontWeight: 600 }}>
                        LIVE · {activeBriefingMinsLeft}m left
                      </div>
                    )}
                    {activeBriefing && activeBriefing.manualPlayUsed && (
                      <div style={{ fontSize: '11px', color: T.text6, background: T.inputBg, border: `1px solid ${T.borderFaint}`, padding: '2px 8px', letterSpacing: '0.1em', fontWeight: 600 }}>PLAYED</div>
                    )}
                    {!activeBriefing && nextSummary && (
                      <div style={{ fontSize: '11px', color: T.gold, background: T.goldFaint2, border: `1px solid ${T.goldFaint7}`, padding: '2px 8px', letterSpacing: '0.1em', fontWeight: 600 }}>{nextSummaryCountdown}</div>
                    )}
                  </div>
                  <div style={{ fontSize: '12.5px', color: T.text5, fontFamily: "'DM Mono', monospace", marginBottom: '10px' }}>
                    {activeBriefing
                      ? activeBriefing.manualPlayUsed
                        ? 'Summary complete · Moving to past summaries'
                        : 'Auto-played · Tap ▶ once to replay within window'
                      : nextSummary
                        ? `${formatSummaryRunAt(nextSummary.run_at)} · ${nextSummary.type === 'custom' ? 'Custom summary' : 'Scheduled summary'} · Your watchlist`
                        : 'Create a scheduled summary below to populate this section'}
                  </div>
                  <div style={{ height: '2px', background: T.goldFaint3, borderRadius: '1px', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: isSpeaking ? '35%' : '0%', background: T.gold, borderRadius: '1px', transition: 'width 0.5s' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '30px', flexShrink: 0 }}>
                  {[...Array(11)].map((_, i) => (
                    <div key={i} style={{ width: '2px', background: T.waveBar, borderRadius: '2px', opacity: isSpeaking ? 0.7 : 0.2, height: isSpeaking ? undefined : '3px', animation: isSpeaking ? `wave 1.4s ease-in-out ${i * 0.1}s infinite` : 'none' }} />
                  ))}
                </div>
              </div>
            </div>

            {/* ── Layout switcher bar ── */}
            {(() => {
              const LAYOUTS: { id: LayoutId; label: string; icon: React.ReactNode }[] = [
                { id: 'focus', label: 'Focus',  icon: <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" fill="currentColor" rx="1"/></svg> },
                { id: '2col',  label: '2 Col',  icon: <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="5.5" height="12" fill="currentColor" rx="1"/><rect x="7.5" y="1" width="5.5" height="12" fill="currentColor" rx="1"/></svg> },
                { id: '2row',  label: '2 Row',  icon: <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="5.5" fill="currentColor" rx="1"/><rect x="1" y="7.5" width="12" height="5.5" fill="currentColor" rx="1"/></svg> },
                { id: '2x2',   label: '2×2',    icon: <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="5.5" height="5.5" fill="currentColor" rx="1"/><rect x="7.5" y="1" width="5.5" height="5.5" fill="currentColor" rx="1"/><rect x="1" y="7.5" width="5.5" height="5.5" fill="currentColor" rx="1"/><rect x="7.5" y="7.5" width="5.5" height="5.5" fill="currentColor" rx="1"/></svg> },
              ]
              return (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 18px', height: '36px', borderBottom: `1px solid ${T.borderFaint2}`, background: T.headerBg, gap: '3px' }}>
                  {LAYOUTS.map(l => (
                    <div key={l.id} onClick={() => setLayout(l.id)} title={l.label}
                      style={{ width: '28px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: layout === l.id ? T.gold : T.text6, background: layout === l.id ? T.goldFaint2 : 'transparent', border: `1px solid ${layout === l.id ? T.goldFaint7 : 'transparent'}`, transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (layout !== l.id) (e.currentTarget as HTMLElement).style.color = T.text3 }}
                      onMouseLeave={e => { if (layout !== l.id) (e.currentTarget as HTMLElement).style.color = T.text6 }}>
                      {l.icon}
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* ── Dynamic panel grid ── */}
            {(() => {
              const ALL_PANELS: PanelId[] = ['pulse', 'events', 'news', 'summaries']
              const PANEL_LABELS: Record<PanelId, string> = { pulse: 'Pulse', events: 'Events', news: 'News', summaries: 'Summaries', chat: 'Chat' }

              const slotCount = layout === 'focus' ? 1 : layout === '2col' || layout === '2row' ? 2 : 4

              const gridStyle: React.CSSProperties = {
                flex: 1, overflow: 'hidden', display: 'grid', gap: '1px', background: T.gridBg,
                ...(layout === '2x2'   ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' } :
                    layout === 'focus' ? { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' } :
                    layout === '2col'  ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' } :
                                         { gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' })
              }

              // Per-slot panel selector strip
              const SlotSelector = ({ slotIdx }: { slotIdx: number }) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '5px 10px', borderBottom: `1px solid ${T.borderFaint2}`, background: T.headerBg, flexShrink: 0 }}>
                  {ALL_PANELS.map(pid => (
                    <div key={pid}
                      onClick={() => setSlotPanels(prev => { const next = [...prev]; next[slotIdx] = pid; return next })}
                      style={{ padding: '2px 7px', fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' as const, color: slotPanels[slotIdx] === pid ? T.gold : T.text6, background: slotPanels[slotIdx] === pid ? T.goldFaint2 : 'transparent', border: `1px solid ${slotPanels[slotIdx] === pid ? T.goldFaint7 : T.borderItem}`, transition: 'all 0.12s' }}
                      onMouseEnter={e => { if (slotPanels[slotIdx] !== pid) (e.currentTarget as HTMLElement).style.color = T.text3 }}
                      onMouseLeave={e => { if (slotPanels[slotIdx] !== pid) (e.currentTarget as HTMLElement).style.color = T.text6 }}>
                      {PANEL_LABELS[pid]}
                    </div>
                  ))}
                </div>
              )

              const renderPanel = (pid: PanelId, slotIdx: number) => {
                const selector = <SlotSelector slotIdx={slotIdx} />
                if (pid === 'pulse') return (
                  <div key={`slot-${slotIdx}`} style={{ background: T.panelBg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {selector}
                    <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.gold, display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600 }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: T.gold }} />{pulseLabel}
                      </div>
                      <div onClick={() => fetchPulse(traderType, watchlist)} style={{ fontSize: '10px', color: T.goldText2, cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: '2px 7px', border: `1px solid ${T.goldFaint5}` }}>{pulseLoading ? '...' : '↻ Refresh'}</div>
                    </div>
                    <div style={{ padding: '14px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                      {pulseLoading && !pulse ? (
                        <div style={{ fontSize: '13px', color: T.goldText3, fontStyle: 'italic', fontFamily: "'Playfair Display', serif" }}>Analyzing your watchlist…</div>
                      ) : pulse ? (
                        <>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: T.text, lineHeight: 1.75 }}>{pulse.headline}</div>
                          {pulse.summary && <div style={{ fontSize: '14px', color: T.textMuted, lineHeight: 1.65 }}>{pulse.summary}</div>}
                          {pulse.riskNote && <div style={{ fontSize: '12px', color: T.red, lineHeight: 1.55, borderLeft: `2px solid ${T.redBorder2}`, paddingLeft: '10px', marginTop: '2px' }}>⚠ {pulse.riskNote}</div>}
                        </>
                      ) : null}
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-end' }}>
                        {watchlist.map((s, i) => (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                            <div style={{ width: '100%', background: s.change ? (s.up ? T.greenFaint3 : T.redFaint3) : T.inputBg, border: `1px solid ${s.change ? (s.up ? T.greenBorder2 : T.redBorder2) : T.borderItem}`, padding: '3px 0', display: 'flex', justifyContent: 'center' }}>
                              <span style={{ fontSize: '11px', color: s.change ? (s.up ? T.green : T.red) : T.text8, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{s.change ?? '—'}</span>
                            </div>
                            <span style={{ fontSize: '10px', color: T.text5, fontFamily: "'DM Mono', monospace" }}>{s.ticker}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
                if (pid === 'events') return (
                  <div key={`slot-${slotIdx}`} style={{ background: T.panelBg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {selector}
                    <EventsPanel watchlistTickers={watchlist.map((s) => s.ticker)} onOpenCalendar={() => setShowCalendar(true)} T={T} isDark={isDark} />
                  </div>
                )
                if (pid === 'news') return (
                  <div key={`slot-${slotIdx}`} style={{ background: T.panelBg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {selector}
                    <div style={{ padding: '0 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {(['watchlist', 'general'] as const).map((tab) => (
                          <div key={tab} onClick={() => handleNewsTab(tab)} style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, padding: '13px 14px', cursor: 'pointer', color: newsTab === tab ? T.gold : T.text6, borderBottom: `2px solid ${newsTab === tab ? T.gold : 'transparent'}`, transition: 'all 0.15s' }}>
                            {tab === 'watchlist' ? '📋 Watchlist' : '🌐 General'}
                          </div>
                        ))}
                      </div>
                      <div onClick={async () => { setShowNewsModal(true); if (generalNews.length === 0) { try { const res = await fetch('/api/news?type=general'); const data = await res.json(); if (data.news?.length) setGeneralNews(data.news) } catch {} } }} style={{ fontSize: '11px', color: T.goldText, cursor: 'pointer', padding: '4px 8px', border: `1px solid ${T.goldFaint6}`, letterSpacing: '0.08em', transition: 'all 0.15s' }}>All News →</div>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {(newsTab === 'watchlist' ? watchlistNews : generalNews).length === 0 ? (
                        <div style={{ padding: '24px 18px', fontSize: '12px', color: T.text7, fontStyle: 'italic' }}>Loading news...</div>
                      ) : (
                        (newsTab === 'watchlist' ? watchlistNews : generalNews).map((n, i) => (
                          <div key={i} style={{ padding: '12px 18px', borderBottom: `1px solid ${T.borderFaint2}`, cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', padding: '2px 7px', fontWeight: 600, color: n.up ? T.green : T.red, border: `1px solid ${n.up ? T.greenBorder2 : T.redBorder2}`, letterSpacing: '0.08em' }}>{n.ticker}</span>
                              <span style={{ fontSize: '11px', color: n.up ? T.green : T.red, fontWeight: 600 }}>{n.sent}</span>
                              <span style={{ fontSize: '11px', color: T.text8, marginLeft: 'auto', fontFamily: "'DM Mono', monospace" }}>{n.time}</span>
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 500, color: T.text, marginBottom: '6px', lineHeight: 1.5, fontFamily: "'Playfair Display', serif" }}>{n.headline}</div>
                            <div style={{ fontSize: '12.5px', color: T.goldText4, lineHeight: 1.6, borderLeft: `2px solid ${T.newsAiBorder}`, paddingLeft: '8px', fontStyle: 'italic' }}>{n.ai}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
                if (pid === 'summaries') return (
                  <div key={`slot-${slotIdx}`} style={{ background: T.panelBg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {selector}
                    <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          {(['scheduled', 'past'] as const).map((tab) => (
                            <div key={tab} onClick={() => setSummaryTab(tab)} style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: summaryTab === tab ? T.gold : T.text6, display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, cursor: 'pointer', paddingBottom: '4px', borderBottom: summaryTab === tab ? `2px solid ${T.gold}` : '2px solid transparent' }}>
                              {tab === 'scheduled' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: summaryTab === 'scheduled' ? T.gold : T.text6 }} />}
                              {tab === 'scheduled' ? 'Scheduled Summaries' : 'Past Summaries'}
                            </div>
                          ))}
                        </div>
                        {summaryTab === 'scheduled' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {(['day', 'week'] as const).map((v) => (
                                <div key={v} onClick={() => setSummaryView(v)} style={{ padding: '3px 10px', border: `1px solid ${summaryView === v ? T.goldFaint9 : T.borderItem}`, background: summaryView === v ? T.goldFaint2 : 'transparent', color: summaryView === v ? T.gold : T.text5, cursor: 'pointer', fontSize: '10px', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{v}</div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <div onClick={() => { if (summaryView === 'week') setSummaryWeekOffset((w) => w - 1); else setSummaryDayOffset((d) => d - 1) }} style={{ padding: '3px 8px', border: `1px solid ${T.goldFaint6}`, color: T.gold, cursor: 'pointer', fontSize: '10px', fontFamily: "'DM Mono', monospace" }}>← Prev</div>
                              <div style={{ fontSize: '10px', color: T.text5, fontFamily: "'DM Mono', monospace" }}>{summaryView === 'week' ? summaryWeek.label : summaryDay.label}</div>
                              <div onClick={() => { if (summaryView === 'week') setSummaryWeekOffset((w) => w + 1); else setSummaryDayOffset((d) => d + 1) }} style={{ padding: '3px 8px', border: `1px solid ${T.goldFaint6}`, color: T.gold, cursor: 'pointer', fontSize: '10px', fontFamily: "'DM Mono', monospace" }}>Next →</div>
                              {((summaryView === 'week' && summaryWeekOffset !== 0) || (summaryView === 'day' && summaryDayOffset !== 0)) && (
                                <div onClick={() => { setSummaryWeekOffset(0); setSummaryDayOffset(0) }} style={{ padding: '3px 8px', border: `1px solid ${T.goldFaint7}`, background: T.goldFaint2, color: T.gold, cursor: 'pointer', fontSize: '10px', fontFamily: "'DM Mono', monospace" }}>Today</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div onClick={() => setShowSummaryEditor(true)} style={{ fontSize: '11px', color: T.goldText, cursor: 'pointer', marginLeft: '12px', flexShrink: 0 }}>Configure →</div>
                    </div>
                    {summaryTab === 'scheduled' ? (
                      summaryView === 'week' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '1px', background: T.gridBg, flex: 1, minHeight: 0, overflow: 'hidden' }}>
                          {summaryDayLabels.map((dayLabel, dayIndex) => {
                            const dayItems = scheduledSummariesByDay[dayIndex] ?? []
                            return (
                              <div key={dayLabel} style={{ background: T.panelBg, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                                <div style={{ padding: '10px 8px', borderBottom: `1px solid ${T.borderFaint3}`, textAlign: 'center', fontSize: '10px', color: T.gold, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, flexShrink: 0 }}>{dayLabel}</div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                                  {dayItems.length === 0 ? (
                                    <div style={{ color: T.text9, fontSize: '11px', fontStyle: 'italic', textAlign: 'center', paddingTop: '10px' }}>No summaries</div>
                                  ) : dayItems.map((s) => {
                                    const msUntil = new Date(s.run_at).getTime() - countdownTick
                                    return (
                                      <div key={s.id} style={{ background: T.cardBg, padding: '12px 10px', cursor: 'pointer', borderTop: `2px solid ${s.top_color}`, border: `1px solid ${T.borderFaint3}` }}>
                                        <div style={{ fontSize: '20px', marginBottom: '7px' }}>{s.icon}</div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: T.text, lineHeight: 1.35 }}>{s.name}</div>
                                        <div style={{ fontSize: '10px', color: T.text5, marginBottom: '8px', fontFamily: "'DM Mono', monospace", lineHeight: 1.45 }}>{formatSummaryRunAt(s.run_at)}</div>
                                        <div style={{ display: 'inline-block', padding: '4px 8px', border: `1px solid ${T.goldFaint7}`, background: T.goldFaint2, color: T.gold, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', fontFamily: "'DM Mono', monospace" }}>
                                          {msUntil <= 0 ? 'READY' : formatCountdown(msUntil).replace('In ', '').toUpperCase()}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', alignContent: 'start' }}>
                          {visibleDaySummaries.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1', color: T.text8, fontSize: '12px', fontStyle: 'italic', padding: '10px' }}>No summaries for this day</div>
                          ) : visibleDaySummaries.map((s) => {
                            const msUntil = new Date(s.run_at).getTime() - countdownTick
                            return (
                              <div key={s.id} style={{ background: T.cardBg, padding: '18px 16px', borderTop: `3px solid ${s.top_color}`, border: `1px solid ${T.borderFaint3}`, minHeight: '170px' }}>
                                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{s.icon}</div>
                                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: T.text, lineHeight: 1.35 }}>{s.name}</div>
                                <div style={{ fontSize: '11px', color: T.text5, marginBottom: '12px', fontFamily: "'DM Mono', monospace" }}>{formatSummaryTimeOnly(s.run_at)}</div>
                                <div style={{ display: 'inline-block', padding: '6px 10px', border: `1px solid ${T.goldFaint7}`, background: T.goldFaint2, color: T.gold, fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', fontFamily: "'DM Mono', monospace" }}>
                                  {msUntil <= 0 ? 'READY' : formatCountdown(msUntil).replace('In ', '').toUpperCase()}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    ) : (
                      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                        {orderedPastBriefings.length === 0 ? (
                          <div style={{ padding: '30px', color: T.text6, fontStyle: 'italic' }}>No past summaries yet</div>
                        ) : orderedPastBriefings.map((item) => (
                          <div key={item.id} onClick={() => setSelectedPastSummary(item)} style={{ padding: '14px 18px', borderBottom: `1px solid ${T.borderFaint3}`, cursor: 'pointer', background: 'transparent', transition: 'background 0.12s' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = T.pastHover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: T.text, marginBottom: '4px' }}>{item.title}</div>
                            <div style={{ fontSize: '11px', color: T.text5, fontFamily: "'DM Mono', monospace", marginBottom: '6px' }}>{formatSummaryRunAt(item.briefing_date)}</div>
                            <div style={{ fontSize: '12px', color: T.text4, lineHeight: 1.55, maxHeight: '38px', overflow: 'hidden' }}>{item.content}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
                return null
              }

              return (
                <div style={gridStyle}>
                  {Array.from({ length: slotCount }, (_, i) => renderPanel(slotPanels[i] ?? 'pulse', i))}
                </div>
              )
            })()}
          </div>

          {/* ── RIGHT SIDEBAR — Chat ── */}
          <div style={{ background: T.sideBg, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'background 0.35s' }}>
            <div style={{ padding: '16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '38px', height: '38px', background: T.avatarBg, border: `1px solid ${T.avatarBorder}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 600, color: T.gold, flexShrink: 0, fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}>M</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: T.text, fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}>Monday</div>
                  <div style={{ fontSize: '9px', color: activeTrader.color, marginTop: '1px', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.8 }}>{activeTrader.label} Mode</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: T.goldFaint, border: `1px solid ${T.goldFaint6}`, padding: '8px 12px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: wakeOn ? T.green : T.text6, boxShadow: wakeOn ? `0 0 8px ${T.greenGlow2}` : 'none', flexShrink: 0, transition: 'all 0.3s' }} />
                  <div style={{ fontSize: '10px', color: T.text5, flex: 1 }}>Listening for</div>
                  <div style={{ fontSize: '10px', color: T.gold, background: T.goldFaint2, padding: '2px 8px', border: `1px solid ${T.goldFaint7}`, letterSpacing: '0.1em', fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>Hey Monday</div>
                </div>
                <div onClick={() => { if (speechOn && isSpeaking) stopCurrentAudio(); setSpeechOn((v) => !v) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: speechOn ? T.greenFaint2 : T.inputBg, border: `1px solid ${speechOn ? T.greenBorder : T.borderItem}`, padding: '8px 12px', cursor: 'pointer' }}>
                  <div style={{ fontSize: '10px', color: T.text5 }}>Monday voice replies</div>
                  <div style={{ fontSize: '10px', color: speechOn ? T.green : T.text6, fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>{speechOn ? (isSpeaking ? 'On · Speaking' : 'On') : 'Off'}</div>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {showSuggestions ? (
                <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldText3, marginBottom: '10px', paddingLeft: '2px' }}>Ask Monday anything</div>
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <div key={i} onClick={() => setChatInput(q.text)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: T.suggestBg, border: `1px solid ${T.suggestBorder}`, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = T.suggestHover; (e.currentTarget as HTMLDivElement).style.borderColor = T.suggestBorderHover }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = T.suggestBg; (e.currentTarget as HTMLDivElement).style.borderColor = T.suggestBorder }}>
                      <span style={{ fontSize: '14px', flexShrink: 0 }}>{q.emoji}</span>
                      <span style={{ fontSize: '12px', color: T.text4, lineHeight: 1.4 }}>{q.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {messages.map((m, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '4px' }}>
                      <div style={{ maxWidth: '92%', padding: '10px 13px', fontSize: '12px', lineHeight: 1.75, background: m.role === 'monday' ? T.chatAiBg : T.chatUserBg, border: `1px solid ${m.role === 'monday' ? T.chatAiBorder : T.chatUserBorder}`, color: m.role === 'monday' ? T.text2 : T.text }}>
                        <MondayText text={m.text} />
                      </div>
                      <div style={{ fontSize: '9px', color: T.text8, display: 'flex', alignItems: 'center', gap: '7px', fontFamily: "'DM Mono', monospace" }}>
                        {m.role === 'monday' ? 'Monday' : 'You'} · {m.time}
                      </div>
                    </div>
                  ))}
                  {isThinking && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                      <div style={{ padding: '10px 13px', fontSize: '12px', background: T.chatAiBg, border: `1px solid ${T.chatAiBorder}`, color: T.thinkingText, fontStyle: 'italic' }}>Monday is thinking…</div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            <div style={{ padding: '12px', borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
                <textarea value={chatInput} onChange={(e) => { setChatInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} placeholder="Ask Monday anything..." rows={1} style={{ flex: 1, background: T.inputBg, border: `1px solid ${T.borderInput}`, color: T.text, padding: '9px 12px', fontSize: '12px', fontFamily: "'DM Sans', sans-serif", outline: 'none', resize: 'none', overflowY: 'hidden', lineHeight: '1.5', maxHeight: '120px' }} />
                <div onClick={() => { if (isRecordingVoice) stopVoiceRecording(); else startVoiceRecording() }} style={{ width: '36px', height: '36px', background: isRecordingVoice ? T.redFaint4 : T.inputBg, border: `1px solid ${isRecordingVoice ? T.redBorder4 : T.borderItem}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', flexShrink: 0, color: isRecordingVoice ? T.red : T.text }}>
                  {isRecordingVoice ? '◼' : <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />}
                </div>
                <div onClick={handleSend} style={{ width: '36px', height: '36px', background: isThinking ? T.goldFaint2 : T.goldFaint3, border: `1px solid ${T.goldFaint9}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isThinking ? 'default' : 'pointer', fontSize: '13px', color: isThinking ? T.goldText3 : T.gold, flexShrink: 0, fontWeight: 700 }}>➤</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Watchlist editor modal ── */}
        {showWlEditor && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={() => setShowWlEditor(false)} style={{ position: 'absolute', inset: 0, background: T.backdropBlur, backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'relative', zIndex: 1, background: T.overlayBg, border: `1px solid ${T.border}`, width: '100%', maxWidth: '500px', margin: '0 20px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${T.borderFaint}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontStyle: 'italic', fontWeight: 500, color: T.text }}>Edit Watchlist</div>
                    <div style={{ fontSize: '13px', color: T.text5, marginTop: '3px' }}>Stocks, ETFs, crypto & futures — up to 20 symbols</div>
                  </div>
                  <div onClick={() => setShowWlEditor(false)} style={{ fontSize: '18px', color: T.text6, cursor: 'pointer', padding: '4px' }}>✕</div>
                </div>
                <div style={{ position: 'relative' }}>
                  <input autoFocus value={wlSearch} onChange={(e) => handleWlSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && wlSearch.trim()) { const top = wlSearchResults[0]; if (top) { addToWatchlist(top.sym, top.name); setWlSearch(''); setWlSearchResults([]) } else { addToWatchlist(wlSearch.trim()); setWlSearch(''); setWlSearchResults([]) } } }}
                    placeholder="Search ticker or name... (e.g. NVDA, Bitcoin, Gold)"
                    style={{ width: '100%', background: T.inputBg, border: `1px solid ${T.goldFaint7}`, color: T.text, padding: '11px 40px 11px 14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' as const }} />
                  {wlSearching && <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: T.goldText2, fontFamily: "'DM Mono', monospace" }}>…</div>}
                </div>
                {wlSearchResults.length > 0 && (
                  <div style={{ background: T.overlayBg, border: `1px solid ${T.borderFaint}`, borderTop: 'none', maxHeight: '200px', overflowY: 'auto' }}>
                    {wlSearchResults.slice(0, 8).map((r) => {
                      const alreadyIn = watchlist.some((w) => w.ticker === r.sym)
                      return (
                        <div key={r.sym} onClick={() => { if (!alreadyIn && watchlist.length < 20) { addToWatchlist(r.sym, r.name); setWlSearch(''); setWlSearchResults([]) } }} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: alreadyIn ? 'default' : 'pointer', gap: '10px', borderBottom: `1px solid ${T.borderItem}`, opacity: alreadyIn ? 0.4 : 1, transition: 'background 0.1s' }}
                          onMouseEnter={(e) => { if (!alreadyIn) (e.currentTarget as HTMLDivElement).style.background = T.goldFaint }}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: '14px', color: T.gold, width: '56px', flexShrink: 0 }}>{r.sym}</div>
                          <div style={{ flex: 1, fontSize: '13px', color: T.text4 }}>{r.name}</div>
                          <div style={{ fontSize: '10px', padding: '1px 6px', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0, ...(r.type === 'Futures' ? { color: T.cyan, background: T.cyanFaint, border: `1px solid ${T.cyanBorder}` } : r.type === 'Crypto' ? { color: T.purple, background: T.purpleFaint, border: `1px solid ${T.purpleBorder}` } : r.type === 'ETF' ? { color: T.green, background: T.greenFaint, border: `1px solid ${T.greenBorder2}` } : { color: T.text6, background: T.inputBg, border: `1px solid ${T.borderItem}` }) }}>{r.type}</div>
                          {alreadyIn ? <div style={{ fontSize: '10px', color: T.green }}>✓ Added</div> : <div style={{ fontSize: '11px', color: T.goldText }}>+ Add</div>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
                <div style={{ padding: '0 24px 10px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldText3, fontWeight: 600 }}>Current · {watchlist.length}/20</div>
                {watchlist.length === 0 && <div style={{ padding: '20px 24px', fontSize: '13px', color: T.text7, fontStyle: 'italic' }}>No symbols yet. Search above to add some.</div>}
                {watchlist.map((w) => (
                  <div key={w.ticker} style={{ display: 'flex', alignItems: 'center', padding: '9px 24px', gap: '12px', borderBottom: `1px solid ${T.borderItem}` }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: '14px', color: T.gold, width: '56px', flexShrink: 0 }}>{w.ticker}</div>
                    <div style={{ flex: 1, fontSize: '13px', color: T.text5, fontFamily: "'DM Mono', monospace" }}>
                      {w.price ? <span style={{ color: T.text3 }}>{w.price}</span> : '—'}
                      {w.change && <span style={{ marginLeft: '8px', color: w.up ? T.green : T.red, fontWeight: 600 }}>{w.change}</span>}
                    </div>
                    <div style={{ fontSize: '10px', color: T.text7, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '4px' }}>{tickerType(w.ticker)}</div>
                    <div onClick={() => removeFromWatchlist(w.ticker)} style={{ fontSize: '12px', color: T.red, cursor: 'pointer', padding: '4px 8px', border: `1px solid ${T.redBorder}`, transition: 'all 0.15s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = T.redBorder4 }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = T.redBorder }}>Remove</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.borderFaint}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '12px', color: T.text6 }}>Changes save automatically</div>
                <div onClick={() => setShowWlEditor(false)} style={{ padding: '9px 22px', background: T.goldFaint3, border: `1px solid ${T.goldFaint8}`, color: T.gold, fontSize: '13px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.08em' }}>Done</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Summary editor modal ── */}
        {showSummaryEditor && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={() => setShowSummaryEditor(false)} style={{ position: 'absolute', inset: 0, background: T.backdropBlur, backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'relative', zIndex: 1, background: T.overlayBg, border: `1px solid ${T.border}`, width: '100%', maxWidth: '820px', margin: '0 20px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${T.borderFaint}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontStyle: 'italic', color: T.text }}>Configure Scheduled Summaries</div>
                    <div style={{ fontSize: '13px', color: T.text5, marginTop: '3px' }}>Max 6 scheduled summaries per ET day.</div>
                  </div>
                  <div onClick={() => setShowSummaryEditor(false)} style={{ fontSize: '18px', color: T.text6, cursor: 'pointer', padding: '4px' }}>✕</div>
                </div>
              </div>
              <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.gold, marginBottom: '12px', fontWeight: 600 }}>Date & Time For New Summary</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '180px 160px', gap: '10px', marginBottom: '16px' }}>
                    <input type="date" value={summaryDate} onChange={(e) => setSummaryDate(e.target.value)} style={{ background: T.inputBg, border: `1px solid ${T.goldFaint7}`, color: T.text, padding: '10px 12px', outline: 'none' }} />
                    <input type="time" value={summaryTime} onChange={(e) => setSummaryTime(e.target.value)} style={{ background: T.inputBg, border: `1px solid ${T.goldFaint7}`, color: T.text, padding: '10px 12px', outline: 'none' }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.gold, marginBottom: '12px', fontWeight: 600 }}>Quick Presets</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px' }}>
                    {SUMMARY_PRESETS.map((preset, i) => (
                      <div key={i} onClick={() => { const runAtIso = buildRunAtIsoFromLocalInput(summaryDate, summaryTime); void addPresetSummary(preset, runAtIso) }} style={{ padding: '12px', border: `1px solid ${T.borderFaint}`, background: T.inputBg, cursor: 'pointer' }}>
                        <div style={{ fontSize: '14px', color: T.text, fontWeight: 600 }}>{preset.icon} {preset.name}</div>
                        <div style={{ fontSize: '11px', color: T.text5, marginTop: '4px', fontFamily: "'DM Mono', monospace" }}>Uses selected date/time above</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.gold, marginBottom: '12px', fontWeight: 600 }}>Custom Summary</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '10px', marginBottom: '10px' }}>
                    <input value={summaryName} onChange={(e) => setSummaryName(e.target.value)} placeholder="Summary name" style={{ background: T.inputBg, border: `1px solid ${T.goldFaint7}`, color: T.text, padding: '10px 12px', outline: 'none' }} />
                    <input value={summaryTopColor} onChange={(e) => setSummaryTopColor(e.target.value)} placeholder="#e8b84b" style={{ background: T.inputBg, border: `1px solid ${T.goldFaint7}`, color: T.text, padding: '10px 12px', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {SUMMARY_ICON_OPTIONS.map((icon) => (
                      <div key={icon} onClick={() => setSummaryIcon(icon)} style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', border: `1px solid ${summaryIcon === icon ? T.goldFaint9 : T.borderItem}`, background: summaryIcon === icon ? T.goldFaint2 : T.inputBg }}>{icon}</div>
                    ))}
                  </div>
                  <textarea value={summaryPrompt} onChange={(e) => setSummaryPrompt(e.target.value)} placeholder="What should Monday summarize?" rows={4} style={{ width: '100%', background: T.inputBg, border: `1px solid ${T.goldFaint7}`, color: T.text, padding: '12px', outline: 'none', resize: 'vertical' }} />
                  <div onClick={() => void addCustomSummary()} style={{ marginTop: '10px', display: 'inline-flex', padding: '10px 18px', background: T.goldFaint3, border: `1px solid ${T.goldFaint8}`, color: T.gold, cursor: 'pointer', fontWeight: 600 }}>Add Custom Summary</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.gold, marginBottom: '12px', fontWeight: 600 }}>Upcoming Summaries</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {scheduledSummaries.length === 0 ? <div style={{ color: T.text6, fontStyle: 'italic' }}>No upcoming summaries.</div> : scheduledSummaries.sort((a, b) => new Date(a.run_at).getTime() - new Date(b.run_at).getTime()).map((item) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px', background: T.inputBg, border: `1px solid ${T.borderFaint}` }}>
                        <div>
                          <div style={{ color: T.text, fontWeight: 600 }}>{item.icon} {item.name}</div>
                          <div style={{ fontSize: '12px', color: T.text5, fontFamily: "'DM Mono', monospace" }}>{formatSummaryRunAt(item.run_at)} · {item.type}</div>
                        </div>
                        <div onClick={() => void removeScheduledSummary(item.id)} style={{ color: T.red, cursor: 'pointer', border: `1px solid ${T.redBorder2}`, padding: '5px 10px', fontSize: '12px' }}>Remove</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Past summary detail modal ── */}
        {selectedPastSummary && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={() => setSelectedPastSummary(null)} style={{ position: 'absolute', inset: 0, background: T.backdropBlur, backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'relative', zIndex: 1, background: T.overlayBg, border: `1px solid ${T.border}`, width: '100%', maxWidth: '820px', margin: '0 20px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${T.borderFaint}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontStyle: 'italic', color: T.text }}>{selectedPastSummary.title}</div>
                    <div style={{ fontSize: '12px', color: T.text5, marginTop: '5px', fontFamily: "'DM Mono', monospace" }}>{formatSummaryRunAt(selectedPastSummary.briefing_date)}</div>
                  </div>
                  <div onClick={() => setSelectedPastSummary(null)} style={{ fontSize: '18px', color: T.text6, cursor: 'pointer', padding: '4px' }}>✕</div>
                </div>
              </div>
              <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                <div>
                  <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.gold, marginBottom: '12px', fontWeight: 600 }}>Summary Details</div>
                  <div style={{ fontSize: '14px', color: T.text3, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{selectedPastSummary.content}</div>
                </div>
                {previousPastSummary && (
                  <div>
                    <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.gold, marginBottom: '12px', fontWeight: 600 }}>Previous Summary</div>
                    <div onClick={() => setSelectedPastSummary(previousPastSummary)} style={{ padding: '14px', background: T.inputBg, border: `1px solid ${T.borderFaint}`, cursor: 'pointer' }}>
                      <div style={{ color: T.text, fontWeight: 600, marginBottom: '4px' }}>{previousPastSummary.title}</div>
                      <div style={{ fontSize: '12px', color: T.text5, fontFamily: "'DM Mono', monospace", marginBottom: '8px' }}>{formatSummaryRunAt(previousPastSummary.briefing_date)}</div>
                      <div style={{ fontSize: '13px', color: T.text4, lineHeight: 1.6, maxHeight: '62px', overflow: 'hidden' }}>{previousPastSummary.content}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── News modal ── */}
        {showNewsModal && <NewsModal watchlistNews={watchlistNews} generalNews={generalNews} onClose={() => setShowNewsModal(false)} watchlistTickers={watchlist.map((s) => s.ticker)} defaultTab={newsTab} T={T} />}

        {/* ── Calendar modal ── */}
        {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} watchlistTickers={watchlist.map((s) => s.ticker)} T={T} isDark={isDark} />}

        <style>{`
          @keyframes scrollTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          @keyframes wave { 0%,100% { height: 3px; } 50% { height: 18px; } }
          * { scrollbar-width: thin; scrollbar-color: ${T.scrollColor} transparent; }
          input::placeholder { color: ${T.text8}; }
          textarea::placeholder { color: ${T.text8}; }
          select option { background: ${T.overlayBg}; color: ${T.text}; }
        `}</style>
      </div>
      </div>
        )}
        {/* end !isMobile */}
      </>
    )
  }