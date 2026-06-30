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
export async function POST(req: Request) {
  try {
    const body = await req.json() as TradeEntry
    if (!body.userId || !body.symbol || !body.entryPrice) {
      return NextResponse.json({ error: 'userId, symbol, entryPrice required' }, { status: 400 })
    }
    await saveTrade(body)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
