import { createAdminSupabaseClient } from './supabase-admin'

interface TimeRange {
  from: string
  to: string
  label: string
}

function toDateStr(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function daysAgo(n: number): string {
  return toDateStr(new Date(Date.now() - n * 86_400_000))
}

export function inferTimeRange(message: string): TimeRange {
  const m = message.toLowerCase()
  const today = toDateStr(new Date())

  // "yesterday"
  if (/\byesterday\b/.test(m)) {
    const d = daysAgo(1)
    return { from: d, to: d, label: 'yesterday' }
  }

  // "last N days/weeks/months"
  const lastN = m.match(/last\s+(\d+)\s+(day|week|month)s?/)
  if (lastN) {
    const n = parseInt(lastN[1], 10)
    const unit = lastN[2]
    const days = unit === 'week' ? n * 7 : unit === 'month' ? n * 30 : n
    return { from: daysAgo(days), to: today, label: `last ${n} ${unit}${n > 1 ? 's' : ''}` }
  }

  // "last week"
  if (/\blast\s+week\b/.test(m)) return { from: daysAgo(7), to: today, label: 'last week' }

  // "last month"
  if (/\blast\s+month\b/.test(m)) return { from: daysAgo(30), to: today, label: 'last month' }

  // "this week" — Monday of current week
  if (/\bthis\s+week\b/.test(m)) {
    const now = new Date()
    const dayOfWeek = now.getDay() || 7
    const monday = new Date(now.getTime() - (dayOfWeek - 1) * 86_400_000)
    return { from: toDateStr(monday), to: today, label: 'this week' }
  }

  // "this month"
  if (/\bthis\s+month\b/.test(m)) {
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: toDateStr(firstOfMonth), to: today, label: 'this month' }
  }

  // "in January" / "in March" / etc.
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december']
  for (let i = 0; i < months.length; i++) {
    if (new RegExp(`\\b${months[i]}\\b`).test(m)) {
      const now = new Date()
      const year = now.getMonth() >= i ? now.getFullYear() : now.getFullYear() - 1
      const first = new Date(year, i, 1)
      const last  = new Date(year, i + 1, 0)
      return { from: toDateStr(first), to: toDateStr(last), label: months[i] }
    }
  }

  // Q1–Q4
  const quarter = m.match(/\bq([1-4])\b/)
  if (quarter) {
    const q = parseInt(quarter[1], 10)
    const now = new Date()
    const startMonth = (q - 1) * 3
    const year = now.getMonth() >= startMonth ? now.getFullYear() : now.getFullYear() - 1
    const first = new Date(year, startMonth, 1)
    const last  = new Date(year, startMonth + 3, 0)
    return { from: toDateStr(first), to: toDateStr(last), label: `Q${q} ${year}` }
  }

  // Default: last 14 days
  return { from: daysAgo(14), to: today, label: 'last 14 days' }
}

interface DataSignals {
  news: boolean
  insider: boolean
  analyst: boolean
  options: boolean
  macro: boolean
  earnings: boolean
  economic: boolean
  sector: boolean
  filings: boolean
  congressional: boolean
  darkPool: boolean
  shortInterest: boolean
  institutional: boolean
  priceHistory: boolean
}

export function inferDataSignals(message: string): DataSignals {
  const m = message.toLowerCase()
  return {
    news:          /\b(news|article|headline|report|press release|announced)\b/.test(m),
    insider:       /\b(insider|insider trade|insider buy|insider sell|bought shares|sold shares)\b/.test(m),
    analyst:       /\b(analyst|rating|upgrade|downgrade|price target|\bpt\b|coverage|initiat)\b/.test(m),
    options:       /\b(option|call|put|flow|unusual options|sweep|contract)\b/.test(m),
    macro:         /\b(macro|fed|federal reserve|interest rate|inflation|gdp|unemployment|cpi|pce|fred|treasury|yield|mortgage rate)\b/.test(m),
    earnings:      /\b(earnings|eps|revenue|beat|miss|guidance|quarter|quarterly|q[1-4])\b/.test(m),
    economic:      /\b(economic calendar|fomc|jobs report|nfp|non.?farm|ppi|retail sales|economic event)\b/.test(m),
    sector:        /\b(sector|sector performance|tech sector|energy sector|financials|rotation)\b/.test(m),
    filings:       /\b(sec|filing|10-k|10-q|8-k|13f|form 4|proxy|annual report)\b/.test(m),
    congressional: /\b(congress|senator|politician|congressional|senate|house representative|pelosi|stock act)\b/.test(m),
    darkPool:      /\b(dark pool|block trade|block print|off.?exchange|ats)\b/.test(m),
    shortInterest: /\b(short interest|short squeeze|days to cover|short ratio|short float|short volume)\b/.test(m),
    institutional: /\b(institutional|hedge fund|fund holding|13f|position|portfolio|institution)\b/.test(m),
    priceHistory:  /\b(price history|historical price|chart|how did|performance|return|went|moved|was trading|high was|low was)\b/.test(m),
  }
}

function fmt(rows: any[], header: string, mapper: (r: any) => string, limit = 20): string {
  if (!rows?.length) return ''
  return `${header}:\n${rows.slice(0, limit).map(r => `  ${mapper(r)}`).join('\n')}`
}

export async function buildHistoricalContext(
  message: string,
  watchlistTickers: string[],
  focusSymbol?: string | null,
): Promise<string> {
  const range = inferTimeRange(message)
  const signals = inferDataSignals(message)

  // If no signals detected, return empty — current live data is enough
  const anySignal = Object.values(signals).some(Boolean)
  if (!anySignal) return ''

  const supabase = createAdminSupabaseClient()
  const tickerFilter = focusSymbol ? [focusSymbol] : watchlistTickers.slice(0, 20)

  type QResult = { key: string; rows: any[] }
  const q = (p: PromiseLike<QResult>): Promise<QResult> => Promise.resolve(p)
  const queries: Promise<QResult>[] = []

  if (signals.news) {
    queries.push(q(
      supabase
        .from('news_articles')
        .select('headline, summary, tickers, published_at, source, sentiment')
        .gte('published_at', `${range.from}T00:00:00`)
        .lte('published_at', `${range.to}T23:59:59`)
        .order('published_at', { ascending: false })
        .limit(30)
        .then(({ data }): QResult => ({ key: 'news', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.insider) {
    queries.push(q(
      supabase
        .from('insider_transactions')
        .select('ticker, insider_name, insider_title, transaction_type, shares, total_value, transaction_date')
        .in('ticker', tickerFilter)
        .gte('transaction_date', range.from)
        .lte('transaction_date', range.to)
        .order('transaction_date', { ascending: false })
        .limit(25)
        .then(({ data }): QResult => ({ key: 'insider', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.analyst) {
    queries.push(q(
      supabase
        .from('analyst_ratings')
        .select('ticker, analyst_firm, rating, price_target, action, rated_at')
        .in('ticker', tickerFilter)
        .gte('rated_at', range.from)
        .lte('rated_at', range.to)
        .order('rated_at', { ascending: false })
        .limit(25)
        .then(({ data }): QResult => ({ key: 'analyst', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.options) {
    queries.push(q(
      supabase
        .from('options_flow')
        .select('ticker, contract_type, strike, expiry, premium, volume, open_interest, sentiment, snapshot_date')
        .in('ticker', tickerFilter)
        .gte('snapshot_date', range.from)
        .lte('snapshot_date', range.to)
        .order('snapshot_date', { ascending: false })
        .limit(30)
        .then(({ data }): QResult => ({ key: 'options', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.macro) {
    queries.push(q(
      supabase
        .from('macro_indicators')
        .select('series_id, series_name, date, value')
        .gte('date', range.from)
        .lte('date', range.to)
        .order('date', { ascending: false })
        .limit(50)
        .then(({ data }): QResult => ({ key: 'macro', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.earnings) {
    queries.push(q(
      supabase
        .from('calendar_events')
        .select('title, event_date, ticker, actual_value, expected_value, event_time')
        .eq('event_type', 'earnings')
        .in('ticker', tickerFilter)
        .gte('event_date', range.from)
        .lte('event_date', range.to)
        .order('event_date', { ascending: false })
        .limit(20)
        .then(({ data }): QResult => ({ key: 'earnings', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.economic) {
    queries.push(q(
      supabase
        .from('calendar_events')
        .select('title, event_date, event_time, impact, actual_value, expected_value, previous_value')
        .eq('event_type', 'economic')
        .gte('event_date', range.from)
        .lte('event_date', range.to)
        .order('event_date', { ascending: false })
        .limit(20)
        .then(({ data }): QResult => ({ key: 'economic', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.sector) {
    queries.push(q(
      supabase
        .from('sector_snapshots')
        .select('sector, change_pct, snapshot_date')
        .gte('snapshot_date', range.from)
        .lte('snapshot_date', range.to)
        .order('snapshot_date', { ascending: false })
        .limit(40)
        .then(({ data }): QResult => ({ key: 'sector', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.filings) {
    queries.push(q(
      supabase
        .from('sec_filings')
        .select('ticker, filing_type, title, filed_at, url')
        .in('ticker', tickerFilter)
        .gte('filed_at', range.from)
        .lte('filed_at', range.to)
        .order('filed_at', { ascending: false })
        .limit(20)
        .then(({ data }): QResult => ({ key: 'filings', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.congressional) {
    queries.push(q(
      supabase
        .from('congressional_trades')
        .select('ticker, politician_name, chamber, party, transaction_type, amount_range, transaction_date')
        .gte('transaction_date', range.from)
        .lte('transaction_date', range.to)
        .order('transaction_date', { ascending: false })
        .limit(20)
        .then(({ data }): QResult => ({ key: 'congressional', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.darkPool) {
    queries.push(q(
      supabase
        .from('dark_pool_trades')
        .select('ticker, price, volume, notional_value, traded_at')
        .in('ticker', tickerFilter)
        .gte('traded_at', `${range.from}T00:00:00`)
        .lte('traded_at', `${range.to}T23:59:59`)
        .order('traded_at', { ascending: false })
        .limit(25)
        .then(({ data }): QResult => ({ key: 'darkPool', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.shortInterest) {
    queries.push(q(
      supabase
        .from('short_interest')
        .select('ticker, report_date, short_volume, short_volume_ratio, days_to_cover')
        .in('ticker', tickerFilter)
        .gte('report_date', range.from)
        .lte('report_date', range.to)
        .order('report_date', { ascending: false })
        .limit(20)
        .then(({ data }): QResult => ({ key: 'shortInterest', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.institutional) {
    queries.push(q(
      supabase
        .from('institutional_holdings')
        .select('ticker, institution_name, shares, value_usd, quarter, change_shares')
        .in('ticker', tickerFilter)
        .order('quarter', { ascending: false })
        .limit(30)
        .then(({ data }): QResult => ({ key: 'institutional', rows: (data ?? []) as any[] }))
    ))
  }

  if (signals.priceHistory) {
    queries.push(q(
      supabase
        .from('price_snapshots')
        .select('ticker, date, open, high, low, close, volume, vwap')
        .in('ticker', tickerFilter)
        .gte('date', range.from)
        .lte('date', range.to)
        .order('date', { ascending: false })
        .limit(100)
        .then(({ data }): QResult => ({ key: 'priceHistory', rows: (data ?? []) as any[] }))
    ))
  }

  const results = await Promise.all(queries)
  const byKey: Record<string, any[]> = {}
  for (const r of results) byKey[r.key] = r.rows

  const blocks: string[] = [`HISTORICAL DATA (${range.label})`]

  const news = byKey['news']
  if (news?.length) {
    blocks.push(fmt(news, 'Historical News', r =>
      `[${r.tickers?.join(',') ?? 'MKT'}] ${r.published_at?.split('T')[0]} — ${r.headline}${r.sentiment ? ` (${r.sentiment})` : ''}`
    ))
  }

  const insider = byKey['insider']
  if (insider?.length) {
    blocks.push(fmt(insider, 'Insider Transactions', r =>
      `${r.ticker} — ${r.insider_name ?? 'unknown'} ${r.transaction_type} ${r.shares?.toLocaleString() ?? '?'} shares @ total $${r.total_value?.toLocaleString() ?? '?'} (${r.transaction_date})`
    ))
  }

  const analyst = byKey['analyst']
  if (analyst?.length) {
    blocks.push(fmt(analyst, 'Analyst Ratings', r =>
      `${r.ticker} — ${r.analyst_firm ?? '?'} ${r.action ?? ''} → ${r.rating ?? '?'}${r.price_target ? ` PT $${r.price_target}` : ''} (${r.rated_at})`
    ))
  }

  const options = byKey['options']
  if (options?.length) {
    blocks.push(fmt(options, 'Options Flow', r =>
      `${r.ticker} ${r.contract_type?.toUpperCase()} $${r.strike} exp ${r.expiry} — prem $${r.premium?.toLocaleString() ?? '?'} vol ${r.volume?.toLocaleString() ?? '?'} OI ${r.open_interest?.toLocaleString() ?? '?'} (${r.sentiment})`
    ))
  }

  const macro = byKey['macro']
  if (macro?.length) {
    const grouped: Record<string, any[]> = {}
    for (const row of macro) {
      if (!grouped[row.series_id]) grouped[row.series_id] = []
      grouped[row.series_id].push(row)
    }
    const macroLines = Object.entries(grouped).map(([, obs]) => {
      const latest = obs[0]
      return `  ${latest.series_name ?? latest.series_id}: ${latest.value} (${latest.date})`
    })
    blocks.push(`Macro Indicators:\n${macroLines.join('\n')}`)
  }

  const earnings = byKey['earnings']
  if (earnings?.length) {
    blocks.push(fmt(earnings, 'Earnings Results', r => {
      const beat = r.actual_value != null && r.expected_value != null
        ? parseFloat(r.actual_value) >= parseFloat(r.expected_value) ? 'beat' : 'missed'
        : ''
      return `${r.ticker} — ${r.event_date}${beat ? ` ${beat}` : ''} EPS actual ${r.actual_value ?? '?'} est ${r.expected_value ?? '?'}${r.event_time ? ` (${r.event_time})` : ''}`
    }))
  }

  const economic = byKey['economic']
  if (economic?.length) {
    blocks.push(fmt(economic, 'Economic Events', r =>
      `${r.event_date} — ${r.title}${r.actual_value != null ? ` actual ${r.actual_value}` : ''}${r.expected_value != null ? ` est ${r.expected_value}` : ''}${r.impact ? ` (${r.impact})` : ''}`
    ))
  }

  const sector = byKey['sector']
  if (sector?.length) {
    const latestDate = sector[0]?.snapshot_date
    const latestDay = sector.filter((r: any) => r.snapshot_date === latestDate)
    blocks.push(fmt(latestDay, `Sector Performance (${latestDate})`, r =>
      `${r.sector}: ${r.change_pct >= 0 ? '+' : ''}${r.change_pct?.toFixed(2)}%`
    ))
  }

  const filings = byKey['filings']
  if (filings?.length) {
    blocks.push(fmt(filings, 'SEC Filings', r =>
      `${r.ticker} — ${r.filing_type ?? '?'} — ${r.title ?? ''} (${r.filed_at})`
    ))
  }

  const congress = byKey['congressional']
  if (congress?.length) {
    blocks.push(fmt(congress, 'Congressional Trades', r =>
      `${r.politician_name} (${r.chamber}, ${r.party ?? '?'}) ${r.transaction_type} ${r.ticker ?? '?'} ${r.amount_range ?? ''} (${r.transaction_date})`
    ))
  }

  const darkPool = byKey['darkPool']
  if (darkPool?.length) {
    blocks.push(fmt(darkPool, 'Dark Pool Prints', r =>
      `${r.ticker} — $${r.price} × ${r.volume?.toLocaleString()} = $${r.notional_value?.toLocaleString()} (${r.traded_at?.split('T')[0]})`
    ))
  }

  const shortInt = byKey['shortInterest']
  if (shortInt?.length) {
    blocks.push(fmt(shortInt, 'Short Interest', r =>
      `${r.ticker} — ${r.short_volume_ratio != null ? (r.short_volume_ratio * 100).toFixed(1) + '% short ratio' : ''} ${r.days_to_cover != null ? r.days_to_cover.toFixed(1) + 'd DTC' : ''} (${r.report_date})`
    ))
  }

  const institutional = byKey['institutional']
  if (institutional?.length) {
    blocks.push(fmt(institutional, 'Institutional Holdings', r =>
      `${r.institution_name} — ${r.ticker} ${r.shares?.toLocaleString()} shares ($${r.value_usd?.toLocaleString()})${r.change_shares != null ? ` Δ${r.change_shares >= 0 ? '+' : ''}${r.change_shares?.toLocaleString()}` : ''} Q${r.quarter}`
    ))
  }

  const prices = byKey['priceHistory']
  if (prices?.length) {
    const grouped: Record<string, any[]> = {}
    for (const row of prices) {
      if (!grouped[row.ticker]) grouped[row.ticker] = []
      grouped[row.ticker].push(row)
    }
    const priceLines = Object.entries(grouped).flatMap(([ticker, rows]) =>
      rows.slice(0, 5).map((r: any) =>
        `  ${ticker} ${r.date}: O${r.open} H${r.high} L${r.low} C${r.close} vol ${r.volume?.toLocaleString()}`
      )
    )
    blocks.push(`Historical Prices:\n${priceLines.join('\n')}`)
  }

  if (blocks.length === 1) return ''
  return blocks.filter(Boolean).join('\n\n')
}
