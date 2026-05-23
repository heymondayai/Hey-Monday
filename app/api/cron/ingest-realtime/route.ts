import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getNyseEquitiesStatus } from '@/lib/market-hours'
import { fetchCompanyNews, fetchMarketNews } from '@/lib/providers/news'
import { fetchMacroSeries } from '@/lib/providers/macro'
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
import { upsertNews, deleteOldNews } from '@/lib/store-news'
import { upsertMacroIndicators, deleteOldMacro } from '@/lib/store-macro'
import {
  upsertInsiderTransactions,
  upsertAnalystRatings,
  upsertOptionsFlow,
  upsertSectorSnapshots,
  upsertSecFilings,
  upsertCongressionalTrades,
  upsertShortInterest,
  upsertInstitutionalHoldings,
  upsertDarkPoolPrints,
} from '@/lib/store-alternative'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function etNow() {
  const now = new Date()
  const etHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(now),
    10,
  )
  const etMin = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', minute: 'numeric' }).format(now),
    10,
  )
  return { etHour, etMin }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()
  const { data: rows } = await supabase.from('watchlist').select('ticker')
  const tickers = [...new Set((rows ?? []).map((r: { ticker: string }) => r.ticker))]

  const { session } = getNyseEquitiesStatus()
  const { etHour, etMin } = etNow()
  const marketOpen = session !== 'closed'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const ran: string[] = []

  // Every minute (market hours): news + dark pool
  if (marketOpen) {
    const [companyArticles, marketArticles, darkPool] = await Promise.all([
      fetchCompanyNews(tickers),
      fetchMarketNews(),
      fetchDarkPoolPrints(tickers),
    ])
    await Promise.all([
      upsertNews([...companyArticles, ...marketArticles]),
      upsertDarkPoolPrints(darkPool),
    ])
    ran.push('news', 'darkPool')

    // Cleanup news once per day at 6 PM ET
    if (etHour === 18 && etMin < 2) {
      await deleteOldNews(95)
      ran.push('cleanupNews')
    }
  }

  // Every 5 min (market hours): options flow + sector performance
  if (marketOpen && etMin % 5 === 0) {
    const [optionsFlow, sectorPerf] = await Promise.all([
      fetchOptionsFlowForTickers(tickers),
      fetchSectorPerf(),
    ])
    await Promise.all([
      upsertOptionsFlow(optionsFlow, today),
      upsertSectorSnapshots(sectorPerf, today),
    ])
    ran.push('options', 'sector')
  }

  // Every 15 min (market hours): insider trades
  if (marketOpen && etMin % 15 === 0) {
    const insider = await fetchInsiderTrades(tickers)
    await upsertInsiderTransactions(insider)
    ran.push('insider')
  }

  // Every 30 min: analyst ratings + SEC filings
  if (etMin % 30 === 0) {
    const [analyst, filings] = await Promise.all([
      fetchAnalystRatingsForTickers(tickers),
      fetchSecFilingsForTickers(tickers),
    ])
    await Promise.all([
      upsertAnalystRatings(analyst),
      upsertSecFilings(filings),
    ])
    ran.push('analyst', 'filings')
  }

  // Once per day at 9 AM ET: macro (FRED), congressional, short interest, institutional
  if (etHour === 9 && etMin === 0) {
    const [macro, congressional, shortInt, institutional] = await Promise.all([
      fetchMacroSeries(),
      fetchCongressionalTrades(),
      fetchShortInterest(tickers),
      fetchInstitutionalHoldings(tickers),
    ])
    await Promise.all([
      upsertMacroIndicators(macro),
      upsertCongressionalTrades(congressional),
      upsertShortInterest(shortInt),
      upsertInstitutionalHoldings(institutional),
      deleteOldMacro(95),
    ])
    ran.push('macro', 'congressional', 'shortInterest', 'institutional')
  }

  return NextResponse.json({ ok: true, session, ran, tickers: tickers.length })
}
