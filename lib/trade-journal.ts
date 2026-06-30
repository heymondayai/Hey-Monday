// Trade journal: persists trade mentions from conversation to Supabase.
// Parsing uses Haiku so users can log trades in natural language.
// Performance stats are queried for "how am I doing" requests.

import { createAdminSupabaseClient } from './supabase-admin'

export interface TradeEntry {
  id?: string
  userId: string
  symbol: string
  side: 'long' | 'short'
  entryPrice: number
  exitPrice?: number
  shares?: number
  status: 'open' | 'closed'
  pnl?: number
  setupType?: string
  notes?: string
  sessionDate: string
}

export interface PerformanceStats {
  totalTrades: number
  openTrades: number
  closedTrades: number
  winRate: number
  totalPnl: number
  avgWin: number
  avgLoss: number
  bestTrade: { symbol: string; pnl: number } | null
  worstTrade: { symbol: string; pnl: number } | null
  bySymbol: Record<string, { trades: number; pnl: number; winRate: number }>
  formatted: string
}

// Detect if a user message contains a trade entry/exit.
// Returns true for natural language like "bought NVDA at $118" or "stopped out".
const TRADE_KEYWORDS = /\b(bought|sold|entered|exited|shorted|covered|took profits|stopped out|closed|opened|long|short)\b.*\$?\d+/i
const TICKER_IN_MSG   = /\b([A-Z]{1,5})\b/

export function messageContainsTrade(message: string): boolean {
  return TRADE_KEYWORDS.test(message)
}

// Extract trade from natural language using Haiku.
// Returns null if extraction fails or no trade found.
export async function extractTradeFromMessage(
  message: string,
  todayStr: string,
): Promise<Omit<TradeEntry, 'userId'> | null> {
  const prompt = `Extract trade data from this message. Return a JSON object ONLY — no explanation. If no trade is present, return null.

Fields:
- symbol: string (uppercase ticker, e.g. "NVDA")
- side: "long" or "short"
- entryPrice: number
- exitPrice: number or null (null if still open)
- shares: number or null
- status: "open" or "closed"
- pnl: number or null (compute if both entry and exit are present: (exit-entry)*shares*(1 if long, -1 if short))
- setupType: string or null (e.g. "VWAP reclaim", "ORB breakout", "momentum", "gap play")
- notes: string or null (brief description)
- sessionDate: "${todayStr}"

Message: "${message.replace(/"/g, "'")}"`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text?.trim() ?? ''
    const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    if (jsonText === 'null' || !jsonText) return null
    return JSON.parse(jsonText) as Omit<TradeEntry, 'userId'>
  } catch {
    return null
  }
}

// Persist a trade entry to Supabase.
export async function saveTrade(trade: TradeEntry): Promise<void> {
  if (!trade.userId || !trade.symbol) return
  const supabase = createAdminSupabaseClient()
  const row = {
    user_id:      trade.userId,
    symbol:       trade.symbol.toUpperCase(),
    side:         trade.side,
    entry_price:  trade.entryPrice,
    exit_price:   trade.exitPrice ?? null,
    shares:       trade.shares ?? null,
    status:       trade.status,
    pnl:          trade.pnl ?? null,
    setup_type:   trade.setupType ?? null,
    notes:        trade.notes ?? null,
    session_date: trade.sessionDate,
  }
  const { error } = await supabase.from('trades').insert(row)
  if (error) console.error('[trade-journal] save:', error.message)
}

// Fetch recent trades and compute performance stats for a user.
export async function getPerformanceStats(
  userId: string,
  days = 30,
): Promise<PerformanceStats | null> {
  if (!userId) return null
  const supabase = createAdminSupabaseClient()
  const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .gte('session_date', since)
    .order('session_date', { ascending: false })

  if (error || !data?.length) return null

  const closed = data.filter((t: any) => t.status === 'closed' && t.pnl !== null)
  const wins   = closed.filter((t: any) => t.pnl > 0)
  const losses = closed.filter((t: any) => t.pnl <= 0)

  const totalPnl  = closed.reduce((a: number, t: any) => a + (t.pnl ?? 0), 0)
  const avgWin    = wins.length   ? wins.reduce((a: number, t: any) => a + t.pnl, 0) / wins.length   : 0
  const avgLoss   = losses.length ? losses.reduce((a: number, t: any) => a + t.pnl, 0) / losses.length : 0
  const winRate   = closed.length ? wins.length / closed.length : 0

  const sorted     = [...closed].sort((a: any, b: any) => b.pnl - a.pnl)
  const bestTrade  = sorted[0]  ? { symbol: sorted[0].symbol,  pnl: sorted[0].pnl  } : null
  const worstTrade = sorted[sorted.length - 1] ? { symbol: sorted[sorted.length - 1].symbol, pnl: sorted[sorted.length - 1].pnl } : null

  // By symbol
  const bySymbol: PerformanceStats['bySymbol'] = {}
  for (const t of closed) {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { trades: 0, pnl: 0, winRate: 0 }
    bySymbol[t.symbol].trades++
    bySymbol[t.symbol].pnl += t.pnl ?? 0
  }
  for (const sym of Object.keys(bySymbol)) {
    const symTrades = closed.filter((t: any) => t.symbol === sym)
    const symWins   = symTrades.filter((t: any) => t.pnl > 0)
    bySymbol[sym].winRate = symTrades.length ? symWins.length / symTrades.length : 0
    bySymbol[sym].pnl = Math.round(bySymbol[sym].pnl * 100) / 100
  }

  const pnlSign = totalPnl >= 0 ? '+' : ''
  const topSyms = Object.entries(bySymbol)
    .sort(([, a], [, b]) => b.trades - a.trades)
    .slice(0, 4)
    .map(([sym, s]) => `${sym} (${s.trades}t, ${Math.round(s.winRate * 100)}% W/R, ${s.pnl >= 0 ? '+' : ''}$${s.pnl.toFixed(0)})`)
    .join(' | ')

  const formatted = [
    `TRADE JOURNAL (last ${days} days):`,
    `  ${data.length} total trades | ${closed.length} closed | ${data.length - closed.length} open`,
    `  Win rate: ${Math.round(winRate * 100)}% (${wins.length}W / ${losses.length}L) | Total P&L: ${pnlSign}$${totalPnl.toFixed(2)}`,
    avgWin  ? `  Avg win: +$${avgWin.toFixed(2)} | Avg loss: $${avgLoss.toFixed(2)} | R/R implied: ${Math.abs(avgWin / avgLoss).toFixed(2)}:1` : '',
    bestTrade  ? `  Best trade: ${bestTrade.symbol} +$${bestTrade.pnl.toFixed(2)}` : '',
    worstTrade ? `  Worst trade: ${worstTrade.symbol} $${worstTrade.pnl.toFixed(2)}` : '',
    topSyms    ? `  By symbol: ${topSyms}` : '',
  ].filter(Boolean).join('\n')

  return {
    totalTrades: data.length, openTrades: data.length - closed.length,
    closedTrades: closed.length, winRate, totalPnl, avgWin, avgLoss,
    bestTrade, worstTrade, bySymbol, formatted,
  }
}

// AI coaching analysis: generate a performance insight using Haiku.
export async function generateCoachingInsight(stats: PerformanceStats): Promise<string> {
  if (stats.closedTrades < 3) {
    return `You have ${stats.closedTrades} closed trade${stats.closedTrades === 1 ? '' : 's'} logged — keep tracking and Monday will identify patterns in your results.`
  }
  const prompt = `You are a trading performance coach. Analyze this trader's stats and give ONE specific, actionable insight in 2-3 sentences. Be direct and concrete. No filler phrases. Focus on a pattern that helps them trade better.

${stats.formatted}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return stats.formatted
    const data = await res.json()
    return data.content?.find((b: any) => b.type === 'text')?.text?.trim() ?? stats.formatted
  } catch {
    return stats.formatted
  }
}
