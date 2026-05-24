import { createAdminSupabaseClient } from './supabase-admin'
import { getRecentCandles, computeVWAP, CandleRow } from './candle-store'

// ── TYPES ─────────────────────────────────────────────────────────────────────

export type AlertRuleType =
  | 'price_above'       // price crosses above threshold
  | 'price_below'       // price crosses below threshold
  | 'vwap_cross_above'  // price crosses from below to above session VWAP
  | 'vwap_cross_below'  // price crosses from above to below session VWAP
  | 'volume_spike'      // volume ≥ threshold × 20-bar average
  | 'pct_move_up'       // % gain from session open ≥ threshold
  | 'pct_move_down'     // % loss from session open ≥ threshold (absolute)

export interface AlertRule {
  id: string
  user_id: string
  ticker: string
  rule_type: AlertRuleType
  threshold: number
  cooldown_minutes: number
  last_triggered_at: string | null
}

export interface AlertFiring {
  rule_id: string
  user_id: string
  ticker: string
  rule_type: string
  triggered_value: number
  threshold: number
  message: string
}

interface Signals {
  price: number           // latest candle close
  prevPrice: number       // previous candle close
  vwap: number | null     // session VWAP including latest candle
  prevVwap: number | null // session VWAP excluding latest candle (cross detection)
  volumeRatio: number     // latest volume ÷ 20-bar rolling avg volume
  pctFromOpen: number     // % change from first candle open in the fetched window
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function isInCooldown(rule: AlertRule): boolean {
  if (!rule.last_triggered_at) return false
  const elapsedMin = (Date.now() - new Date(rule.last_triggered_at).getTime()) / 60_000
  return elapsedMin < rule.cooldown_minutes
}

// Returns the timestamp of the most recent 9:30 AM ET session open.
function getSessionOpenTs(): string {
  const now = new Date()
  const etDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now)
  const openUtc = new Date(`${etDate}T09:30:00-04:00`)
  // If DST is off (ET = UTC-5) the -04:00 parse will be wrong by 1h, so verify
  // by checking the ET hour of the result and nudge if needed.
  const etHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(openUtc),
    10,
  )
  if (etHour !== 9) {
    // EST window: offset is -05:00 instead
    return new Date(`${etDate}T09:30:00-05:00`).toISOString()
  }
  return openUtc.toISOString()
}

function computeSignals(candles: CandleRow[]): Signals | null {
  if (candles.length < 2) return null

  const latest = candles[candles.length - 1]
  const prev   = candles[candles.length - 2]

  // Session candles = 9:30 AM ET onwards (VWAP and pctFromOpen use regular session only)
  const sessionOpenTs = getSessionOpenTs()
  const sessionCandles = candles.filter(c => c.ts >= sessionOpenTs)
  const vwapCandles    = sessionCandles.length >= 2 ? sessionCandles : candles

  const vwap     = computeVWAP(vwapCandles)
  const prevVwap = computeVWAP(vwapCandles.slice(0, -1))

  // Volume ratio vs trailing 20-bar average (excluding current bar)
  const window  = candles.slice(-21, -1)   // up to 20 previous bars
  const avgVol  = window.length > 0
    ? window.reduce((s, c) => s + c.volume, 0) / window.length
    : latest.volume
  const volumeRatio = avgVol > 0 ? latest.volume / avgVol : 1

  // % change from the 9:30 AM regular session open candle.
  // Falls back to first available candle if session hasn't opened yet (pre-market only).
  const openCandle  = sessionCandles.length > 0 ? sessionCandles[0] : candles[0]
  const sessionOpen = openCandle.open
  const pctFromOpen = sessionOpen > 0
    ? ((latest.close - sessionOpen) / sessionOpen) * 100
    : 0

  return { price: latest.close, prevPrice: prev.close, vwap, prevVwap, volumeRatio, pctFromOpen }
}

function buildMessage(rule: AlertRule, s: Signals): string {
  const p = s.price.toFixed(2)
  const t = rule.threshold
  switch (rule.rule_type) {
    case 'price_above':      return `${rule.ticker} crossed above $${t} — now $${p}`
    case 'price_below':      return `${rule.ticker} crossed below $${t} — now $${p}`
    case 'vwap_cross_above': return `${rule.ticker} crossed above VWAP at $${p}`
    case 'vwap_cross_below': return `${rule.ticker} crossed below VWAP at $${p}`
    case 'volume_spike':     return `${rule.ticker} volume spike: ${s.volumeRatio.toFixed(1)}× avg`
    case 'pct_move_up':      return `${rule.ticker} +${s.pctFromOpen.toFixed(2)}% from session open`
    case 'pct_move_down':    return `${rule.ticker} ${s.pctFromOpen.toFixed(2)}% from session open`
  }
}

// Returns the triggered value if the rule fires, null otherwise.
// Price/VWAP rules use crossover detection (prev→current) to avoid
// re-firing on every tick while a condition remains true.
function evaluate(rule: AlertRule, s: Signals): { triggeredValue: number } | null {
  switch (rule.rule_type) {
    case 'price_above':
      if (s.prevPrice <= rule.threshold && s.price > rule.threshold)
        return { triggeredValue: s.price }
      break
    case 'price_below':
      if (s.prevPrice >= rule.threshold && s.price < rule.threshold)
        return { triggeredValue: s.price }
      break
    case 'vwap_cross_above':
      if (s.vwap != null && s.prevVwap != null
          && s.prevPrice <= s.prevVwap && s.price > s.vwap)
        return { triggeredValue: s.price }
      break
    case 'vwap_cross_below':
      if (s.vwap != null && s.prevVwap != null
          && s.prevPrice >= s.prevVwap && s.price < s.vwap)
        return { triggeredValue: s.price }
      break
    case 'volume_spike':
      if (s.volumeRatio >= rule.threshold)
        return { triggeredValue: s.volumeRatio }
      break
    case 'pct_move_up':
      if (s.pctFromOpen >= rule.threshold)
        return { triggeredValue: s.pctFromOpen }
      break
    case 'pct_move_down':
      if (s.pctFromOpen <= -rule.threshold)
        return { triggeredValue: s.pctFromOpen }
      break
  }
  return null
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

// Evaluates all enabled alert rules against the latest candle data.
// Inserts firings, stamps cooldown timestamps, and returns fired alerts
// so the caller can broadcast them via Realtime.
export async function runAlertCheck(): Promise<AlertFiring[]> {
  const supabase = createAdminSupabaseClient()

  const { data: rules, error } = await supabase
    .from('alert_rules')
    .select('id,user_id,ticker,rule_type,threshold,cooldown_minutes,last_triggered_at')
    .eq('enabled', true)

  if (error) {
    console.error('[alert-engine] fetch rules:', error.message)
    return []
  }
  if (!rules?.length) return []

  const tickers = [...new Set((rules as AlertRule[]).map((r) => r.ticker))]

  // Fetch a full session window (~7 h covers 4 AM pre-market → 8 PM after-hours)
  const candleMap = Object.fromEntries(
    await Promise.all(
      tickers.map(async (ticker) => [ticker, await getRecentCandles(ticker, 420)])
    )
  ) as Record<string, CandleRow[]>

  const firings: AlertFiring[]                                          = []
  const toStamp: Array<{ id: string; last_triggered_at: string }>      = []

  for (const rule of rules as AlertRule[]) {
    if (isInCooldown(rule)) continue

    const candles = candleMap[rule.ticker]
    if (!candles?.length) continue

    const signals = computeSignals(candles)
    if (!signals) continue

    const hit = evaluate(rule, signals)
    if (!hit) continue

    firings.push({
      rule_id:         rule.id,
      user_id:         rule.user_id,
      ticker:          rule.ticker,
      rule_type:       rule.rule_type,
      triggered_value: hit.triggeredValue,
      threshold:       rule.threshold,
      message:         buildMessage(rule, signals),
    })
    toStamp.push({ id: rule.id, last_triggered_at: new Date().toISOString() })
  }

  if (!firings.length) return []

  // Persist firings
  const { error: insertErr } = await supabase.from('alert_firings').insert(firings)
  if (insertErr) console.error('[alert-engine] insert firings:', insertErr.message)

  // Stamp cooldown timestamps
  await Promise.all(
    toStamp.map(({ id, last_triggered_at }) =>
      supabase.from('alert_rules').update({ last_triggered_at }).eq('id', id)
    )
  )

  return firings
}
