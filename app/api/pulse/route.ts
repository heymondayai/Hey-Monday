import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

const cache = new Map<string, { data: any; fetchedAt: number }>()
const CACHE_TTL = 30 * 1000

const refreshLimits = new Map<string, { count: number; resetAt: number }>()
const MAX_REFRESHES_PER_DAY = 2

type WatchlistItem = {
  ticker: string
  price?: string | number
  change?: string | number
  up?: boolean
}

type MarketStateRow = {
  snapshot_time: string
  market_status: string
  top_movers: any[]
  macro_context: any[]
  calendar_events: any[]
  summary: string
} | null

function getRateLimitKey(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'anonymous'
  return `pulse:${ip}`
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const midnight = new Date()
  midnight.setHours(24, 0, 0, 0)
  const resetAt = midnight.getTime()
  const existing = refreshLimits.get(key)
  if (!existing || now >= existing.resetAt) {
    refreshLimits.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: MAX_REFRESHES_PER_DAY - 1, resetAt }
  }
  if (existing.count >= MAX_REFRESHES_PER_DAY) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt }
  }
  existing.count++
  refreshLimits.set(key, existing)
  return { allowed: true, remaining: MAX_REFRESHES_PER_DAY - existing.count, resetAt: existing.resetAt }
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[$,%(),+\s]/g, '').trim()
  if (!cleaned) return null
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : null
}

function formatSignedPct(value: number | null): string {
  if (value == null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatPrice(value: unknown): string {
  const n = parseNumber(value)
  if (n == null) return '—'
  return `$${n.toFixed(2)}`
}

function normalizeWatchlist(watchlist: WatchlistItem[]) {
  return watchlist.map((w) => {
    const changeNum = parseNumber(w.change)
    const priceNum = parseNumber(w.price)
    return {
      ticker: w.ticker?.toUpperCase?.() ?? '',
      price: priceNum,
      changePct: changeNum,
      up: typeof w.up === 'boolean' ? w.up : changeNum != null ? changeNum >= 0 : null,
    }
  }).filter((w) => w.ticker)
}

function getMarketSentiment(normalized: ReturnType<typeof normalizeWatchlist>): {
  bullCount: number
  bearCount: number
  avgChange: number
  sentiment: 'strongly_bullish' | 'bullish' | 'mixed' | 'bearish' | 'strongly_bearish'
} {
  const withChanges = normalized.filter(w => w.changePct != null)
  if (!withChanges.length) return { bullCount: 0, bearCount: 0, avgChange: 0, sentiment: 'mixed' }
  const bullCount = withChanges.filter(w => (w.changePct ?? 0) > 0).length
  const bearCount = withChanges.filter(w => (w.changePct ?? 0) < 0).length
  const avgChange = withChanges.reduce((sum, w) => sum + (w.changePct ?? 0), 0) / withChanges.length
  let sentiment: 'strongly_bullish' | 'bullish' | 'mixed' | 'bearish' | 'strongly_bearish'
  if (avgChange > 1.5) sentiment = 'strongly_bullish'
  else if (avgChange > 0.3) sentiment = 'bullish'
  else if (avgChange < -1.5) sentiment = 'strongly_bearish'
  else if (avgChange < -0.3) sentiment = 'bearish'
  else sentiment = 'mixed'
  return { bullCount, bearCount, avgChange, sentiment }
}

async function generatePulseWithClaude(params: {
  traderType: string
  normalizedWatchlist: ReturnType<typeof normalizeWatchlist>
  latestMarketState: MarketStateRow
}): Promise<{ headline: string; summary: string; riskNote: string }> {
  const { traderType, normalizedWatchlist, latestMarketState } = params
  const { sentiment, bullCount, bearCount, avgChange } = getMarketSentiment(normalizedWatchlist)

  const sortedByStrength = [...normalizedWatchlist]
    .filter(w => w.changePct != null)
    .sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity))

  const biggestGainer = sortedByStrength[0] ?? null
  const biggestLoser = sortedByStrength[sortedByStrength.length - 1] ?? null
  const total = normalizedWatchlist.filter(w => w.changePct != null).length

  const watchlistStr = normalizedWatchlist
    .filter(w => w.changePct != null)
    .map(w => `${w.ticker}: ${w.changePct! >= 0 ? '+' : ''}${w.changePct!.toFixed(2)}%`)
    .join(', ')

  const macroItems = (latestMarketState?.macro_context ?? [])
    .filter((m: any) => m.label && m.value && !m.label.includes('10Y') && !m.label.includes('Treasury') && !m.label.includes('2Y'))
    .slice(0, 3)
    .map((m: any) => `${m.label}: ${m.value}${m.implication ? ` (${m.implication})` : ''}`)
    .join(', ')

  const calendarItems = (latestMarketState?.calendar_events ?? [])
    .slice(0, 3)
    .map((e: any) => `${e.name}${e.time ? ` at ${e.time} ET` : ''}${e.impact ? ` [${e.impact}]` : ''}`)
    .join('; ')

  const traderLabel =
    traderType === 'day' ? 'day trader (intraday focus, same-session exits)' :
    traderType === 'longterm' ? 'long-term investor (weeks to years, fundamentals-focused)' :
    'swing trader (multi-day to multi-week holds)'

  const now = new Date()
  const etTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(now)

  const prompt = `You are Monday, an AI market intelligence assistant. Generate a fresh market pulse for a trader right now.

CURRENT TIME (ET): ${etTime}
MARKET STATUS: ${latestMarketState?.market_status ?? 'Unknown'}
TRADER TYPE: ${traderLabel}

WATCHLIST PERFORMANCE TODAY:
${watchlistStr || 'No price data available yet'}

OVERALL SENTIMENT: ${sentiment.replace('_', ' ')} (${bullCount} up, ${bearCount} down out of ${total}, avg ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%)
${biggestGainer ? `BIGGEST MOVER UP: ${biggestGainer.ticker} ${biggestGainer.changePct! >= 0 ? '+' : ''}${biggestGainer.changePct!.toFixed(2)}%` : ''}
${biggestLoser && biggestLoser.ticker !== biggestGainer?.ticker ? `BIGGEST MOVER DOWN: ${biggestLoser.ticker} ${biggestLoser.changePct!.toFixed(2)}%` : ''}

MACRO DATA:
${macroItems || 'No macro data available'}

UPCOMING ECONOMIC EVENTS:
${calendarItems || 'No scheduled events'}

Generate exactly three things. Be specific to TODAY's actual numbers and tickers — never generic. Write for a sophisticated retail trader. No unexplained jargon. Complete sentences only.

Respond in this exact JSON format with no other text:
{
  "headline": "One punchy sentence (max 15 words) capturing the single most important thing happening right now. Reference actual tickers or data. No clichés.",
  "summary": "Two to three complete sentences. First: what is actually happening across the watchlist, referencing specific tickers and their percentage moves. Second: what the macro backdrop means for these specific names today. Third: one specific observation for this trader type given what is happening — plain English, no unexplained jargon.",
  "riskNote": "One complete sentence identifying the single biggest risk to positions right now. If there is an upcoming economic event, name it and explain in plain terms why it matters to this watchlist."
}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`)

  const data = await response.json()
  const text = data.content?.[0]?.text?.trim() ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')
  const parsed = JSON.parse(jsonMatch[0])

  return {
    headline: parsed.headline ?? 'Unable to generate pulse right now.',
    summary: parsed.summary ?? '',
    riskNote: parsed.riskNote ?? '',
  }
}

export async function POST(req: NextRequest) {
  try {
    const { watchlist = [], traderType = 'swing', isManualRefresh = false } = await req.json()
    const supabase = createAdminSupabaseClient()

    if (isManualRefresh) {
      const key = getRateLimitKey(req)
      const { allowed, remaining, resetAt } = checkRateLimit(key)
      if (!allowed) {
        const resetTime = new Date(resetAt).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
        })
        return NextResponse.json(
          { pulse: null, rateLimited: true, message: `You've already used your manual refresh for today. Resets at ${resetTime} ET.` },
          { status: 429 }
        )
      }
      const cacheKey = JSON.stringify({
        watchlist: watchlist.map((w: WatchlistItem) => [w.ticker, w.price, w.change, w.up]),
        traderType,
      })
      const cached = cache.get(cacheKey)
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return NextResponse.json({ ...cached.data, refreshesRemaining: remaining })
      }
    }

    const cacheKey = JSON.stringify({
      watchlist: watchlist.map((w: WatchlistItem) => [w.ticker, w.price, w.change, w.up]),
      traderType,
    })
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    const { data: latestMarketState } = await supabase
      .from('market_state_snapshots')
      .select('snapshot_time, market_status, top_movers, macro_context, calendar_events, summary')
      .order('snapshot_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    const normalizedWatchlist = normalizeWatchlist(watchlist)
    const sortedByStrength = [...normalizedWatchlist]
      .filter((w) => w.changePct != null)
      .sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity))

    const pulse = await generatePulseWithClaude({
      traderType,
      normalizedWatchlist,
      latestMarketState,
    })

    const result = { pulse }
    cache.set(cacheKey, { data: result, fetchedAt: Date.now() })
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[pulse] Error:', err.message)
    return NextResponse.json({ pulse: null })
  }
}
