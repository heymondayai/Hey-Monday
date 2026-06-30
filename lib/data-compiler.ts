// Stage 2 of the two-stage chat pipeline.
// Given a QueryPlan, fetches exactly the data it specifies, pre-computes
// structured insights (VWAP, HOD/LOD, gaps, breadth, signals, etc.),
// and returns a compact context string for the executor system prompt.

import { getRecentCandlesMulti, getHistoricalDailyVolumes, CandleRow } from './candle-store'
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
  SymbolSignals,
} from './market-data'
import { buildMarketState } from './market-state'
import { buildHistoricalContext } from './context-builder'
import { QueryPlan, CompileStep } from './query-planner'
import { computeMarketRegime } from './market-regime'
import { runBacktests, formatBacktests } from './backtest'

// ── UTC → ET conversion ───────────────────────────────────────────────────────

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

// ── SESSION PHASE ──────────────────────────────────────────────────────────────
// Intraday context changes meaning depending on where we are in the trading day.

export function getSessionPhase(): { phase: string; label: string; guidance: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const h    = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0', 10)
  const m    = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)
  const mins = h * 60 + m

  if (mins < 240)  return { phase: 'overnight',     label: 'Overnight / Post-market',          guidance: 'Market is closed. Reference the most recent regular-session close for price context. Overnight futures and overseas markets are the active session.' }
  if (mins < 570)  return { phase: 'premarket',     label: 'Pre-market (4:00–9:30 AM ET)',     guidance: 'Pre-market is active. Volume is thin; treat pre-market prints as directional signals, not firm levels. The opening gap from yesterday\'s close is the key setup to frame.' }
  if (mins < 630)  return { phase: 'opening_drive', label: 'Opening drive (9:30–10:30 AM ET)', guidance: 'Opening drive: the most volatile and highest-volume period of the day. HOD and LOD are frequently set here. The first 15–30 min establishes session tone — gap direction, bias, and whether the gap holds or fills.' }
  if (mins < 840)  return { phase: 'midday',        label: 'Midday (10:30 AM–2:00 PM ET)',     guidance: 'Midday chop: volume dries up, price ranges. Breakouts from midday ranges on low volume are suspect. A volume pickup during this window is a meaningful signal. VWAP acts as a gravitational anchor.' }
  if (mins < 930)  return { phase: 'afternoon',     label: 'Afternoon (2:00–3:30 PM ET)',      guidance: 'Afternoon trend: institutional rebalancing and position-building begins. Volume increases. Directional moves in this window have more conviction than midday.' }
  if (mins < 960)  return { phase: 'power_hour',    label: 'Power hour (3:30–4:00 PM ET)',     guidance: 'Power hour: highest intraday volume window. Trends that hold to 3:45 PM typically close in that direction. High-volume reversals here are significant. Closing auctions finalize prices.' }
  if (mins < 1200) return { phase: 'after_hours',   label: 'After-hours (4:00–8:00 PM ET)',    guidance: 'After-hours: thin liquidity, wider spreads. AH prices reflect earnings reactions and breaking news. Treat AH levels as directional signals, not as firm support/resistance.' }
  return           { phase: 'overnight',     label: 'Late post-market / Overnight',             guidance: 'Market closed. Reference the regular-session close for price context.' }
}

// ── WATCHLIST BREADTH INTELLIGENCE ────────────────────────────────────────────
// Pre-computed market-wide view for multi-symbol / briefing questions.
// Replaces scattered per-symbol raw data with a single structured intelligence block.

function buildWatchlistBreadthBlock(
  candlesBySym: Record<string, EtCandle[]>,
  signalsBySym: Record<string, SymbolSignals | null>,
  prevCloses: Record<string, number>,
  todayStr: string,
): string {
  type Entry = {
    sym: string
    intradayPct: number
    dayOverDayPct: number | null
    aboveVwap: boolean
    nearHod: boolean
    nearLod: boolean
    volRatio: number
  }
  const entries: Entry[] = []

  for (const sym of Object.keys(candlesBySym)) {
    const candles = candlesBySym[sym]
    if (!candles?.length) continue

    const sessionOpen  = parseFloat(candles[0].open)
    const sessionClose = parseFloat(candles[candles.length - 1].close)
    const intradayPct  = sessionOpen !== 0 ? (sessionClose - sessionOpen) / sessionOpen * 100 : 0

    const prevClose    = prevCloses[sym]
    const dayOverDayPct = prevClose && prevClose > 0
      ? (sessionClose - prevClose) / prevClose * 100
      : null

    const sig = signalsBySym[sym]
    entries.push({
      sym,
      intradayPct,
      dayOverDayPct,
      aboveVwap: sig ? sig.vwapRelation !== 'below' : false,
      nearHod:   sig?.nearHod ?? false,
      nearLod:   sig?.nearLod ?? false,
      volRatio:  sig?.volumeRatio ?? 1,
    })
  }

  if (entries.length < 2) return ''

  const sign   = (n: number) => n >= 0 ? '+' : ''
  const fmtPct = (n: number) => `${sign(n)}${n.toFixed(2)}%`

  const greenCount    = entries.filter(e => e.intradayPct >= 0).length
  const avgIntraday   = entries.reduce((a, e) => a + e.intradayPct, 0) / entries.length
  const sorted        = [...entries].sort((a, b) => b.intradayPct - a.intradayPct)
  const aboveVwapCnt  = entries.filter(e => e.aboveVwap).length
  const nearHodCnt    = entries.filter(e => e.nearHod).length
  const nearLodCnt    = entries.filter(e => e.nearLod).length
  const volAlerts     = entries.filter(e => e.volRatio >= 2)

  const leaders  = sorted.slice(0, 3).map(e => `${e.sym} ${fmtPct(e.intradayPct)}`)
  const laggards = [...sorted].reverse()
    .filter(e => e.intradayPct < 0)
    .slice(0, 3)
    .map(e => `${e.sym} ${fmtPct(e.intradayPct)}`)

  const lines: string[] = [
    `WATCHLIST BREADTH (intraday open→close, ${todayStr}):`,
    `  ${greenCount}/${entries.length} names green | Avg: ${fmtPct(avgIntraday)} | VWAP: ${aboveVwapCnt}/${entries.length} above`,
    `  Leaders:  ${leaders.join(' | ')}`,
  ]
  if (laggards.length) lines.push(`  Laggards: ${laggards.join(' | ')}`)

  const structureNotes = [
    nearHodCnt > 0 && `${nearHodCnt} near HOD (session strength)`,
    nearLodCnt > 0 && `${nearLodCnt} near LOD (session weakness)`,
  ].filter(Boolean)
  if (structureNotes.length) lines.push(`  Structure: ${structureNotes.join(' | ')}`)

  if (volAlerts.length) {
    lines.push(`  Volume elevated: ${volAlerts.map(e => `${e.sym} ${e.volRatio.toFixed(1)}x avg (${e.intradayPct >= 0 ? '▲' : '▼'})`).join(', ')}`)
  }

  return lines.join('\n')
}

// ── PER-SYMBOL COMPILE ────────────────────────────────────────────────────────

function compileSymbol(
  sym: string,
  allCandles: EtCandle[],
  steps: CompileStep[],
  plan: QueryPlan,
  prevClose?: number,  // previous session close — enables gap detection
  prevHigh?: number,   // prior session high — key intraday reference level
  prevLow?: number,    // prior session low
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
      `${sym} ${sessionDate}: open $${sessionOpen.toFixed(2)} → close $${sessionClose.toFixed(2)} (${sign}${changePct}% intraday open→close) | ` +
      `HOD $${hod.toFixed(2)} | LOD $${lod.toFixed(2)} | VWAP $${vwap} | vol ${totalVol.toLocaleString()}`
    )

    // Gap detection — only available when prev session close is known
    if (prevClose && prevClose > 0) {
      const gapAbs = sessionOpen - prevClose
      const gapPct = (gapAbs / prevClose) * 100
      const gapFilled = gapAbs > 0 ? lod <= prevClose : hod >= prevClose

      if (Math.abs(gapPct) >= 0.10) {
        const gapDir  = gapAbs > 0 ? 'gap up' : 'gap down'
        const gapSign = gapAbs >= 0 ? '+' : ''
        lines.push(
          `${sym} vs prev close $${prevClose.toFixed(2)}: ${gapDir} ${gapSign}$${Math.abs(gapAbs).toFixed(2)} (${gapSign}${gapPct.toFixed(2)}%) | ` +
          `gap ${gapFilled ? 'FILLED intraday' : 'unfilled (holding)'}`
        )
      } else {
        lines.push(`${sym} vs prev close $${prevClose.toFixed(2)}: flat open (no meaningful gap)`)
      }
    }
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

  // ── setup_analysis ────────────────────────────────────────────────────────
  // Pre-computes the key structural levels the model needs to synthesize a setup.
  // The model does the actual setup analysis — this block gives it the scaffolding.
  if (steps.includes('setup_analysis')) {
    const opens  = candles.map(c => parseFloat(c.open))
    const highs  = candles.map(c => parseFloat(c.high))
    const lows   = candles.map(c => parseFloat(c.low))
    const closes = candles.map(c => parseFloat(c.close))
    const vols   = candles.map(c => parseInt(c.volume, 10))

    const sessionOpen  = opens[0]
    const sessionClose = closes[closes.length - 1]
    const hod = Math.max(...highs)
    const lod = Math.min(...lows)
    const totalVol = vols.reduce((a, b) => a + b, 0)

    // Session VWAP
    let cumPV = 0, cumVol = 0
    for (const c of candles) {
      const tp = (parseFloat(c.high) + parseFloat(c.low) + parseFloat(c.close)) / 3
      const v  = parseInt(c.volume, 10)
      cumPV += tp * v
      cumVol += v
    }
    const vwap = cumVol > 0 ? cumPV / cumVol : sessionClose

    // Opening range: first 30 minutes of regular session (9:30–10:00 AM ET)
    const orCandles = candles.filter(c => {
      const mins = candleTimeMins(c)
      return mins >= 570 && mins < 600
    })
    const orHigh = orCandles.length ? Math.max(...orCandles.map(c => parseFloat(c.high))) : null
    const orLow  = orCandles.length ? Math.min(...orCandles.map(c => parseFloat(c.low))) : null

    // Price context relative to key levels
    const vsVwap     = sessionClose > vwap * 1.0005 ? 'above' : sessionClose < vwap * 0.9995 ? 'below' : 'at'
    const nearHod    = hod > 0 && (hod - sessionClose) / hod < 0.005
    const nearLod    = lod > 0 && (sessionClose - lod) / lod < 0.005
    const abovePrevH = prevHigh && sessionClose > prevHigh
    const belowPrevL = prevLow  && sessionClose < prevLow
    const priceCtx   = nearHod ? 'near HOD' : nearLod ? 'near LOD' : `${vsVwap} VWAP`

    const setupLines: string[] = [
      `SETUP LEVELS — ${sym} (${sessionDate}):`,
      `  Current price:  $${sessionClose.toFixed(2)} — ${priceCtx}`,
      `  Session VWAP:   $${vwap.toFixed(2)} (price ${vsVwap} by $${Math.abs(sessionClose - vwap).toFixed(2)})`,
      `  HOD / LOD:      $${hod.toFixed(2)} / $${lod.toFixed(2)}`,
    ]

    if (orHigh !== null && orLow !== null) {
      const orStatus = sessionClose > orHigh ? 'ABOVE OR (breakout)' : sessionClose < orLow ? 'BELOW OR (breakdown)' : 'inside OR'
      setupLines.push(`  Opening range:  H $${orHigh.toFixed(2)} / L $${orLow.toFixed(2)} — price ${orStatus}`)
    }

    if (prevClose) {
      const gapAbs = sessionOpen - prevClose
      const gapPct = (gapAbs / prevClose * 100).toFixed(2)
      const gapStatus = Math.abs(parseFloat(gapPct)) >= 0.15
        ? `${gapAbs > 0 ? 'gap up' : 'gap down'} ${gapAbs > 0 ? '+' : ''}${gapPct}% from $${prevClose.toFixed(2)}`
        : `flat open (prev close $${prevClose.toFixed(2)})`
      setupLines.push(`  Gap / prior C:  ${gapStatus}`)
    }

    if (prevHigh && prevLow) {
      const priorContext = abovePrevH ? 'price ABOVE prior high — extended territory'
        : belowPrevL ? 'price BELOW prior low — breakdown territory'
        : 'price within prior range'
      setupLines.push(`  Prior day H/L:  $${prevHigh.toFixed(2)} / $${prevLow.toFixed(2)} — ${priorContext}`)
    }

    setupLines.push(`  Session volume: ${totalVol.toLocaleString()} shares`)

    lines.push(...setupLines)
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

// ── EARNINGS PROXIMITY ALERT ──────────────────────────────────────────────────
// Always injected when any target symbol has earnings within 7 calendar days
// (~5 trading days). Runs in parallel with candle fetch — no added latency.

async function buildEarningsProximityAlert(
  symbols: string[],
  todayStr: string,
): Promise<string> {
  if (!symbols.length) return ''
  try {
    const toDate = new Date(`${todayStr}T12:00:00`)
    toDate.setDate(toDate.getDate() + 7)
    const toStr = toDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const events = await fetchEarningsCalendar(symbols, todayStr, toStr)
    if (!events.length) return ''
    const alerts = events
      .filter(e => e.date >= todayStr)
      .map(e => {
        const timing = e.time === 'bmo' ? 'before open'
          : e.time === 'amc' ? 'after close'
          : e.date
        return `EARNINGS ALERT: ${e.symbol} reports ${e.date} (${timing}) — elevated volume and implied volatility are earnings-driven, not purely technical`
      })
    return alerts.join('\n')
  } catch {
    return ''
  }
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export type BadgeSource = 'live' | 'api' | 'search'

export interface DataBadge {
  label: string
  source: BadgeSource
}

export interface CompilerResult {
  context: string
  badges: DataBadge[]
  confidence: 'high' | 'low'
}

export interface CompilerOptions {
  watchlistTickers: string[]
  watchlistNames?: Record<string, string>
  passedPrices?: any[]                      // { sym, price, change, up }[]
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
  const {
    watchlistTickers, watchlistNames = {}, passedPrices = [],
    passedNews, todayStr, message, userPlan, traderType,
  } = opts

  const blocks: string[] = []
  const targetSymbols = plan.symbols.length ? plan.symbols : watchlistTickers.slice(0, 8)

  // ── WATCHLIST BLOCK (always present) ──────────────────────────────────────
  if (watchlistTickers.length) {
    const priceMap: Record<string, { price?: string; change?: string }> = {}
    for (const p of passedPrices) {
      if (p.sym) priceMap[p.sym] = { price: p.price, change: p.change }
    }
    const pricesAt = passedPrices.length
      ? ` (prices as of ${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })} ET)`
      : ''
    const lines = watchlistTickers.map(t => {
      const name     = watchlistNames[t] && watchlistNames[t] !== t ? ` (${watchlistNames[t]})` : ''
      const p        = priceMap[t]
      const priceStr = p?.price ? ` — $${p.price}${p.change ? ' ' + p.change + ' vs prev close' : ''}` : ''
      return `  ${t}${name}${priceStr}`
    })
    blocks.push(`WATCHLIST${pricesAt}:\n${lines.join('\n')}`)
  }

  const badges: DataBadge[] = []

  // ── CANDLES ────────────────────────────────────────────────────────────────
  // Hoisted so market-state can reuse the same candles instead of double-fetching.
  // 26h lookback: captures yesterday's 4 PM close from any time today
  // (market closes 4 PM ET; at 9:30 AM next day = 17.5h ago — within 26h window).
  let candlesBySym: Record<string, EtCandle[]> = {}
  const prevCloses: Record<string, number> = {}
  const prevHighs:  Record<string, number> = {}
  const prevLows:   Record<string, number> = {}

  // Fire earnings proximity check alongside candle fetch — no serial latency added
  const earningsProximityPromise = plan.fetch.includes('candles') && targetSymbols.length
    ? buildEarningsProximityAlert(targetSymbols, todayStr)
    : Promise.resolve('')

  // Fire backtest in parallel for setup_analysis — 4s cap so it never blocks response
  const backtestPromise = plan.compile.includes('setup_analysis') && plan.symbols[0]
    ? runBacktests(plan.symbols[0])
    : Promise.resolve([])

  if (plan.fetch.includes('candles') && targetSymbols.length) {
    const lookbackMins = plan.isHistorical ? 32 * 60 : 26 * 60

    // Historical volumes run in parallel with candle fetch — both hit Supabase
    const [rows, historicalAvgVolumes] = await Promise.all([
      getRecentCandlesMulti(targetSymbols, lookbackMins),
      getHistoricalDailyVolumes(targetSymbols),
    ])

    const hasData = targetSymbols.some(t => (rows[t]?.length ?? 0) > 0)

    if (hasData) {
      badges.push({ label: 'candle data', source: 'live' })
      for (const sym of targetSymbols) {
        const converted    = (rows[sym] ?? []).map(candleRowToEt)
        const todayCandles = converted.filter(c => c.datetime.startsWith(plan.timeRange.startDate))
        const prevCandles  = converted.filter(c => !c.datetime.startsWith(plan.timeRange.startDate))

        // Never fall back to wrong-day candles — leave empty and log
        if (todayCandles.length) {
          candlesBySym[sym] = todayCandles
        } else {
          console.warn(`[compiler] ${sym}: no candles for ${plan.timeRange.startDate}`)
          candlesBySym[sym] = []
        }

        // Previous session OHLC — close enables gap detection, H/L are key reference levels
        if (prevCandles.length) {
          prevCloses[sym] = parseFloat(prevCandles[prevCandles.length - 1].close)
          prevHighs[sym]  = Math.max(...prevCandles.map(c => parseFloat(c.high)))
          prevLows[sym]   = Math.min(...prevCandles.map(c => parseFloat(c.low)))
        }
      }
    } else {
      badges.push({ label: 'candle data', source: 'api' })
      const { data } = await fetchIntraday(targetSymbols, {
        interval: '5min',
        outputsize: plan.isHistorical ? 500 : 100,
        startDate: plan.timeRange.startDate,
        endDate:   plan.timeRange.endDate,
      })
      for (const sym of targetSymbols) {
        candlesBySym[sym] = (data[sym] ?? []) as unknown as EtCandle[]
      }
    }

    // Pre-compute signals for ALL target symbols (not just first or briefing)
    const spyRaw = (candlesBySym['SPY'] ?? []) as unknown as Parameters<typeof computeSignals>[2]
    const signalsBySym: Record<string, SymbolSignals | null> = {}
    for (const sym of targetSymbols) {
      signalsBySym[sym] = computeSignals(sym, candlesBySym[sym] as any ?? [], spyRaw, {
        historicalAvgDailyVolume: hasData ? historicalAvgVolumes[sym] : undefined,
        prevDayHigh:  prevHighs[sym],
        prevDayLow:   prevLows[sym],
        prevDayClose: prevCloses[sym],
      })
    }

    // Market regime — computed from SPY candles when available
    const spyCandlesRaw = candlesBySym['SPY']
    if (spyCandlesRaw?.length) {
      const spySimple = spyCandlesRaw.map(c => ({
        open: parseFloat(c.open), high: parseFloat(c.high),
        low:  parseFloat(c.low),  close: parseFloat(c.close),
        volume: parseInt(c.volume, 10),
      }))
      const regime = computeMarketRegime(spySimple)
      if (regime.formatted) blocks.push(regime.formatted)
    }

    // Watchlist breadth block — leads context for multi-symbol / briefing queries
    const isMultiSymbol = targetSymbols.length >= 3 || plan.topic === 'briefing'
    if (isMultiSymbol) {
      const breadth = buildWatchlistBreadthBlock(candlesBySym, signalsBySym, prevCloses, plan.timeRange.startDate)
      if (breadth) blocks.push(breadth)
    }

    // Per-symbol candle details (session summary, biggest move, gaps, etc.)
    const candleLines: string[] = []
    for (const sym of targetSymbols) {
      if (!candlesBySym[sym]?.length) continue
      const compiled = compileSymbol(sym, candlesBySym[sym], plan.compile, plan, prevCloses[sym], prevHighs[sym], prevLows[sym])
      candleLines.push(...compiled)
    }

    // News–price correlation
    if (plan.compile.includes('news_price_correlation') && passedNews?.length) {
      const correlation = correlateNewsToPriceMove(candlesBySym, passedNews)
      if (correlation) candleLines.push(correlation)
    }

    // Signals block — all symbols
    const allSignals = targetSymbols
      .map(sym => signalsBySym[sym])
      .filter((s): s is SymbolSignals => s !== null)
    if (allSignals.length) candleLines.push(formatSignals(allSignals))

    if (candleLines.length) {
      blocks.push(`MARKET DATA (session: ${plan.timeRange.startDate})\n${candleLines.join('\n')}`)
    }
  }

  // Earnings proximity alert — fires whenever any target symbol reports within 7 days
  const earningsAlert = await earningsProximityPromise
  if (earningsAlert) blocks.push(earningsAlert)

  // Backtest stats — injected alongside setup levels when setup_analysis runs
  const backtestResults = await backtestPromise
  if (backtestResults.length) {
    const backtestBlock = formatBacktests(plan.symbols[0], backtestResults)
    if (backtestBlock) blocks.push(backtestBlock)
  }

  // ── LIVE PRICES ────────────────────────────────────────────────────────────
  if (plan.fetch.includes('live_prices')) {
    const priceSyms = plan.symbols.length ? plan.symbols : targetSymbols.slice(0, 6)
    try {
      const prices = await fetchLivePrices(priceSyms)
      if (prices.length) {
        badges.push({ label: 'prices', source: 'api' })
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
      badges.push({ label: 'news', source: 'api' })
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
        // Pass already-fetched candles to avoid a duplicate Twelve Data API call
        intradayData: Object.keys(candlesBySym).length > 0 ? candlesBySym as any : undefined,
      }) : Promise.resolve(null),
    ])

    if (economicEvents?.length)  { badges.push({ label: 'calendar', source: 'api' }); blocks.push(formatEconomicCalendar(economicEvents, todayStr)) }
    if (macroData)               { badges.push({ label: 'macro', source: 'api' });    blocks.push(formatMacroData(macroData)) }
    if (marketState?.summary)    blocks.push(`MARKET SNAPSHOT (${marketState.snapshotTime}): ${marketState.summary}`)
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
      if (events?.length) { badges.push({ label: 'earnings', source: 'api' }); blocks.push(formatEarningsCalendar(events)) }
    } catch { /* non-fatal */ }
  }

  // ── SECTOR ─────────────────────────────────────────────────────────────────
  if (plan.fetch.includes('sector')) {
    try {
      const sectorData = await fetchSectorPerformance()
      if (sectorData?.length) { badges.push({ label: 'sectors', source: 'api' }); blocks.push(formatSectorPerformance(sectorData)) }
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
        if (k === 'insider') { badges.push({ label: 'insider', source: 'api' }); blocks.push(formatInsiderTransactions(results[i], focusSym)) }
        if (k === 'analyst') { badges.push({ label: 'analyst', source: 'api' }); blocks.push(formatAnalystRatings(results[i], focusSym)) }
        if (k === 'options') { badges.push({ label: 'options', source: 'api' }); blocks.push(formatOptionsFlow(results[i], focusSym)) }
      })
    }
  }

  // ── HISTORICAL CONTEXT ─────────────────────────────────────────────────────
  if (plan.fetch.includes('historical_context')) {
    try {
      const hist = await buildHistoricalContext(message, watchlistTickers, focusSym, userPlan ?? null)
      if (hist) { badges.push({ label: 'history', source: 'api' }); blocks.push(hist) }
    } catch { /* non-fatal */ }
  }

  // ── TRADER LENS ────────────────────────────────────────────────────────────
  const traderLens = traderType === 'day'
    ? 'USER IS A DAY TRADER: Prioritize intraday momentum, VWAP, HOD/LOD, volume pace, session phase context.'
    : traderType === 'longterm'
    ? 'USER IS A LONG-TERM INVESTOR: Prioritize fundamentals, macro regime, earnings, thesis durability.'
    : 'USER IS A SWING TRADER: Prioritize 3-day to 3-month setups, catalysts, sector rotation, key technical levels.'

  const context = [traderLens, ...blocks].filter(Boolean).join('\n\n')
  const confidence: CompilerResult['confidence'] = badges.some(b => b.source === 'live') ? 'high' : 'low'

  return { context, badges, confidence }
}

// ── OUTPUT FORMAT INSTRUCTIONS ────────────────────────────────────────────────

export function buildOutputInstructions(plan: QueryPlan): string {
  switch (plan.outputFormat) {
    case 'one_liner':
      if (plan.topic === 'casual') {
        return 'RESPONSE: One warm, natural sentence. Acknowledge the greeting and invite their question. Reflect the market context if relevant (e.g. market is open, busy session, etc.). Stop.'
      }
      return 'RESPONSE: One sentence only. Answer the exact question. Stop.'
    case 'candle_list':
      return 'RESPONSE: List the candles exactly as shown in MARKET DATA. No prose intro. No filler. Stop after the last candle.'
    case 'summary':
      return 'RESPONSE: 2–3 sentences. Lead with the key number or move. One supporting fact. Stop.'
    case 'briefing':
      return `RESPONSE: Lead with the WATCHLIST BREADTH block summary (breadth, leaders/laggards). Then the single most important market theme or catalyst. Then one forward-looking note (key risk, upcoming event, or setup). Max 4 sentences total. Stop.`
    case 'warroom':
      return `RESPONSE: Lead with EPS vs estimate and revenue vs estimate in one sentence. Then forward guidance vs consensus — identify which number matters most. Then the initial price reaction and whether it makes sense. Then one trade implication (gap-and-go, earnings fade, or "wait for structure"). Max 5 sentences. No filler.`
    case 'setup':
      return `RESPONSE: Provide a structured technical setup analysis using the SETUP LEVELS block. Write in flowing prose — no markdown, no bullets, no headers. Cover all four elements in order:
1. Setup: Identify the setup type (e.g. VWAP reclaim, ORB breakout, HOD breakout, gap-and-go, bull flag, prior day high test) and direction (long/short). One sentence.
2. Entry zone: Specific price range where the setup triggers with reasoning (e.g. "entry on a VWAP reclaim above $X, ideally a dip to the $X–Y zone"). If there are multiple valid entries (aggressive vs. confirmation), state both.
3. Risk level: The exact price where the setup is invalidated — the natural structural stop. State it precisely ("structure breaks below LOD at $X" or "invalidated below VWAP at $X").
4. Target: Measured move or next key resistance/support with the risk/reward ratio stated explicitly (e.g. "measured move to prior day high at $X — roughly 2.5:1 at current entry").
5. Context (1–2 sentences): Volume confirmation, session phase, what would confirm or invalidate the setup intraday.
End every setup response with exactly: "Technical analysis only — not financial advice." Do not stop before all five elements are covered.`
    case 'prose':
    default:
      if (plan.detailLevel === 'detailed') {
        return 'RESPONSE: Provide a complete, detailed narrative covering the full requested timeframe chronologically. Cover all key price moves, volume spikes, gap behavior, and session phases through the end of the period. Do not stop early. Do not summarize — narrate.'
      }
      return plan.detailLevel === 'brief'
        ? 'RESPONSE: 1–2 sentences. Answer the question. Stop.'
        : 'RESPONSE: 2–3 sentences. Answer first, one supporting fact only. Stop.'
  }
}
