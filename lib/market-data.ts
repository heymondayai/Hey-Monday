// lib/market-data.ts
// ─────────────────────────────────────────────────────────────────────────────
// All external market data fetchers, cleanly separated and reusable.
// Every function is self-contained: takes the relevant params, returns typed
// data or null on failure. Errors are logged, never thrown.
// ─────────────────────────────────────────────────────────────────────────────

// ── TYPES ────────────────────────────────────────────────────────────────────

export interface Candle {
  datetime: string
  open: string
  high: string
  low: string
  close: string
  volume: string
}

export interface IntradayCandleLookup {
  symbol: string
  requestedEt: string
  matchedEt: string
  intervalStartEt: string
  intervalEndEt: string
  exactBoundaryMatch: boolean
  open: number
  high: number
  low: number
  close: number
  volume: number
  candleDirection: 'up' | 'down' | 'flat'
}

export interface IntradayMoveSummary {
  symbol: string
  startEt: string
  endEt: string
  startOpen: number
  endClose: number
  high: number
  low: number
  absoluteChange: number
  percentChange: number
  direction: 'up' | 'down' | 'flat'
}

export interface EconomicEvent {
  date: string
  time: string
  event: string
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
  actual: string | null
  forecast: string | null
  previous: string | null
  country: string
}

export interface InsiderTransaction {
  symbol: string
  name: string
  transactionDate: string
  transactionType: string
  shares: number
  value: number
  filingDate: string
}

export interface AnalystRating {
  symbol: string
  analyst: string
  rating: string
  priceTarget: number | null
  date: string
  action: string
}

export interface OptionsFlow {
  symbol: string
  strike: number
  expiry: string
  type: 'call' | 'put'
  sentiment: 'bullish' | 'bearish' | 'neutral'
  premium: number
  volume: number
  openInterest: number
  impliedVolatility: number
}

export interface MacroData {
  fedFundsRate: string | null
  tenYearYield: string | null
  twoYearYield: string | null
  yieldSpread: string | null
  cpiYoY: string | null
  unemploymentRate: string | null
}

export interface EarningsEvent {
  symbol: string
  date: string
  time: 'bmo' | 'amc' | 'dmh' | '--'
  epsEstimate: number | null
  revenueEstimate: number | null
  epsActual: number | null
  revenueActual: number | null
}

export interface SecFiling {
  symbol: string
  filingDate: string
  type: string
  title: string
  url: string
}

// ── TWELVE DATA — INTRADAY CANDLES ───────────────────────────────────────────

export interface FetchIntradayOptions {
  interval?: '1min' | '5min' | '15min'
  outputsize?: number
  startDate?: string
  endDate?: string
}

export async function fetchIntraday(
  symbols: string[],
  options: FetchIntradayOptions = {}
): Promise<{ data: Record<string, Candle[]>; debug: string[] }> {
  const key = process.env.TWELVE_DATA_API_KEY
  const debug: string[] = []

  const {
    interval = '5min',
    outputsize = 100,
    startDate,
    endDate,
  } = options

  if (!key) {
    debug.push('TWELVE_DATA_API_KEY not set')
    return { data: {}, debug }
  }

  try {
    const syms = symbols.join(',')
    const params = new URLSearchParams({
      symbol: syms,
      interval,
      outputsize: String(outputsize),
      extended_hours: 'true',
      apikey: key,
    })

    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)

    const url = `https://api.twelvedata.com/time_series?${params.toString()}`
    const res = await fetch(url, { next: { revalidate: 60 } })

    if (!res.ok) {
      debug.push(`Twelve Data HTTP ${res.status}`)
      return { data: {}, debug }
    }

    const raw = await res.json()
    const result: Record<string, Candle[]> = {}

    for (const sym of symbols) {
      const entry = raw[sym] ?? raw
      if (!entry || entry.status === 'error' || !entry.values?.length) {
        debug.push(`${sym}: ${entry?.message ?? 'no data'}`)
        continue
      }

      result[sym] = [...entry.values].reverse()
      debug.push(
        `${sym}: ${result[sym].length} candles` +
        `${startDate || endDate ? ` [${startDate ?? 'latest'} -> ${endDate ?? 'latest'}]` : ''}`
      )
    }

    return { data: result, debug }
  } catch (err: any) {
    debug.push(`Exception: ${err.message}`)
    return { data: {}, debug }
  }
}

// ── BENZINGA — ECONOMIC CALENDAR ─────────────────────────────────────────────

export async function fetchEconomicCalendar(
  from: string,
  to: string
): Promise<EconomicEvent[]> {
  const key = process.env.BENZINGA_API_KEY
  if (!key) return []

  try {
    const days: string[] = []
    const cursor = new Date(`${from}T12:00:00`)
    const end = new Date(`${to}T12:00:00`)
    while (cursor <= end) {
      days.push(cursor.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }))
      cursor.setDate(cursor.getDate() + 1)
    }

    const results = await Promise.all(days.map(async (day): Promise<EconomicEvent[]> => {
      try {
        const params = new URLSearchParams({
          token: key,
          'parameters[date_from]': day,
          'parameters[date_to]': day,
          'parameters[importance]': '1',
        })
       const res = await fetch(
          `https://api.benzinga.com/api/v2.1/calendar/economics?${params}`,
          { cache: 'no-store', headers: { accept: 'application/json' } }
        )
        if (!res.ok) {
          const errText = await res.text()
          console.error('[calendar] Benzinga HTTP', res.status, 'for day', day, 'body:', errText.slice(0, 300))
          return []
        }
        const raw = await res.json()
        const events: any[] = Array.isArray(raw?.economics) ? raw.economics : []
        return events
          .filter((e: any) => {
            if (!e.country) return true
            const c = e.country.toUpperCase()
            return c === 'US' || c === 'USA' || c.includes('UNITED STATES') || c.includes('AMERICA')
          })
          .map((e: any): EconomicEvent => {
            const imp = Number(e.importance)
            return {
              date:     day,
              time:     (e.time ?? '').slice(0, 5),
              event:    (e.event_name ?? e.event ?? '').trim(),
              impact:   imp === 3 ? 'HIGH' : imp === 2 ? 'MEDIUM' : 'LOW',
              actual:   e.actual != null && e.actual !== '' ? String(e.actual) : null,
              forecast: e.consensus != null && e.consensus !== '' ? String(e.consensus) : null,
              previous: e.previous != null && e.previous !== '' ? String(e.previous) : null,
              country:  'US',
            }
          })
          .filter((e: EconomicEvent) => e.event)
      } catch (err: any) {
        console.error('[calendar] day fetch exception for', day, ':', err?.message)
        return []
      }
    }))

    return results.flat()
  } catch {
    return []
  }
}

// ── FINNHUB — INSIDER TRANSACTIONS ───────────────────────────────────────────

export async function fetchInsiderTransactions(symbol: string): Promise<InsiderTransaction[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []

  try {
    const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&token=${key}`
    const res = await fetch(url, { next: { revalidate: 3600 } })

    if (!res.ok) return []
    const raw = await res.json()

    return (raw.data ?? [])
      .filter((t: any) => t.transactionDate && t.share && t.value)
      .slice(0, 10)
      .map((t: any) => ({
        symbol,
        name:            t.name ?? '',
        transactionDate: t.transactionDate ?? '',
        transactionType: t.transactionCode === 'P' ? 'Buy' : t.transactionCode === 'S' ? 'Sale' : t.transactionCode ?? '',
        shares:          Math.abs(t.share ?? 0),
        value:           Math.abs(t.value ?? 0),
        filingDate:      t.filingDate ?? '',
      }))
  } catch {
    return []
  }
}

// ── FMP — ANALYST RATINGS ────────────────────────────────────────────────────

export async function fetchAnalystRatings(symbol: string): Promise<AnalystRating[]> {
  const key = process.env.FMP_API_KEY
  if (!key) return []

  try {
    const url = `https://financialmodelingprep.com/api/v4/upgrades-downgrades?symbol=${symbol}&apikey=${key}`
    const res = await fetch(url, { next: { revalidate: 3600 } })

    if (!res.ok) return []
    const raw: any[] = await res.json()

    return raw.slice(0, 8).map(r => ({
      symbol,
      analyst:     r.gradingCompany ?? '',
      rating:      r.newGrade ?? '',
      priceTarget: r.priceTarget ?? null,
      date:        r.publishedDate?.split('T')[0] ?? '',
      action:      r.action ?? '',
    }))
  } catch {
    return []
  }
}

// ── FMP — UNUSUAL OPTIONS FLOW ───────────────────────────────────────────────

export async function fetchOptionsFlow(symbol: string): Promise<OptionsFlow[]> {
  const key = process.env.FMP_API_KEY
  if (!key) return []

  try {
    const url = `https://financialmodelingprep.com/api/v4/options/chain?symbol=${symbol}&apikey=${key}`
    const res = await fetch(url, { next: { revalidate: 300 } })

    if (!res.ok) return []
    const raw: any[] = await res.json()

    return raw
      .filter((o: any) => o.openInterest > 1000 && o.volume > 500)
      .sort((a: any, b: any) => b.volume - a.volume)
      .slice(0, 6)
      .map((o: any) => ({
        symbol,
        strike:            o.strike ?? 0,
        expiry:            o.expirationDate ?? '',
        type:              o.optionType?.toLowerCase() === 'put' ? 'put' : 'call',
        sentiment:         o.optionType?.toLowerCase() === 'call' ? 'bullish' : 'bearish',
        premium:           (o.lastPrice ?? 0) * (o.contractSize ?? 100),
        volume:            o.volume ?? 0,
        openInterest:      o.openInterest ?? 0,
        impliedVolatility: o.impliedVolatility ?? 0,
      }))
  } catch {
    return []
  }
}

// ── FRED — MACRO DATA ────────────────────────────────────────────────────────

async function fredSeries(seriesId: string, key: string): Promise<string | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=1`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = await res.json()
    return data.observations?.[0]?.value ?? null
  } catch {
    return null
  }
}

export async function fetchMacroData(): Promise<MacroData> {
  const key = process.env.FRED_API_KEY
  if (!key) return { fedFundsRate: null, tenYearYield: null, twoYearYield: null, yieldSpread: null, cpiYoY: null, unemploymentRate: null }

  const [fedFunds, tenYear, twoYear, cpi, unemployment] = await Promise.all([
    fredSeries('FEDFUNDS', key),
    fredSeries('DGS10', key),
    fredSeries('DGS2', key),
    fredSeries('CPIAUCSL', key),
    fredSeries('UNRATE', key),
  ])

  let yieldSpread: string | null = null
  if (tenYear && twoYear && tenYear !== '.' && twoYear !== '.') {
    const spread = (parseFloat(tenYear) - parseFloat(twoYear)).toFixed(2)
    yieldSpread = spread
  }

  return {
    fedFundsRate:     fedFunds !== '.' ? fedFunds : null,
    tenYearYield:     tenYear !== '.' ? tenYear : null,
    twoYearYield:     twoYear !== '.' ? twoYear : null,
    yieldSpread,
    cpiYoY:           cpi !== '.' ? cpi : null,
    unemploymentRate: unemployment !== '.' ? unemployment : null,
  }
}

// ── FMP — EARNINGS CALENDAR ───────────────────────────────────────────────────

export async function fetchEarningsCalendar(
  symbols: string[],
  daysAhead: number = 7
): Promise<EarningsEvent[]> {
  const key = process.env.FMP_API_KEY
  if (!key) return []

  try {
    const from = new Date()
    const to   = new Date()
    to.setDate(to.getDate() + daysAhead)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    const url = `https://financialmodelingprep.com/api/v3/earning_calendar?from=${fmt(from)}&to=${fmt(to)}&apikey=${key}`
    const res = await fetch(url, { next: { revalidate: 3600 } })

    if (!res.ok) return []
    const raw: any[] = await res.json()

    const symbolSet = new Set(symbols.map(s => s.toUpperCase()))
    return raw
      .filter(e => symbolSet.has(e.symbol?.toUpperCase()))
      .map(e => ({
        symbol:          e.symbol ?? '',
        date:            e.date ?? '',
        time:            e.time ?? '--',
        epsEstimate:     e.epsEstimated ?? null,
        revenueEstimate: e.revenueEstimated ?? null,
        epsActual:       e.eps ?? null,
        revenueActual:   e.revenue ?? null,
      }))
  } catch {
    return []
  }
}

// ── FINNHUB — SEC FILINGS ─────────────────────────────────────────────────────

export async function fetchSecFilings(symbol: string): Promise<SecFiling[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []

  try {
    const url = `https://finnhub.io/api/v1/stock/filings?symbol=${symbol}&token=${key}`
    const res = await fetch(url, { next: { revalidate: 3600 } })

    if (!res.ok) return []
    const raw: any[] = await res.json()

    return raw
      .filter(f => ['8-K', '10-Q', '10-K', '13F'].includes(f.form))
      .slice(0, 5)
      .map(f => ({
        symbol,
        filingDate: f.filedDate ?? '',
        type:       f.form ?? '',
        title:      f.description ?? f.form ?? '',
        url:        f.reportUrl ?? '',
      }))
  } catch {
    return []
  }
}

// ── FMP — SECTOR PERFORMANCE ──────────────────────────────────────────────────

export interface SectorPerformance {
  sector: string
  change: string
}

export async function fetchSectorPerformance(): Promise<SectorPerformance[]> {
  const key = process.env.FMP_API_KEY
  if (!key) return []

  try {
    const url = `https://financialmodelingprep.com/api/v3/sectors-performance?apikey=${key}`
    const res = await fetch(url, { next: { revalidate: 300 } })

    if (!res.ok) return []
    const raw: any[] = await res.json()

    return raw.map(s => ({
      sector: s.sector ?? '',
      change: s.changesPercentage ?? '0',
    })).sort((a, b) => parseFloat(b.change) - parseFloat(a.change))
  } catch {
    return []
  }
}

// ── CONTEXT FORMATTERS ────────────────────────────────────────────────────────

function parseEtClockToMinutes(input: string): number | null {
  const raw = input.trim().toLowerCase().replace(/\./g, '')
  const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (!match) return null

  let hour = parseInt(match[1], 10)
  const minute = parseInt(match[2] ?? '0', 10)
  const meridiem = match[3]

  if (minute < 0 || minute > 59) return null

  if (meridiem === 'am') {
    if (hour === 12) hour = 0
  } else if (meridiem === 'pm') {
    if (hour !== 12) hour += 12
  }

  if (hour < 0 || hour > 23) return null
  return hour * 60 + minute
}

function minutesToEtLabel(totalMinutes: number): string {
  const hh = Math.floor(totalMinutes / 60)
  const mm = totalMinutes % 60
  const hour12 = hh % 12 === 0 ? 12 : hh % 12
  const ampm = hh >= 12 ? 'pm' : 'am'
  return `${hour12}:${String(mm).padStart(2, '0')}${ampm}`
}

function candleEtLabel(datetime: string): string {
  const timePart = datetime.split(' ')[1]?.slice(0, 5) ?? datetime
  const [hh, mm] = timePart.split(':').map(Number)
  const hour12 = hh % 12 === 0 ? 12 : hh % 12
  const ampm = hh >= 12 ? 'pm' : 'am'
  return `${hour12}:${String(mm).padStart(2, '0')}${ampm}`
}

function candleMinutesFromDatetime(datetime: string): number | null {
  const timePart = datetime.split(' ')[1]?.slice(0, 5)
  if (!timePart) return null
  const [hh, mm] = timePart.split(':').map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}

function safeCandleNumber(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function candleDatePart(datetime: string): string | null {
  const part = datetime.split(' ')[0]
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null
}

function filterCandlesByEtDate(candles: Candle[], targetDate?: string | null): Candle[] {
  if (!targetDate) return candles
  return candles.filter((c) => candleDatePart(c.datetime) === targetDate)
}

export function findIntradayCandleContainingTime(
  candles: Candle[],
  requestedEt: string,
  intervalMinutes: number = 5,
  targetDate?: string | null
): IntradayCandleLookup | null {
  const dateFiltered = filterCandlesByEtDate(candles, targetDate)
  if (!dateFiltered.length) return null

  const requestedMinutes = parseEtClockToMinutes(requestedEt)
  if (requestedMinutes === null) return null

  let containing: Candle | null = null
  let containingStartMinutes: number | null = null

  for (const candle of dateFiltered) {
    const startMinutes = candleMinutesFromDatetime(candle.datetime)
    if (startMinutes === null) continue

    const endMinutes = startMinutes + intervalMinutes

    if (requestedMinutes >= startMinutes && requestedMinutes < endMinutes) {
      containing = candle
      containingStartMinutes = startMinutes
      break
    }
  }

  if (!containing || containingStartMinutes === null) {
    return null
  }

  const open = safeCandleNumber(containing.open)
  const high = safeCandleNumber(containing.high)
  const low = safeCandleNumber(containing.low)
  const close = safeCandleNumber(containing.close)
  const volume = parseInt(containing.volume || '0', 10) || 0

  const candleDirection =
    close > open ? 'up' : close < open ? 'down' : 'flat'

  return {
    symbol: '',
    requestedEt,
    matchedEt: candleEtLabel(containing.datetime),
    intervalStartEt: minutesToEtLabel(containingStartMinutes),
    intervalEndEt: minutesToEtLabel(containingStartMinutes + intervalMinutes),
    exactBoundaryMatch: requestedMinutes === containingStartMinutes,
    open,
    high,
    low,
    close,
    volume,
    candleDirection,
  }
}

export function summarizeIntradayMoveWindow(
  candles: Candle[],
  startEt: string,
  endEt: string,
  targetDate?: string | null
): IntradayMoveSummary | null {
  const dateFiltered = filterCandlesByEtDate(candles, targetDate)
  if (!dateFiltered.length) return null

  const startMinutes = parseEtClockToMinutes(startEt)
  const endMinutes = parseEtClockToMinutes(endEt)
  if (startMinutes === null || endMinutes === null) return null

  const minMins = Math.min(startMinutes, endMinutes)
  const maxMins = Math.max(startMinutes, endMinutes)

  const windowCandles = dateFiltered.filter((c) => {
    const mins = candleMinutesFromDatetime(c.datetime)
    return mins !== null && mins >= minMins && mins <= maxMins
  })

  if (!windowCandles.length) return null

  const first = windowCandles[0]
  const last = windowCandles[windowCandles.length - 1]

  const startOpen = safeCandleNumber(first.open)
  const endClose = safeCandleNumber(last.close)
  const absoluteChange = endClose - startOpen
  const percentChange = startOpen !== 0 ? (absoluteChange / startOpen) * 100 : 0

  const high = Math.max(...windowCandles.map((c) => safeCandleNumber(c.high)))
  const low = Math.min(...windowCandles.map((c) => safeCandleNumber(c.low)))

  return {
    symbol: '',
    startEt: candleEtLabel(first.datetime),
    endEt: candleEtLabel(last.datetime),
    startOpen,
    endClose,
    high,
    low,
    absoluteChange,
    percentChange,
    direction: absoluteChange > 0 ? 'up' : absoluteChange < 0 ? 'down' : 'flat',
  }
}

export function buildIntradayQuestionContext(
  data: Record<string, Candle[]>,
  message: string,
  focusSymbol?: string | null,
  targetDate?: string | null
): string {
  if (!data || !Object.keys(data).length) {
    return ''
  }

  const lower = message.toLowerCase()
  const lines: string[] = []

  const extractTime = (msg: string): string | null => {
    const match = msg.match(/\b(\d{1,2}):(\d{2})\s?(am|pm)\b/i)
    if (!match) return null

    let [_, h, m, ap] = match
    let hour = parseInt(h)
    const minute = parseInt(m)

    if (ap.toLowerCase() === 'pm' && hour !== 12) hour += 12
    if (ap.toLowerCase() === 'am' && hour === 12) hour = 0

    const hh = hour.toString().padStart(2, '0')
    return `${hh}:${m}`
  }

  const requestedTime = extractTime(lower)

  if (!requestedTime) return ''

  for (const [symbol, candles] of Object.entries(data)) {
    if (focusSymbol && symbol !== focusSymbol) continue

    // 🔥 FILTER BY DATE (THIS IS THE FIX)
    const dateFiltered = targetDate
      ? candles.filter(c => c.datetime?.startsWith(targetDate))
      : candles

    if (!dateFiltered.length) {
      lines.push(`No intraday data found for ${symbol} on ${targetDate}`)
      continue
    }

    const lookup = findIntradayCandleContainingTime(dateFiltered, requestedTime)

    if (!lookup) {
      lines.push(`No candle found for ${symbol} at ${requestedTime} ET on ${targetDate}`)
      continue
    }

    lines.push(
      `${symbol} ${lookup.intervalStartEt}-${lookup.intervalEndEt} ET candle (${targetDate}): ` +
      `open ${lookup.open}, high ${lookup.high}, low ${lookup.low}, close ${lookup.close}, ` +
      `${lookup.candleDirection} candle, volume ${lookup.volume}`
    )
  }

  return lines.join('\n')
}

export function formatIntradayContext(data: Record<string, Candle[]>): string {
  if (!Object.keys(data).length) {
    return 'INTRADAY DATA: Unavailable. Do NOT fabricate intraday moves. If asked about a specific move or candle, say the intraday feed is unavailable.'
  }

  const lines = [
    'INTRADAY 5-MIN CANDLES — oldest at top. Use these exact candles only.',
    'For exact-time questions, use the 5-minute candle interval that contains the ET timestamp, not the nearest later candle.',
    'For move questions, analyze the broader move window, not just one candle in isolation.',
  ]

  for (const [sym, candles] of Object.entries(data)) {
    if (!candles.length) continue

    const first = candles[0]
    const last = candles[candles.length - 1]
    const firstOpen = parseFloat(first.open)
    const lastClose = parseFloat(last.close)
    const movePct = firstOpen !== 0 ? ((lastClose - firstOpen) / firstOpen) * 100 : 0
    const lo = Math.min(...candles.map((c) => parseFloat(c.low)))
    const hi = Math.max(...candles.map((c) => parseFloat(c.high)))

    lines.push(
      `\n${sym} coverage: ${candleEtLabel(first.datetime)} to ${candleEtLabel(last.datetime)} ET | ` +
      `window ${movePct >= 0 ? '+' : ''}${movePct.toFixed(2)}% | range ${lo.toFixed(2)}-${hi.toFixed(2)}`
    )

    for (const c of candles) {
      const startMins = candleMinutesFromDatetime(c.datetime)
      if (startMins === null) continue

      const intervalStart = minutesToEtLabel(startMins)
      const intervalEnd = minutesToEtLabel(startMins + 5)

      lines.push(
        `  ${intervalStart}-${intervalEnd} ET  O:${parseFloat(c.open).toFixed(2)} H:${parseFloat(c.high).toFixed(2)} ` +
        `L:${parseFloat(c.low).toFixed(2)} C:${parseFloat(c.close).toFixed(2)} Vol:${(parseInt(c.volume || '0', 10) || 0).toLocaleString()}`
      )
    }
  }

  return lines.join('\n')
}

export function formatEconomicCalendar(events: EconomicEvent[], todayStr: string): string {
  if (!events.length) return ''

  const today    = events.filter(e => e.date === todayStr)
  const upcoming = events.filter(e => e.date > todayStr)

  const lines = ['ECONOMIC CALENDAR (Benzinga — use these, do not fabricate):']

  const todayFiltered = today.filter(e => e.impact === 'HIGH' || e.impact === 'MEDIUM')
  if (todayFiltered.length) {
    lines.push('\n  TODAY:')
    for (const e of todayFiltered) {
      const actual   = e.actual   ? `Actual: ${e.actual}`   : '(pending)'
      const forecast = e.forecast ? `Est: ${e.forecast}`    : ''
      const prev     = e.previous ? `Prev: ${e.previous}`   : ''
      lines.push(`    ${e.time || '--'} ET  [${e.impact}]  ${e.event}  ${actual}  ${forecast}  ${prev}`.trim())
    }
  }

  const upcomingFiltered = upcoming.filter(e => e.impact === 'HIGH' || e.impact === 'MEDIUM')
  if (upcomingFiltered.length) {
    lines.push('\n  UPCOMING:')
    for (const e of upcomingFiltered.slice(0, 40)) {
      const forecast = e.forecast ? `Est: ${e.forecast}` : ''
      const prev     = e.previous ? `Prev: ${e.previous}` : ''
      const dayLabel = new Date(`${e.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })
      lines.push(`    ${e.date} (${dayLabel})  ${e.time || '--'} ET  [${e.impact}]  ${e.event}  ${forecast}  ${prev}`.trim())
    }
  }

  return lines.join('\n')
}

export function formatInsiderTransactions(transactions: InsiderTransaction[], symbol: string): string {
  if (!transactions.length) return ''
  const lines = [`INSIDER TRANSACTIONS — ${symbol} (last 10 filings):`]
  for (const t of transactions) {
    const val = t.value >= 1_000_000 ? `$${(t.value / 1_000_000).toFixed(1)}M` : `$${(t.value / 1_000).toFixed(0)}K`
    lines.push(`  ${t.transactionDate}  ${t.name}  ${t.transactionType.toUpperCase()}  ${t.shares.toLocaleString()} shares  ${val}`)
  }
  return lines.join('\n')
}

export function formatAnalystRatings(ratings: AnalystRating[], symbol: string): string {
  if (!ratings.length) return ''
  const lines = [`ANALYST RATINGS — ${symbol} (recent):`]
  for (const r of ratings) {
    const pt = r.priceTarget ? `  PT: $${r.priceTarget}` : ''
    lines.push(`  ${r.date}  ${r.analyst}  ${r.action.toUpperCase()}  →  ${r.rating}${pt}`)
  }
  return lines.join('\n')
}

export function formatOptionsFlow(flow: OptionsFlow[], symbol: string): string {
  if (!flow.length) return ''
  const lines = [`OPTIONS FLOW — ${symbol} (high volume contracts):`]
  for (const o of flow) {
    const premium = o.premium >= 1_000_000 ? `$${(o.premium / 1_000_000).toFixed(1)}M` : `$${(o.premium / 1_000).toFixed(0)}K`
    lines.push(`  ${o.expiry}  $${o.strike}${o.type.toUpperCase()}  ${o.sentiment.toUpperCase()}  Vol:${o.volume.toLocaleString()}  OI:${o.openInterest.toLocaleString()}  Premium:${premium}  IV:${(o.impliedVolatility * 100).toFixed(1)}%`)
  }
  return lines.join('\n')
}

export function formatMacroData(macro: MacroData): string {
  if (!Object.values(macro).some(v => v !== null)) return ''
  const lines = ['MACRO / FRED DATA (live):']
  if (macro.fedFundsRate)     lines.push(`  Fed Funds Rate: ${macro.fedFundsRate}%`)
  if (macro.tenYearYield)     lines.push(`  10-Year Treasury Yield: ${macro.tenYearYield}%`)
  if (macro.twoYearYield)     lines.push(`  2-Year Treasury Yield: ${macro.twoYearYield}%`)
  if (macro.yieldSpread) {
    const inverted = parseFloat(macro.yieldSpread) < 0
    lines.push(`  Yield Curve (10Y-2Y): ${macro.yieldSpread}%${inverted ? ' — INVERTED' : ''}`)
  }
  if (macro.cpiYoY)           lines.push(`  CPI Index (latest): ${macro.cpiYoY}`)
  if (macro.unemploymentRate) lines.push(`  Unemployment Rate: ${macro.unemploymentRate}%`)
  return lines.join('\n')
}

export function formatEarningsCalendar(events: EarningsEvent[]): string {
  if (!events.length) return ''
  const lines = ['UPCOMING EARNINGS (watchlist):']
  for (const e of events) {
    const timing = e.time === 'bmo' ? 'Before Open' : e.time === 'amc' ? 'After Close' : e.time
    const eps    = e.epsEstimate != null ? `EPS est: $${e.epsEstimate}` : ''
    const rev    = e.revenueEstimate != null ? `Rev est: $${(e.revenueEstimate / 1e9).toFixed(1)}B` : ''
    const actual = e.epsActual != null ? `Actual EPS: $${e.epsActual}` : ''
    lines.push(`  ${e.date}  ${e.symbol}  ${timing}  ${eps}  ${rev}  ${actual}`.trim())
  }
  return lines.join('\n')
}

// ── TWELVE DATA — LIVE QUOTE ──────────────────────────────────────────────────

export interface LiveQuote {
  sym: string
  price: string
  change: string
  changePct: string
  up: boolean
}

export async function fetchLivePrices(symbols: string[]): Promise<LiveQuote[]> {
  const key = process.env.TWELVE_DATA_API_KEY
  if (!key || !symbols.length) return []
  try {
    const syms = symbols.slice(0, 8).join(',')
    const res = await fetch(
      `https://api.twelvedata.com/quote?symbol=${syms}&apikey=${key}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return []
    const raw = await res.json()
    return symbols.map(sym => {
      const entry = symbols.length === 1 ? raw : raw[sym]
      if (!entry || entry.status === 'error') return null
      const price = parseFloat(entry.close ?? entry.price ?? '0')
      const prevClose = parseFloat(entry.previous_close ?? '0')
      const change = price - prevClose
      const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0
      return {
        sym,
        price: price.toFixed(2),
        change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}`,
        changePct: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`,
        up: change >= 0,
      }
    }).filter(Boolean) as LiveQuote[]
  } catch {
    return []
  }
}

// ── SIGNAL PRE-COMPUTATION LAYER ─────────────────────────────────────────────

export interface SymbolSignals {
  ticker: string
  price: number
  sessionChangePct: number
  vwap: number
  vwapDiffPct: number
  vwapRelation: 'above' | 'below' | 'at'
  volumeRatio: number
  hod: number
  lod: number
  nearHod: boolean
  nearLod: boolean
  trend: 'higher_highs' | 'lower_lows' | 'ranging'
  momentum: 'accelerating' | 'decelerating' | 'steady'
  relativeStrengthVsSpy: number | null
}

export function computeSignals(
  ticker: string,
  candles: Candle[],
  spyCandles?: Candle[]
): SymbolSignals | null {
  if (!candles.length) return null

  // Filter to regular session only (9:30 AM ET) for industry-standard VWAP anchor
  const regularSessionCandles = candles.filter(c => {
    const timePart = c.datetime.split(' ')[1]
    if (!timePart) return true
    const [hh, mm] = timePart.split(':').map(Number)
    const mins = hh * 60 + mm
    return mins >= 570 // 9:30 AM = 570 minutes
  })

  // Use regular session candles for VWAP, all candles for HOD/LOD/trend
  const vwapCandles = regularSessionCandles.length ? regularSessionCandles : candles

  const nums = candles.map(c => ({
    open:   parseFloat(c.open),
    high:   parseFloat(c.high),
    low:    parseFloat(c.low),
    close:  parseFloat(c.close),
    volume: parseInt(c.volume || '0', 10) || 0,
  }))

  const vwapNums = vwapCandles.map(c => ({
    high:   parseFloat(c.high),
    low:    parseFloat(c.low),
    close:  parseFloat(c.close),
    volume: parseInt(c.volume || '0', 10) || 0,
  }))

  // ── PRICE & SESSION CHANGE ────────────────────────────────────────────────
  const price = nums[nums.length - 1].close
  const sessionOpen = nums[0].open
  const sessionChangePct = sessionOpen !== 0
    ? ((price - sessionOpen) / sessionOpen) * 100
    : 0

  // ── HOD / LOD ─────────────────────────────────────────────────────────────
  const hod = Math.max(...nums.map(c => c.high))
  const lod = Math.min(...nums.map(c => c.low))
  const range = hod - lod
  const nearHod = range > 0 && (hod - price) / range < 0.15
  const nearLod = range > 0 && (price - lod) / range < 0.15

  // ── VWAP ──────────────────────────────────────────────────────────────────
  let totalTPV = 0
  let totalVol = 0
  for (const c of vwapNums) {
    const typicalPrice = (c.high + c.low + c.close) / 3
    totalTPV += typicalPrice * c.volume
    totalVol += c.volume
  }
  const vwap = totalVol > 0 ? totalTPV / totalVol : price
  const vwapDiffPct = vwap !== 0 ? ((price - vwap) / vwap) * 100 : 0
  const vwapRelation: 'above' | 'below' | 'at' =
    Math.abs(vwapDiffPct) < 0.05 ? 'at' : vwapDiffPct > 0 ? 'above' : 'below'

  // ── VOLUME RATIO ──────────────────────────────────────────────────────────
  const avgVolume = totalVol / nums.length
  const recentVolume = nums[nums.length - 1].volume
  const volumeRatio = avgVolume > 0 ? recentVolume / avgVolume : 1

  // ── TREND (last 6 candles) ────────────────────────────────────────────────
  const recent = nums.slice(-6)
  let higherHighs = 0
  let lowerLows = 0
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].high > recent[i - 1].high) higherHighs++
    if (recent[i].low < recent[i - 1].low) lowerLows++
  }
  const trend: 'higher_highs' | 'lower_lows' | 'ranging' =
    higherHighs >= 4 ? 'higher_highs' :
    lowerLows >= 4 ? 'lower_lows' : 'ranging'

  // ── MOMENTUM (comparing first half vs second half of session) ─────────────
  const mid = Math.floor(nums.length / 2)
  const firstHalf = nums.slice(0, mid)
  const secondHalf = nums.slice(mid)
  const firstAvgMove = firstHalf.length > 1
    ? Math.abs((firstHalf[firstHalf.length - 1].close - firstHalf[0].open) / firstHalf.length)
    : 0
  const secondAvgMove = secondHalf.length > 1
    ? Math.abs((secondHalf[secondHalf.length - 1].close - secondHalf[0].open) / secondHalf.length)
    : 0
  const momentum: 'accelerating' | 'decelerating' | 'steady' =
    secondAvgMove > firstAvgMove * 1.2 ? 'accelerating' :
    secondAvgMove < firstAvgMove * 0.8 ? 'decelerating' : 'steady'

  // ── RELATIVE STRENGTH VS SPY ──────────────────────────────────────────────
  let relativeStrengthVsSpy: number | null = null
  if (spyCandles?.length) {
    const spyNums = spyCandles.map(c => ({
      open: parseFloat(c.open),
      close: parseFloat(c.close),
    }))
    const spyOpen = spyNums[0].open
    const spyClose = spyNums[spyNums.length - 1].close
    const spyChangePct = spyOpen !== 0 ? ((spyClose - spyOpen) / spyOpen) * 100 : 0
    relativeStrengthVsSpy = sessionChangePct - spyChangePct
  }

  return {
    ticker,
    price,
    sessionChangePct,
    vwap,
    vwapDiffPct,
    vwapRelation,
    volumeRatio,
    hod,
    lod,
    nearHod,
    nearLod,
    trend,
    momentum,
    relativeStrengthVsSpy,
  }
}

export function formatSignals(signals: SymbolSignals[]): string {
  if (!signals.length) return ''

  const lines = ['INTRADAY SIGNALS (pre-computed — use these instead of raw candles for signal questions):']

  for (const s of signals) {
    const changeSign = s.sessionChangePct >= 0 ? '+' : ''
    const vwapSign = s.vwapDiffPct >= 0 ? '+' : ''
    const rsSign = s.relativeStrengthVsSpy != null && s.relativeStrengthVsSpy >= 0 ? '+' : ''

    const hodLodNote = s.nearHod ? 'near HOD' : s.nearLod ? 'near LOD' : 'mid-range'
    const trendNote =
      s.trend === 'higher_highs' ? 'higher highs and higher lows' :
      s.trend === 'lower_lows' ? 'lower highs and lower lows' : 'ranging'
    const volNote =
      s.volumeRatio >= 2 ? `${s.volumeRatio.toFixed(1)}x avg (very elevated)` :
      s.volumeRatio >= 1.3 ? `${s.volumeRatio.toFixed(1)}x avg (elevated)` :
      s.volumeRatio <= 0.7 ? `${s.volumeRatio.toFixed(1)}x avg (light)` :
      `${s.volumeRatio.toFixed(1)}x avg (normal)`

    lines.push(`\n${s.ticker}:`)
    lines.push(`  Price: $${s.price.toFixed(2)} (${changeSign}${s.sessionChangePct.toFixed(2)}% session)`)
    lines.push(`  VWAP: $${s.vwap.toFixed(2)} — ${s.vwapRelation} by ${vwapSign}${s.vwapDiffPct.toFixed(2)}%`)
    if (s.relativeStrengthVsSpy != null) {
      lines.push(`  vs SPY: ${rsSign}${s.relativeStrengthVsSpy.toFixed(2)}% relative strength`)
    }
    lines.push(`  Volume: ${volNote}`)
    lines.push(`  Range: $${s.lod.toFixed(2)} – $${s.hod.toFixed(2)} (${hodLodNote})`)
    lines.push(`  Trend: ${trendNote}, momentum ${s.momentum}`)
  }

  return lines.join('\n')
}

export function formatSectorPerformance(sectors: SectorPerformance[]): string {
  if (!sectors.length) return ''
  const lines = ['SECTOR PERFORMANCE TODAY:']
  for (const s of sectors) {
    const pct   = parseFloat(s.change)
    const arrow = pct >= 0 ? '▲' : '▼'
    const sign  = pct >= 0 ? '+' : ''
    lines.push(`  ${arrow} ${s.sector}: ${sign}${pct.toFixed(2)}%`)
  }
  return lines.join('\n')
}