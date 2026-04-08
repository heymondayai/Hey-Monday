import { NextResponse } from 'next/server'
import {
  computeSignals,
  formatSignals,
  fetchLivePrices,
  fetchIntraday,
  fetchEconomicCalendar,
  fetchInsiderTransactions,
  fetchAnalystRatings,
  fetchOptionsFlow,
  fetchMacroData,
  fetchEarningsCalendar,
  fetchSectorPerformance,
  formatIntradayContext,
  formatEconomicCalendar,
  formatInsiderTransactions,
  formatAnalystRatings,
  formatOptionsFlow,
  formatMacroData,
  formatEarningsCalendar,
  formatSectorPerformance,
  buildIntradayQuestionContext,
} from '@/lib/market-data'
import { buildMarketState, MarketStateSnapshot } from '@/lib/market-state'
import { getNyseEquitiesStatus } from '@/lib/market-hours'

// ── SONNET DAILY CAP ─────────────────────────────────────────────────────────
const sonnetUsage = new Map<string, { count: number; dateET: string }>()
const SONNET_DAILY_CAP = 10

function getTodayET(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

// ── TYPES ────────────────────────────────────────────────────────────────────

interface QuestionIntent {
  requestType: 'briefing' | 'analysis' | 'simple'
  needsInsider: boolean
  needsAnalyst: boolean
  needsOptions: boolean
  needsMacro: boolean
  needsSector: boolean
  needsFilings: boolean
  needsNews: boolean
  needsLevel2: boolean
  mentionsBreaking: boolean
  mentionsExactTimestamp: boolean
  focusSymbol: string | null
  offWatchlistSymbol: string | null
  isCasualConversation: boolean
  isOpenEndedWhyQuestion: boolean
}

interface DataQualityInput {
  message: string
  intent: QuestionIntent
  watchlistTickers: string[]
  prices?: any[]
  news?: any[]
  level2?: any
  intradayData?: any
  marketState?: MarketStateSnapshot | null
  macroFetched: boolean
  sectorFetched: boolean
  insiderFetched: boolean
  analystFetched: boolean
  optionsFetched: boolean
  signals?: any[]
}

type RoutingDecision = 'confident' | 'limited' | 'research'

function extractUppercaseTickerCandidates(message: string): string[] {
  const matches = message.match(/\b[A-Z]{2,6}\b/g) ?? []
  return [...new Set(matches)]
}

function normalizeTimeReference(text: string): string {
  return text
    .replace(/\bthis morning\b/gi, 'earlier in the session')
    .replace(/\bthis afternoon\b/gi, 'later in the session')
    .replace(/\bthis evening\b/gi, 'later')
}

interface IntradayDateRequest {
  startDate?: string
  endDate?: string
  targetDate?: string | null
  isHistorical: boolean
}

function getTodayEtIsoDate(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  })
}

function shiftEtDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function normalizeMonthNameToNumber(month: string): string {
  const map: Record<string, string> = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
  }

  return map[month.toLowerCase()]
}

function parseExplicitEtDate(message: string): string | null {
  const lower = message.toLowerCase()
  const today = getTodayEtIsoDate()
  const currentYear = today.slice(0, 4)

  const match = lower.match(
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i
  )

  if (!match) return null

  const [, monthName, dayRaw, yearRaw] = match
  const month = normalizeMonthNameToNumber(monthName)
  const day = dayRaw.padStart(2, '0')
  const year = yearRaw ?? currentYear

  if (!month) return null

  return `${year}-${month}-${day}`
}

function parseHistoricalIntradayRequest(message: string): IntradayDateRequest {
  const lower = message.toLowerCase()
  const today = getTodayEtIsoDate()

  if (/\btoday\b/.test(lower)) {
    return {
      startDate: today,
      endDate: today,
      targetDate: today,
      isHistorical: false,
    }
  }

  if (/\byesterday\b/.test(lower)) {
    const y = shiftEtDate(today, -1)
    return {
      startDate: y,
      endDate: y,
      targetDate: y,
      isHistorical: true,
    }
  }

  const explicitDate = parseExplicitEtDate(message)
  if (explicitDate) {
    return {
      startDate: explicitDate,
      endDate: explicitDate,
      targetDate: explicitDate,
      isHistorical: explicitDate !== today,
    }
  }

  return {
    startDate: today,
    endDate: today,
    targetDate: today,
    isHistorical: false,
  }
}

function buildSafeFallback(intent: QuestionIntent): string {
  if (intent.requestType === 'simple') {
    return "I don't have that exact data in the current feed."
  }
  return "I don't have enough verified data in the current feed to answer that confidently."
}

function buildResearchCapFallback(intent: QuestionIntent): string {
  if (intent.requestType === 'simple') {
    return "I don't have enough current verified data for that exact answer right now."
  }
  return "I don't have enough verified data in the current feed to answer that confidently, and deeper research is unavailable right now."
}

function slimNewsForResearch(news?: any[]): string {
  if (!news?.length) return ''
  return news
    .slice(0, 3)
    .map((n: any, i: number) => `${i + 1}. [${n.ticker ?? 'MKT'}] ${n.headline}`)
    .join('\n')
}

function slimPricesForResearch(prices?: any[], focusSymbol?: string | null): string {
  if (!prices?.length) return ''
  const prioritized = focusSymbol
    ? [
        ...prices.filter((p: any) => p.sym === focusSymbol),
        ...prices.filter((p: any) => p.sym !== focusSymbol).slice(0, 2),
      ]
    : prices.slice(0, 3)

  return prioritized
    .slice(0, 3)
    .map((p: any) => `${p.sym}: $${p.price ?? '—'} ${p.change ?? ''}`)
    .join('\n')
}

function buildResearchContext(params: {
  focusSymbol: string | null
  prices?: any[]
  news?: any[]
  intradayContext: string
  calendarContext: string
  macroContext: string
  sectorContext: string
  insiderContext: string
  analystContext: string
  optionsContext: string
  level2Context: string
}): string {
  const {
    focusSymbol,
    prices,
    news,
    intradayContext,
    calendarContext,
    macroContext,
    sectorContext,
    insiderContext,
    analystContext,
    optionsContext,
    level2Context,
  } = params

  const chunks = [
    focusSymbol ? `FOCUS SYMBOL:\n${focusSymbol}` : '',
    slimPricesForResearch(prices, focusSymbol) ? `KEY PRICES:\n${slimPricesForResearch(prices, focusSymbol)}` : '',
    slimNewsForResearch(news) ? `TOP NEWS:\n${slimNewsForResearch(news)}` : '',
    calendarContext ? `TODAY'S CALENDAR:\n${calendarContext.slice(0, 900)}` : '',
    macroContext ? `MACRO SNAPSHOT:\n${macroContext.slice(0, 700)}` : '',
    sectorContext ? `SECTOR SNAPSHOT:\n${sectorContext.slice(0, 700)}` : '',
    intradayContext ? `INTRADAY SNAPSHOT:\n${intradayContext.slice(0, 1200)}` : '',
    insiderContext ? `INSIDER DATA:\n${insiderContext.slice(0, 600)}` : '',
    analystContext ? `ANALYST DATA:\n${analystContext.slice(0, 600)}` : '',
    optionsContext ? `OPTIONS DATA:\n${optionsContext.slice(0, 700)}` : '',
    level2Context ? `LEVEL 2 DATA:\n${level2Context.slice(0, 700)}` : '',
  ]

  return chunks.filter(Boolean).join('\n\n')
}

// ── QUESTION INTENT CLASSIFIER ───────────────────────────────────────────────

function classifyIntent(
  message: string,
  watchlist: string[],
  priceSymbols: string[]
): QuestionIntent {
  const lower = message.toLowerCase().trim()

  const briefingKw = [
    'briefing', 'summary', 'recap', 'rundown', 'overview', 'update me',
    'catch me up', 'what happened', 'how did', 'end of day', 'eod',
    'closing', 'pre-market', 'post-market', 'morning', 'afternoon',
    'today overall', 'full picture', 'post market',
  ]

  const simpleKw = [
    'what is the price', "what's the price", 'how much is', 'market open',
    'market closed', 'what time', 'price of', 'where is', 'is nvda up', 'is spy up',
    'what did', 'what was', 'close at', 'closed at', 'open at', 'opened at',
    'how much did', 'what price',
  ]

  const casualConversationPatterns = [
    /^hey monday[!.?]*$/i,
    /^hi monday[!.?]*$/i,
    /^hello monday[!.?]*$/i,
    /^hey[!.?]*$/i,
    /^hi[!.?]*$/i,
    /^hello[!.?]*$/i,
    /^how are you[?.!]*$/i,
    /^hey monday,?\s*how are you[?.!]*$/i,
    /^what's up[?.!]*$/i,
    /^yo[!.?]*$/i,
    /^thanks[!.?]*$/i,
    /^thank you[!.?]*$/i,
    /^good morning[!.?]*$/i,
    /^good afternoon[!.?]*$/i,
  ]

  const isCasualConversation = casualConversationPatterns.some((re) => re.test(lower))
  const isOpenEndedWhyQuestion =
    /^(why|how)\b/.test(lower) ||
    /\bwhy did\b/.test(lower) ||
    /\bwhy is\b/.test(lower) ||
    /\bwhy are\b/.test(lower) ||
    /\bwhat changed\b/.test(lower) ||
    /\bwhat caused\b/.test(lower) ||
    /\bwhat drove\b/.test(lower)

  let requestType: 'briefing' | 'analysis' | 'simple' = 'analysis'

  if (isCasualConversation) {
    requestType = 'simple'
  } else if (briefingKw.some((k) => lower.includes(k))) {
    requestType = 'briefing'
  } else if (
    simpleKw.some((k) => lower.includes(k)) &&
    lower.split(/\s+/).length <= 12 &&
    !isOpenEndedWhyQuestion
  ) {
    requestType = 'simple'
  }

  const needsInsider = /insider|bought|sold|selling|buying|executive|ceo|cfo|officer|director/.test(lower)
  const needsAnalyst = /analyst|rating|price target|upgrade|downgrade|wall street|goldman|morgan|jpmorgan|ubs|citi|bank of america/.test(lower)
  const needsOptions = /option|call|put|unusual|flow|iv|implied vol|gamma|open interest|oi|strike|expir|contracts|derivatives/.test(lower)
  const needsMacro = /macro|fed|fomc|cpi|inflation|yield|treasury|rate|unemployment|gdp|interest rate|10-year|2-year|jobs|payroll|pce|calendar|events|tomorrow|today|scheduled|this week|economic|release|data|high impact|news event/.test(lower)
  const needsSector = /sector|rotation|energy|tech|financials|healthcare|real estate|industrials|utilities|materials|consumer|xlk|xle|xlf|xlv|xlre|xli|xlu|xlb|xly|xlp/.test(lower)
  const needsFilings = /filing|8-k|10-q|10-k|sec|reported|disclosed|announced/.test(lower)
  const needsNews = /news|headline|headlines|why is|why did|why are|catalyst|what happened|what caused|what moved|driver|drivers|what's going on|going on|just dropped|just spiked|just crashed|just moved|dropped fast|spiked fast/.test(lower)
  const needsLevel2 = /level 2|l2|order flow|book|depth|bid stack|ask stack|liquidity|tape|prints|dom/.test(lower)

  const mentionsBreaking = /just|right now|latest|breaking|current|live|today's|just happened|just reported|just announced|news on|what's going on/.test(lower)
  const mentionsExactTimestamp =
  /\bwhen\b|\btime\b|\bwhat time\b|\btimestamp\b|\bexactly when\b|\bat \d/.test(lower) ||
  /\b\d{1,2}:\d{2}\s?(am|pm)\b/.test(lower)

  const knownSymbols = [
    ...watchlist, ...priceSymbols,
    'SPY', 'QQQ', 'IWM', 'DIA', 'AAPL', 'NVDA', 'TSLA', 'META', 'AMD',
    'AMZN', 'MSFT', 'GOOGL', 'BTC', 'ETH', 'GC', 'CL', 'NQ', 'ES',
  ]

  const dedupedKnownSymbols = [...new Set(knownSymbols)]
  const focusSymbol = dedupedKnownSymbols.find((s) => lower.includes(s.toLowerCase())) ?? null

  const stopWords = new Set([
    'THE', 'AND', 'FOR', 'BUT', 'NOT', 'ARE', 'WAS', 'HAS', 'HAD', 'ITS',
    'FROM', 'WITH', 'THIS', 'THAT', 'THEY', 'HAVE', 'WILL', 'BEEN', 'WHAT',
    'HOW', 'WHY', 'CAN', 'DID', 'GET', 'GOT', 'DOES', 'IS', 'IN', 'OF', 'TO',
    'A', 'I', 'AM', 'AT', 'BY', 'DO', 'UP', 'SO', 'ON', 'IF', 'OR', 'BE', 'MY',
    'IT', 'AN', 'AS', 'WE', 'NO', 'US', 'ME', 'HE', 'HIM', 'HER', 'SHE', 'HIS',
    'WHO', 'ALL', 'ANY', 'NOW', 'NEW', 'TOP', 'SET', 'RUN', 'CPI', 'FED', 'GDP',
    'ETF', 'IPO', 'CEO', 'CFO', 'COO', 'SEC', 'USD', 'EUR', 'YTD', 'EOD', 'EOW',
    'AM', 'PM', 'ET', 'EST', 'EDT',
  ])

  const offWatchlistSymbol =
    extractUppercaseTickerCandidates(message).find(
      (sym) => !dedupedKnownSymbols.includes(sym) && !stopWords.has(sym)
    ) ?? null

  return {
    requestType,
    needsInsider,
    needsAnalyst,
    needsOptions,
    needsMacro: needsMacro || requestType === 'briefing',
    needsSector: needsSector || requestType === 'briefing',
    needsFilings,
    needsNews,
    needsLevel2,
    mentionsBreaking,
    mentionsExactTimestamp,
    focusSymbol,
    offWatchlistSymbol,
    isCasualConversation,
    isOpenEndedWhyQuestion,
  }
}

// ── ROUTING DECISION: CAN CURRENT DATA ANSWER THIS? ──────────────────────────

function scoreDataQuality(input: DataQualityInput): { score: number; decision: RoutingDecision; reasons: string[] } {
  const {
    message, intent, watchlistTickers, prices, news,
    level2, intradayData, marketState,
    macroFetched, sectorFetched, insiderFetched, analystFetched, optionsFetched, signals,
  } = input

  let score = 0
  const reasons: string[] = []
  const lower = message.toLowerCase()

  // ── HARD DISQUALIFIERS ────────────────────────────────────────────────────
  if (intent.offWatchlistSymbol) {
    return { score: -10, decision: 'research', reasons: ['off-watchlist symbol with no data'] }
  }
  if (/\b(powell|yellen|jerome|gensler|trump|biden|elon|musk|cook|jensen|huang|zuckerberg|pichai|bezos|dimon)\b/.test(lower)) {
    return { score: -10, decision: 'research', reasons: ['mentions named public figure'] }
  }
  if (/\b(merger|acquisition|buyout|bankruptcy|lawsuit|fda|press release|conference call|earnings call)\b/.test(lower)) {
    return { score: -10, decision: 'research', reasons: ['mentions corporate event'] }
  }
  if (intent.isCasualConversation) {
    return { score: 10, decision: 'confident', reasons: ['casual conversation'] }
  }

  // ── POSITIVE SIGNALS ──────────────────────────────────────────────────────
  const focusPrices = prices?.filter((p: any) =>
    intent.focusSymbol ? p.sym === intent.focusSymbol : watchlistTickers.includes(p.sym)
  ) ?? []
  if (focusPrices.length > 0) { score += 2; reasons.push('+2 live prices present') }

  if (intradayData && Object.keys(intradayData).length > 0) {
    const hasRelevantCandles = intent.focusSymbol
      ? !!intradayData[intent.focusSymbol]?.length
      : Object.values(intradayData).some((c: any) => c?.length > 0)
    if (hasRelevantCandles) { score += 2; reasons.push('+2 intraday candles available') }
  }

  if (signals && signals.length > 0) { score += 1; reasons.push('+1 pre-computed signals available') }

  if (news && news.length > 0) {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    const recentNews = news.filter((n: any) => !n.publishedAt || new Date(n.publishedAt).getTime() > twoHoursAgo)
    if (recentNews.length > 0) { score += 2; reasons.push('+2 recent news present') }
    else { score += 1; reasons.push('+1 older news present') }
  }

  if (marketState) {
    const hasCalendar = Array.isArray(marketState.calendarEvents) && marketState.calendarEvents.length > 0
    const hasMacro = Array.isArray(marketState.macroContext) && marketState.macroContext.length > 0
    if ((intent.needsMacro || intent.requestType === 'briefing') && (hasCalendar || hasMacro)) {
      score += 1; reasons.push('+1 macro/calendar data present')
    }
  }

  if (intent.needsSector && sectorFetched) { score += 1; reasons.push('+1 sector data') }
  if (intent.needsInsider && insiderFetched) { score += 1; reasons.push('+1 insider data') }
  if (intent.needsAnalyst && analystFetched) { score += 1; reasons.push('+1 analyst data') }
  if (intent.needsOptions && optionsFetched) { score += 1; reasons.push('+1 options data') }
  if (intent.needsLevel2 && level2) { score += 2; reasons.push('+2 level 2 data') }

  // ── NEGATIVE SIGNALS ──────────────────────────────────────────────────────
  if (intent.mentionsBreaking) { score -= 3; reasons.push('-3 mentions breaking/realtime event') }
  if (intent.mentionsExactTimestamp && !intradayData) { score -= 3; reasons.push('-3 exact timestamp but no intraday data') }
  if (intent.needsNews && (!news || news.length === 0)) { score -= 2; reasons.push('-2 needs news but feed empty') }
  if (intent.needsLevel2 && !level2) { score -= 2; reasons.push('-2 needs L2 but unavailable') }

  const mentionsKnownWatchlist = watchlistTickers.some((t) => lower.includes(t.toLowerCase()))
  if (!mentionsKnownWatchlist && !intent.focusSymbol && lower.split(' ').length > 6 && /(market|stock|sector|economy|crypto|futures)/.test(lower)) {
    score -= 1; reasons.push('-1 broad market question with no known ticker')
  }

  // ── ROUTING DECISION ──────────────────────────────────────────────────────
  const decision: RoutingDecision = score >= 5 ? 'confident' : score >= 2 ? 'limited' : 'research'
  return { score, decision, reasons }
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
  level2,
  history = [],
  marketState,
  userId,
  mode = 'chat',
} = await req.json() as {
  message: string
  watchlist?: any[]
  traderType?: string
  prices?: any[]
  news?: any[]
  level2?: any
  history?: { role: string; content: string }[]
  marketState?: MarketStateSnapshot | null
  userId?: string
  mode?: 'chat' | 'summary'
}

    const watchlistTickers: string[] = watchlist?.map((s: any) => s.ticker) ?? []
const priceSymbols: string[] = prices?.map((p: any) => p.sym).filter(Boolean) ?? []

const canonicalMarketState =
  marketState ??
  await buildMarketState({
    watchlistTickers: watchlistTickers.length
      ? watchlistTickers
      : priceSymbols.length
        ? priceSymbols
        : ['SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'META', 'AMD'],
    keyNews: (news ?? []).slice(0, 12).map((n: any) => ({
      symbol: n.ticker,
      headline: n.headline,
      source: n.source,
      publishedAt: n.publishedAt,
    })),
  })

const intent = classifyIntent(message, watchlistTickers, priceSymbols)

    const userKey = userId ?? 'anonymous'
    const sonnetAllowed = canUseSonnet(userKey)

    // ── TIME & MARKET STATUS ────────────────────────────────────────────────
    const now = new Date()
    const nyseStatus = getNyseEquitiesStatus(now)
    const marketStatus = nyseStatus.label
    const marketOpen = nyseStatus.session === 'open'
    const preMarket = nyseStatus.session === 'premarket'
    const afterHours = nyseStatus.session === 'afterhours'
    const minutesToClose = nyseStatus.minutesToClose

    const etParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric', minute: '2-digit', hour12: true,
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }).formatToParts(now)

    const etTime = `${etParts.find((p) => p.type === 'hour')?.value}:${etParts.find((p) => p.type === 'minute')?.value} ${(etParts.find((p) => p.type === 'dayPeriod')?.value ?? '').toUpperCase().split('').join(' ')} ET`
    const etDate = `${etParts.find((p) => p.type === 'weekday')?.value}, ${etParts.find((p) => p.type === 'month')?.value} ${etParts.find((p) => p.type === 'day')?.value}, ${etParts.find((p) => p.type === 'year')?.value}`
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    // ── UNIVERSAL FETCHES ────────────────────────────────────────────────────
    const intradaySymbols = watchlistTickers.length
  ? watchlistTickers
  : ['SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'META', 'AMD']

const intradayDateRequest = parseHistoricalIntradayRequest(message)

// ── FRESH PRICE FETCH AT QUESTION TIME ───────────────────────────────────────
// Only fetch fresh prices for realtime/breaking questions, not historical or casual
const needsFreshPrices =
  !intent.isCasualConversation &&
  !intradayDateRequest.isHistorical &&
  (intent.mentionsBreaking || intent.needsNews || intent.focusSymbol != null)

const freshPrices = needsFreshPrices
  ? await fetchLivePrices(
      intent.focusSymbol
        ? [intent.focusSymbol, ...watchlistTickers.filter(t => t !== intent.focusSymbol).slice(0, 4)]
        : watchlistTickers.slice(0, 6)
    )
  : []

const effectivePrices = freshPrices.length ? freshPrices : prices

console.log('[chat intraday date request]', {
  message,
  intradayDateRequest,
})

const calendarToDate = new Date(`${todayStr}T12:00:00`)
calendarToDate.setDate(calendarToDate.getDate() + 45)
const calendarTo = calendarToDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

const [intradayResult, economicEvents, earningsEvents, macroData, sectorData] = await Promise.all([
  fetchIntraday(intradaySymbols, {
    interval: '5min',
    outputsize: intradayDateRequest.isHistorical ? 500 : 100,
    startDate: intradayDateRequest.startDate,
    endDate: intradayDateRequest.endDate,
  }),
  fetchEconomicCalendar(todayStr, calendarTo),
  fetchEarningsCalendar(intradaySymbols, 14),
  fetchMacroData(),
  fetchSectorPerformance(),
])

console.log('[chat intraday fetch result]', {
  requestedDate: intradayDateRequest.targetDate,
  symbols: intradaySymbols,
  debug: intradayResult.debug,
  sampleKeys: Object.keys(intradayResult.data ?? {}),
  firstNvdaCandle: intradayResult.data?.NVDA?.[0] ?? null,
  lastNvdaCandle:
    intradayResult.data?.NVDA?.length
      ? intradayResult.data.NVDA[intradayResult.data.NVDA.length - 1]
      : null,
  economicEventsCount: economicEvents?.length ?? 0,
  earningsEventsCount: earningsEvents?.length ?? 0,
  macroDataKeys: macroData ? Object.keys(macroData) : [],
  sectorDataCount: sectorData?.length ?? 0,
})

    // ── CONDITIONAL SYMBOL-SPECIFIC FETCHES ─────────────────────────────────
    const tier2Promises: Promise<any>[] = []
    const tier2Keys: string[] = []

    if (intent.focusSymbol && intent.needsInsider) { tier2Promises.push(fetchInsiderTransactions(intent.focusSymbol)); tier2Keys.push('insider') }
    if (intent.focusSymbol && intent.needsAnalyst)  { tier2Promises.push(fetchAnalystRatings(intent.focusSymbol)); tier2Keys.push('analyst') }
    if (intent.focusSymbol && intent.needsOptions)  { tier2Promises.push(fetchOptionsFlow(intent.focusSymbol)); tier2Keys.push('options') }

    const tier2Results = await Promise.all(tier2Promises)
    const tier2: Record<string, any> = {}
    tier2Keys.forEach((k, i) => { tier2[k] = tier2Results[i] })

    // ── SIGNAL PRE-COMPUTATION ───────────────────────────────────────────────
    const spyCandles = intradayResult.data['SPY'] ?? []
    const symbolsToSignal = intent.focusSymbol
      ? [intent.focusSymbol]
      : intent.requestType === 'briefing' ? intradaySymbols : [intradaySymbols[0]].filter(Boolean)

    const signals = symbolsToSignal
      .map(sym => computeSignals(sym, intradayResult.data[sym] ?? [], spyCandles))
      .filter((s): s is NonNullable<typeof s> => s !== null)

    const signalsContext = formatSignals(signals)

    // ── ANSWERABILITY DECISION ───────────────────────────────────────────────
    const { score: dataScore, decision: dataDecision, reasons: scoreReasons } = scoreDataQuality({
      message,
      intent,
      watchlistTickers,
      prices: effectivePrices,
      news,
      level2,
      intradayData: intradayResult?.data,
      marketState: canonicalMarketState,
      macroFetched: !!macroData,
      sectorFetched: !!sectorData,
      insiderFetched: !!tier2.insider,
      analystFetched: !!tier2.analyst,
      optionsFetched: !!tier2.options,
      signals,
    })

    console.log(`[chat] data quality score=${dataScore} decision=${dataDecision}`, scoreReasons)

    const currentDataEnough = dataDecision === 'confident' || dataDecision === 'limited'
    const isLimitedData = dataDecision === 'limited'
    const needsResearchButBlocked = dataDecision === 'research' && !sonnetAllowed
    const useLiveSearch = dataDecision === 'research' && sonnetAllowed

    // ── CONTEXT BLOCKS ───────────────────────────────────────────────────────
    const watchlistContext = watchlist.length
      ? `USER WATCHLIST WITH CURRENT PRICES:\n${watchlist.map((s: any) => `  ${s.ticker}: $${s.price ?? '—'} ${s.change ?? ''} ${s.up !== undefined ? (s.up ? '▲ UP' : '▼ DOWN') : ''}`).join('\n')}`
      : ''

    const marketDataContext = prices.length
      ? `LIVE TICKER DATA:\n${prices.map((t: any) => `  ${t.sym}: $${t.price ?? '—'} ${t.change ?? ''}`).join('\n')}`
      : ''

    const newsContext = news.length
      ? `LATEST NEWS FEED:\n${news.slice(0, 10).map((n: any, i: number) => `  ${i + 1}. [${n.ticker ?? 'MKT'}] ${n.headline}${n.ai ? ' | AI Take: ' + n.ai : ''}`).join('\n')}`
      : ''

    const level2Context = level2
      ? `LEVEL 2 / ORDER FLOW DATA:\n${typeof level2 === 'string' ? level2 : JSON.stringify(level2, null, 2)}`
      : ''

    const intradayContext = formatIntradayContext(intradayResult.data)
const exactIntradayQuestionContext = buildIntradayQuestionContext(
  intradayResult.data,
  message,
  intent.focusSymbol,
  intradayDateRequest.targetDate
)
const calendarContext = formatEconomicCalendar(economicEvents, todayStr)
const earningsContext = formatEarningsCalendar(earningsEvents)
const macroContext = formatMacroData(macroData)
const sectorContext = formatSectorPerformance(sectorData)
const insiderContext = tier2.insider ? formatInsiderTransactions(tier2.insider, intent.focusSymbol ?? '') : ''
const analystContext = tier2.analyst ? formatAnalystRatings(tier2.analyst, intent.focusSymbol ?? '') : ''
const optionsContext = tier2.options ? formatOptionsFlow(tier2.options, intent.focusSymbol ?? '') : ''

const marketStateContext = [
  `CANONICAL MARKET SNAPSHOT (${canonicalMarketState.snapshotTime}):`,
  `Market status: ${canonicalMarketState.marketStatus}`,
  canonicalMarketState.summary ? `Summary: ${canonicalMarketState.summary}` : '',
  canonicalMarketState.watchlistSummary?.length
    ? `Watchlist summary:\n${canonicalMarketState.watchlistSummary
        .slice(0, 10)
        .map((w: any) => `  ${w.symbol}: ${w.price ?? '—'} (${w.changePct ?? '—'}%)`)
        .join('\n')}`
    : '',
  canonicalMarketState.calendarEvents?.length
    ? `Economic calendar:\n${canonicalMarketState.calendarEvents
        .slice(0, 40)
        .map((e: any) => `  ${e.name}${e.time ? ` — ${e.time}` : ''}${e.impact ? ` — ${e.impact}` : ''}`)
        .join('\n')}`
    : '',
  canonicalMarketState.earningsEvents?.length
    ? `Earnings calendar:\n${canonicalMarketState.earningsEvents
        .slice(0, 20)
        .map((e: any) => `  ${e.symbol}${e.timing ? ` — ${e.timing}` : ''}`)
        .join('\n')}`
    : '',
  canonicalMarketState.macroContext?.length
    ? `Macro context:\n${canonicalMarketState.macroContext
        .slice(0, 12)
        .map((m: any) => `  ${m.label}: ${m.value}${m.implication ? ` (${m.implication})` : ''}`)
        .join('\n')}`
    : '',
  canonicalMarketState.keyNews?.length
    ? `Key news:\n${canonicalMarketState.keyNews
        .slice(0, 12)
        .map((n: any, i: number) => `  ${i + 1}. [${n.symbol ?? 'MKT'}] ${n.headline}`)
        .join('\n')}`
    : '',
].filter(Boolean).join('\n\n')

const fullContextBlocks = [
  marketStateContext,
  watchlistContext,
  marketDataContext,
  newsContext,
  intradayContext,
  signalsContext,
  exactIntradayQuestionContext,
  calendarContext,
  earningsContext,
  macroContext,
  sectorContext,
  level2Context,
  insiderContext,
  analystContext,
  optionsContext,
].filter(Boolean).join('\n\n')

    const researchContextBlocks = buildResearchContext({
      focusSymbol: intent.focusSymbol, prices, news,
      intradayContext, calendarContext, macroContext, sectorContext,
      insiderContext, analystContext, optionsContext, level2Context,
    })

    const traderLens =
      traderType === 'day'
        ? 'USER IS A DAY TRADER: Focus intraday. Mention momentum, VWAP, HOD/LOD, liquidity, same-day catalysts, and session context.'
        : traderType === 'longterm'
          ? 'USER IS A LONG-TERM INVESTOR: Focus on fundamentals, macro, earnings, and longer-term thesis.'
          : 'USER IS A SWING TRADER: Focus on 3-day to 3-month setups, catalysts, sector rotation, and key technical context.'

    // ── LENGTH RULES ─────────────────────────────────────────────────────────
    // IMPORTANT: These are hard limits. Do not exceed them under any circumstances.
    const lengthRules = mode === 'summary'
      ? `
SUMMARY RESPONSE RULES (HARD LIMITS):
- Maximum 4 sentences total. No exceptions.
- Sentence 1: The single most important move or theme with a number (e.g. "TSLA fell 3.18% to $380.30, the session's biggest mover on your list.").
- Sentence 2: One other notable move or macro data point if directly relevant.
- Sentence 3: One key catalyst or risk driving the action.
- Sentence 4 (optional): One forward-looking note only if it adds real value.
- Do NOT include: intraday ranges, volume commentary, multiple catalysts, multiple news items, analyst detail, or anything that does not directly change the summary conclusion.
- If you find yourself writing more than 4 sentences, cut the least important one.
`
      : intent.isCasualConversation
        ? `
RESPONSE RULES: Reply in 1 short sentence. Warm and brief. No market data unless asked.
`
        : intent.requestType === 'simple'
          ? `
RESPONSE RULES (HARD LIMITS):
- Answer in exactly 1 sentence with the specific number or fact asked for.
- Add a 2nd sentence ONLY if it directly changes how the user should interpret the first (e.g. "That's down 3.2% on the day.").
- Do NOT add: intraday range, volume, news context, analyst commentary, macro color, or any other unsolicited detail.
- The user asked a simple question. Give a simple answer. Stop.
`
          : intent.isOpenEndedWhyQuestion || intent.mentionsExactTimestamp
  ? `
RESPONSE RULES:
- Answer in 2-3 sentences maximum.
- If the user asked about an exact time or candle, first identify the 5-minute candle interval that contains that ET timestamp on the requested ET date.
- If the user specified a past date and candles for that date are present, answer from that historical session instead of saying only today's candles are available.
- State the containing interval clearly, for example "12:35pm on 2026-03-31 falls inside the 12:35pm-12:40pm ET candle."
- Then give the OHLC result in plain English and describe whether that candle was up, down, or roughly neutral.
- If the requested ET date is not present in the current feed, say that exact date is not available in the current intraday dataset.
- If the user asked "why did it drop" or "what happened," analyze the broader move window, not a single candle in isolation.
- Do not say a stock rallied just because one candle was green if the surrounding move was down.
- If no clear catalyst is present in the supplied data, say there is no clear catalyst in the current feed.
- Stop after the direct answer.
`
            : useLiveSearch
              ? `
RESPONSE RULES:
- 2–3 sentences maximum.
- Answer first, then one supporting fact only if it changes the answer.
- No filler, no restating the question, no extra color.
`
              : intent.requestType === 'briefing'
                ? `
RESPONSE RULES (HARD LIMITS):
- Maximum 3 sentences.
- Sentence 1: Biggest theme with a number.
- Sentence 2: Top mover or catalyst.
- Sentence 3: One key risk or forward note. Then stop.
`
                : `
RESPONSE RULES:
- 1–2 sentences. Answer the question. Stop.
- Include only facts that directly answer what was asked.
`

    const contextBlocks = useLiveSearch ? researchContextBlocks : fullContextBlocks

    // ── SYSTEM PROMPT ────────────────────────────────────────────────────────
    const systemPrompt = `You are Monday, an elite AI market intelligence assistant inside a professional trading dashboard.

Current time: ${etTime}
Current date: ${etDate}
Market status: ${marketStatus}${minutesToClose !== null ? `\nMinutes until market close: ${minutesToClose}` : ''}

${contextBlocks}

${traderLens}

IDENTITY:
- Be direct, fast, and precise. You are a terminal, not a newsletter.
- Simple questions get one-sentence answers. Period.
- Never volunteer information the user did not ask for.
- No markdown, no bullets, no headers.
- Stop the moment the answer is complete.

CORE RULES:
1. Use only facts in the supplied data. Never invent prices, events, or timestamps.
2. Do not restate the question.
3. Do not add unsolicited macro color, volume commentary, or analyst context to simple factual questions.
4. Frame bullish/bearish views as scenario analysis, never as advice.
5. Never tell the user to buy, sell, or size a position.
6. If data is missing, say so in one sentence and stop.
7. For calendar questions, treat HIGH and MEDIUM impact events as market-moving. Do not say "no high impact events" if MEDIUM impact events exist — list them.
8. Treat the CANONICAL MARKET SNAPSHOT as the primary source of truth for upcoming economic events, calendar timing, macro context, and key headlines.
9. Do not claim that tomorrow's or future events are unavailable if they appear in the canonical market snapshot.
10. When asked for the next event, upcoming event, or next high-impact event, answer from the canonical market snapshot first.
11. For exact intraday timestamp questions, use the matched candle nearest that ET time and state whether it was exact or nearest.
12. For move questions like "why did it drop" or "what happened from 1:06 to 2:40", analyze the move across the whole requested window, not one candle in isolation.
13. Never describe the move as bullish or a rally if the broader requested move window was down.
14. If the current feed does not show a clear catalyst, say there is no clear catalyst in the current feed rather than inventing one.
15. When using web search, only report facts from actual search results. If search returns no clear results about a specific real-time event, say the search did not surface a clear catalyst rather than inventing one. Never fabricate prices, dates, people, or events.
${isLimitedData ? `\n16. DATA QUALITY FLAG: The available data for this question is incomplete or may be stale. Answer from what is available but add a brief note that data may be limited. Do not fabricate missing data points.` : ''}

${lengthRules}`

    // ── SHORT-CIRCUIT WHEN RESEARCH BLOCKED ─────────────────────────────────
    if (needsResearchButBlocked) {
      return NextResponse.json({
        reply: buildResearchCapFallback(intent),
        grounded: true, usedResearch: false, currentDataEnough: false,
        sonnetRemaining: getSonnetRemaining(userKey),
      })
    }

    // ── CALL MODEL ───────────────────────────────────────────────────────────
    const historyMessages = (history as { role: string; content: string }[])
      .slice(useLiveSearch ? -4 : -8)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: useLiveSearch ? m.content.slice(0, 500) : m.content.slice(0, 800),
      }))

    const model = useLiveSearch ? 'claude-sonnet-4-5' : 'claude-haiku-4-5-20251001'

    // Token limits — kept tight to enforce brevity
    const maxTokens = useLiveSearch
      ? mode === 'summary' ? 200 : 140
      : mode === 'summary'
        ? 160
        : intent.isCasualConversation ? 50
        : intent.requestType === 'simple' ? 60
        : intent.isOpenEndedWhyQuestion ? 120
        : intent.requestType === 'briefing' ? 130
        : intent.needsMacro ? 250 : 100

    const requestBody: any = {
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [...historyMessages, { role: 'user', content: message.slice(0, 1200) }],
    }

    if (useLiveSearch) {
      requestBody.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
    }

    console.log(
      `[chat] routing → ${useLiveSearch ? `SONNET+search (${getSonnetRemaining(userKey)} left)` : 'HAIKU'} | enough_data=${currentDataEnough} | type=${intent.requestType} | max_tokens=${maxTokens}`
    )

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[chat] Anthropic error:', response.status, errText)
      return NextResponse.json({ reply: 'Something went wrong — please try again.' }, { status: 500 })
    }

    if (useLiveSearch) recordSonnetCall(userKey)

    const data = await response.json()

    const reply = data.content
      ?.filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim()

    if (!reply) {
      console.error('[chat] No text block. Types:', data.content?.map((b: any) => b.type))
      return NextResponse.json({
        reply: currentDataEnough ? 'No response generated — please try again.' : buildSafeFallback(intent),
        grounded: false, usedResearch: useLiveSearch, currentDataEnough,
        sonnetRemaining: getSonnetRemaining(userKey),
      })
    }

    return NextResponse.json({
      reply: normalizeTimeReference(reply),
      grounded: true, usedResearch: useLiveSearch, currentDataEnough,
      sonnetRemaining: getSonnetRemaining(userKey),
    })
  } catch (err: any) {
    console.error('[chat] Error:', err.message)
    return NextResponse.json({ reply: 'Error connecting to Monday. Please try again.' }, { status: 500 })
  }
}