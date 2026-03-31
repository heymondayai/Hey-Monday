import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

const cache = new Map<string, { data: any; fetchedAt: number }>()
const CACHE_TTL = 30 * 1000

const refreshLimits = new Map<string, { count: number; resetAt: number }>()
const MAX_REFRESHES_PER_DAY = 3

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

function buildHeadline(params: {
  traderType: string
  biggestGainer: { ticker: string; changePct: number | null } | null
  biggestLoser: { ticker: string; changePct: number | null } | null
  macroLead: string | null
  normalizedWatchlist: ReturnType<typeof normalizeWatchlist>
  latestMarketState: MarketStateRow
}): string {
  const { traderType, biggestGainer, biggestLoser, macroLead, normalizedWatchlist, latestMarketState } = params
  const { sentiment, avgChange, bullCount, bearCount } = getMarketSentiment(normalizedWatchlist)
  const total = normalizedWatchlist.filter(w => w.changePct != null).length

  // Event-driven headlines (highest priority)
  const firstEvent = latestMarketState?.calendar_events?.[0]
  if (firstEvent?.name && firstEvent?.impact === 'HIGH') {
    if (sentiment === 'strongly_bullish' || sentiment === 'bullish') {
      return `${firstEvent.name} in focus — your watchlist rallying into the print`
    }
    if (sentiment === 'strongly_bearish' || sentiment === 'bearish') {
      return `Risk-off ahead of ${firstEvent.name} — watchlist selling into the event`
    }
    return `${firstEvent.name} on deck — tape positioning mixed ahead of release`
  }

  // Dominant mover headlines
  if (biggestGainer && (biggestGainer.changePct ?? 0) > 3) {
    if (bearCount > bullCount) {
      return `${biggestGainer.ticker} surges ${formatSignedPct(biggestGainer.changePct)} but can't lift a broadly red watchlist`
    }
    return `${biggestGainer.ticker} leading the charge at ${formatSignedPct(biggestGainer.changePct)} — outpacing the rest of your names`
  }

  if (biggestLoser && (biggestLoser.changePct ?? 0) < -3) {
    if (bullCount > bearCount) {
      return `${biggestLoser.ticker} drags at ${formatSignedPct(biggestLoser.changePct)} despite broader strength in your book`
    }
    return `${biggestLoser.ticker} leading the tape lower at ${formatSignedPct(biggestLoser.changePct)} — pressure across the watchlist`
  }

  // Sentiment-driven headlines
  if (sentiment === 'strongly_bullish') {
    const macro = macroLead ? ` with ${macroLead}` : ''
    return `Broad-based strength${macro} — ${bullCount} of ${total} names pushing higher`
  }

  if (sentiment === 'strongly_bearish') {
    const macro = macroLead ? ` as ${macroLead}` : ''
    return `Broad-based selling${macro} — ${bearCount} of ${total} names under pressure`
  }

  if (sentiment === 'bullish') {
    if (biggestGainer) return `Watchlist leaning green — ${biggestGainer.ticker} pacing the move at ${formatSignedPct(biggestGainer.changePct)}`
    return `Your names tilting higher — ${bullCount}/${total} in positive territory`
  }

  if (sentiment === 'bearish') {
    if (biggestLoser) return `Watchlist leaning red — ${biggestLoser.ticker} the weakest link at ${formatSignedPct(biggestLoser.changePct)}`
    return `Mild selling pressure — ${bearCount}/${total} names in the red`
  }

  // Mixed / flat
  if (biggestGainer && biggestLoser) {
    const gPct = biggestGainer.changePct ?? 0
    const lPct = biggestLoser.changePct ?? 0
    if (Math.abs(gPct) > 2 || Math.abs(lPct) > 2) {
      return `${biggestGainer.ticker} and ${biggestLoser.ticker} pulling in opposite directions — divergence widening`
    }
    return `${biggestGainer.ticker} vs ${biggestLoser.ticker} — watchlist split with no clear directional conviction`
  }

  // Trader-type fallback (last resort, still better than generic)
  if (traderType === 'day') return 'Tape is choppy — no clear intraday trend emerging yet'
  if (traderType === 'longterm') return 'Market tone is consolidating — monitor macro catalysts for directional cues'
  return 'Watchlist in wait-and-see mode — setup building, no breakout yet'
}

function buildSummary(params: {
  traderType: string
  normalizedWatchlist: ReturnType<typeof normalizeWatchlist>
  biggestGainer: { ticker: string; price: number | null; changePct: number | null } | null
  biggestLoser: { ticker: string; price: number | null; changePct: number | null } | null
  latestMarketState: MarketStateRow
}): string {
  const { traderType, normalizedWatchlist, biggestGainer, biggestLoser, latestMarketState } = params
  const { sentiment, avgChange } = getMarketSentiment(normalizedWatchlist)
  const sentences: string[] = []

  // Lead with the most important price action
  if (biggestGainer && biggestLoser) {
    const spread = Math.abs((biggestGainer.changePct ?? 0) - (biggestLoser.changePct ?? 0))
    if (spread > 4) {
      sentences.push(
        `${biggestGainer.ticker} at ${formatPrice(biggestGainer.price)} (${formatSignedPct(biggestGainer.changePct)}) and ${biggestLoser.ticker} at ${formatPrice(biggestLoser.price)} (${formatSignedPct(biggestLoser.changePct)}) are pulling your watchlist in opposite directions — that's a ${spread.toFixed(1)}pt spread worth watching.`
      )
    } else {
      sentences.push(
        `${biggestGainer.ticker} is the relative leader at ${formatPrice(biggestGainer.price)} (${formatSignedPct(biggestGainer.changePct)}), while ${biggestLoser.ticker} is the laggard at ${formatPrice(biggestLoser.price)} (${formatSignedPct(biggestLoser.changePct)}).`
      )
    }
  } else if (biggestGainer) {
    sentences.push(`${biggestGainer.ticker} at ${formatPrice(biggestGainer.price)} is carrying the watchlist, up ${formatSignedPct(biggestGainer.changePct)} — no other name showing comparable strength.`)
  } else if (biggestLoser) {
    sentences.push(`${biggestLoser.ticker} at ${formatPrice(biggestLoser.price)} is the key drag, down ${formatSignedPct(biggestLoser.changePct)} — no offsetting strength elsewhere in the book.`)
  } else {
    sentences.push('Not enough verified price data to rank relative strength across the watchlist right now.')
  }

  // Macro context — conversational, not just a data read
  const macro = latestMarketState?.macro_context?.[0]
  if (macro?.label && macro?.value) {
    const implication = macro.implication
    if (implication) {
      sentences.push(`${macro.label} at ${macro.value} — ${implication.toLowerCase().replace(/\.$/, '')}.`)
    } else {
      sentences.push(`${macro.label} sits at ${macro.value}.`)
    }
  } else if (latestMarketState?.summary) {
    sentences.push(latestMarketState.summary)
  }

  // Trader-type context — specific and actionable, not generic
  if (traderType === 'day') {
    if (sentiment === 'strongly_bullish' || sentiment === 'bullish') {
      sentences.push('For intraday positioning, confirm relative strength is holding on retests before adding — single green prints on low volume can reverse fast in this tape.')
    } else if (sentiment === 'strongly_bearish' || sentiment === 'bearish') {
      sentences.push('For intraday positioning, be cautious fading strength — sustained bearish tape tends to rip on short covering. Wait for a failed bounce before leaning short.')
    } else {
      sentences.push('Chop tends to favor range trades intraday — the key is waiting for the range extremes to set rather than chasing the first move off the open.')
    }
  } else if (traderType === 'longterm') {
    if (Math.abs(avgChange) < 0.5) {
      sentences.push('For longer-term positioning, single-day noise in a tight range is rarely meaningful — focus on whether the macro trend is shifting, not daily prints.')
    } else if (sentiment === 'strongly_bearish' || sentiment === 'bearish') {
      sentences.push('For longer-term positioning, drawdowns in fundamentally sound names can be entry opportunities — but confirm the macro thesis hasn\'t changed before adding.')
    } else {
      sentences.push('For longer-term positioning, what matters more than today\'s print is whether earnings and macro trends remain intact over the next quarter.')
    }
  } else {
    if (sentiment === 'mixed') {
      sentences.push('For swing setups, mixed tapes often precede a directional move — watch for a catalyst to break the current range and confirm which side has control.')
    } else if (sentiment === 'strongly_bullish' || sentiment === 'bullish') {
      sentences.push('For swing positioning, the question is whether this strength can hold into the next session — follow-through above today\'s highs would be the confirmation signal.')
    } else {
      sentences.push('For swing positioning, the key question is whether today\'s weakness is distribution or just noise — a break of recent lows on volume would tip the hand.')
    }
  }

  return sentences.join(' ')
}

function buildRiskNote(params: {
  latestMarketState: MarketStateRow
  biggestGainer: { ticker: string; changePct: number | null } | null
  biggestLoser: { ticker: string; changePct: number | null } | null
  normalizedWatchlist: ReturnType<typeof normalizeWatchlist>
}): string {
  const { latestMarketState, biggestGainer, biggestLoser, normalizedWatchlist } = params
  const { sentiment } = getMarketSentiment(normalizedWatchlist)

  // Upcoming catalyst (highest priority)
  const firstEvent = latestMarketState?.calendar_events?.[0]
  if (firstEvent?.name) {
    const time = firstEvent.time ? ` at ${firstEvent.time}` : ''
    const impact = firstEvent.impact === 'HIGH' ? 'high-impact ' : ''
    return `${firstEvent.name}${time} is the next ${impact}catalyst on the tape — positions taken ahead of binary events carry event risk that stops and sizing can't fully protect against.`
  }

  // Macro risk
  const macro = latestMarketState?.macro_context?.[0]
  if (macro?.label && macro?.value) {
    if (sentiment === 'strongly_bullish' || sentiment === 'bullish') {
      return `Don't let a strong session create false confidence while ${macro.label} stays at ${macro.value} — macro headwinds don't disappear on green days, they compress the runway for follow-through.`
    }
    if (sentiment === 'strongly_bearish' || sentiment === 'bearish') {
      return `With ${macro.label} at ${macro.value} and broad selling pressure, the risk is adding into a move that has further to go — let the tape show a base before stepping in.`
    }
    return `${macro.label} at ${macro.value} remains the macro anchor — watch for a shift here before assuming the current tape bias has changed.`
  }

  // Relative divergence risk
  if (biggestGainer && biggestLoser) {
    const spread = Math.abs((biggestGainer.changePct ?? 0) - (biggestLoser.changePct ?? 0))
    if (spread > 5) {
      return `The ${spread.toFixed(1)}pt spread between ${biggestGainer.ticker} and ${biggestLoser.ticker} is unusually wide — divergence this sharp often mean-reverts, so be cautious extrapolating either move.`
    }
  }

  // Generic but still specific
  if (biggestGainer && (biggestGainer.changePct ?? 0) > 2) {
    return `${biggestGainer.ticker}'s outperformance is notable, but leadership from a single name without broader confirmation is fragile — wait for the rest of the watchlist to confirm before sizing up.`
  }

  return 'No single catalyst dominates the tape right now — the main risk is overtrading a ranging market and giving back edge on commissions and spread.'
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
          { pulse: null, rateLimited: true, message: `You've used all 3 refreshes for today. Resets at ${resetTime} ET.` },
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

    const biggestGainer = sortedByStrength[0] ?? null
    const biggestLoser = [...sortedByStrength].sort((a, b) => (a.changePct ?? Infinity) - (b.changePct ?? Infinity))[0] ?? null

    const macroLead =
      latestMarketState?.macro_context?.[0]?.label && latestMarketState?.macro_context?.[0]?.value
        ? `${latestMarketState.macro_context[0].label} at ${latestMarketState.macro_context[0].value}`
        : null

    const pulse = {
      headline: buildHeadline({
        traderType, biggestGainer, biggestLoser, macroLead,
        normalizedWatchlist, latestMarketState,
      }),
      summary: buildSummary({
        traderType, normalizedWatchlist, biggestGainer, biggestLoser, latestMarketState,
      }),
      riskNote: buildRiskNote({
        latestMarketState, biggestGainer, biggestLoser, normalizedWatchlist,
      }),
    }

    const result = { pulse }
    cache.set(cacheKey, { data: result, fetchedAt: Date.now() })
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[pulse] Error:', err.message)
    return NextResponse.json({ pulse: null })
  }
}