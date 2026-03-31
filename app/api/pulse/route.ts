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
  const { traderType, biggestGainer, biggestLoser, normalizedWatchlist, latestMarketState } = params
  const { sentiment, bullCount, bearCount } = getMarketSentiment(normalizedWatchlist)
  const total = normalizedWatchlist.filter(w => w.changePct != null).length
  const firstEvent = latestMarketState?.calendar_events?.[0]
  const macro = latestMarketState?.macro_context?.[0]
  const hour = new Date().getHours()
  const dow = new Date().getDay()

  if (firstEvent?.name && firstEvent?.impact === 'HIGH') {
    const ev = firstEvent.name
      .replace('Federal Reserve', 'Fed')
      .replace('Nonfarm Payrolls', 'Payrolls')
      .replace('Consumer Price Index', 'CPI')
    if (sentiment === 'strongly_bullish' || sentiment === 'bullish') {
      const opts = [
        `Bulls loading up ahead of ${ev} — conviction high, risk appetite intact`,
        `Tape running hot into ${ev} — traders betting the print confirms the move`,
        `${ev} on the horizon and the market is leaning in, not flinching`,
      ]
      return opts[hour % opts.length]
    }
    if (sentiment === 'strongly_bearish' || sentiment === 'bearish') {
      const opts = [
        `Sellers staking out territory before ${ev} has a chance to speak`,
        `Risk coming off the table — ${ev} has the market thinking twice`,
        `Caution spreading ahead of ${ev} — nobody wants to be caught leaning wrong`,
      ]
      return opts[hour % opts.length]
    }
    const opts = [
      `${ev} approaching — market holding its breath and its positions`,
      `Everyone waiting on ${ev} to tell them what to do next`,
      `The tape goes quiet as ${ev} gets closer — calm before the print`,
    ]
    return opts[hour % opts.length]
  }

  if (macro?.label) {
    const isYield = macro.label.toLowerCase().includes('yield')
    const isFed = macro.label.toLowerCase().includes('fed')
    if (isYield && (sentiment === 'bearish' || sentiment === 'strongly_bearish')) {
      const opts = [
        `Rates doing what rates do — repricing growth expectations and taking names with them`,
        `The bond market is making the equity argument harder — yields up, multiples down`,
        `Higher-for-longer is back in the conversation and your watchlist is paying the price`,
        `Yields aren't blinking, and the growth trade is suffering for that stubbornness`,
      ]
      return opts[dow % opts.length]
    }
    if (isYield && (sentiment === 'bullish' || sentiment === 'strongly_bullish')) {
      const opts = [
        `Equities finding a way higher despite the rates backdrop — resilience worth noting`,
        `Buyers stepping over the yield hurdle — risk appetite proving stickier than expected`,
        `The rate story hasn't changed but the market's reaction to it has — worth watching`,
      ]
      return opts[hour % opts.length]
    }
    if (isFed) {
      const opts = [
        `Fed policy still casting a long shadow — every tick in rates matters right now`,
        `Powell's stance is priced in, or so the market thinks — until the next data point`,
      ]
      return opts[hour % opts.length]
    }
  }

  if (biggestGainer && biggestLoser) {
    const gPct = biggestGainer.changePct ?? 0
    const lPct = biggestLoser.changePct ?? 0
    const spread = Math.abs(gPct - lPct)
    if (spread > 6 && gPct > 3) {
      const opts = [
        `${biggestGainer.ticker} ignoring the memo the rest of the watchlist received — running solo`,
        `${biggestGainer.ticker} in its own universe today — the tape hasn't caught up, or won't`,
        `One name leading, nobody following — ${biggestGainer.ticker} writing a different story`,
      ]
      return opts[hour % opts.length]
    }
    if (spread > 6 && lPct < -3) {
      const opts = [
        `${biggestLoser.ticker} getting sold like someone knows something — rest of the book holding`,
        `${biggestLoser.ticker} taking the stairs down while the watchlist takes the elevator sideways`,
        `Isolated breakdown in ${biggestLoser.ticker} — dispersion rising, conviction uncertain`,
      ]
      return opts[hour % opts.length]
    }
    if (spread > 4) {
      const opts = [
        `${biggestGainer.ticker} and ${biggestLoser.ticker} — same watchlist, completely different sessions`,
        `A tale of two names: ${biggestGainer.ticker} running while ${biggestLoser.ticker} breaks — the book can't agree on a direction`,
        `Dispersion widening — ${biggestGainer.ticker} and ${biggestLoser.ticker} pulling the book apart`,
      ]
      return opts[dow % opts.length]
    }
  }

  if (sentiment === 'strongly_bullish') {
    const opts = [
      `Clean sweep — ${bullCount} of ${total} names in the green and the tape has a real pulse today`,
      `Broad-based buying with genuine participation — not just one name holding the index up`,
      `Risk-on across the book — the kind of session where staying out costs more than getting in`,
      `Everything working at once — a rising tide session with ${bullCount} of ${total} names confirming`,
    ]
    return opts[hour % opts.length]
  }

  if (sentiment === 'strongly_bearish') {
    const opts = [
      `Nowhere to hide — ${bearCount} of ${total} names printing red and the bid is thin`,
      `Broad liquidation underway — the question isn't what's weak, it's what's left standing`,
      `Sellers running the table across ${bearCount} of ${total} names — limited pushback anywhere`,
      `Distribution unfolding across the book — this is what a real sell day looks like`,
    ]
    return opts[hour % opts.length]
  }

  if (sentiment === 'bullish') {
    const opts = [
      biggestGainer
        ? `${biggestGainer.ticker} setting the tone for a quietly constructive session`
        : `Watchlist grinding higher — buyers present but not rushing`,
      `Mild but real — the tape is leaning up and the book is following along`,
      `Green session with asterisks — moving higher but nobody's pounding the table yet`,
    ]
    return opts[dow % opts.length]
  }

  if (sentiment === 'bearish') {
    const opts = [
      biggestLoser
        ? `${biggestLoser.ticker} dragging a session that was already looking for a reason to sell`
        : `Quiet selling pressure — not panic, but nobody's buying this dip with conviction`,
      `Sellers in light control — the path of least resistance is still lower for now`,
      `Red tape, low conviction — feels more like exhaustion than real distribution`,
    ]
    return opts[dow % opts.length]
  }

  const mixedOpts = [
    `The market is doing its best impression of a shrug — range-bound and waiting for a catalyst`,
    `Neither bull nor bear making a compelling case today — patience is the only real edge`,
    `Conviction on vacation — the tape is coiling for something worth actually trading`,
    `Flat is a direction too — the market conserving energy before the next real move`,
    traderType === 'day'
      ? `A session that rewards discipline over activity — the range hasn't given anyone an edge yet`
      : `The setup isn't there yet — the best swing trades start with a tape that knows what it wants`,
  ]
  return mixedOpts[(hour + dow) % mixedOpts.length]
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

  // ── LEAD: narrative price action, no raw numbers ──────────────────────────
  if (biggestGainer && biggestLoser) {
    const spread = Math.abs((biggestGainer.changePct ?? 0) - (biggestLoser.changePct ?? 0))
    if (spread > 5) {
      sentences.push(`${biggestGainer.ticker} and ${biggestLoser.ticker} are the session's defining divergence — one running, one breaking, with the rest of the book stuck in between.`)
    } else if (sentiment === 'bullish' || sentiment === 'strongly_bullish') {
      sentences.push(`${biggestGainer.ticker} is leading the move with ${biggestLoser.ticker} as the notable laggard — overall the book is tilting in the right direction.`)
    } else if (sentiment === 'bearish' || sentiment === 'strongly_bearish') {
      sentences.push(`${biggestLoser.ticker} is the weakest name in the book today, with ${biggestGainer.ticker} the lone bright spot holding against the broader selling.`)
    } else {
      sentences.push(`${biggestGainer.ticker} is the session's relative leader while ${biggestLoser.ticker} is the drag — the watchlist is split with no clear directional conviction.`)
    }
  } else if (biggestGainer) {
    sentences.push(`${biggestGainer.ticker} is carrying the watchlist today — no other name matching its strength, which makes the move harder to trust as a broad signal.`)
  } else if (biggestLoser) {
    sentences.push(`${biggestLoser.ticker} is the main weight on the watchlist today — without a offsetting leader, the book is leaning defensive.`)
  } else {
    sentences.push('Not enough price data to identify relative strength across the watchlist right now.')
  }

  // ── MACRO LAYER ───────────────────────────────────────────────────────────
  const macro = latestMarketState?.macro_context?.[0]
  if (macro?.label && macro?.value) {
    if (macro.implication) {
      sentences.push(`${macro.label} at ${macro.value} — ${macro.implication.toLowerCase().replace(/\.$/, '')}.`)
    } else {
      sentences.push(`Macro backdrop: ${macro.label} at ${macro.value}.`)
    }
  } else if (latestMarketState?.summary) {
    sentences.push(latestMarketState.summary)
  }

  // ── TRADER LENS: situational, not boilerplate ─────────────────────────────
  if (traderType === 'day') {
    if (sentiment === 'strongly_bullish' || sentiment === 'bullish')
      sentences.push('Intraday edge favors the long side — but confirm momentum is holding on retests before adding size, green opens that fade by 10:30 tend to trap.')
    else if (sentiment === 'strongly_bearish' || sentiment === 'bearish')
      sentences.push('Bearish intraday setups are in play — be cautious fading aggressively though, short-covering rips in a weak tape can be violent and quick.')
    else
      sentences.push('Choppy tape is the day trader\'s worst environment — the edge is in waiting, not in forcing a trade from a range that hasn\'t resolved yet.')
  } else if (traderType === 'longterm') {
    if (Math.abs(avgChange) < 0.5)
      sentences.push('A quiet session changes nothing for longer time horizons — the macro trend and earnings trajectory matter far more than daily noise.')
    else if (sentiment === 'bearish' || sentiment === 'strongly_bearish')
      sentences.push('Drawdowns in fundamentally sound names are the long-term investor\'s entry opportunity — the question is whether the thesis is intact, not whether the price is down.')
    else
      sentences.push('Strength in the session is encouraging but rarely enough on its own — the macro trend, not a single green day, is what builds a durable thesis.')
  } else {
    if (sentiment === 'mixed')
      sentences.push('Mixed tapes often precede a directional break — the swing setup is building, not ready. Marking the range extremes now gives you the levels to trade against when it resolves.')
    else if (sentiment === 'strongly_bullish' || sentiment === 'bullish')
      sentences.push('Swing setups are improving — the question now is whether today\'s strength holds into the close and prints a higher high, which would shift the short-term structure.')
    else
      sentences.push('Swing positioning demands patience here — selling into weakness without a base risks getting shaken out before the real move develops.')
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