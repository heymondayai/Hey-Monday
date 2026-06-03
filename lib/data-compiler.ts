// Stage 2 of the two-stage chat pipeline.
// Given a QueryPlan, fetches exactly the data it specifies, pre-computes
// structured insights (VWAP, HOD/LOD, biggest move, etc.), and returns a
// compact context string ready to paste into the executor system prompt.

import { getRecentCandlesMulti, CandleRow } from './candle-store'
import {
  fetchLivePrices,
  fetchIntraday,
  fetchEconomicCalendar,
  fetchEarningsCalendar,
  fetchMacroData,
  fetchSectorPerformance,
  fetchInsiderTransactions,
  fetchAnalystRatings,
  fetchOptionsFlow,
  formatEconomicCalendar,
  formatEarningsCalendar,
  formatMacroData,
  formatSectorPerformance,
  formatInsiderTransactions,
  formatAnalystRatings,
  formatOptionsFlow,
  computeSignals,
  formatSignals,
} from './market-data'
import { buildMarketState } from './market-state'
import { buildHistoricalContext } from './context-builder'
import { QueryPlan, CompileStep } from './query-planner'

// ── UTC → ET conversion (same approach as chat/route.ts) ─────────────────────

function candleRowToEt(row: CandleRow) {
  const d = new Date(row.ts)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  return {
    datetime: `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`,
    open:   row.open.toString(),
    high:   row.high.toString(),
    low:    row.low.toString(),
    close:  row.close.toString(),
    volume: row.volume.toString(),
  }
}

type EtCandle = ReturnType<typeof candleRowToEt>

// ── HELPERS ───────────────────────────────────────────────────────────────────

function candleTimeMins(c: EtCandle): number {
  const t = c.datetime.split(' ')[1]?.slice(0, 5) ?? '00:00'
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minsToLabel(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  const ap = h >= 12 ? 'pm' : 'am'
  return `${h12}:${String(m).padStart(2, '0')}${ap}`
}

function filterToTimeRange(candles: EtCandle[], startTime?: string, endTime?: string): EtCandle[] {
  if (!startTime && !endTime) return candles
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const start = startTime ? toMins(startTime) : 0
  const end   = endTime   ? toMins(endTime)   : 24 * 60
  return candles.filter(c => {
    const mins = candleTimeMins(c)
    return mins >= start && mins < end
  })
}

// ── PER-SYMBOL COMPILE ────────────────────────────────────────────────────────

function compileSymbol(
  sym: string,
  allCandles: EtCandle[],   // all candles for sym (ET, date-filtered to session)
  steps: CompileStep[],
  plan: QueryPlan,
): string[] {
  if (!allCandles.length) return []

  const candles = filterToTimeRange(allCandles, plan.timeRange.startTime, plan.timeRange.endTime)
  if (!candles.length) return [`${sym}: no candles in requested window`]

  const lines: string[] = []
  const sessionDate = candles[0].datetime.split(' ')[0]

  // ── session_summary ───────────────────────────────────────────────────────
  if (steps.includes('session_summary')) {
    const opens  = candles.map(c => parseFloat(c.open))
    const closes = candles.map(c => parseFloat(c.close))
    const highs  = candles.map(c => parseFloat(c.high))
    const lows   = candles.map(c => parseFloat(c.low))
    const vols   = candles.map(c => parseInt(c.volume, 10))

    const sessionOpen  = opens[0]
    const sessionClose = closes[closes.length - 1]
    const hod = Math.max(...highs)
    const lod = Math.min(...lows)
    const changePct = sessionOpen !== 0
      ? ((sessionClose - sessionOpen) / sessionOpen * 100).toFixed(2)
      : '0.00'
    const totalVol = vols.reduce((a, b) => a + b, 0)

    // VWAP = Σ(typical_price × volume) / Σ(volume)
    let cumPV = 0, cumVol = 0
    for (const c of candles) {
      const tp = (parseFloat(c.high) + parseFloat(c.low) + parseFloat(c.close)) / 3
      const v  = parseInt(c.volume, 10)
      cumPV += tp * v
      cumVol += v
    }
    const vwap = cumVol > 0 ? (cumPV / cumVol).toFixed(2) : 'N/A'

    const sign = parseFloat(changePct) >= 0 ? '+' : ''
    lines.push(
      `${sym} ${sessionDate}: open $${sessionOpen.toFixed(2)} → close $${sessionClose.toFixed(2)} (${sign}${changePct}%) | ` +
      `HOD $${hod.toFixed(2)} | LOD $${lod.toFixed(2)} | VWAP $${vwap} | vol ${totalVol.toLocaleString()}`
    )
  }

  // ── biggest_move ──────────────────────────────────────────────────────────
  if (steps.includes('biggest_move')) {
    let biggestPct = 0
    let biggestC: EtCandle | null = null
    for (const c of candles) {
      const o = parseFloat(c.open), cl = parseFloat(c.close)
      const pct = o !== 0 ? Math.abs((cl - o) / o * 100) : 0
      if (pct > biggestPct) { biggestPct = pct; biggestC = c }
    }
    if (biggestC) {
      const startMins = candleTimeMins(biggestC)
      const dir = parseFloat(biggestC.close) >= parseFloat(biggestC.open) ? '▲' : '▼'
      lines.push(
        `${sym} biggest candle: ${minsToLabel(startMins)}–${minsToLabel(startMins + 5)} ET ` +
        `${dir}${biggestPct.toFixed(2)}% | O:${parseFloat(biggestC.open).toFixed(2)} C:${parseFloat(biggestC.close).toFixed(2)} ` +
        `vol:${parseInt(biggestC.volume, 10).toLocaleString()}`
      )
    }
  }

  // ── volume_spikes ─────────────────────────────────────────────────────────
  if (steps.includes('volume_spikes')) {
    const vols = candles.map(c => parseInt(c.volume, 10))
    const avg  = vols.reduce((a, b) => a + b, 0) / vols.length
    const spikes = candles.filter(c => parseInt(c.volume, 10) > avg * 2)
    if (spikes.length) {
      lines.push(`${sym} volume spikes (>2× avg ${Math.round(avg).toLocaleString()}):`)
      for (const c of spikes) {
        const startMins = candleTimeMins(c)
        lines.push(
          `  ${minsToLabel(startMins)}–${minsToLabel(startMins + 5)} ET: ` +
          `${parseInt(c.volume, 10).toLocaleString()} vol | C:${parseFloat(c.close).toFixed(2)}`
        )
      }
    }
  }

  // ── momentum_score ────────────────────────────────────────────────────────
  if (steps.includes('momentum_score')) {
    const last5   = candles.slice(-5)
    const upCount = last5.filter(c => parseFloat(c.close) > parseFloat(c.open)).length
    const label   = upCount >= 4 ? 'strong bullish' : upCount === 3 ? 'mild bullish'
      : upCount <= 1 ? 'strong bearish' : upCount === 2 ? 'mild bearish' : 'neutral'
    lines.push(`${sym} momentum (last 5 candles): ${label} (${upCount}/5 green)`)
  }

  // ── candle_range_detail ───────────────────────────────────────────────────
  if (steps.includes('candle_range_detail')) {
    const label = plan.timeRange.startTime && plan.timeRange.endTime
      ? `${minsToLabel(parseInt(plan.timeRange.startTime.split(':')[0]) * 60 + parseInt(plan.timeRange.startTime.split(':')[1]))}–${minsToLabel(parseInt(plan.timeRange.endTime.split(':')[0]) * 60 + parseInt(plan.timeRange.endTime.split(':')[1]))} ET`
      : 'full session'
    lines.push(`${sym} ${sessionDate} candles (${label}):`)
    for (const c of candles) {
      const startMins = candleTimeMins(c)
      lines.push(
        `  ${minsToLabel(startMins)}–${minsToLabel(startMins + 5)}: ` +
        `O:${parseFloat(c.open).toFixed(2)} H:${parseFloat(c.high).toFixed(2)} ` +
        `L:${parseFloat(c.low).toFixed(2)} C:${parseFloat(c.close).toFixed(2)} ` +
        `Vol:${parseInt(c.volume, 10).toLocaleString()}`
      )
    }
  }

  return lines
}

// ── NEWS–PRICE CORRELATION ────────────────────────────────────────────────────
// Matches news items (by publish time) to the nearest candle for context.

function correlateNewsToPriceMove(
  candlesBySym: Record<string, EtCandle[]>,
  news: any[],
): string {
  if (!news.length || !Object.keys(candlesBySym).length) return ''

  const lines: string[] = ['NEWS → PRICE CORRELATION:']
  for (const item of news.slice(0, 6)) {
    if (!item.publishedAt) continue
    const pubMs = new Date(item.publishedAt).getTime()
    const sym = item.ticker
    const candles = sym ? (candlesBySym[sym] ?? []) : Object.values(candlesBySym)[0] ?? []
    if (!candles.length) continue

    // Find candle whose window contains the news timestamp (ET)
    const pubEt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(pubMs))
    const [ph, pm] = pubEt.split(':').map(Number)
    const pubMins = ph * 60 + pm

    let match: EtCandle | null = null
    for (const c of candles) {
      const startMins = candleTimeMins(c)
      if (pubMins >= startMins && pubMins < startMins + 5) { match = c; break }
    }

    if (match) {
      const startMins = candleTimeMins(match)
      const movePct = ((parseFloat(match.close) - parseFloat(match.open)) / parseFloat(match.open) * 100).toFixed(2)
      const sign = parseFloat(movePct) >= 0 ? '+' : ''
      lines.push(
        `  [${minsToLabel(pubMins)} ET] "${item.headline?.slice(0, 60)}" → ` +
        `${sym ?? ''} candle ${minsToLabel(startMins)}–${minsToLabel(startMins + 5)}: ${sign}${movePct}%`
      )
    }
  }
  return lines.length > 1 ? lines.join('\n') : ''
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export type DataSource = 'supabase' | 'api' | 'search' | 'none'

export interface CompilerResult {
  context: string
  dataSource: DataSource
  confidence: 'high' | 'low'
}

export interface CompilerOptions {
  watchlistTickers: string[]
  passedPrices?: any[]
  passedNews?: any[]
  todayStr: string
  message: string
  userId?: string
  userPlan?: 'core' | 'edge' | null
  traderType?: string
}

export async function compileContext(
  plan: QueryPlan,
  opts: CompilerOptions,
): Promise<CompilerResult> {
  const { watchlistTickers, passedNews, todayStr, message, userPlan, traderType } = opts

  const blocks: string[] = []
  const targetSymbols = plan.symbols.length ? plan.symbols : watchlistTickers.slice(0, 8)
  let dataSource: DataSource = 'none'

  // ── CANDLES ────────────────────────────────────────────────────────────────
  if (plan.fetch.includes('candles') && targetSymbols.length) {
    const lookbackMins = plan.isHistorical ? 32 * 60 : 16 * 60
    const rows = await getRecentCandlesMulti(targetSymbols, lookbackMins)
    const hasData = targetSymbols.some(t => (rows[t]?.length ?? 0) > 0)

    let candlesBySym: Record<string, EtCandle[]> = {}

    if (hasData) {
      dataSource = 'supabase'
      for (const sym of targetSymbols) {
        const converted = (rows[sym] ?? []).map(candleRowToEt)
        // Filter to the plan's target date
        const dateFiltered = converted.filter(c => c.datetime.startsWith(plan.timeRange.startDate))
        candlesBySym[sym] = dateFiltered.length ? dateFiltered : converted
      }
    } else {
      dataSource = 'api'
      // Supabase empty → fall back to Twelve Data API
      const { data } = await fetchIntraday(targetSymbols, {
        interval: '5min',
        outputsize: plan.isHistorical ? 500 : 100,
        startDate: plan.timeRange.startDate,
        endDate: plan.timeRange.endDate,
      })
      for (const sym of targetSymbols) {
        candlesBySym[sym] = (data[sym] ?? []) as unknown as EtCandle[]
      }
    }

    // Run compile steps per symbol
    const candleLines: string[] = []
    for (const sym of targetSymbols) {
      if (!(candlesBySym[sym]?.length)) continue
      const compiled = compileSymbol(sym, candlesBySym[sym], plan.compile, plan)
      candleLines.push(...compiled)
    }

    // News–price correlation (cross-symbol step)
    if (plan.compile.includes('news_price_correlation') && passedNews?.length) {
      const correlation = correlateNewsToPriceMove(candlesBySym, passedNews)
      if (correlation) candleLines.push(correlation)
    }

    // Signals (technical indicators)
    const spyCandles = (candlesBySym['SPY'] ?? []) as unknown as Parameters<typeof computeSignals>[2]
    const signalSyms = plan.topic === 'briefing' ? targetSymbols : targetSymbols.slice(0, 1)
    const signals = signalSyms
      .map(sym => computeSignals(sym, candlesBySym[sym] as any ?? [], spyCandles))
      .filter(Boolean)
    if (signals.length) candleLines.push(formatSignals(signals as any))

    if (candleLines.length) {
      blocks.push(`MARKET DATA (session: ${plan.timeRange.startDate})\n${candleLines.join('\n')}`)
    }
  }

  // ── LIVE PRICES ────────────────────────────────────────────────────────────
  if (plan.fetch.includes('live_prices')) {
    const priceSyms = plan.symbols.length ? plan.symbols : targetSymbols.slice(0, 6)
    try {
      const prices = await fetchLivePrices(priceSyms)
      if (prices.length) {
        blocks.push(`LIVE PRICES:\n${prices.map((p: any) => `  ${p.sym}: $${p.price} ${p.change ?? ''}`).join('\n')}`)
      }
    } catch { /* non-fatal */ }
  }

  // ── NEWS ───────────────────────────────────────────────────────────────────
  if (plan.fetch.includes('news') && passedNews?.length) {
    const relevant = passedNews
      .filter((n: any) =>
        !plan.symbols.length ||
        plan.symbols.some(s => n.ticker === s) ||
        !n.ticker
      )
      .slice(0, 10)
    if (relevant.length) {
      blocks.push(
        `NEWS:\n${relevant.map((n: any, i: number) =>
          `  ${i + 1}. [${n.ticker ?? 'MKT'}] ${n.headline}${n.ai ? ' — ' + n.ai : ''}`
        ).join('\n')}`
      )
    }
  }

  // ── CALENDAR + MACRO + MARKET STATE ───────────────────────────────────────
  const needsCalendar = plan.fetch.includes('calendar')
  const needsMacro    = plan.fetch.includes('macro')
  const needsState    = plan.fetch.includes('market_state')

  if (needsCalendar || needsMacro || needsState) {
    const calTo = new Date(`${todayStr}T12:00:00`)
    calTo.setDate(calTo.getDate() + 45)
    const calToStr = calTo.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    const [economicEvents, macroData, marketState] = await Promise.all([
      needsCalendar ? fetchEconomicCalendar(todayStr, calToStr) : Promise.resolve([]),
      needsMacro    ? fetchMacroData()                          : Promise.resolve(null),
      needsState    ? buildMarketState({
        watchlistTickers,
        keyNews: (passedNews ?? []).slice(0, 10).map((n: any) => ({
          symbol: n.ticker, headline: n.headline,
          source: n.source, publishedAt: n.publishedAt,
        })),
      }) : Promise.resolve(null),
    ])

    if (economicEvents?.length) blocks.push(formatEconomicCalendar(economicEvents, todayStr))
    if (macroData)              blocks.push(formatMacroData(macroData))
    if (marketState?.summary)   blocks.push(`MARKET SNAPSHOT (${marketState.snapshotTime}): ${marketState.summary}`)
    if (marketState?.macroContext?.length) {
      blocks.push(
        `MACRO:\n${marketState.macroContext.slice(0, 10)
          .map((m: any) => `  ${m.label}: ${m.value}${m.implication ? ` (${m.implication})` : ''}`)
          .join('\n')}`
      )
    }
  }

  // ── EARNINGS ───────────────────────────────────────────────────────────────
  if (plan.fetch.includes('earnings_calendar')) {
    const calTo = new Date(`${todayStr}T12:00:00`)
    calTo.setDate(calTo.getDate() + 45)
    const calToStr = calTo.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    try {
      const events = await fetchEarningsCalendar(targetSymbols, todayStr, calToStr)
      if (events?.length) blocks.push(formatEarningsCalendar(events))
    } catch { /* non-fatal */ }
  }

  // ── SECTOR ─────────────────────────────────────────────────────────────────
  if (plan.fetch.includes('sector')) {
    try {
      const sectorData = await fetchSectorPerformance()
      if (sectorData?.length) blocks.push(formatSectorPerformance(sectorData))
    } catch { /* non-fatal */ }
  }

  // ── SYMBOL-SPECIFIC: INSIDER / ANALYST / OPTIONS ──────────────────────────
  const focusSym = plan.symbols[0] ?? null
  if (focusSym) {
    const fetches: Promise<any>[] = []
    const keys: string[]          = []
    if (plan.fetch.includes('insider')) { fetches.push(fetchInsiderTransactions(focusSym)); keys.push('insider') }
    if (plan.fetch.includes('analyst')) { fetches.push(fetchAnalystRatings(focusSym));      keys.push('analyst') }
    if (plan.fetch.includes('options')) { fetches.push(fetchOptionsFlow(focusSym));          keys.push('options') }

    if (fetches.length) {
      const results = await Promise.all(fetches)
      keys.forEach((k, i) => {
        if (!results[i]) return
        if (k === 'insider') blocks.push(formatInsiderTransactions(results[i], focusSym))
        if (k === 'analyst') blocks.push(formatAnalystRatings(results[i], focusSym))
        if (k === 'options') blocks.push(formatOptionsFlow(results[i], focusSym))
      })
    }
  }

  // ── HISTORICAL CONTEXT ─────────────────────────────────────────────────────
  if (plan.fetch.includes('historical_context')) {
    try {
      const hist = await buildHistoricalContext(
        message, watchlistTickers, focusSym, userPlan ?? null
      )
      if (hist) blocks.push(hist)
    } catch { /* non-fatal */ }
  }

  // ── TRADER LENS ────────────────────────────────────────────────────────────
  const traderLens = traderType === 'day'
    ? 'USER IS A DAY TRADER: Focus on intraday momentum, VWAP, HOD/LOD, volume, session context.'
    : traderType === 'longterm'
    ? 'USER IS A LONG-TERM INVESTOR: Focus on fundamentals, macro, earnings, longer-term thesis.'
    : 'USER IS A SWING TRADER: Focus on 3-day to 3-month setups, catalysts, sector rotation.'

  const context = [traderLens, ...blocks].filter(Boolean).join('\n\n')
  const confidence: CompilerResult['confidence'] = dataSource === 'supabase' ? 'high' : 'low'

  return { context, dataSource, confidence }
}

// ── OUTPUT FORMAT INSTRUCTIONS ────────────────────────────────────────────────

export function buildOutputInstructions(plan: QueryPlan): string {
  switch (plan.outputFormat) {
    case 'one_liner':
      return 'RESPONSE: One sentence only. Answer the exact question. Stop.'
    case 'candle_list':
      return 'RESPONSE: List the candles exactly as shown in MARKET DATA. No prose intro. No filler. Stop after the last candle.'
    case 'summary':
      return 'RESPONSE: 2–3 sentences. Lead with the key number or move. One supporting fact. Stop.'
    case 'briefing':
      return `RESPONSE RULES (HARD LIMITS):
- Max 3 sentences.
- Sentence 1: Biggest theme with a number.
- Sentence 2: Top mover or catalyst.
- Sentence 3: One key risk or forward note. Stop.`
    case 'prose':
    default:
      return plan.detailLevel === 'brief'
        ? 'RESPONSE: 1–2 sentences. Answer the question. Stop.'
        : 'RESPONSE: 2–3 sentences maximum. Answer first, one supporting fact only if it changes the answer. Stop.'
  }
}
