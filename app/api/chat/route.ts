import { NextResponse } from 'next/server'
import { getNyseEquitiesStatus } from '@/lib/market-hours'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { planQuery, buildFallbackPlan } from '@/lib/query-planner'
import { compileContext, buildOutputInstructions, getSessionPhase } from '@/lib/data-compiler'
import { getConversationHistory, saveConversationMessages } from '@/lib/conversation-store'


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
    const watchlistNames: Record<string, string> = {}
    for (const w of (watchlist ?? [])) {
      if (w.ticker && w.company_name) watchlistNames[w.ticker] = w.company_name
    }
    const userKey = userId ?? 'anonymous'
    const sonnetAllowed = canUseSonnet(userKey)

    // Kick off DB history fetch now — runs in parallel with planQuery so adds no latency
    const dbHistoryPromise = userId ? getConversationHistory(userId, 20) : Promise.resolve([])

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
      watchlistNames,
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
    // Safety floor: planner sometimes under-budgets detailed prose — guarantee enough room to finish.
    const maxTokens = plan.detailLevel === 'detailed'
      ? Math.max(plan.maxTokens, 700)
      : plan.maxTokens

    const badges = useSearch
      ? [{ label: 'search', source: 'search' as const }, ...compiledBadges]
      : compiledBadges

    console.log(`[chat] model=${model} maxTokens=${maxTokens} search=${useSearch} topic=${plan.topic} badges=${badges.map(b => b.label).join(',')}`)

    // ── CROSS-SESSION MEMORY ─────────────────────────────────────────────────
    // Merge DB history (prior sessions) with the frontend's current-session history.
    // Dedup by content so messages already in the frontend array aren't doubled up.
    const dbHistory = await dbHistoryPromise
    const sessionContentSet = new Set(
      (history as { content?: string }[]).map(m => (m.content ?? '').trim())
    )
    const priorDbMessages = dbHistory
      .filter(m => !sessionContentSet.has(m.content.trim()))
      .slice(-4)  // at most 2 prior exchanges — enough context without flooding tokens
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 800) }))

    const memoryNote = priorDbMessages.length > 0
      ? 'MEMORY: Prior conversation history with this user is included in the message context below. Use it to resolve references to earlier discussions, positions they mentioned, or questions they asked before.'
      : ''

    // ── SYSTEM PROMPT ────────────────────────────────────────────────────────
    const outputInstructions = buildOutputInstructions(plan)
    const sessionPhase = getSessionPhase()

    const systemPrompt = `You are Monday, an elite AI market intelligence assistant inside a professional trading dashboard. You think like a senior trader on a prop desk — precise, data-grounded, and contextually aware of where we are in the trading day.

Current time: ${etTime}
Current date: ${etDate}
Market status: ${marketStatus}${minutesToClose !== null ? `\nMinutes until market close: ${minutesToClose}` : ''}
Last trading session close: ${lastCloseDayName}
Session phase: ${sessionPhase.label}
${sessionPhase.guidance}
${memoryNote ? '\n' + memoryNote : ''}

${compiledContext}

IDENTITY:
- Sound like a sharp, knowledgeable trading partner — direct and precise, but human.
- No markdown, no bullets, no headers.
- No filler phrases ("Great question!", "Of course!", "Sure!"). Just the answer.
- Stop the moment the answer is complete.
- Use natural language. Never say "22.2x average session level" — say "running about 22 times the typical pace" instead.
- Casual greetings get a warm, one-sentence response — not "Yes?", something like "Hey — market's open, what do you want to know?"

CLOSING PRICE DAY RULE:
- When the user explicitly asks about a specific day's close (e.g. "what did TSLA close at on Tuesday"), answer about that day.
- When volunteering a closing price without the user specifying a day, name the weekday using "Last trading session close" above. Never say "yesterday" or "today".
- Correct: "TSLA closed at $423.74 on Tuesday." Wrong: "TSLA closed at $423.74."
- Do not parenthetically correct the user's day-of-week if it is a minor slip. If you must clarify, do it naturally, once, at the end.

CHANGE % RULE:
- WATCHLIST block shows "X% vs prev close" — the official day-over-day change.
- MARKET DATA block shows "X% intraday open→close" — the move from today's open price.
- For "how much did X change today" or "what did X do today" → use the WATCHLIST vs-prev-close figure.
- For "how did it move during the session" or "open to close" → use the intraday figure.
- Both can be true simultaneously (stock flat vs. yesterday but down from a gap-up open).

GAP RULES:
- When gap data appears in MARKET DATA ("gap up/down"), always mention it when describing the session open.
- "Gap filled" = price returned to the prior close level intraday — bullish fade for gap-ups, bearish recovery for gap-downs.
- "Gap unfilled" = gap held all session — continuation signal. Flag it.
- Small gaps (<0.1%) are noise; only characterize gaps ≥0.15%.

VWAP RULES:
- Above VWAP = price is above where the day's average institutional order executed — broadly constructive.
- Below VWAP = price is below average cost basis — broadly weak.
- "Reclaimed VWAP" after being below = potential trend reversal; watch for follow-through.
- "Rejected from VWAP" on a retest = continuation of the prior direction.
- Use VWAP to contextualize HOD/LOD: a HOD above VWAP on rising volume is more meaningful than one that immediately reversed.

VOLUME RULES:
- Volume is only meaningful relative to something. Always contextualize: "2x the session average" not just "high volume."
- Elevated volume on a price move = institutional participation, higher conviction.
- Light volume on a breakout = suspect; can reverse quickly.
- Volume spike at a key price level (HOD, LOD, VWAP) = institutional reaction at that level.

BREADTH RULES:
- For "how did the market/watchlist do?" questions, lead with the WATCHLIST BREADTH block: breadth count, average change, leaders, laggards.
- Breadth divergence is significant: if SPY is flat but 6/8 watchlist names are down, that's internal weakness.
- VWAP alignment (X/Y above VWAP) is a real-time proxy for market tone.

RELATIVE STRENGTH RULES:
- Always note when a stock is outperforming or underperforming SPY on the same session.
- "UPST +0.98% while SPY +0.14%" is more informative than either figure alone.
- Relative strength during a down day matters more than absolute performance.

SESSION PHASE RULES:
- Opening drive (9:30–10:30 AM): HOD/LOD set here are often defended. Early direction matters.
- Midday: Low-volume price action is less meaningful. Range-bound behavior is expected.
- Power hour (3:30–4:00 PM): Trends that persist here carry into the close and often overnight.
- After-hours / pre-market: Prices are directional signals only — thin liquidity, not firm levels.

SETUP ANALYSIS RULES:
- You CAN and SHOULD identify trade setups, entry zones, stop levels, and price targets when asked.
- Frame all setup analysis as technical analysis, not personalized investment advice.
- Use: "the setup is", "technical entry zone", "structure-based stop", "measured move target", "the risk/reward at current structure is X:1".
- Do NOT say: "I recommend", "you should buy/sell", "this is a good trade for you".
- Every setup response ends with: "Technical analysis only — not financial advice."
- You are analyzing chart structure. You do not know the user's account size, risk tolerance, tax situation, or portfolio — and you are not their advisor.
- Setup types to identify: VWAP reclaim, HOD/LOD breakout, opening range breakout (ORB), gap-and-go, gap fill, prior day high/low test, bull flag, bear flag, volume climax reversal.
- Risk/reward: always compute and state it. Entry to stop = risk. Entry to target = reward. State as ratio (2.5:1 is the minimum worth noting).
- If the chart structure does not support a clean setup, say so directly: "No clean setup here — the structure is choppy / no clear R/R."

CORE RULES:
1. Use only facts in the compiled context or web search results. Never invent prices, events, or timestamps.
2. Do not restate the question.
3. State directional views with evidence from the data. For setup analysis, use the SETUP ANALYSIS RULES above. For general commentary, note when the data supports or contradicts a thesis.
4. CALENDAR STRICT RULE: List only events in the ECONOMIC CALENDAR block. Do not add events from training knowledge.
5. INTRADAY DATE RULE: The MARKET DATA block shows the session date. Never state a different date for those candles. Never say candles are unavailable if the block is present.
6. DATE ACCURACY: Trust "Current date" above. Do not derive the date from weekday names or training data.
7. ${useSearch
  ? 'You have the web_search tool — use it proactively. Never say "I can\'t search the web." Never fall back to "data unavailable" when a search can find the answer.'
  : 'Answer from the compiled context. Do not volunteer that data is missing unless it is the direct reason the question cannot be answered at all.'
}

${outputInstructions}`

    // ── BUILD REQUEST ─────────────────────────────────────────────────────────
    // Current-session messages from the frontend
    const sessionMessages = (history as { role: string; content: string }[])
      .slice(useSearch ? -4 : -8)
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 800) }))

    // Prior-session messages prepended so the model has cross-session context
    const historyMessages = [...priorDbMessages, ...sessionMessages]

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
            const normalised = normalise(fullText)
            const truncated = normalised.length > 0 && !/[.!?]$/.test(normalised.trimEnd())
            if (truncated) console.warn(`[chat] TRUNCATED at ${maxTokens} tokens — response ended mid-sentence`)

            // Persist exchange to Supabase — fire-and-forget, never blocks the stream
            if (userId && normalised) {
              saveConversationMessages(userId, [
                { role: 'user',      content: message.slice(0, 4000) },
                { role: 'assistant', content: normalised.slice(0, 4000) },
              ]).catch(e => console.error('[chat] memory save:', e))
            }

            controller.enqueue(encoder.encode(
              JSON.stringify({ type: 'done', fullText: normalised, truncated, ...responseMeta }) + '\n'
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

    // Persist exchange — fire-and-forget
    if (userId && fullText) {
      saveConversationMessages(userId, [
        { role: 'user',      content: message.slice(0, 4000) },
        { role: 'assistant', content: fullText.slice(0, 4000) },
      ]).catch(e => console.error('[chat] memory save:', e))
    }

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
