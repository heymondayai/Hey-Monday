'use client'

import { useEffect, useMemo, useState } from 'react'

// ── TYPES ─────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string
  date: string
  time: string
  timeET: string
  name: string
  country: string
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
  category:
    | 'EARNINGS'
    | 'FED'
    | 'INFLATION'
    | 'JOBS'
    | 'GROWTH'
    | 'CONSUMER'
    | 'HOUSING'
    | 'TRADE'
    | 'MACRO'
    | 'WATCHLIST'
    | 'OPEX'
  actual: string | null
  forecast: string | null
  previous: string | null
  unit: string
  ticker?: string
}

// Token type — matches the DARK/LIGHT objects in dashboard-page.tsx
type ThemeTokens = {
  pageBg: string; sideBg: string; panelBg: string; cardBg: string
  headerBg: string; tickerBg: string; inputBg: string; overlayBg: string
  border: string; borderFaint: string; borderFaint2: string; borderFaint3: string
  borderInput: string; borderItem: string
  gold: string; goldFaint: string; goldFaint2: string; goldFaint3: string
  goldFaint4: string; goldFaint5: string; goldFaint6: string; goldFaint7: string
  goldFaint8: string; goldFaint9: string; goldFaint10: string
  goldText: string; goldText2: string; goldText3: string; goldText4: string
  text: string; text2: string; text3: string; text4: string; text5: string
  text6: string; text7: string; text8: string; text9: string; text10: string
  textMuted: string
  green: string; greenFaint: string; greenFaint2: string; greenFaint3: string
  greenFaint4: string; greenBorder: string; greenBorder2: string; greenBorder3: string
  greenGlow: string; greenGlow2: string
  red: string; redFaint: string; redFaint2: string; redFaint3: string
  redFaint4: string; redBorder: string; redBorder2: string; redBorder3: string
  redBorder4: string; redBorder5: string
  blue: string; blueFaint: string; blueFaint2: string
  purple: string; purpleFaint: string; purpleBorder: string
  cyan: string; cyanFaint: string; cyanBorder: string
  tickerText: string; tickerPrice: string; tickerBorder: string
  wlActive: string; wlRemoveBg: string; newsAiBorder: string; pulseHero: string
  waveBar: string; avatarBg: string; avatarBorder: string; scrollColor: string
  modalOverlay: string; backdropBlur: string
  suggestBg: string; suggestBorder: string; suggestHover: string; suggestBorderHover: string
  chatUserBg: string; chatUserBorder: string; chatAiBg: string; chatAiBorder: string
  thinkingText: string; gridBg: string; dayHeaderBg: string; pastHover: string
  alertRemoveBg: string; pricingToggle: string
  [key: string]: string
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function getTodayET(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function getTodayLabelET(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric',
  }).format(new Date())
}

function getWeekBounds(offsetWeeks = 0): { from: string; to: string; label: string } {
  const etNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = etNow.getDay()
  const monday = new Date(etNow)
  monday.setDate(etNow.getDate() - (day === 0 ? 6 : day - 1) + offsetWeeks * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const fmtLabel = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(d)
  return { from: fmt(monday), to: fmt(sunday), label: `${fmtLabel(monday)} – ${fmtLabel(sunday)}` }
}

function normalizeImpact(value?: string | null): 'HIGH' | 'MEDIUM' | 'LOW' | '' {
  const v = (value || '').toUpperCase().trim()
  if (v.includes('HIGH')) return 'HIGH'
  if (v.includes('MEDIUM')) return 'MEDIUM'
  if (v.includes('LOW')) return 'LOW'
  return ''
}

function normalizeCountry(value?: string | null): string {
  const v = (value || '').toUpperCase().trim()
  if (['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(v)) return 'USA'
  return v
}

function isUsMediumOrHighEvent(event: CalendarEvent): boolean {
  const country = normalizeCountry(event.country)
  const impact = normalizeImpact(event.impact)
  return country === 'USA' && (impact === 'MEDIUM' || impact === 'HIGH')
}

function sortEventsByDateTime(a: CalendarEvent, b: CalendarEvent): number {
  return `${a.date} ${a.timeET || a.time || ''}`.localeCompare(`${b.date} ${b.timeET || b.time || ''}`)
}

function tagWatchlistEvents(events: CalendarEvent[], watchlistTickers: string[]): CalendarEvent[] {
  return events.map((e) => ({
    ...e,
    country: normalizeCountry(e.country),
    impact: (normalizeImpact(e.impact) || 'LOW') as CalendarEvent['impact'],
    category: e.category === 'EARNINGS' && watchlistTickers.includes((e.ticker ?? '').toUpperCase())
      ? ('WATCHLIST' as const) : e.category,
  }))
}

function filterDashboardEvents(events: CalendarEvent[], todayET: string): CalendarEvent[] {
  return events.filter((e) => e.date === todayET).filter(isUsMediumOrHighEvent).sort(sortEventsByDateTime)
}

function filterCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter(isUsMediumOrHighEvent).sort(sortEventsByDateTime)
}

function eventToUTC(dateStr: string, timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  const hh = String(isNaN(h) ? 0 : h).padStart(2, '0')
  const mm = String(isNaN(m) ? 0 : m).padStart(2, '0')
  const roughUTC = new Date(`${dateStr}T${hh}:${mm}:00Z`)
  roughUTC.setUTCHours(roughUTC.getUTCHours() + 5)
  const etParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(roughUTC)
  const get = (t: string) => parseInt(etParts.find((p) => p.type === t)?.value ?? '0', 10)
  const etH = get('hour') === 24 ? 0 : get('hour')
  const targetMs = Date.UTC(get('year'), get('month') - 1, get('day'), etH, get('minute'), get('second'))
  const offsetMs = roughUTC.getTime() - targetMs
  const eventH = isNaN(h) ? 0 : h; const eventM = isNaN(m) ? 0 : m
  const naiveUTC = Date.UTC(parseInt(dateStr.slice(0, 4), 10), parseInt(dateStr.slice(5, 7), 10) - 1, parseInt(dateStr.slice(8, 10), 10), eventH, eventM, 0)
  return naiveUTC + offsetMs
}

function getTimeUntil(dateStr: string, timeStr: string): string | null {
  try {
    const diffMs = eventToUTC(dateStr, timeStr) - Date.now()
    if (diffMs <= 0) return null
    const totalMin = Math.floor(diffMs / 60000)
    if (totalMin > 60 * 24 * 2) return null
    const hrs = Math.floor(totalMin / 60); const mins = totalMin % 60
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
  } catch { return null }
}

function isEventPast(dateStr: string, timeStr: string): boolean {
  try { return eventToUTC(dateStr, timeStr) < Date.now() } catch { return false }
}

function getOutcomeColor(event: CalendarEvent, T: ThemeTokens): { color: string; label: string; isGood: boolean | null } {
  if (!event.actual) return { color: T.text5, label: '', isGood: null }
  const actual = parseFloat(event.actual.replace(/[^0-9.-]/g, ''))
  const forecast = event.forecast ? parseFloat(event.forecast.replace(/[^0-9.-]/g, '')) : null
  const previous = event.previous ? parseFloat(event.previous.replace(/[^0-9.-]/g, '')) : null
  if (isNaN(actual)) return { color: T.gold, label: event.actual, isGood: null }
  const compare = forecast ?? previous
  if (compare === null || isNaN(compare)) return { color: T.gold, label: event.actual, isGood: null }
  const diff = actual - compare
  const pctDiff = compare === 0 ? Math.abs(diff) : Math.abs(diff / compare)
  const lowerIsBetter = ['INFLATION', 'JOBS'].includes(event.category) && !event.name.toLowerCase().includes('payroll') && !event.name.toLowerCase().includes('nonfarm')
  const higherIsBetter = event.name.toLowerCase().includes('payroll') || event.name.toLowerCase().includes('nonfarm') || event.category === 'GROWTH' || event.category === 'CONSUMER'
  let isGood: boolean | null = null
  if (lowerIsBetter) isGood = diff < 0
  else if (higherIsBetter) isGood = diff > 0
  if (pctDiff < 0.005) isGood = null
  const color = isGood === true ? T.green : isGood === false ? T.red : T.gold
  const arrow = diff > 0 ? ' ↑' : diff < 0 ? ' ↓' : ''
  return { color, label: `${event.actual}${event.unit}${arrow}`, isGood }
}

function getCategoryColor(cat: CalendarEvent['category'], T: ThemeTokens): string {
  switch (cat) {
    case 'FED': return '#c084fc'
    case 'INFLATION': return T.red
    case 'JOBS': return T.green
    case 'GROWTH': return T.blue
    case 'EARNINGS': return T.gold
    case 'CONSUMER': return '#fb923c'
    case 'HOUSING': return '#34d399'
    case 'TRADE': return T.purple
    case 'WATCHLIST': return T.gold
    default: return T.text5
  }
}

function getImpactPipColor(impact: string, T: ThemeTokens): string {
  return impact === 'HIGH' ? T.red : T.gold
}

function formatDayHeader(dateStr: string, today: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return dateStr === today ? `Today — ${label}` : label
}

// ── EVENTS PANEL ──────────────────────────────────────────────────────────────

interface EventsPanelProps {
  watchlistTickers: string[]
  onOpenCalendar: () => void
  T: ThemeTokens
  isDark: boolean
}

export function EventsPanel({ watchlistTickers, onOpenCalendar, T, isDark }: EventsPanelProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [impactFilter, setImpactFilter] = useState<'BOTH' | 'HIGH' | 'MEDIUM'>('BOTH')

  useEffect(() => {
    const t = setInterval(() => setEvents((prev) => [...prev]), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const today = getTodayET()
        const tickers = encodeURIComponent(watchlistTickers.join(','))
        const res = await fetch(`/api/calendar?from=${today}&to=${today}&tickers=${tickers}&view=dashboard`)
        const data = await res.json()
        const tagged = tagWatchlistEvents((data.events as CalendarEvent[]) ?? [], watchlistTickers.map((t) => t.toUpperCase()))
        setEvents(filterDashboardEvents(tagged, today))
      } catch { setEvents([]) } finally { setLoading(false) }
    }
    load()
  }, [watchlistTickers.join(',')])

  const todayLabel = getTodayLabelET()
  const visibleEvents = events.filter((e) =>
    impactFilter === 'BOTH' ? e.impact === 'HIGH' || e.impact === 'MEDIUM' : e.impact === impactFilter
  )

  return (
    <div style={{ background: T.panelBg, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'background 0.35s' }}>
      {/* Header */}
      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.gold, display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600 }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: T.red, boxShadow: `0 0 6px ${T.redBorder5}` }} />
          {`Today's Events — ${todayLabel}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {([{ id: 'BOTH', label: 'All' }, { id: 'HIGH', label: 'High' }, { id: 'MEDIUM', label: 'Medium' }] as const).map((item) => (
            <div key={item.id} onClick={() => setImpactFilter(item.id)}
              style={{ fontSize: '9px', padding: '3px 7px', border: `1px solid ${impactFilter === item.id ? T.goldFaint9 : T.borderItem}`, background: impactFilter === item.id ? T.goldFaint2 : 'transparent', color: impactFilter === item.id ? T.gold : T.text6, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace", transition: 'all 0.15s' }}>
              {item.label}
            </div>
          ))}
          <div onClick={onOpenCalendar}
            style={{ fontSize: '9px', color: T.goldText, cursor: 'pointer', padding: '3px 8px', border: `1px solid ${T.goldFaint5}`, transition: 'all 0.15s', marginLeft: '4px' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = T.gold)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = T.goldText)}>
            Full Calendar →
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading ? (
          <div style={{ padding: '20px 18px', fontSize: '12px', color: T.text7, fontStyle: 'italic' }}>Loading events…</div>
        ) : visibleEvents.length === 0 ? (
          <div style={{ padding: '20px 18px', fontSize: '12px', color: T.text7, fontStyle: 'italic' }}>
            {impactFilter === 'HIGH' ? 'No U.S. high-impact events scheduled today.' : impactFilter === 'MEDIUM' ? 'No U.S. medium-impact events scheduled today.' : 'No U.S. medium or high-impact market events scheduled today.'}
          </div>
        ) : visibleEvents.map((e) => {
          const outcome = getOutcomeColor(e, T)
          const catColor = getCategoryColor(e.category, T)
          const pipColor = getImpactPipColor(e.impact, T)
          const isPast = !!e.actual || isEventPast(e.date, e.time)
          const timer = !isPast ? getTimeUntil(e.date, e.time) : null

          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'stretch', gap: '12px', padding: '12px 18px', borderBottom: `1px solid ${T.borderFaint2}`, opacity: isPast ? 0.85 : 1 }}>
              <div style={{ width: '2px', background: pipColor, flexShrink: 0, borderRadius: '1px', opacity: isPast ? 0.6 : 1, boxShadow: !isPast && e.impact === 'HIGH' ? `0 0 6px ${pipColor}` : 'none' }} />
              <div style={{ fontSize: '10px', color: T.text5, width: '52px', flexShrink: 0, fontFamily: "'DM Mono', monospace", paddingTop: '2px' }}>{e.timeET}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px', color: isPast ? T.text3 : T.text, lineHeight: 1.3 }}>{e.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '9px', color: catColor, background: `${catColor}15`, border: `1px solid ${catColor}30`, padding: '1px 6px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>{e.category}</span>
                  <span style={{ fontSize: '9px', color: e.impact === 'HIGH' ? T.red : T.gold, letterSpacing: '0.1em', opacity: 0.8 }}>{e.impact}</span>
                  <span style={{ fontSize: '9px', color: T.text6 }}>USA</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '3px' }}>
                {isPast ? (
                  <>
                    {e.actual ? (
                      <div style={{ fontSize: '13px', fontWeight: 700, color: outcome.color, fontFamily: "'DM Mono', monospace" }}>{outcome.label || e.actual}</div>
                    ) : (
                      <div style={{ fontSize: '10px', color: T.text7, fontFamily: "'DM Mono', monospace" }}>—</div>
                    )}
                    {e.forecast && <div style={{ fontSize: '10px', color: T.text6, fontFamily: "'DM Mono', monospace" }}>est {e.forecast}{e.unit}</div>}
                  </>
                ) : timer ? (
                  <div style={{ fontSize: '11px', color: T.gold, fontFamily: "'DM Mono', monospace", background: T.goldFaint2, border: `1px solid ${T.goldFaint6}`, padding: '3px 7px' }}>⏳ {timer}</div>
                ) : (
                  <>
                    {e.forecast && <div style={{ fontSize: '11px', color: T.text4, fontFamily: "'DM Mono', monospace" }}>est {e.forecast}{e.unit}</div>}
                    {e.previous && <div style={{ fontSize: '10px', color: T.text6, fontFamily: "'DM Mono', monospace" }}>prev {e.previous}{e.unit}</div>}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── FULL CALENDAR MODAL ───────────────────────────────────────────────────────

interface CalendarModalProps {
  onClose: () => void
  watchlistTickers: string[]
  T: ThemeTokens
  isDark: boolean
}

export function CalendarModal({ onClose, watchlistTickers, T, isDark }: CalendarModalProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState<string>('ALL')

  const week = useMemo(() => getWeekBounds(weekOffset), [weekOffset])
  const today = getTodayET()

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const tickers = encodeURIComponent(watchlistTickers.join(','))
        const res = await fetch(`/api/calendar?from=${week.from}&to=${week.to}&tickers=${tickers}`)
        const data = await res.json()
        const tagged = tagWatchlistEvents((data.events as CalendarEvent[]) ?? [], watchlistTickers.map((t) => t.toUpperCase()))
        setEvents(filterCalendarEvents(tagged))
      } catch { setEvents([]) } finally { setLoading(false) }
    }
    load()
  }, [week.from, week.to, watchlistTickers.join(',')])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const CATS = ['ALL', 'HIGH', 'FED', 'INFLATION', 'JOBS', 'EARNINGS', 'WATCHLIST', 'GROWTH', 'CONSUMER']

  const filteredEvents = useMemo(() => events.filter((e) => {
    if (filterCat === 'ALL') return true
    if (filterCat === 'HIGH') return e.impact === 'HIGH'
    return e.category === filterCat
  }), [events, filterCat])

  const byDate = filteredEvents.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})
  const allDates = Object.keys(byDate).sort()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: T.backdropBlur, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', zIndex: 1, background: T.overlayBg, border: `1px solid ${T.border}`, width: '100%', maxWidth: '860px', maxHeight: '88vh', margin: '0 20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'background 0.35s' }}>

        {/* Modal header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${T.borderFaint}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontStyle: 'italic', color: T.text }}>Economic Calendar</div>
            <div onClick={onClose} style={{ fontSize: '16px', color: T.text6, cursor: 'pointer', padding: '4px 8px' }}>✕</div>
          </div>

          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div onClick={() => setWeekOffset((w) => w - 1)} style={{ padding: '6px 14px', background: T.inputBg, border: `1px solid ${T.goldFaint6}`, color: T.gold, cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Mono', monospace" }}>← Prev</div>
            <div style={{ flex: 1, textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: T.text4 }}>{week.label}</div>
            <div onClick={() => setWeekOffset((w) => w + 1)} style={{ padding: '6px 14px', background: T.inputBg, border: `1px solid ${T.goldFaint6}`, color: T.gold, cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Mono', monospace" }}>Next →</div>
            {weekOffset !== 0 && (
              <div onClick={() => setWeekOffset(0)} style={{ padding: '6px 12px', background: T.goldFaint2, border: `1px solid ${T.goldFaint7}`, color: T.gold, cursor: 'pointer', fontSize: '11px', fontFamily: "'DM Mono', monospace" }}>This Week</div>
            )}
          </div>

          {/* Category filters */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {CATS.map((cat) => (
              <div key={cat} onClick={() => setFilterCat(cat)}
                style={{ padding: '4px 10px', fontSize: '10px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em', cursor: 'pointer', border: `1px solid ${filterCat === cat ? T.goldFaint9 : T.borderItem}`, background: filterCat === cat ? T.goldFaint2 : 'transparent', color: filterCat === cat ? T.gold : T.text5, transition: 'all 0.15s', textTransform: 'uppercase' }}>
                {cat}
              </div>
            ))}
          </div>
        </div>

        {/* Event list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '40px 24px', fontSize: '13px', color: T.text6, fontStyle: 'italic', textAlign: 'center' }}>Loading calendar…</div>
          ) : allDates.length === 0 ? (
            <div style={{ padding: '40px 24px', fontSize: '13px', color: T.text6, fontStyle: 'italic', textAlign: 'center' }}>No U.S. medium or high-impact events match this filter for the selected week.</div>
          ) : allDates.map((date) => {
            const dayEvents = byDate[date]
            return (
              <div key={date}>
                {/* Day header */}
                <div style={{ padding: '10px 24px 8px', background: date === today ? T.goldFaint : T.dayHeaderBg, borderBottom: `1px solid ${T.borderFaint}`, position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.35s' }}>
                  <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: date === today ? T.gold : T.text4, fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{formatDayHeader(date, today)}</div>
                  {date === today && <div style={{ fontSize: '9px', color: T.green, background: T.greenFaint3, border: `1px solid ${T.greenBorder2}`, padding: '1px 7px', letterSpacing: '0.1em' }}>TODAY</div>}
                  <div style={{ marginLeft: 'auto', fontSize: '10px', color: T.text6, fontFamily: "'DM Mono', monospace" }}>{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</div>
                </div>

                {dayEvents.map((e) => {
                  const outcome = getOutcomeColor(e, T)
                  const catColor = getCategoryColor(e.category, T)
                  const pipColor = getImpactPipColor(e.impact, T)
                  const isPast = !!e.actual || isEventPast(e.date, e.time)
                  const timer = !isPast ? getTimeUntil(e.date, e.time) : null
                  const isWatchlist = e.category === 'WATCHLIST' || (e.category === 'EARNINGS' && watchlistTickers.map((t) => t.toUpperCase()).includes((e.ticker ?? '').toUpperCase()))

                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'stretch', gap: '14px', padding: '14px 24px', borderBottom: `1px solid ${T.borderItem}`, background: isWatchlist ? T.goldFaint : 'transparent', transition: 'background 0.35s' }}>
                      <div style={{ width: '3px', background: pipColor, flexShrink: 0, borderRadius: '2px', opacity: isPast ? 0.5 : 1, boxShadow: !isPast && e.impact === 'HIGH' ? `0 0 8px ${pipColor}80` : 'none' }} />
                      <div style={{ width: '90px', flexShrink: 0, paddingTop: '2px' }}>
                        <div style={{ fontSize: '12px', color: T.text4, fontFamily: "'DM Mono', monospace" }}>{e.timeET}</div>
                        <div style={{ fontSize: '10px', color: T.text6, marginTop: '2px' }}>USA</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: isPast ? T.text3 : T.text, marginBottom: '5px', lineHeight: 1.3 }}>{e.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '9px', color: catColor, background: `${catColor}18`, border: `1px solid ${catColor}35`, padding: '2px 7px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>{e.category}</span>
                          <span style={{ fontSize: '9px', color: e.impact === 'HIGH' ? T.red : T.gold, background: e.impact === 'HIGH' ? T.redFaint3 : T.goldFaint2, border: `1px solid ${e.impact === 'HIGH' ? T.redBorder2 : T.goldFaint6}`, padding: '2px 6px', letterSpacing: '0.1em' }}>{e.impact} IMPACT</span>
                          {isWatchlist && <span style={{ fontSize: '9px', color: T.gold, background: T.goldFaint2, border: `1px solid ${T.goldFaint7}`, padding: '2px 6px', letterSpacing: '0.1em' }}>★ WATCHLIST</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexShrink: 0 }}>
                        {e.previous && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '9px', color: T.text6, letterSpacing: '0.1em', marginBottom: '3px' }}>PREV</div>
                            <div style={{ fontSize: '13px', color: T.text4, fontFamily: "'DM Mono', monospace" }}>{e.previous}{e.unit}</div>
                          </div>
                        )}
                        {e.forecast && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '9px', color: T.text6, letterSpacing: '0.1em', marginBottom: '3px' }}>EST</div>
                            <div style={{ fontSize: '13px', color: T.text3, fontFamily: "'DM Mono', monospace" }}>{e.forecast}{e.unit}</div>
                          </div>
                        )}
                        <div style={{ textAlign: 'center', minWidth: '70px' }}>
                          <div style={{ fontSize: '9px', color: T.text6, letterSpacing: '0.1em', marginBottom: '3px' }}>ACTUAL</div>
                          {isPast ? (
                            e.actual ? (
                              <div style={{ fontSize: '14px', fontWeight: 700, color: outcome.color, fontFamily: "'DM Mono', monospace" }}>{outcome.label || e.actual}</div>
                            ) : (
                              <div style={{ fontSize: '11px', color: T.text7, fontFamily: "'DM Mono', monospace" }}>—</div>
                            )
                          ) : timer ? (
                            <div style={{ fontSize: '12px', color: T.gold, fontFamily: "'DM Mono', monospace", background: T.goldFaint2, border: `1px solid ${T.goldFaint6}`, padding: '4px 8px' }}>⏳ {timer}</div>
                          ) : (
                            <div style={{ fontSize: '12px', color: T.text7, fontFamily: "'DM Mono', monospace" }}>—</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: '16px', flexWrap: 'wrap', flexShrink: 0, background: T.overlayBg, transition: 'background 0.35s' }}>
          {[{ color: T.green, label: 'Beat / Good for markets' }, { color: T.red, label: 'Miss / Bad for markets' }, { color: T.gold, label: 'In line / Neutral' }].map((l) => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
              <span style={{ fontSize: '10px', color: T.text5 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}