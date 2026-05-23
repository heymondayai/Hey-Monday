import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import {
  fetchInsiderTrades,
  fetchAnalystRatingsForTickers,
  fetchOptionsFlowForTickers,
  fetchSecFilingsForTickers,
  fetchSectorPerf,
  fetchCongressionalTrades,
  fetchShortInterest,
  fetchInstitutionalHoldings,
  fetchDarkPoolPrints,
} from '@/lib/providers/alternative'
import {
  upsertInsiderTransactions,
  upsertAnalystRatings,
  upsertOptionsFlow,
  upsertSectorSnapshots,
  upsertSecFilings,
  derivePriceSnapshots,
  upsertCongressionalTrades,
  upsertShortInterest,
  upsertInstitutionalHoldings,
  upsertDarkPoolPrints,
  cleanupAlternativeData,
} from '@/lib/store-alternative'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()
  const { data: rows } = await supabase.from('watchlist').select('ticker')
  const tickers = [...new Set((rows ?? []).map((r: { ticker: string }) => r.ticker))]
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const [
    insiderTrades,
    analystRatings,
    optionsFlow,
    secFilings,
    sectorPerf,
    congressTrades,
    shortInt,
    institutionalH,
    darkPool,
  ] = await Promise.all([
    fetchInsiderTrades(tickers),
    fetchAnalystRatingsForTickers(tickers),
    fetchOptionsFlowForTickers(tickers),
    fetchSecFilingsForTickers(tickers),
    fetchSectorPerf(),
    fetchCongressionalTrades(),
    fetchShortInterest(tickers),
    fetchInstitutionalHoldings(tickers),
    fetchDarkPoolPrints(tickers),
  ])

  await Promise.all([
    upsertInsiderTransactions(insiderTrades),
    upsertAnalystRatings(analystRatings),
    upsertOptionsFlow(optionsFlow, today),
    upsertSectorSnapshots(sectorPerf, today),
    upsertSecFilings(secFilings),
    derivePriceSnapshots(tickers),
    upsertCongressionalTrades(congressTrades),
    upsertShortInterest(shortInt),
    upsertInstitutionalHoldings(institutionalH),
    upsertDarkPoolPrints(darkPool),
    cleanupAlternativeData(95),
  ])

  return NextResponse.json({
    ok:          true,
    insider:     insiderTrades.length,
    analyst:     analystRatings.length,
    options:     optionsFlow.length,
    sector:      sectorPerf.length,
    filings:     secFilings.length,
    tickers:     tickers.length,
  })
}
