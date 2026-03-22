/**
 * app/api/prices/route.ts
 *
 * Stocks  → Finnhub (free tier, 60 req/min)
 * Futures → Finnhub first, Yahoo Finance fallback (no key needed)
 * Crypto  → CoinGecko
 *
 * Per-symbol cache so any watchlist combination works correctly.
 */

import { NextResponse } from 'next/server'

const DEFAULT_STOCK_TICKERS = [
  'SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'MSFT', 'META', 'AMD', 'GLD', 'AMZN'
]

const COINGECKO_MAP: Record<string, string> = {
  BTC:   'bitcoin',
  ETH:   'ethereum',
  SOL:   'solana',
  BNB:   'binancecoin',
  XRP:   'ripple',
  DOGE:  'dogecoin',
  ADA:   'cardano',
  AVAX:  'avalanche-2',
  LINK:  'chainlink',
  MATIC: 'matic-network',
  DOT:   'polkadot',
  LTC:   'litecoin',
  UNI:   'uniswap',
  ATOM:  'cosmos',
}

// Finnhub continuous contract symbols
const FUTURES_MAP: Record<string, string> = {
  ES:   'CME_MINI:ES1!',  NQ:  'CME_MINI:NQ1!',  RTY: 'CME_MINI:RTY1!', YM: 'CBOT_MINI:YM1!',
  CL:   'NYMEX:CL1!',    NG:  'NYMEX:NG1!',      RB:  'NYMEX:RB1!',     HO: 'NYMEX:HO1!',
  GC:   'COMEX:GC1!',    SI:  'COMEX:SI1!',      HG:  'COMEX:HG1!',     PL: 'NYMEX:PL1!',
  PA:   'NYMEX:PA1!',    ZW:  'CBOT:ZW1!',       ZC:  'CBOT:ZC1!',      ZS: 'CBOT:ZS1!',
  ZB:   'CBOT:ZB1!',     ZN:  'CBOT:ZN1!',       ZF:  'CBOT:ZF1!',
  '6E': 'CME:6E1!',      '6J':'CME:6J1!',        '6B':'CME:6B1!',
  MBT:  'CME:MBT1!',     MET: 'CME:MET1!',
}

// Yahoo Finance fallback symbols for futures
const YAHOO_FUTURES_MAP: Record<string, string> = {
  ES:   'ES=F',  NQ:  'NQ=F',  RTY: 'RTY=F', YM: 'YM=F',
  CL:   'CL=F',  NG:  'NG=F',  RB:  'RB=F',  HO: 'HO=F',
  GC:   'GC=F',  SI:  'SI=F',  HG:  'HG=F',  PL: 'PL=F',
  PA:   'PA=F',  ZW:  'ZW=F',  ZC:  'ZC=F',  ZS: 'ZS=F',
  ZB:   'ZB=F',  ZN:  'ZN=F',  ZF:  'ZF=F',
  '6E': '6E=F',  '6J':'6J=F',  '6B':'6B=F',
}

interface TickerItem {
  sym:       string
  price:     string
  rawPrice:  number
  change:    string
  rawChange: number
  up:        boolean
}

// Per-symbol cache — works correctly for any watchlist combination
const symbolCache = new Map<string, { item: TickerItem; fetchedAt: number }>()

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (price >= 1)    return price.toFixed(2)
  return price.toFixed(4)
}

function getMarketSession(): 'regular' | 'pre' | 'after' | 'closed' {
  const et  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  const t   = et.getHours() * 60 + et.getMinutes()
  if (day === 0 || day === 6) return 'closed'
  if (t >= 570 && t < 960)   return 'regular'
  if (t >= 240 && t < 570)   return 'pre'
  if (t >= 960 && t < 1200)  return 'after'
  return 'closed'
}

// ── STOCKS ────────────────────────────────────────────────────────────────────

async function fetchFinnhubSymbol(symbol: string, key: string): Promise<TickerItem | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const d = await res.json()
    if (!d.c || d.c === 0) return null
    const changePct = d.dp ?? 0
    return {
      sym: symbol, price: formatPrice(d.c), rawPrice: d.c,
      change: (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%',
      rawChange: changePct, up: changePct >= 0,
    }
  } catch { return null }
}

async function fetchAllStocks(tickers: string[], key: string): Promise<TickerItem[]> {
  const results = await Promise.all(
    tickers.map((sym, i) =>
      new Promise<TickerItem | null>(resolve =>
        setTimeout(() => fetchFinnhubSymbol(sym, key).then(resolve), i * 50)
      )
    )
  )
  const valid = results.filter(Boolean) as TickerItem[]
  console.log(`[prices] Finnhub stocks: ${valid.length}/${tickers.length} —`, valid.map(t => t.sym).join(', '))
  return valid
}

// ── FUTURES ───────────────────────────────────────────────────────────────────

async function fetchFinnhubFutures(syms: string[], key: string): Promise<TickerItem[]> {
  const results = await Promise.all(
    syms.map((userSym, i) =>
      new Promise<TickerItem | null>(resolve => {
        setTimeout(async () => {
          const finnhubSym = FUTURES_MAP[userSym]
          if (!finnhubSym) { resolve(null); return }
          try {
            const res = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSym)}&token=${key}`,
              { cache: 'no-store' }
            )
            if (!res.ok) { resolve(null); return }
            const d = await res.json()
            if (!d.c || d.c === 0) { resolve(null); return }
            const changePct = d.dp ?? 0
            resolve({
              sym: userSym, price: formatPrice(d.c), rawPrice: d.c,
              change: (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%',
              rawChange: changePct, up: changePct >= 0,
            })
          } catch { resolve(null) }
        }, i * 60)
      })
    )
  )
  return results.filter(Boolean) as TickerItem[]
}

async function fetchYahooFutures(syms: string[]): Promise<TickerItem[]> {
  const results = await Promise.all(
    syms.map(async (userSym): Promise<TickerItem | null> => {
      const yahooSym = YAHOO_FUTURES_MAP[userSym]
      if (!yahooSym) return null
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1d&range=1d`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
        )
        if (!res.ok) return null
        const data = await res.json()
        const meta = data?.chart?.result?.[0]?.meta
        if (!meta?.regularMarketPrice) return null
        const price     = meta.regularMarketPrice as number
        const prevClose = (meta.chartPreviousClose ?? meta.previousClose ?? price) as number
        const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
        return {
          sym: userSym, price: formatPrice(price), rawPrice: price,
          change: (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%',
          rawChange: changePct, up: changePct >= 0,
        }
      } catch { return null }
    })
  )
  const valid = results.filter(Boolean) as TickerItem[]
  console.log(`[prices] Yahoo futures: ${valid.length}/${syms.length} —`, valid.map(t => t.sym).join(', '))
  return valid
}

async function fetchFutures(syms: string[], key: string): Promise<TickerItem[]> {
  if (syms.length === 0) return []
  const finnhubResults = await fetchFinnhubFutures(syms, key)
  const finnhubHit     = new Set(finnhubResults.map(t => t.sym))
  const needYahoo      = syms.filter(s => !finnhubHit.has(s))
  const yahooResults   = needYahoo.length > 0 ? await fetchYahooFutures(needYahoo) : []
  const all = [...finnhubResults, ...yahooResults]
  console.log(`[prices] Futures: ${all.length} total (${finnhubResults.length} Finnhub + ${yahooResults.length} Yahoo)`)
  return all
}

// ── CRYPTO ────────────────────────────────────────────────────────────────────

async function fetchCoinGecko(requestedSyms: string[]): Promise<TickerItem[]> {
  if (requestedSyms.length === 0) return []
  const cgKey   = process.env.COINGECKO_API_KEY
  const toFetch = requestedSyms.filter(s => COINGECKO_MAP[s])
  if (toFetch.length === 0) return []
  const coinIds = toFetch.map(s => COINGECKO_MAP[s]).join(',')
  const headers: Record<string, string> = { accept: 'application/json' }
  if (cgKey) headers['x-cg-demo-api-key'] = cgKey
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`,
      { headers, cache: 'no-store' }
    )
    if (!res.ok) { console.warn(`[prices] CoinGecko HTTP ${res.status}`); return [] }
    const data = await res.json()
    return toFetch.map((sym): TickerItem | null => {
      const coin = data[COINGECKO_MAP[sym]]
      if (!coin) return null
      const changePct = coin.usd_24h_change ?? 0
      return {
        sym, price: formatPrice(coin.usd), rawPrice: coin.usd,
        change: (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%',
        rawChange: changePct, up: changePct >= 0,
      }
    }).filter(Boolean) as TickerItem[]
  } catch (err: any) {
    console.warn('[prices] CoinGecko exception:', err.message)
    return []
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tickersParam  = searchParams.get('tickers')
    const requestedSyms = tickersParam
      ? tickersParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : DEFAULT_STOCK_TICKERS

    const futuresSyms = requestedSyms.filter(s =>  FUTURES_MAP[s])
    const cryptoSyms  = requestedSyms.filter(s =>  COINGECKO_MAP[s])
    const stockSyms   = requestedSyms.filter(s => !FUTURES_MAP[s] && !COINGECKO_MAP[s])

    const finnhubKey = process.env.FINNHUB_API_KEY
    const session    = getMarketSession()
    const now        = Date.now()

    const CACHE_TTL = session === 'regular' ? 30_000
                    : session === 'pre'     ? 120_000
                    : session === 'after'   ? 120_000
                    : 300_000

    // Stocks — only re-fetch stale symbols
    const staleStocks = stockSyms.filter(s => {
      const c = symbolCache.get(s)
      return !c || (now - c.fetchedAt) > CACHE_TTL
    })
    if (staleStocks.length > 0 && finnhubKey) {
      const fresh = await fetchAllStocks(staleStocks, finnhubKey)
      fresh.forEach(item => symbolCache.set(item.sym, { item, fetchedAt: now }))
    }
    const stockTickers = stockSyms
      .map(s => symbolCache.get(s)?.item)
      .filter(Boolean) as TickerItem[]

    // Futures — only re-fetch stale symbols
    const staleFutures = futuresSyms.filter(s => {
      const c = symbolCache.get(s)
      return !c || (now - c.fetchedAt) > CACHE_TTL
    })
    if (staleFutures.length > 0) {
      const fresh = await fetchFutures(staleFutures, finnhubKey ?? '')
      fresh.forEach(item => symbolCache.set(item.sym, { item, fetchedAt: now }))
    }
    const futuresTickers = futuresSyms
      .map(s => symbolCache.get(s)?.item)
      .filter(Boolean) as TickerItem[]

    // Crypto — always fresh
    const cryptoTickers = await fetchCoinGecko(cryptoSyms)
    cryptoTickers.forEach(item => symbolCache.set(item.sym, { item, fetchedAt: now }))

    const tickers = [...stockTickers, ...futuresTickers, ...cryptoTickers]
    console.log(
      `[prices] → ${tickers.length} total`,
      `| stocks: ${stockTickers.map(t => t.sym).join(',')}`,
      `| futures: ${futuresTickers.map(t => t.sym).join(',')}`,
      `| crypto: ${cryptoTickers.map(t => t.sym).join(',')}`
    )

    return NextResponse.json({ tickers, updatedAt: now, session })
  } catch (err: any) {
    console.error('[prices] Unhandled error:', err.message)
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 })
  }
}