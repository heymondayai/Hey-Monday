import { NextRequest, NextResponse } from 'next/server'
import { fetchEarningsCalendar } from '@/lib/market-data'

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
  source?: 'benzinga' | 'provider'
}

interface BenzingaEconomicEvent {
  date?: string
  date_short?: string
  time?: string
  event_name?: string
  event?: string
  importance?: number | string
  actual?: string | number | null
  consensus?: string | number | null
  forecast?: string | number | null
  previous?: string | number | null
  country?: string
}

const DASHBOARD_MAJOR_COUNTRIES = new Set([
  'US',
  'USA',
  'EUR',
  'EU',
  'EMU',
  'EUROZONE',
  'GB',
  'GBP',
  'UK',
  'GBR',
  'JP',
  'JPY',
  'JPN',
  'CN',
  'CNY',
  'CHN',
  'CA',
  'CAD',
  'CAN',
])

function categorize(name: string): CalendarEvent['category'] {
  const n = name.toLowerCase()
  if (/earnings/.test(n)) return 'EARNINGS'
  if (/triple witching|options expir|opex/.test(n)) return 'OPEX'
  if (/fed|fomc|powell|chair|reserve|rate decision|minutes|beige book|speak|speech|testimony/.test(n)) return 'FED'
  if (/cpi|ppi|pce|inflation|price index/.test(n)) return 'INFLATION'
  if (/nfp|nonfarm|payroll|job|employment|unemployment|claims|labor|jolts/.test(n)) return 'JOBS'
  if (/gdp|gross domestic|pmi|ism|manufacturing|services|industrial production|capacity utilization/.test(n)) return 'GROWTH'
  if (/retail sales|consumer confidence|consumer sentiment|spending/.test(n)) return 'CONSUMER'
  if (/housing|home sales|building permit|housing start|nahb/.test(n)) return 'HOUSING'
  if (/trade balance|import|export/.test(n)) return 'TRADE'
  return 'MACRO'
}

function getUnit(name: string): string {
  const n = name.toLowerCase()
  if (/rate|cpi|ppi|pce|gdp|unemployment|inflation|sales|confidence|sentiment|pmi|ism|capacity utilization|production/.test(n)) return '%'
  if (/nonfarm|payroll|claims/.test(n)) return 'K'
  if (/jolts|openings|home sales/.test(n)) return 'M'
  return ''
}

function formatTimeET(raw: string): string {
  if (!raw || raw === '--') return '--'

  const cleaned = raw.trim().slice(0, 5)
  const [hh, mm] = cleaned.split(':').map(Number)

  if (Number.isNaN(hh) || Number.isNaN(mm)) return raw

  const date = new Date()
  date.setHours(hh, mm, 0, 0)

  return (
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date) + ' ET'
  )
}

function normalizeValue(value: string | number | null | undefined): string | null {
  if (value == null || value === '') return null
  return String(value)
}

function dedupeEvents(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Set<string>()
  const out: CalendarEvent[] = []

  for (const e of events) {
    const key = [e.date, e.time, e.name.toLowerCase(), e.category, e.ticker ?? ''].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }

  return out
}

function normalizeBenzingaDate(raw?: string): string {
  if (!raw) return ''

  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  }

  return raw.slice(0, 10)
}

function normalizeBenzingaTime(raw?: string): string {
  if (!raw) return '--'

  const hhmm = raw.match(/^(\d{2}):(\d{2})/)
  if (hhmm) return `${hhmm[1]}:${hhmm[2]}`

  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampm) {
    let hour = parseInt(ampm[1], 10)
    const minute = ampm[2]
    const period = ampm[3].toUpperCase()

    if (period === 'PM' && hour !== 12) hour += 12
    if (period === 'AM' && hour === 12) hour = 0

    return `${String(hour).padStart(2, '0')}:${minute}`
  }

  return '--'
}

function mapImportanceToImpact(value: number | string | undefined): CalendarEvent['impact'] {
  const n = typeof value === 'string' ? parseInt(value, 10) : value
  if (n === 3) return 'HIGH'
  if (n === 2) return 'MEDIUM'
  return 'LOW'
}

function normalizeCountry(country?: string): string {
  if (!country) return 'US'
  const v = country.trim().toUpperCase()
  if (['UNITED STATES', 'UNITED STATES OF AMERICA', 'USA'].includes(v)) return 'US'
  return v
}

function isDashboardRelevantCountry(country?: string): boolean {
  return DASHBOARD_MAJOR_COUNTRIES.has(normalizeCountry(country))
}

function enumerateDates(from: string, to: string): string[] {
  const out: string[] = []
  const cursor = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)

  while (cursor.getTime() <= end.getTime()) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cursor.setDate(cursor.getDate() + 1)
  }

  return out
}

async function fetchBenzingaEconomicCalendarForDay(day: string): Promise<CalendarEvent[]> {
  const token = process.env.BENZINGA_API_KEY
  if (!token) return []

  try {
    const params = new URLSearchParams({
      token,
      'parameters[date_from]': day,
      'parameters[date_to]': day,
      'parameters[importance]': '1',
    })

    const url = `https://api.benzinga.com/api/v2.1/calendar/economics?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
      },
      next: { revalidate: 300 },
    })

    if (!res.ok) return []

    const raw = await res.json()
    const economics: BenzingaEconomicEvent[] = Array.isArray(raw?.economics) ? raw.economics : []

    return economics
      .map((e, idx): CalendarEvent | null => {
        const name = (e.event_name ?? e.event ?? '').trim()
        const date = normalizeBenzingaDate(e.date ?? e.date_short)
        const time = normalizeBenzingaTime(e.time)
        const unit = getUnit(name)

        if (!name || !date) return null

        return {
          id: `eco-${date}-${time}-${idx}-${name.replace(/[^a-zA-Z0-9]+/g, '-')}`,
          date,
          time,
          timeET: time === '--' ? '--' : formatTimeET(time),
          name,
          country: normalizeCountry(e.country),
          impact: mapImportanceToImpact(e.importance),
          category: categorize(name),
          actual: normalizeValue(e.actual),
          forecast: normalizeValue(e.consensus ?? e.forecast),
          previous: normalizeValue(e.previous),
          unit,
          source: 'benzinga',
        }
      })
      .filter((e): e is CalendarEvent => e !== null)
  } catch {
    return []
  }
}

async function getMacroCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const days = enumerateDates(from, to)
  const results = await Promise.all(days.map((day) => fetchBenzingaEconomicCalendarForDay(day)))
  return results.flat()
}

function applyDashboardFilters(events: CalendarEvent[], today: string): CalendarEvent[] {
  return events
    .filter((e) => e.date === today)
    .filter((e) => e.impact === 'HIGH' || e.impact === 'MEDIUM')
    .filter((e) => isDashboardRelevantCountry(e.country))
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    const from = searchParams.get('from') || today
    const to = searchParams.get('to') || today
    const view = searchParams.get('view') || 'full'
    const tickersParam = searchParams.get('tickers') || ''

    const watchlistTickers = tickersParam
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)

    const fromDate = new Date(`${from}T12:00:00`)
    const toDate = new Date(`${to}T12:00:00`)
    const diffDays = Math.max(0, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)))

    const [macroEvents, earningsEvents] = await Promise.all([
      getMacroCalendarEvents(from, to),
      watchlistTickers.length ? fetchEarningsCalendar(watchlistTickers, diffDays + 7) : Promise.resolve([]),
    ])

    const earningsCalendarEvents: CalendarEvent[] = earningsEvents
      .filter((e) => e.date >= from && e.date <= to)
      .map((e, idx) => {
        const isWatchlist = watchlistTickers.includes(e.symbol.toUpperCase())
        const timeET =
          e.time === 'bmo'
            ? 'Before Open'
            : e.time === 'amc'
              ? 'After Close'
              : e.time === 'dmh'
                ? 'During Market'
                : '--'

        return {
          id: `earnings-${e.date}-${e.symbol}-${idx}`,
          date: e.date,
          time: e.time || '--',
          timeET,
          name: `${e.symbol} Earnings`,
          country: 'US',
          impact: 'HIGH',
          category: isWatchlist ? 'WATCHLIST' : 'EARNINGS',
          actual: e.epsActual != null ? String(e.epsActual) : null,
          forecast: e.epsEstimate != null ? String(e.epsEstimate) : null,
          previous: null,
          unit: '',
          ticker: e.symbol,
          source: 'provider',
        }
      })

    function timeToMinutes(t: string): number {
      if (!t || t === '--' || t === 'bmo') return -60
      if (t === 'amc') return 1200
      if (t === 'dmh') return 600
      const match = t.match(/^(\d{2}):(\d{2})/)
      if (!match) return 9999
      return parseInt(match[1]) * 60 + parseInt(match[2])
    }

    let allEvents = dedupeEvents([...macroEvents, ...earningsCalendarEvents]).sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date)
      if (dateCmp !== 0) return dateCmp
      return timeToMinutes(a.time) - timeToMinutes(b.time)
    })

    if (view === 'dashboard') {
      allEvents = applyDashboardFilters(allEvents, today)
    }

    return NextResponse.json({
      events: allEvents,
      from,
      to,
      meta: {
        provider: 'benzinga',
        providerReady: true,
        view,
      },
    })
  } catch {
    return NextResponse.json(
      { events: [], error: 'Failed to load calendar' },
      { status: 500 }
    )
  }
}