import { createAdminSupabaseClient } from './supabase-admin'

export interface CandleRow {
  ticker: string
  ts:     string   // UTC ISO — stored as timestamptz
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
  vwap:   number | null
}

// Upsert a batch of candles. Conflict on (ticker, ts) is a no-op so re-ingestion
// of the same bars is safe.
export async function upsertCandles(candles: CandleRow[]): Promise<void> {
  if (!candles.length) return
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('candles_1m')
    .upsert(candles, { onConflict: 'ticker,ts' })
  if (error) console.error('[candle-store] upsert:', error.message)
}

// Fetch the last `minutes` worth of candles for multiple tickers in one query, oldest-first.
export async function getRecentCandlesMulti(
  tickers: string[],
  minutes = 480,
): Promise<Record<string, CandleRow[]>> {
  if (!tickers.length) return {}
  const supabase = createAdminSupabaseClient()
  const since = new Date(Date.now() - minutes * 60_000).toISOString()
  const { data, error } = await supabase
    .from('candles_1m')
    .select('ticker,ts,open,high,low,close,volume,vwap')
    .in('ticker', tickers)
    .gte('ts', since)
    .order('ts', { ascending: true })
  if (error) console.error('[candle-store] getRecentCandlesMulti:', error.message)
  const result: Record<string, CandleRow[]> = {}
  for (const t of tickers) result[t] = []
  for (const row of (data ?? []) as CandleRow[]) {
    if (result[row.ticker]) result[row.ticker].push(row)
  }
  return result
}

// Fetch the last `minutes` worth of candles for a single ticker, oldest-first.
export async function getRecentCandles(ticker: string, minutes = 30): Promise<CandleRow[]> {
  const supabase = createAdminSupabaseClient()
  const since = new Date(Date.now() - minutes * 60_000).toISOString()
  const { data, error } = await supabase
    .from('candles_1m')
    .select('ticker,ts,open,high,low,close,volume,vwap')
    .eq('ticker', ticker)
    .gte('ts', since)
    .order('ts', { ascending: true })
  if (error) console.error('[candle-store] getRecentCandles:', error.message)
  return (data ?? []) as CandleRow[]
}

// Running VWAP: Σ(typical_price × volume) / Σ(volume)
// Typical price = (high + low + close) / 3
export function computeVWAP(candles: CandleRow[]): number | null {
  let cumPV = 0
  let cumVol = 0
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3
    cumPV += tp * c.volume
    cumVol += c.volume
  }
  return cumVol > 0 ? cumPV / cumVol : null
}

// Returns average daily total volume per ticker from the last `tradingDays` sessions.
// Queries existing candles_1m data — no external API call.
// Used for historical relative volume ("today running at 1.8x 20-day avg").
export async function getHistoricalDailyVolumes(
  tickers: string[],
  tradingDays = 20,
): Promise<Record<string, number>> {
  if (!tickers.length) return {}
  const supabase = createAdminSupabaseClient()
  // 32 calendar days reliably contains 20 trading days
  const since = new Date(Date.now() - 32 * 86_400_000).toISOString()
  const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const { data, error } = await supabase
    .from('candles_1m')
    .select('ticker,ts,volume')
    .in('ticker', tickers)
    .gte('ts', since)
    .order('ts', { ascending: true })

  if (error) { console.error('[candle-store] historical volumes:', error.message); return {} }

  // Accumulate daily totals: byTickerDate[ticker][date] = total volume for that day
  const byTickerDate: Record<string, Record<string, number>> = {}
  for (const t of tickers) byTickerDate[t] = {}

  for (const row of (data ?? []) as CandleRow[]) {
    const dateEt = new Date(row.ts).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    if (dateEt === todayEt) continue  // skip today — session not yet complete
    if (!byTickerDate[row.ticker]) continue
    byTickerDate[row.ticker][dateEt] = (byTickerDate[row.ticker][dateEt] ?? 0) + row.volume
  }

  const result: Record<string, number> = {}
  for (const ticker of tickers) {
    const dayVols = Object.values(byTickerDate[ticker] ?? {}).slice(-tradingDays)
    if (!dayVols.length) continue
    result[ticker] = dayVols.reduce((a, b) => a + b, 0) / dayVols.length
  }

  return result
}

// Delete candles older than `daysToKeep`. Called once per day by the cron.
export async function deleteOldCandles(daysToKeep = 95): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - daysToKeep * 86_400_000).toISOString()
  const { error } = await supabase
    .from('candles_1m')
    .delete()
    .lt('ts', cutoff)
  if (error) console.error('[candle-store] cleanup:', error.message)
}
