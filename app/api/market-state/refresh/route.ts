import { NextResponse } from 'next/server'
import { buildMarketState } from '@/lib/market-state'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export async function GET() {
  try {
    const supabase = createAdminSupabaseClient()

    const snapshot = await buildMarketState()

    const { data, error } = await supabase
      .from('market_state_snapshots')
      .insert({
        snapshot_time: snapshot.snapshotTime,
        market_status: snapshot.marketStatus,
        top_movers: snapshot.topMovers,
        sector_leaders: snapshot.sectorLeaders,
        sector_laggards: snapshot.sectorLaggards,
        macro_context: snapshot.macroContext,
        calendar_events: snapshot.calendarEvents,
        earnings_events: snapshot.earningsEvents,
        key_news: snapshot.keyNews,
        watchlist_summary: snapshot.watchlistSummary,
        summary: snapshot.summary,
        raw_payload: snapshot.rawPayload,
      })
      .select()
      .single()

    if (error) {
      console.error('[market-state refresh] Supabase insert error:', error.message)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      snapshotId: data.id,
      snapshotTime: data.snapshot_time,
      marketStatus: data.market_status,
      summary: data.summary,
    })
  } catch (err: any) {
    console.error('[market-state refresh] Error:', err.message)
    return NextResponse.json(
      { ok: false, error: err.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}