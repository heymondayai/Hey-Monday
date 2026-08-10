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

interface ForexFactoryEvent {
  title: string
  country: string  // currency code: USD, EUR, GBP, JPY, etc.
  date: string     // ISO 8601 with offset: "2026-08-11T08:30:00-04:00"
  impact: 'High' | 'Medium' | 'Low'
  forecast: string
  previous: string
  actual?: string
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
  // Specific overrides first — must come before broad "sales" / "%" catch-all
  if (/home sales|new home|existing home/.test(n)) return 'K'
  if (/jolts|job openings/.test(n)) return 'M'
  if (/nonfarm|payroll|claims/.test(n)) return 'K'
  if (/rate|cpi|ppi|pce|gdp|unemployment|inflation|sales|confidence|sentiment|pmi|ism|capacity utilization|production/.test(n)) return '%'
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

function normalizeValueForUnit(raw: string | null, unit: string): string | null {
  if (raw == null) return null
  const num = parseFloat(raw)
  if (isNaN(num)) return raw
  if (unit === 'K' && Math.abs(num) >= 10_000) {
    const n = num / 1_000
    return n % 1 === 0 ? String(n) : n.toFixed(1)
  }
  if (unit === 'M' && Math.abs(num) >= 1_000_000) {
    const n = num / 1_000_000
    return n % 1 === 0 ? String(n) : n.toFixed(2)
  }
  return raw
}

function dedupeEvents(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Map<string, CalendarEvent>()

  for (const e of events) {
    const key = [e.date, e.time, e.name.toLowerCase(), e.category, e.ticker ?? ''].join('|')
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, e)
    } else {
      // Prefer the scheduled release (has forecast) over a retroactive delayed one
      const incomingForecastWins = e.forecast != null && existing.forecast == null
      // If the incoming event's previous value matches the existing event's actual,
      // the incoming is a newer reporting period (e.g. March previous=635K == Feb actual=635K)
      const incomingIsNewerPeriod =
        e.previous != null &&
        existing.actual != null &&
        Math.abs(parseFloat(e.previous) - parseFloat(existing.actual)) < 0.01
      if (incomingForecastWins || incomingIsNewerPeriod) {
        seen.set(key, e)
      }
    }
  }

  return Array.from(seen.values())
}

function overrideFedImpact(name: string, impact: CalendarEvent['impact']): CalendarEvent['impact'] {
  if (/fomc|federal open market|rate decision|powell|fed chair|beige book/i.test(name)) return 'HIGH'
  return impact
}

function normalizeCountry(country?: string): string {
  if (!country) return 'US'
  const v = country.trim().toUpperCase()
  if (['UNITED STATES', 'UNITED STATES OF AMERICA', 'USA', 'USD'].includes(v)) return 'US'
  return v
}

function isDashboardRelevantCountry(country?: string): boolean {
  return DASHBOARD_MAJOR_COUNTRIES.has(normalizeCountry(country))
}

function mapFFImpact(impact: string): CalendarEvent['impact'] {
  if (impact === 'High') return 'HIGH'
  if (impact === 'Medium') return 'MEDIUM'
  return 'LOW'
}

async function getMacroCalendarEvents(from: string, to: string, fresh = false): Promise<CalendarEvent[]> {
  const fetchOpts = fresh
    ? { cache: 'no-store' as const }
    : { next: { revalidate: 300 } as const }

  const [thisWeekRes, nextWeekRes] = await Promise.allSettled([
    fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', fetchOpts),
    fetch('https://nfs.faireconomy.media/ff_calendar_nextweek.json', fetchOpts),
  ])

  const rawEvents: ForexFactoryEvent[] = []
  if (thisWeekRes.status === 'fulfilled' && thisWeekRes.value.ok) {
    const data = await thisWeekRes.value.json()
    if (Array.isArray(data)) rawEvents.push(...data)
  }
  if (nextWeekRes.status === 'fulfilled' && nextWeekRes.value.ok) {
    const data = await nextWeekRes.value.json()
    if (Array.isArray(data)) rawEvents.push(...data)
  }

  return rawEvents
    .map((e, idx): CalendarEvent | null => {
      const name = (e.title ?? '').trim()
      if (!name) return null

      const dt = new Date(e.date)
      if (isNaN(dt.getTime())) return null

      const dateET = dt.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      if (dateET < from || dateET > to) return null

      const timeRaw = dt.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      // Some locales emit "24:xx" for midnight — normalize to "00:xx"
      const time = timeRaw.startsWith('24') ? `00${timeRaw.slice(2)}` : timeRaw
      const unit = getUnit(name)

      return {
        id: `eco-${dateET}-${time}-${idx}-${name.replace(/[^a-zA-Z0-9]+/g, '-')}`,
        date: dateET,
        time,
        timeET: formatTimeET(time),
        name,
        country: normalizeCountry(e.country),
        impact: overrideFedImpact(name, mapFFImpact(e.impact)),
        category: categorize(name),
        actual: normalizeValueForUnit(e.actual || null, unit),
        forecast: normalizeValueForUnit(e.forecast || null, unit),
        previous: normalizeValueForUnit(e.previous || null, unit),
        unit,
        source: 'benzinga',
      }
    })
    .filter((e): e is CalendarEvent => e !== null)
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
    const fresh = searchParams.get('fresh') === '1'
    const tickersParam = searchParams.get('tickers') || ''

    const watchlistTickers = tickersParam
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)

    // Extend the earnings window 7 days past `to` so upcoming events are visible
    const toExtended = new Date(`${to}T12:00:00`)
    toExtended.setDate(toExtended.getDate() + 7)
    const toEarnings = toExtended.toISOString().split('T')[0]

    const [macroEvents, earningsEvents] = await Promise.all([
      getMacroCalendarEvents(from, to, fresh),
      fetchEarningsCalendar(watchlistTickers, from, toEarnings),
    ])

    const earningsCalendarEvents: CalendarEvent[] = earningsEvents
      .filter((e) => e.date >= from && e.date <= to)
      .map((e, idx) => {
        const sym = e.symbol.toUpperCase()
        const isWatchlist = watchlistTickers.includes(sym)
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
      allEvents = applyDashboardFilters(allEvents, from)
    }

    return NextResponse.json({
      events: allEvents,
      from,
      to,
      meta: {
        provider: 'forexfactory',
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