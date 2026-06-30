// Computes an intraday market regime classification from SPY candles,
// optional VIX, and sector breadth. Pure function — no I/O.
// Called inside compileContext after candles are fetched and injected
// into the AI context as a MARKET REGIME block.

export interface MarketRegime {
  trend:      'trending_up' | 'trending_down' | 'ranging' | 'volatile'
  volatility: 'low' | 'normal' | 'elevated' | 'extreme'
  riskMode:   'risk_on' | 'neutral' | 'risk_off'
  setupEdge:  string
  formatted:  string
}

interface SimpleCandle {
  open: number; high: number; low: number; close: number; volume: number
}

export function computeMarketRegime(
  spyCandles: SimpleCandle[],
  vix?: number | null,
  greenSectors?: number,
  totalSectors?: number,
): MarketRegime {
  const fallback: MarketRegime = {
    trend: 'ranging', volatility: 'normal', riskMode: 'neutral',
    setupEdge: 'Insufficient session data for regime detection.',
    formatted: '',
  }
  if (!spyCandles.length) return fallback

  // Session VWAP
  let cumPV = 0, cumVol = 0
  for (const c of spyCandles) {
    const tp = (c.high + c.low + c.close) / 3
    cumPV += tp * c.volume
    cumVol += c.volume
  }
  const vwap     = cumVol > 0 ? cumPV / cumVol : spyCandles[spyCandles.length - 1].close
  const lastClose = spyCandles[spyCandles.length - 1].close
  const spyAboveVwap = lastClose > vwap * 1.0003

  // Momentum from last 5 candles
  const last5   = spyCandles.slice(-5)
  const upCount = last5.filter(c => c.close > c.open).length

  // Session range
  const sessionOpen  = spyCandles[0].open
  const sessionChange = sessionOpen > 0 ? (lastClose - sessionOpen) / sessionOpen * 100 : 0
  const hod = Math.max(...spyCandles.map(c => c.high))
  const lod = Math.min(...spyCandles.map(c => c.low))
  const mid = (hod + lod) / 2
  const rangePct = mid > 0 ? (hod - lod) / mid * 100 : 0

  // Trend
  let trend: MarketRegime['trend']
  if (rangePct < 0.35) {
    trend = 'ranging'
  } else if (sessionChange > 0.4 && upCount >= 4 && spyAboveVwap) {
    trend = 'trending_up'
  } else if (sessionChange < -0.4 && upCount <= 1 && !spyAboveVwap) {
    trend = 'trending_down'
  } else if (rangePct > 1.6) {
    trend = 'volatile'
  } else {
    trend = 'ranging'
  }

  // Volatility from VIX
  let volatility: MarketRegime['volatility']
  if (!vix) {
    volatility = 'normal'
  } else if (vix < 13) {
    volatility = 'low'
  } else if (vix < 20) {
    volatility = 'normal'
  } else if (vix < 28) {
    volatility = 'elevated'
  } else {
    volatility = 'extreme'
  }

  // Risk mode from sector breadth
  let riskMode: MarketRegime['riskMode'] = 'neutral'
  if (greenSectors !== undefined && totalSectors && totalSectors > 0) {
    const ratio = greenSectors / totalSectors
    if (ratio >= 0.7) riskMode = 'risk_on'
    else if (ratio <= 0.3) riskMode = 'risk_off'
  } else {
    if (trend === 'trending_up') riskMode = 'risk_on'
    else if (trend === 'trending_down') riskMode = 'risk_off'
  }

  // Setup edge recommendation
  let setupEdge: string
  if (volatility === 'extreme') {
    setupEdge = 'Extreme vol — cut size, avoid holds, scalps only. Do not add to losers.'
  } else if (trend === 'trending_up' && volatility === 'low') {
    setupEdge = 'Low-vol uptrend — breakouts and momentum setups have high edge. Avoid counter-trend shorts.'
  } else if (trend === 'trending_up') {
    setupEdge = 'Uptrending session — VWAP holds are buyable dips. Breakouts above HOD favored.'
  } else if (trend === 'trending_down' && volatility === 'low') {
    setupEdge = 'Low-vol downtrend — VWAP rejections and HOD fade setups favored. Avoid buy-the-dip.'
  } else if (trend === 'trending_down') {
    setupEdge = 'Downtrending session — VWAP failures are shorting opportunities. Wait for VWAP reclaim to consider longs.'
  } else if (volatility === 'elevated') {
    setupEdge = 'Elevated vol, no clear trend — wait for structure. Wider stops or smaller size required.'
  } else {
    setupEdge = 'Range-bound session — fade extremes toward VWAP. Breakout setups have lower historical hit rate in ranging conditions.'
  }

  // Format
  const vwapTag  = spyAboveVwap ? 'SPY above VWAP' : 'SPY below VWAP'
  const vixTag   = vix ? ` | VIX ${vix.toFixed(1)} (${volatility} vol)` : ''
  const modeTag  = riskMode !== 'neutral' ? ` | ${riskMode.replace('_', '-')}` : ''
  const changeFmt = `${sessionChange >= 0 ? '+' : ''}${sessionChange.toFixed(2)}%`

  const formatted = [
    `MARKET REGIME: ${trend.replace('_', ' ').toUpperCase()} | ${vwapTag} | SPY session ${changeFmt}${vixTag}${modeTag}`,
    `  Momentum: ${upCount}/5 of last candles green${trend === 'ranging' ? ' — choppy internals' : ''}`,
    `  Setup edge: ${setupEdge}`,
  ].join('\n')

  return { trend, volatility, riskMode, setupEdge, formatted }
}
