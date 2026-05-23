import { NextRequest, NextResponse } from 'next/server'
import { getNyseEquitiesStatus } from '@/lib/market-hours'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { fetchCompanyNews, fetchMarketNews } from '@/lib/providers/news'
import { upsertNews, deleteOldNews } from '@/lib/store-news'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { session } = getNyseEquitiesStatus()
  if (session === 'closed') {
    return NextResponse.json({ skipped: true, reason: 'market closed' })
  }

  const supabase = createAdminSupabaseClient()
  const { data: rows } = await supabase.from('watchlist').select('ticker')
  const tickers = [...new Set((rows ?? []).map((r: { ticker: string }) => r.ticker))]

  const [companyArticles, marketArticles] = await Promise.all([
    fetchCompanyNews(tickers),
    fetchMarketNews(),
  ])
  const all = [...companyArticles, ...marketArticles]
  await upsertNews(all)

  // Cleanup once per day at 6 PM ET (first 5 minutes only)
  const now = new Date()
  const etHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(now),
    10
  )
  const etMin = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', minute: 'numeric' }).format(now),
    10
  )
  if (etHour === 18 && etMin < 5) await deleteOldNews(95)

  return NextResponse.json({ ok: true, ingested: all.length, tickers: tickers.length, session })
}
