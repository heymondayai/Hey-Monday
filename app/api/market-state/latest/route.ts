import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('market_state_snapshots')
      .select(`
        id,
        snapshot_time,
        market_status,
        top_movers,
        sector_leaders,
        sector_laggards,
        macro_context,
        calendar_events,
        earnings_events,
        key_news,
        watchlist_summary,
        summary,
        raw_payload
      `)
      .order('snapshot_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[market-state latest] Supabase read error:', error.message)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json({
        ok: true,
        snapshot: null,
      })
    }

    return NextResponse.json({
      ok: true,
      snapshot: {
        id: data.id,
        snapshotTime: data.snapshot_time,
        marketStatus: data.market_status,
        topMovers: data.top_movers,
        sectorLeaders: data.sector_leaders,
        sectorLaggards: data.sector_laggards,
        macroContext: data.macro_context,
        calendarEvents: data.calendar_events,
        earningsEvents: data.earnings_events,
        keyNews: data.key_news,
        watchlistSummary: data.watchlist_summary,
        summary: data.summary,
        rawPayload: data.raw_payload,
      },
    })
  } catch (err: any) {
    console.error('[market-state latest] Error:', err.message)
    return NextResponse.json(
      { ok: false, error: err.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}