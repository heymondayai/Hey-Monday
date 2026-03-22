import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

const cache = new Map<string, { data: any; fetchedAt: number }>()
const CACHE_TTL = 30 * 1000

// Rate limit: max 3 manual refreshes per user per day
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

function timingLabel(eventTime?: string): string | null {
  if (!eventTime) return null
  return eventTime
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

function buildHeadline(params: {
  traderType: string
  biggestGainer: { ticker: string; changePct: number | null } | null
  biggestLoser: { ticker: string; changePct: number | null } | null
  macroLead: string | null
}): string {
  const { traderType, biggestGainer, biggestLoser, macroLead } = params

  const tone =
    traderType === 'day'
      ? 'Intraday tape is split'
      : traderType === 'longterm'
        ? 'Market tone is mixed'
        : 'Swing setup is mixed'

  const parts: string[] = [tone]

  if (biggestLoser?.ticker && biggestLoser.changePct != null) {
    parts.push(`${biggestLoser.ticker} ${formatSignedPct(biggestLoser.changePct)}`)
  }

  if (biggestGainer?.ticker && biggestGainer.changePct != null) {
    parts.push(`${biggestGainer.ticker} ${formatSignedPct(biggestGainer.changePct)}`)
  }

  let headline = parts.join(' — ')
  if (macroLead) headline += ` | ${macroLead}`

  return headline
}

function buildSummary(params: {
  traderType: string
  normalizedWatchlist: ReturnType<typeof normalizeWatchlist>
  biggestGainer: { ticker: string; price: number | null; changePct: number | null } | null
  biggestLoser: { ticker: string; price: number | null; changePct: number | null } | null
  latestMarketState: MarketStateRow
}): string {
  const { traderType, normalizedWatchlist, biggestGainer, biggestLoser, latestMarketState } = params

  const sentences: string[] = []

  if (biggestGainer && biggestLoser) {
    sentences.push(
      `${biggestGainer.ticker} is your strongest watchlist name at ${formatPrice(biggestGainer.price)} (${formatSignedPct(biggestGainer.changePct)}), while ${biggestLoser.ticker} is weakest at ${formatPrice(biggestLoser.price)} (${formatSignedPct(biggestLoser.changePct)}).`
    )
  } else if (biggestGainer) {
    sentences.push(
      `${biggestGainer.ticker} is showing the strongest move in your watchlist at ${formatPrice(biggestGainer.price)} (${formatSignedPct(biggestGainer.changePct)}).`
    )
  } else if (biggestLoser) {
    sentences.push(
      `${biggestLoser.ticker} is showing the weakest move in your watchlist at ${formatPrice(biggestLoser.price)} (${formatSignedPct(biggestLoser.changePct)}).`
    )
  } else {
    sentences.push('Your watchlist does not have enough verified price-change data to rank relative strength right now.')
  }

  const macro = latestMarketState?.macro_context?.[0]
  if (macro?.label && macro?.value) {
    const implication = macro.implication ? ` ${macro.implication}.` : ''
    sentences.push(`${macro.label} is ${macro.value}.${implication}`.replace('..', '.'))
  } else if (latestMarketState?.summary) {
    sentences.push(latestMarketState.summary)
  }

  if (traderType === 'day') {
    sentences.push('For day trading, favor names with confirmed relative strength and avoid treating a single green print as proof of broader momentum.')
  } else if (traderType === 'longterm') {
    sentences.push('For long-term positioning, today’s move matters less than whether macro pressure is broadening or easing across your core names.')
  } else {
    sentences.push('For swing trading, the key question is whether relative strength can survive the current tape instead of fading on the next market push lower.')
  }

  return sentences.join(' ')
}

function buildRiskNote(params: {
  latestMarketState: MarketStateRow
  biggestGainer: { ticker: string; changePct: number | null } | null
}): string {
  const { latestMarketState, biggestGainer } = params

  const firstEvent = latestMarketState?.calendar_events?.[0]
  if (firstEvent?.name) {
    const time = timingLabel(firstEvent.time)
    return `Avoid forcing fresh exposure ahead of ${firstEvent.name}${time ? ` at ${time}` : ''}; that is the next visible catalyst that can invalidate the current tape.`
  }

  const macro = latestMarketState?.macro_context?.[0]
  if (macro?.label && macro?.value) {
    return `Avoid overconfidence while ${macro.label} sits at ${macro.value}; if that macro backdrop does not improve, follow-through in weaker growth names can stay limited.`
  }

  if (biggestGainer?.ticker) {
    return `Avoid assuming ${biggestGainer.ticker}'s relative strength automatically means a durable reversal; wait for broader confirmation across the rest of the watchlist.`
  }

  return 'Avoid acting aggressively until the dashboard has stronger verified cross-watchlist confirmation.'
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
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York',
        })

        return NextResponse.json(
          {
            pulse: null,
            rateLimited: true,
            message: `You've used all 3 refreshes for today. Resets at ${resetTime} ET.`,
          },
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
        ? `${latestMarketState.macro_context[0].label} ${latestMarketState.macro_context[0].value}`
        : null

    const pulse = {
      headline: buildHeadline({
        traderType,
        biggestGainer,
        biggestLoser,
        macroLead,
      }),
      summary: buildSummary({
        traderType,
        normalizedWatchlist,
        biggestGainer,
        biggestLoser,
        latestMarketState,
      }),
      riskNote: buildRiskNote({
        latestMarketState,
        biggestGainer,
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