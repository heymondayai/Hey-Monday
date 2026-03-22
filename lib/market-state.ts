import {
  fetchEconomicCalendar,
  fetchEarningsCalendar,
  fetchIntraday,
  fetchMacroData,
  fetchSectorPerformance,
  Candle,
  EconomicEvent,
  EarningsEvent,
  MacroData,
  SectorPerformance,
} from '@/lib/market-data'

export interface MarketMover {
  symbol: string
  price: number | null
  changePct: number | null
  direction: 'up' | 'down'
}

export interface MarketSectorMove {
  name: string
  changePct: number | null
}

export interface MarketMacroItem {
  label: string
  value: string
  implication?: string
}

export interface MarketCalendarItem {
  time?: string
  name: string
  impact?: string
}

export interface MarketEarningsItem {
  symbol: string
  name?: string
  timing?: string
}

export interface MarketNewsItem {
  symbol?: string
  headline: string
  source?: string
  publishedAt?: string
}

export interface MarketWatchlistItem {
  symbol: string
  price: number | null
  changePct: number | null
}

export interface MarketStateSnapshot {
  snapshotTime: string
  marketStatus: string
  topMovers: MarketMover[]
  sectorLeaders: MarketSectorMove[]
  sectorLaggards: MarketSectorMove[]
  macroContext: MarketMacroItem[]
  calendarEvents: MarketCalendarItem[]
  earningsEvents: MarketEarningsItem[]
  keyNews: MarketNewsItem[]
  watchlistSummary: MarketWatchlistItem[]
  summary: string
  rawPayload: Record<string, unknown>
}

function getMarketStatus(): string {
  const now = new Date()
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const hour = parseInt(etParts.find((p) => p.type === 'hour')?.value || '0')
  const minute = parseInt(etParts.find((p) => p.type === 'minute')?.value || '0')
  const totalMinutes = hour * 60 + minute

  const preMarketStart = 4 * 60
  const regularOpen = 9 * 60 + 30
  const regularClose = 16 * 60
  const afterHoursClose = 20 * 60

  if (totalMinutes >= regularOpen && totalMinutes < regularClose) return 'MARKET IS OPEN'
  if (totalMinutes >= preMarketStart && totalMinutes < regularOpen) return 'PRE-MARKET SESSION'
  if (totalMinutes >= regularClose && totalMinutes < afterHoursClose) return 'AFTER-HOURS SESSION'
  return 'MARKET IS CLOSED'
}

function getTodayStrET(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  })
}

function safeNum(value: unknown): number | null {
  const n = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) ? n : null
}

function buildMoversFromIntraday(data: Record<string, Candle[]>): MarketMover[] {
  const movers: MarketMover[] = []

  for (const [symbol, candles] of Object.entries(data)) {
    if (!candles?.length) continue

    const first = candles[0]
    const last = candles[candles.length - 1]

    const open = safeNum(first.open)
    const close = safeNum(last.close)

    if (open == null || close == null || open === 0) continue

    const changePct = ((close - open) / open) * 100

    movers.push({
      symbol,
      price: close,
      changePct: Number(changePct.toFixed(2)),
      direction: changePct >= 0 ? 'up' : 'down',
    })
  }

  return movers.sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
}

function pickTopMovers(movers: MarketMover[], limit: number = 5): MarketMover[] {
  return movers.slice(0, limit)
}

function pickWatchlistSummary(movers: MarketMover[], limit: number = 8): MarketWatchlistItem[] {
  return movers.slice(0, limit).map((m) => ({
    symbol: m.symbol,
    price: m.price,
    changePct: m.changePct,
  }))
}

function normalizeSectorPerformance(sectors: SectorPerformance[]): {
  leaders: MarketSectorMove[]
  laggards: MarketSectorMove[]
} {
  const normalized = sectors
    .map((s) => ({
      name: s.sector,
      changePct: safeNum(String(s.change).replace('%', '')),
    }))
    .filter((s) => s.changePct !== null) as MarketSectorMove[]

  const leaders = [...normalized].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0)).slice(0, 3)
  const laggards = [...normalized].sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0)).slice(0, 3)

  return { leaders, laggards }
}

function normalizeMacroContext(macro: MacroData): MarketMacroItem[] {
  const items: MarketMacroItem[] = []

  if (macro.tenYearYield) {
    items.push({
      label: '10Y Treasury Yield',
      value: `${macro.tenYearYield}%`,
      implication: 'Higher yields can pressure growth stocks',
    })
  }

  if (macro.twoYearYield) {
    items.push({
      label: '2Y Treasury Yield',
      value: `${macro.twoYearYield}%`,
    })
  }

  if (macro.yieldSpread) {
    const spread = safeNum(macro.yieldSpread)
    items.push({
      label: '10Y-2Y Spread',
      value: `${macro.yieldSpread}%`,
      implication: spread != null && spread < 0 ? 'Inverted curve can signal macro caution' : 'Positive curve is less restrictive',
    })
  }

  if (macro.fedFundsRate) {
    items.push({
      label: 'Fed Funds Rate',
      value: `${macro.fedFundsRate}%`,
    })
  }

  if (macro.unemploymentRate) {
    items.push({
      label: 'Unemployment Rate',
      value: `${macro.unemploymentRate}%`,
    })
  }

  if (macro.cpiYoY) {
    items.push({
      label: 'CPI Index',
      value: macro.cpiYoY,
    })
  }

  return items
}

function normalizeCalendarEvents(events: EconomicEvent[], todayStr: string): MarketCalendarItem[] {
  return events
    .filter((e) => e.date >= todayStr)
    .slice(0, 6)
    .map((e) => ({
      time: e.time ? `${e.date} ${e.time} ET` : e.date,
      name: e.event,
      impact: e.impact,
    }))
}

function normalizeEarningsEvents(events: EarningsEvent[]): MarketEarningsItem[] {
  return events.slice(0, 8).map((e) => ({
    symbol: e.symbol,
    timing:
      e.time === 'bmo'
        ? `Before open on ${e.date}`
        : e.time === 'amc'
        ? `After close on ${e.date}`
        : `${e.date} ${e.time}`,
  }))
}

function buildRuleBasedSummary(params: {
  marketStatus: string
  topMovers: MarketMover[]
  sectorLeaders: MarketSectorMove[]
  sectorLaggards: MarketSectorMove[]
  calendarEvents: MarketCalendarItem[]
  macroContext: MarketMacroItem[]
}): string {
  const { marketStatus, topMovers, sectorLeaders, sectorLaggards, calendarEvents, macroContext } = params

  const lines: string[] = []

  lines.push(marketStatus)

  if (sectorLeaders.length) {
    const leader = sectorLeaders[0]
    lines.push(
      `${leader.name} is leading${leader.changePct != null ? ` at ${leader.changePct > 0 ? '+' : ''}${leader.changePct.toFixed(2)}%` : ''}.`
    )
  }

  if (sectorLaggards.length) {
    const laggard = sectorLaggards[0]
    lines.push(
      `${laggard.name} is lagging${laggard.changePct != null ? ` at ${laggard.changePct > 0 ? '+' : ''}${laggard.changePct.toFixed(2)}%` : ''}.`
    )
  }

  if (topMovers.length) {
    const mover = topMovers[0]
    lines.push(
      `${mover.symbol} is one of the biggest movers${mover.changePct != null ? ` at ${mover.changePct > 0 ? '+' : ''}${mover.changePct.toFixed(2)}%` : ''}.`
    )
  }

  const highImpactEvent = calendarEvents.find((e) => e.impact === 'HIGH')
  if (highImpactEvent) {
    lines.push(`Top scheduled macro event: ${highImpactEvent.name}${highImpactEvent.time ? ` (${highImpactEvent.time})` : ''}.`)
  }

  const tenYear = macroContext.find((m) => m.label === '10Y Treasury Yield')
  if (tenYear) {
    lines.push(`10Y yield is ${tenYear.value}.`)
  }

  return lines.join(' ')
}

export async function buildMarketState(params?: {
  watchlistTickers?: string[]
  keyNews?: MarketNewsItem[]
}): Promise<MarketStateSnapshot> {
  const watchlistTickers =
    params?.watchlistTickers?.length
      ? params.watchlistTickers
      : ['SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'META', 'AMD']

const todayStr = getTodayStrET()
const marketStatus = getMarketStatus()

const calendarToDate = new Date(`${todayStr}T12:00:00`)
calendarToDate.setDate(calendarToDate.getDate() + 4)
const calendarTo = calendarToDate.toLocaleDateString('en-CA', {
  timeZone: 'America/New_York',
})

const [intradayResult, economicEvents, earningsEvents, macroData, sectorData] = await Promise.all([
  fetchIntraday(watchlistTickers),
  fetchEconomicCalendar(todayStr, calendarTo),
  fetchEarningsCalendar(watchlistTickers, 7),
  fetchMacroData(),
  fetchSectorPerformance(),
])


  const movers = buildMoversFromIntraday(intradayResult.data)
  const topMovers = pickTopMovers(movers, 5)
  const watchlistSummary = pickWatchlistSummary(movers, 8)

  const { leaders: sectorLeaders, laggards: sectorLaggards } = normalizeSectorPerformance(sectorData)
  const macroContext = normalizeMacroContext(macroData)
  const calendarEvents = normalizeCalendarEvents(economicEvents, todayStr)
  const normalizedEarnings = normalizeEarningsEvents(earningsEvents)
  const keyNews = params?.keyNews ?? []

  const summary = buildRuleBasedSummary({
    marketStatus,
    topMovers,
    sectorLeaders,
    sectorLaggards,
    calendarEvents,
    macroContext,
  })

  return {
    snapshotTime: new Date().toISOString(),
    marketStatus,
    topMovers,
    sectorLeaders,
    sectorLaggards,
    macroContext,
    calendarEvents,
    earningsEvents: normalizedEarnings,
    keyNews,
    watchlistSummary,
    summary,
    rawPayload: {
      watchlistTickers,
      intradayDebug: intradayResult.debug,
      counts: {
        intradaySymbols: Object.keys(intradayResult.data).length,
        economicEvents: economicEvents.length,
        earningsEvents: earningsEvents.length,
        sectorData: sectorData.length,
      },
    },
  }
}