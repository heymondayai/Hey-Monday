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

export async function fetchIntraday(
  symbols: string[],
  interval: '1min' | '5min' | '15min' = '5min',
  outputsize: number = 100
): Promise<{ data: Record<string, Candle[]>; debug: string[] }> {
  const key = process.env.TWELVE_DATA_API_KEY
  const debug: string[] = []

  if (!key) { debug.push('TWELVE_DATA_API_KEY not set'); return { data: {}, debug } }

  try {
    const syms = symbols.join(',')
    const url = `https://api.twelvedata.com/time_series?symbol=${syms}&interval=${interval}&outputsize=${outputsize}&extended_hours=true&apikey=${key}`
    const res = await fetch(url, { next: { revalidate: 60 } })

    if (!res.ok) { debug.push(`Twelve Data HTTP ${res.status}`); return { data: {}, debug } }

    const raw = await res.json()
    const result: Record<string, Candle[]> = {}

    for (const sym of symbols) {
      const entry = raw[sym] ?? raw
      if (!entry || entry.status === 'error' || !entry.values?.length) {
        debug.push(`${sym}: ${entry?.message ?? 'no data'}`)
        continue
      }
      result[sym] = [...entry.values].reverse()
      debug.push(`${sym}: ${result[sym].length} candles`)
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

export function formatIntradayContext(data: Record<string, Candle[]>): string {
  if (!Object.keys(data).length) {
    return 'INTRADAY DATA: Unavailable. Do NOT fabricate intraday moves. If asked about a specific move, explain what economic events likely caused it based on the calendar.'
  }

  const lines = ['INTRADAY 5-MIN CANDLES — oldest at top. Reference these exact values, do not guess.']

  for (const [sym, candles] of Object.entries(data)) {
    if (!candles.length) continue
    const first   = candles[0]
    const last    = candles[candles.length - 1]
    const movePct = ((parseFloat(last.close) - parseFloat(first.open)) / parseFloat(first.open) * 100).toFixed(2)
    const sign    = parseFloat(movePct) >= 0 ? '+' : ''
    const lo      = Math.min(...candles.map(c => parseFloat(c.low))).toFixed(2)
    const hi      = Math.max(...candles.map(c => parseFloat(c.high))).toFixed(2)

    lines.push(`\n  ${sym}  window: ${sign}${movePct}%  range: ${lo}–${hi}`)
    for (const c of candles) {
      const t = c.datetime.split(' ')[1]?.slice(0, 5) ?? c.datetime
      lines.push(`    ${t}  O:${c.open}  H:${c.high}  L:${c.low}  C:${c.close}  Vol:${parseInt(c.volume).toLocaleString()}`)
    }
  }

  return lines.join('\n')
}

export function formatEconomicCalendar(events: EconomicEvent[], todayStr: string): string {
  if (!events.length) return ''

  const today    = events.filter(e => e.date === todayStr)
  const upcoming = events.filter(e => e.date > todayStr)

  const lines = ['ECONOMIC CALENDAR (Benzinga — use these, do not fabricate):']

  if (today.length) {
    lines.push('\n  TODAY:')
    for (const e of today) {
      const actual   = e.actual   ? `Actual: ${e.actual}`   : '(pending)'
      const forecast = e.forecast ? `Est: ${e.forecast}`    : ''
      const prev     = e.previous ? `Prev: ${e.previous}`   : ''
      lines.push(`    ${e.time || '--'} ET  [${e.impact}]  ${e.event}  ${actual}  ${forecast}  ${prev}`.trim())
    }
  }

  if (upcoming.length) {
    lines.push('\n  UPCOMING:')
    for (const e of upcoming.slice(0, 10)) {
      const forecast = e.forecast ? `Est: ${e.forecast}` : ''
      const prev     = e.previous ? `Prev: ${e.previous}` : ''
      lines.push(`    ${e.date}  ${e.time || '--'} ET  [${e.impact}]  ${e.event}  ${forecast}  ${prev}`.trim())
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