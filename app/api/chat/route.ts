import { NextResponse } from 'next/server'
import { getNyseEquitiesStatus } from '@/lib/market-hours'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { planQuery, buildFallbackPlan } from '@/lib/query-planner'
import { compileContext, buildOutputInstructions } from '@/lib/data-compiler'


// ── SONNET DAILY CAP ─────────────────────────────────────────────────────────

const sonnetUsage = new Map<string, { count: number; dateET: string }>()
const SONNET_DAILY_CAP = 20

function getTodayET(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function canUseSonnet(userId: string): boolean {
  const today = getTodayET()
  const entry = sonnetUsage.get(userId)
  if (!entry || entry.dateET !== today) return true
  return entry.count < SONNET_DAILY_CAP
}

function recordSonnetCall(userId: string): number {
  const today = getTodayET()
  const entry = sonnetUsage.get(userId)
  if (!entry || entry.dateET !== today) {
    sonnetUsage.set(userId, { count: 1, dateET: today })
    return 1
  }
  entry.count++
  return entry.count
}

function getSonnetRemaining(userId: string): number {
  const today = getTodayET()
  const entry = sonnetUsage.get(userId)
  if (!entry || entry.dateET !== today) return SONNET_DAILY_CAP
  return Math.max(0, SONNET_DAILY_CAP - entry.count)
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const {
      message,
      watchlist = [],
      traderType,
      prices = [],
      news = [],
      history = [],
      userId,
      mode = 'chat',
    } = await req.json() as {
      message: string
      watchlist?: any[]
      traderType?: string
      prices?: any[]
      news?: any[]
      history?: { role: string; content: string }[]
      userId?: string
      mode?: 'chat' | 'summary'
    }

    const watchlistTickers: string[] = watchlist?.map((s: any) => s.ticker) ?? []
    const userKey = userId ?? 'anonymous'
    const sonnetAllowed = canUseSonnet(userKey)

    // ── DATE / TIME / MARKET STATUS ──────────────────────────────────────────
    const now = new Date()
    const nyseStatus = getNyseEquitiesStatus(now)
    const marketStatus = nyseStatus.label
    const minutesToClose = nyseStatus.minutesToClose

    const etParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric', minute: '2-digit', hour12: true,
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }).formatToParts(now)

    const etTime = `${etParts.find(p => p.type === 'hour')?.value}:${etParts.find(p => p.type === 'minute')?.value} ${(etParts.find(p => p.type === 'dayPeriod')?.value ?? '').toUpperCase().split('').join(' ')} ET`
    const etDate = `${etParts.find(p => p.type === 'weekday')?.value}, ${etParts.find(p => p.type === 'month')?.value} ${etParts.find(p => p.type === 'day')?.value}, ${etParts.find(p => p.type === 'year')?.value}`
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    // Last-close day label (before 4 PM ET the current session hasn't closed)
    const etHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23',
      }).format(now),
      10,
    )
    const etWeekday = etParts.find(p => p.type === 'weekday')?.value ?? ''
    const PREV_TRADING: Record<string, string> = {
      Sunday: 'Friday', Monday: 'Friday',
      Tuesday: 'Monday', Wednesday: 'Tuesday',
      Thursday: 'Wednesday', Friday: 'Thursday', Saturday: 'Friday',
    }
    const marketHasClosed = etHour >= 16
    const lastCloseDayName =
      etWeekday === 'Saturday' || etWeekday === 'Sunday' || !marketHasClosed
        ? PREV_TRADING[etWeekday] ?? etWeekday
        : etWeekday

    // ── RESOLVE USER PLAN ────────────────────────────────────────────────────
    const userPlan = await (async (): Promise<'core' | 'edge' | null> => {
      if (!userId) return null
      const admin = createAdminSupabaseClient()
      const { data } = await admin.from('profiles').select('stripe_price_id').eq('id', userId).single()
      const pid = (data as any)?.stripe_price_id ?? null
      const coreIds = [process.env.NEXT_PUBLIC_STRIPE_PRICE_CORE_MONTHLY, process.env.NEXT_PUBLIC_STRIPE_PRICE_CORE_ANNUAL]
      const edgeIds = [process.env.NEXT_PUBLIC_STRIPE_PRICE_EDGE_MONTHLY, process.env.NEXT_PUBLIC_STRIPE_PRICE_EDGE_ANNUAL]
      if (coreIds.includes(pid)) return 'core'
      if (edgeIds.includes(pid)) return 'edge'
      return null
    })()

    // ── STAGE 1: PLAN ────────────────────────────────────────────────────────
    // Summary mode gets a fixed plan — no planner call needed.
    const plan = mode === 'summary'
      ? {
          topic: 'briefing' as const,
          symbols: watchlistTickers,
          timeRange: { type: 'session' as const, startDate: todayStr, endDate: todayStr },
          fetch: ['candles', 'live_prices', 'news', 'macro', 'calendar', 'sector', 'market_state'] as any,
          compile: ['session_summary', 'biggest_move'] as any,
          outputFormat: 'briefing' as const,
          detailLevel: 'detailed' as const,
          maxTokens: 350,
          isHistorical: false,
          requiresSearch: false,
        }
      : (await planQuery(message, watchlistTickers, todayStr, marketStatus))
        ?? buildFallbackPlan(message, watchlistTickers, todayStr)

    console.log('[chat] plan:', JSON.stringify(plan))

    // ── STAGE 2: COMPILE ─────────────────────────────────────────────────────
    const { context: compiledContext, badges: compiledBadges, confidence } = await compileContext(plan, {
      watchlistTickers,
      passedPrices: prices,
      passedNews: news,
      todayStr,
      message,
      userId,
      userPlan,
      traderType,
    })

    // ── MODEL + SEARCH ROUTING ────────────────────────────────────────────────
    const useSearch = plan.requiresSearch
    const useSonnet = useSearch && sonnetAllowed
    const model     = useSonnet ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'
    const maxTokens = plan.maxTokens

    const badges = useSearch
      ? [{ label: 'search', source: 'search' as const }, ...compiledBadges]
      : compiledBadges

    console.log(`[chat] model=${model} maxTokens=${maxTokens} search=${useSearch} topic=${plan.topic} badges=${badges.map(b => b.label).join(',')}`)

    // ── SYSTEM PROMPT ────────────────────────────────────────────────────────
    const outputInstructions = buildOutputInstructions(plan)

    const systemPrompt = `You are Monday, an elite AI market intelligence assistant inside a professional trading dashboard.

Current time: ${etTime}
Current date: ${etDate}
Market status: ${marketStatus}${minutesToClose !== null ? `\nMinutes until market close: ${minutesToClose}` : ''}
Last trading session close: ${lastCloseDayName}

${compiledContext}

IDENTITY:
- Sound like a sharp, knowledgeable trading partner — direct and precise, but human.
- No markdown, no bullets, no headers.
- No filler phrases ("Great question!", "Of course!", "Sure!"). Just the answer.
- Stop the moment the answer is complete.
- Use natural language. Avoid robotic constructions like "22.2x average session level" — say "volume was running about 22 times the typical rate" instead.
- Casual greetings get a warm, one-sentence response. Not "Yes?" — something like "Hey — market's open, what do you want to know?" or similar.

CLOSING PRICE DAY RULE:
- When the user explicitly asks about a specific day's close (e.g. "what did TSLA close at on Tuesday"), answer about that day. Do not substitute the "Last trading session close" label.
- When volunteering a closing price without the user specifying a day, name the weekday using "Last trading session close" above. Never say "yesterday" or "today".
- Correct: "TSLA closed at $423.74 on Tuesday." Wrong: "TSLA closed at $423.74."
- Do not parenthetically correct the user's day-of-week if it is close or a minor slip. If you must clarify, do it naturally, once, at the end.

CORE RULES:
1. Use only facts in the compiled context or web search results. Never invent prices, events, or timestamps.
2. Do not restate the question.
3. Frame bullish/bearish views as scenario analysis, never as advice. Never tell the user to buy, sell, or size a position.
4. For calendar questions, treat HIGH and MEDIUM impact events as market-moving.
5. CALENDAR STRICT RULE: List only events that appear in the ECONOMIC CALENDAR block. Do not add events from training knowledge.
6. INTRADAY DATE RULE: The MARKET DATA block shows the session date. Never state a different date for those candles. Never say candles are unavailable if the block is present.
7. DATE ACCURACY: Trust "Current date" above. Do not derive the date from weekday names or training data.
8. ${useSearch
  ? 'You have the web_search tool — use it proactively. Never say "I can\'t search the web." Never fall back to "data unavailable" when a search can find the answer.'
  : 'Answer from the compiled context. Do not volunteer that data is missing unless it is the direct reason the question cannot be answered at all.'
}

${outputInstructions}`

    // ── BUILD REQUEST ─────────────────────────────────────────────────────────
    const historyMessages = (history as { role: string; content: string }[])
      .slice(useSearch ? -4 : -8)
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 800) }))

    const requestBody: any = {
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [...historyMessages, { role: 'user', content: message.slice(0, 1200) }],
    }
    if (useSearch) requestBody.tools = [{ type: 'web_search_20250305', name: 'web_search' }]

    // ── SHARED RESPONSE METADATA ──────────────────────────────────────────────
    const responseMeta = {
      plan:      { topic: plan.topic, outputFormat: plan.outputFormat },
      badges,
      confidence: useSearch ? 'high' : confidence,
      sessionDate: plan.timeRange.startDate,
      sonnetRemaining: getSonnetRemaining(userKey),
    }

    const normalise = (t: string) => t
      .replace(/\bthis morning\b/gi, 'earlier in the session')
      .replace(/\bthis afternoon\b/gi, 'later in the session')
      .replace(/\bthis evening\b/gi, 'later')

    // ── STREAMING PATH (Haiku, no search) ────────────────────────────────────
    if (!useSearch) {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ ...requestBody, stream: true }),
      })

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text()
        console.error('[chat] Anthropic error:', anthropicRes.status, errText)
        return NextResponse.json({ reply: 'Something went wrong — please try again.' }, { status: 500 })
      }

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          const reader = anthropicRes.body!.getReader()
          const decoder = new TextDecoder()
          let sseBuf = ''
          let fullText = ''

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              sseBuf += decoder.decode(value, { stream: true })
              const lines = sseBuf.split('\n')
              sseBuf = lines.pop() ?? ''

              for (const line of lines) {
                if (!line.startsWith('data: ')) continue
                const json = line.slice(6).trim()
                if (!json) continue
                try {
                  const ev = JSON.parse(json)
                  if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
                    const chunk = ev.delta.text as string
                    fullText += chunk
                    controller.enqueue(encoder.encode(
                      JSON.stringify({ type: 'text', text: chunk }) + '\n'
                    ))
                  }
                } catch { /* skip malformed SSE */ }
              }
            }
          } finally {
            controller.enqueue(encoder.encode(
              JSON.stringify({ type: 'done', fullText: normalise(fullText), ...responseMeta }) + '\n'
            ))
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    // ── NON-STREAMING PATH (Sonnet + search) ─────────────────────────────────
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('[chat] Anthropic error:', anthropicRes.status, errText)
      return NextResponse.json({ reply: 'Something went wrong — please try again.' }, { status: 500 })
    }

    recordSonnetCall(userKey)

    const data = await anthropicRes.json()
    const reply = data.content
      ?.filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim() ?? ''

    const fullText = normalise(reply)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        if (fullText) controller.enqueue(encoder.encode(JSON.stringify({ type: 'text', text: fullText }) + '\n'))
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', fullText, ...responseMeta }) + '\n'))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
    })

  } catch (err: any) {
    console.error('[chat] Error:', err.message)
    return NextResponse.json(
      { reply: 'Error connecting to Monday. Please try again.' },
      { status: 500 },
    )
  }
}
