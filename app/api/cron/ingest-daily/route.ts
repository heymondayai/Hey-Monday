import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { fetchMacroSeries } from '@/lib/providers/macro'
import { fetchEconomicEvents, fetchEarningsEvents } from '@/lib/providers/events'
import { upsertMacroIndicators, deleteOldMacro } from '@/lib/store-macro'
import { upsertEconomicEvents, upsertEarningsEvents, deleteOldEvents } from '@/lib/store-events'
import { MARKET_MOVERS } from '@/lib/market-data'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()
  const { data: rows } = await supabase.from('watchlist').select('ticker')
  const watchlistTickers = [...new Set((rows ?? []).map((r: { ticker: string }) => r.ticker))]
  const allSymbols = [...new Set([...watchlistTickers, ...Array.from(MARKET_MOVERS)])]

  // Fetch 90 days forward for events (want upcoming earnings/economic data)
  const from = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const to   = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const [macro, economicEvents, earningsEvents] = await Promise.all([
    fetchMacroSeries(),
    fetchEconomicEvents(from, to),
    fetchEarningsEvents(allSymbols, from, to),
  ])

  await Promise.all([
    upsertMacroIndicators(macro),
    upsertEconomicEvents(economicEvents),
    upsertEarningsEvents(earningsEvents),
    deleteOldMacro(95),
    deleteOldEvents(95),
  ])

  return NextResponse.json({
    ok:       true,
    macro:    macro.length,
    economic: economicEvents.length,
    earnings: earningsEvents.length,
  })
}
