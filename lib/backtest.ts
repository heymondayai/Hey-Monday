// Pattern backtesting from existing candles_1m data (up to 95 days).
// Detects VWAP reclaim, ORB breakout, and HOD breakout occurrences
// across historical sessions and computes win rate + avg move.
// Called in parallel during setup_analysis — capped at 4s to avoid latency.

import { createAdminSupabaseClient } from './supabase-admin'

export interface BacktestResult {
  pattern:     string
  occurrences: number
  winRate:     number    // fraction 0–1
  avgWinPct:   number
  avgLossPct:  number
  expectancy:  number    // winRate*avgWin + lossRate*avgLoss
  sampleDays:  number
  formatted:   string
}

// ── DATA FETCHING ─────────────────────────────────────────────────────────────

interface SessionCandle {
  open: number; high: number; low: number; close: number
  volume: number; minsFromOpen: number
}
interface SessionDay { date: string; candles: SessionCandle[] }

async function fetchSessionDays(ticker: string, days = 90): Promise<SessionDay[]> {
  const supabase = createAdminSupabaseClient()
  const since    = new Date(Date.now() - (days + 5) * 86_400_000).toISOString()
  const todayEt  = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const { data, error } = await supabase
    .from('candles_1m')
    .select('ts,open,high,low,close,volume')
    .eq('ticker', ticker)
    .gte('ts', since)
    .order('ts', { ascending: true })

  if (error || !data?.length) return []

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })

  const byDate: Record<string, SessionCandle[]> = {}
  for (const row of data as any[]) {
    const d     = new Date(row.ts)
    const dateEt = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    if (dateEt === todayEt) continue  // skip today — incomplete

    const parts = fmt.formatToParts(d)
    const h = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0', 10)
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)
    const mins = h * 60 + m

    // Only regular session: 9:30 AM–4:00 PM ET (570–959 mins from midnight)
    if (mins < 570 || mins >= 960) continue

    if (!byDate[dateEt]) byDate[dateEt] = []
    byDate[dateEt].push({
      open: row.open, high: row.high, low: row.low, close: row.close,
      volume: row.volume, minsFromOpen: mins - 570,
    })
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, candles]) => ({ date, candles }))
    .slice(-days)  // cap to requested window
}

// ── PATTERN DETECTORS ─────────────────────────────────────────────────────────

// Running VWAP at each candle index
function computeRunningVwap(candles: SessionCandle[]): number[] {
  let cumPV = 0, cumVol = 0
  return candles.map(c => {
    const tp = (c.high + c.low + c.close) / 3
    cumPV += tp * c.volume; cumVol += c.volume
    return cumVol > 0 ? cumPV / cumVol : c.close
  })
}

type PatternResult = { wins: number; losses: number; winPcts: number[]; lossPcts: number[] }

// VWAP Reclaim: price below VWAP for ≥5 consecutive candles, then crosses back above.
// Win = +0.20% continuation within 30 minutes.
function detectVwapReclaims(day: SessionDay): PatternResult {
  const { candles } = day
  if (candles.length < 30) return { wins: 0, losses: 0, winPcts: [], lossPcts: [] }
  const vwapAt = computeRunningVwap(candles)
  let wins = 0, losses = 0
  const winPcts: number[] = [], lossPcts: number[] = []
  let belowStreak = 0

  for (let i = 5; i < candles.length - 30; i++) {
    const prevBelow = candles[i - 1].close < vwapAt[i - 1]
    const currAbove = candles[i].close     > vwapAt[i]

    if (prevBelow && currAbove && belowStreak >= 5) {
      const entry = candles[i].close
      const exit  = candles[Math.min(i + 30, candles.length - 1)].close
      const pct   = (exit - entry) / entry * 100
      if (pct > 0.20) { wins++; winPcts.push(pct) }
      else            { losses++; lossPcts.push(pct) }
    }

    belowStreak = candles[i].close < vwapAt[i] ? belowStreak + 1 : 0
  }
  return { wins, losses, winPcts, lossPcts }
}

// ORB Breakout: price breaks above the first-30-min high after the opening range.
// Win = +0.4% continuation within 60 minutes of the break.
function detectOrbBreakouts(day: SessionDay): PatternResult {
  const { candles } = day
  const orb = candles.filter(c => c.minsFromOpen < 30)
  if (orb.length < 5) return { wins: 0, losses: 0, winPcts: [], lossPcts: [] }

  const orbHigh = Math.max(...orb.map(c => c.high))
  let wins = 0, losses = 0
  const winPcts: number[] = [], lossPcts: number[] = []
  let broken = false

  for (let i = 0; i < candles.length - 60; i++) {
    if (candles[i].minsFromOpen < 30 || broken) continue
    if (candles[i].close > orbHigh * 1.0010) {
      broken = true
      const entry = candles[i].close
      const exit  = candles[Math.min(i + 60, candles.length - 1)].close
      const pct   = (exit - entry) / entry * 100
      if (pct > 0.40) { wins++; winPcts.push(pct) }
      else            { losses++; lossPcts.push(pct) }
    }
  }
  return { wins, losses, winPcts, lossPcts }
}

// HOD Breakout: price sets a new intraday HOD after 10 AM.
// Win = HOD holds for 15+ minutes (price doesn't retrace >0.25% from HOD close).
function detectHodBreakouts(day: SessionDay): PatternResult {
  const { candles } = day
  if (candles.length < 30) return { wins: 0, losses: 0, winPcts: [], lossPcts: [] }

  let wins = 0, losses = 0
  const winPcts: number[] = [], lossPcts: number[] = []
  let runningHod = candles.slice(0, 10).reduce((m, c) => Math.max(m, c.high), 0)

  for (let i = 10; i < candles.length - 15; i++) {
    if (candles[i].high > runningHod * 1.0010) {
      runningHod = candles[i].high
      if (candles[i].minsFromOpen < 60) continue  // too early — opening drive, not a setup
      const entry = candles[i].high
      const futureCandles = candles.slice(i + 1, i + 16)
      const worstDraw = Math.min(...futureCandles.map(c => c.low))
      const pct = (worstDraw - entry) / entry * 100
      if (pct > -0.25) { wins++; winPcts.push(Math.abs(pct) * -1 + 0.5) }
      else             { losses++; lossPcts.push(pct) }
    }
  }
  return { wins, losses, winPcts, lossPcts }
}

// ── AGGREGATION ───────────────────────────────────────────────────────────────

function aggregate(
  pattern: string,
  results: PatternResult[],
  sampleDays: number,
): BacktestResult {
  let wins = 0, losses = 0
  const allWins: number[] = [], allLosses: number[] = []
  for (const r of results) {
    wins += r.wins; losses += r.losses
    allWins.push(...r.winPcts); allLosses.push(...r.lossPcts)
  }
  const total      = wins + losses
  const winRate    = total > 0 ? wins / total : 0
  const avgWinPct  = allWins.length   ? allWins.reduce((a, b) => a + b, 0) / allWins.length   : 0
  const avgLossPct = allLosses.length ? allLosses.reduce((a, b) => a + b, 0) / allLosses.length : 0
  const expectancy = winRate * avgWinPct + (1 - winRate) * avgLossPct

  const formatted = total === 0
    ? `${pattern}: no clean occurrences detected in ${sampleDays} sessions`
    : `${pattern} (${sampleDays}d): ${total} setups | ${Math.round(winRate * 100)}% W/R | avg win +${avgWinPct.toFixed(2)}% | avg loss ${avgLossPct.toFixed(2)}% | expectancy ${expectancy >= 0 ? '+' : ''}${expectancy.toFixed(2)}% per trade`

  return { pattern, occurrences: total, winRate, avgWinPct, avgLossPct, expectancy, sampleDays, formatted }
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

// Run all three pattern backtests for a ticker. Capped at 4 seconds.
// Returns empty array on timeout or error so setup_analysis always responds.
export async function runBacktests(ticker: string): Promise<BacktestResult[]> {
  const timeout = new Promise<BacktestResult[]>(resolve =>
    setTimeout(() => resolve([]), 4000)
  )
  const work = async (): Promise<BacktestResult[]> => {
    try {
      const days = await fetchSessionDays(ticker)
      if (days.length < 5) return []

      const vwap = days.map(detectVwapReclaims)
      const orb  = days.map(detectOrbBreakouts)
      const hod  = days.map(detectHodBreakouts)

      return [
        aggregate('VWAP reclaim', vwap, days.length),
        aggregate('ORB breakout', orb,  days.length),
        aggregate('HOD breakout', hod,  days.length),
      ].filter(r => r.occurrences > 0)
    } catch {
      return []
    }
  }
  return Promise.race([work(), timeout])
}

// Formats backtest results for injection into the compiler context block.
export function formatBacktests(ticker: string, results: BacktestResult[]): string {
  if (!results.length) return ''
  const lines = [`HISTORICAL PATTERN STATS — ${ticker}:`]
  for (const r of results) lines.push(`  ${r.formatted}`)
  return lines.join('\n')
}
