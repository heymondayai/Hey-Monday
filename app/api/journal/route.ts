import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getPerformanceStats, saveTrade, TradeEntry } from '@/lib/trade-journal'

// GET /api/journal?userId=xxx&days=30
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const days   = parseInt(searchParams.get('days') ?? '30', 10)
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const stats = await getPerformanceStats(userId, days)
  if (!stats) return NextResponse.json({ trades: [], stats: null })

  // Also fetch raw recent trades for display
  const supabase = createAdminSupabaseClient()
  const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]
  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .gte('session_date', since)
    .order('session_date', { ascending: false })
    .limit(50)

  return NextResponse.json({ trades: trades ?? [], stats })
}

// POST /api/journal — manual trade entry
// Accepts both canonical names (symbol, side, sessionDate) and aliases (ticker, direction, date)
export async function POST(req: Request) {
  try {
    const raw = await req.json()
    const symbol = (raw.symbol ?? raw.ticker ?? '').toUpperCase()
    const side: 'long' | 'short' = /short|sell/i.test(raw.side ?? raw.direction ?? 'long') ? 'short' : 'long'
    const sessionDate = raw.sessionDate ?? raw.date ?? new Date().toISOString().split('T')[0]
    const entryPrice = parseFloat(raw.entryPrice ?? raw.entry_price ?? 0)
    const exitPrice = raw.exitPrice ?? raw.exit_price ? parseFloat(raw.exitPrice ?? raw.exit_price) : undefined
    const status: 'open' | 'closed' = exitPrice !== undefined ? 'closed' : 'open'

    if (!raw.userId || !symbol || !entryPrice) {
      return NextResponse.json({ error: 'userId, symbol/ticker, entryPrice required' }, { status: 400 })
    }

    const trade: TradeEntry = {
      userId: raw.userId,
      symbol,
      side,
      entryPrice,
      exitPrice,
      shares: raw.shares ? parseInt(raw.shares) : undefined,
      status,
      pnl: raw.pnl ?? undefined,
      setupType: raw.setupType ?? raw.setup_type ?? undefined,
      notes: raw.notes ?? undefined,
      sessionDate,
    }
    await saveTrade(trade)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
