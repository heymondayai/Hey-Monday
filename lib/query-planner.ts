// Stage 1 of the two-stage chat pipeline.
// A cheap Haiku call reads the user question and outputs a structured JSON plan
// that tells the compiler exactly what data to fetch and how to compile it.

export type TopicType =
  | 'intraday'       // candle questions, time-range price action
  | 'price'          // current price / today's simple move
  | 'news_catalyst'  // why did it move, what's driving it
  | 'macro'          // economic calendar, fed, rates
  | 'earnings'       // earnings calendar / results
  | 'options'        // options flow, unusual activity
  | 'insider'        // insider buying/selling
  | 'analyst'        // ratings, price targets, upgrades
  | 'briefing'       // eod briefing, session recap, catch me up
  | 'sector'         // sector rotation / performance
  | 'technical'      // signals, momentum, technical levels
  | 'historical'     // specific past date
  | 'casual'         // greeting / non-market chat

export type DataFetchType =
  | 'candles'
  | 'live_prices'
  | 'news'
  | 'macro'
  | 'calendar'
  | 'earnings_calendar'
  | 'sector'
  | 'insider'
  | 'analyst'
  | 'options'
  | 'historical_context'
  | 'market_state'

export type CompileStep =
  | 'session_summary'        // open→close, HOD/LOD, VWAP, total volume
  | 'candle_range_detail'    // full OHLCV listing for the requested time window
  | 'biggest_move'           // largest % candle in the window + context
  | 'volume_spikes'          // candles with volume > 2× avg
  | 'momentum_score'         // trend direction from last 5 candles
  | 'news_price_correlation' // map news timestamps to price moves

export interface TimeRange {
  type: 'session' | 'range' | 'specific_date' | 'yesterday' | 'week' | 'month'
  startDate: string    // YYYY-MM-DD ET
  endDate: string      // YYYY-MM-DD ET
  startTime?: string   // HH:MM 24h ET — only for intraday range questions
  endTime?: string     // HH:MM 24h ET
}

export interface QueryPlan {
  topic: TopicType
  symbols: string[]
  timeRange: TimeRange
  fetch: DataFetchType[]
  compile: CompileStep[]
  outputFormat: 'prose' | 'candle_list' | 'summary' | 'one_liner' | 'briefing'
  detailLevel: 'brief' | 'standard' | 'detailed'
  maxTokens: number
  isHistorical: boolean
  requiresSearch: boolean
}

// ── PLANNER SYSTEM PROMPT ─────────────────────────────────────────────────────

const PLANNER_SYSTEM = `You are a query planner for a stock market AI assistant. Output ONLY a valid JSON object — no explanation, no markdown fences, just raw JSON.

Schema:
{
  "topic": intraday|price|news_catalyst|macro|earnings|options|insider|analyst|briefing|sector|technical|historical|casual,
  "symbols": [uppercase ticker strings — include watchlist tickers for general market questions],
  "timeRange": {
    "type": session|range|specific_date|yesterday|week|month,
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "startTime": "HH:MM" (24h ET, only if question specifies a start time),
    "endTime": "HH:MM" (24h ET, only if question specifies an end time)
  },
  "fetch": [candles|live_prices|news|macro|calendar|earnings_calendar|sector|insider|analyst|options|historical_context|market_state],
  "compile": [session_summary|candle_range_detail|biggest_move|volume_spikes|momentum_score|news_price_correlation],
  "outputFormat": prose|candle_list|summary|one_liner|briefing,
  "detailLevel": brief|standard|detailed,
  "maxTokens": integer,
  "isHistorical": boolean,
  "requiresSearch": boolean
}

TOPIC RULES:
- "show/list/give me candles" → intraday, compile:[candle_range_detail], outputFormat:candle_list
- "what happened to X today/this session" → intraday, compile:[session_summary,biggest_move], outputFormat:prose
- "why did X move/drop/spike/rally" → news_catalyst, fetch:[candles,news], compile:[biggest_move,news_price_correlation], requiresSearch:true
- "what is the price / where is X" → price, fetch:[live_prices], compile:[], outputFormat:one_liner
- "briefing/summary/recap/how did market do" → briefing, fetch:[candles,live_prices,news,sector,macro,market_state], compile:[session_summary,biggest_move], outputFormat:briefing
- macro/calendar/events/fed/cpi → macro, fetch:[calendar,macro,market_state], compile:[]
- earnings → earnings, fetch:[earnings_calendar], compile:[]
- insider → insider, fetch:[insider], compile:[]
- analyst/rating/target → analyst, fetch:[analyst], compile:[]
- options/flow/calls/puts → options, fetch:[options], compile:[]
- greeting/casual → casual, fetch:[], compile:[], outputFormat:one_liner

TOKEN BUDGET:
- casual/one_liner: 50
- price/simple: 80
- prose/summary (1-2 sentences): 130
- candle_list (per-candle detail): 240
- briefing/detailed: 320
- news_catalyst with search: 280

FETCH RULES — only include what the question actually needs:
- Candle questions always need "candles"
- "Why" / catalyst questions need "candles" + "news" + requiresSearch:true
- General market questions: include all watchlist tickers in symbols
- Historical questions (specific past date): isHistorical:true
- Today / this session: isHistorical:false

TIME RULES:
- "today" / "this session" / no date → type:session, startDate and endDate = today
- "from 3:30 to 4pm" → type:range, startTime:"15:30", endTime:"16:00"
- "from 10am to noon" → type:range, startTime:"10:00", endTime:"12:00"
- "yesterday" → type:yesterday, isHistorical:true
- specific date like "June 2nd" → type:specific_date, isHistorical: true only if date ≠ today`

// ── PLANNER CALL ─────────────────────────────────────────────────────────────

export async function planQuery(
  message: string,
  watchlistTickers: string[],
  todayEt: string,
  marketStatus: string,
): Promise<QueryPlan | null> {
  const userContent =
    `Today (ET): ${todayEt}\nMarket: ${marketStatus}\nWatchlist: ${watchlistTickers.slice(0, 12).join(', ')}\n\nQuestion: ${message}`

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
        max_tokens: 320,
        system: PLANNER_SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!res.ok) {
      console.error('[planner] HTTP', res.status)
      return null
    }

    const data = await res.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text?.trim() ?? ''
    // Strip accidental markdown fences
    const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const plan = JSON.parse(jsonText) as QueryPlan
    console.log('[planner]', JSON.stringify(plan))
    return plan
  } catch (e: any) {
    console.error('[planner] failed:', e.message)
    return null
  }
}

// ── FALLBACK PLAN ─────────────────────────────────────────────────────────────
// Used when the planner call fails — behaves like the old "fetch everything" approach.

export function buildFallbackPlan(
  message: string,
  watchlistTickers: string[],
  todayEt: string,
): QueryPlan {
  const lower = message.toLowerCase()
  const isCasual = /^(hey|hi|hello|thanks|good morning|good afternoon|what's up|yo)\b/.test(lower)
  const isBriefing = /briefing|summary|recap|rundown|how did|what happened|end of day|eod/.test(lower)
  const isCandle = /candle|ohlc|open.*close|from \d/.test(lower)
  const isPrice = /price|where is|how much/.test(lower) && lower.split(' ').length < 8

  return {
    topic: isCasual ? 'casual' : isBriefing ? 'briefing' : isCandle ? 'intraday' : isPrice ? 'price' : 'intraday',
    symbols: watchlistTickers,
    timeRange: { type: 'session', startDate: todayEt, endDate: todayEt },
    fetch: isCasual ? [] : isBriefing
      ? ['candles', 'live_prices', 'news', 'macro', 'calendar', 'sector', 'market_state']
      : ['candles', 'live_prices', 'news', 'market_state'],
    compile: isCasual ? [] : isBriefing
      ? ['session_summary', 'biggest_move']
      : isCandle ? ['candle_range_detail'] : ['session_summary', 'biggest_move'],
    outputFormat: isCasual ? 'one_liner' : isBriefing ? 'briefing' : isCandle ? 'candle_list' : 'prose',
    detailLevel: isBriefing ? 'detailed' : 'standard',
    maxTokens: isCasual ? 50 : isBriefing ? 320 : isCandle ? 240 : 130,
    isHistorical: false,
    requiresSearch: false,
  }
}
