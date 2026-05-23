import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { fetchCandles as fetchIntraday } from '@/lib/providers/candles'
import { upsertCandles, CandleRow } from '@/lib/candle-store'
import { getNyseEquitiesStatus } from '@/lib/market-hours'

export const dynamic = 'force-dynamic'

// Convert a Twelve Data datetime string ("YYYY-MM-DD HH:mm:ss" in US/Eastern)
// to a UTC ISO string. Tries EDT (-04:00) first and verifies the round-trip;
// falls back to EST (-05:00) for the Nov–Mar window.
function etDatetimeToISO(dt: string): string {
  const isoStr = dt.replace(' ', 'T')
  const withEDT = new Date(`${isoStr}-04:00`)
  const targetH = parseInt(isoStr.split('T')[1].split(':')[0], 10)
  const checkH  = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(withEDT),
    10,
  )
  return checkH === targetH
    ? withEDT.toISOString()
    : new Date(`${isoStr}-05:00`).toISOString()
}

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret when configured
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Skip outside trading hours (pre-market opens 4 AM ET)
  const { session } = getNyseEquitiesStatus()
  if (session === 'closed') {
    return NextResponse.json({ skipped: true, reason: 'market closed' })
  }

  // Collect all unique tickers across every user's watchlist
  const supabase = createAdminSupabaseClient()
  const { data: rows, error } = await supabase.from('watchlist').select('ticker')
  if (error) {
    console.error('[ingest-candles] watchlist fetch:', error.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
  if (!rows?.length) {
    return NextResponse.json({ ok: true, ingested: 0 })
  }

  const tickers = [...new Set(rows.map((r: { ticker: string }) => r.ticker))]

  // Fetch the last 5 bars per ticker so we catch up on any missed ticks
  // without blowing through API rate limits on every call.
  const { data: candleData } = await fetchIntraday(tickers, {
    interval: '1min',
    outputsize: 5,
  })

  const candles: CandleRow[] = []
  for (const [ticker, bars] of Object.entries(candleData)) {
    for (const bar of bars) {
      candles.push({
        ticker,
        ts:     etDatetimeToISO(bar.datetime),
        open:   parseFloat(bar.open),
        high:   parseFloat(bar.high),
        low:    parseFloat(bar.low),
        close:  parseFloat(bar.close),
        volume: parseInt(bar.volume, 10),
        vwap:   null,
      })
    }
  }

  await upsertCandles(candles)

  return NextResponse.json({
    ok:      true,
    ingested: candles.length,
    tickers: tickers.length,
    session,
  })
}
