/**
 * app/api/search/route.ts
 *
 * Searches for stock/ETF/crypto tickers using Finnhub symbol search.
 * Falls back to a curated list of common crypto symbols when query matches.
 *
 * GET /api/search?q=nvidia
 * Returns: { results: [{ sym, name, type }] }
 */

import { NextResponse } from 'next/server'

// Well-known crypto that Finnhub won't return as equities
const KNOWN_CRYPTO: { sym: string; name: string }[] = [
  { sym: 'BTC',   name: 'Bitcoin' },
  { sym: 'ETH',   name: 'Ethereum' },
  { sym: 'SOL',   name: 'Solana' },
  { sym: 'BNB',   name: 'BNB' },
  { sym: 'XRP',   name: 'XRP' },
  { sym: 'DOGE',  name: 'Dogecoin' },
  { sym: 'ADA',   name: 'Cardano' },
  { sym: 'AVAX',  name: 'Avalanche' },
  { sym: 'LINK',  name: 'Chainlink' },
  { sym: 'MATIC', name: 'Polygon' },
  { sym: 'DOT',   name: 'Polkadot' },
  { sym: 'LTC',   name: 'Litecoin' },
  { sym: 'UNI',   name: 'Uniswap' },
  { sym: 'ATOM',  name: 'Cosmos' },
]

// Popular ETFs / indices that are useful to have in a watchlist
const KNOWN_ETFS: { sym: string; name: string }[] = [
  { sym: 'SPY',  name: 'SPDR S&P 500 ETF' },
  { sym: 'QQQ',  name: 'Invesco Nasdaq 100 ETF' },
  { sym: 'IWM',  name: 'iShares Russell 2000 ETF' },
  { sym: 'DIA',  name: 'SPDR Dow Jones ETF' },
  { sym: 'GLD',  name: 'SPDR Gold Shares ETF' },
  { sym: 'SLV',  name: 'iShares Silver Trust ETF' },
  { sym: 'USO',  name: 'United States Oil Fund' },
  { sym: 'TLT',  name: 'iShares 20+ Year Treasury Bond ETF' },
  { sym: 'XLK',  name: 'Technology Select Sector SPDR' },
  { sym: 'XLF',  name: 'Financial Select Sector SPDR' },
  { sym: 'XLE',  name: 'Energy Select Sector SPDR' },
  { sym: 'XLV',  name: 'Health Care Select Sector SPDR' },
  { sym: 'ARKK', name: 'ARK Innovation ETF' },
  { sym: 'GDX',  name: 'VanEck Gold Miners ETF' },
  { sym: 'VIX',  name: 'CBOE Volatility Index (VIX)' },
]

// Futures contracts (front month continuous)
const KNOWN_FUTURES: { sym: string; name: string; exchange: string }[] = [
  // Equity index
  { sym: 'ES',  name: 'E-mini S&P 500 Futures',       exchange: 'CME' },
  { sym: 'NQ',  name: 'E-mini Nasdaq-100 Futures',     exchange: 'CME' },
  { sym: 'RTY', name: 'E-mini Russell 2000 Futures',   exchange: 'CME' },
  { sym: 'YM',  name: 'E-mini Dow Jones Futures',      exchange: 'CBOT' },
  // Energy
  { sym: 'CL',  name: 'Crude Oil WTI Futures',         exchange: 'NYMEX' },
  { sym: 'NG',  name: 'Natural Gas Futures',           exchange: 'NYMEX' },
  { sym: 'RB',  name: 'RBOB Gasoline Futures',         exchange: 'NYMEX' },
  { sym: 'HO',  name: 'Heating Oil Futures',           exchange: 'NYMEX' },
  // Metals
  { sym: 'GC',  name: 'Gold Futures',                  exchange: 'COMEX' },
  { sym: 'SI',  name: 'Silver Futures',                exchange: 'COMEX' },
  { sym: 'HG',  name: 'Copper Futures',                exchange: 'COMEX' },
  { sym: 'PL',  name: 'Platinum Futures',              exchange: 'NYMEX' },
  { sym: 'PA',  name: 'Palladium Futures',             exchange: 'NYMEX' },
  // Agriculture
  { sym: 'ZW',  name: 'Wheat Futures',                 exchange: 'CBOT' },
  { sym: 'ZC',  name: 'Corn Futures',                  exchange: 'CBOT' },
  { sym: 'ZS',  name: 'Soybeans Futures',              exchange: 'CBOT' },
  // Bonds
  { sym: 'ZB',  name: '30-Year T-Bond Futures',        exchange: 'CBOT' },
  { sym: 'ZN',  name: '10-Year T-Note Futures',        exchange: 'CBOT' },
  { sym: 'ZF',  name: '5-Year T-Note Futures',         exchange: 'CBOT' },
  // FX
  { sym: '6E',  name: 'Euro FX Futures',               exchange: 'CME' },
  { sym: '6J',  name: 'Japanese Yen Futures',          exchange: 'CME' },
  { sym: '6B',  name: 'British Pound Futures',         exchange: 'CME' },
]

const FUTURES_SYMS = new Set(KNOWN_FUTURES.map(f => f.sym))

const CRYPTO_SYMS = new Set(KNOWN_CRYPTO.map(c => c.sym))

function classifyType(sym: string, finnhubType: string): string {
  if (CRYPTO_SYMS.has(sym.toUpperCase()))   return 'Crypto'
  if (FUTURES_SYMS.has(sym.toUpperCase()))  return 'Futures'
  if (finnhubType === 'ETP') return 'ETF'
  if (finnhubType === 'ADR') return 'ADR'
  return 'Stock'
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ results: [] })

  const upper = q.toUpperCase()

  // Check futures first (exact or prefix or name match)
  const futuresMatches = KNOWN_FUTURES.filter(f =>
    f.sym.startsWith(upper) || f.name.toLowerCase().includes(q.toLowerCase())
  ).map(f => ({ sym: f.sym, name: f.name, type: 'Futures' }))

  // Check crypto (exact or prefix match)
  const cryptoMatches = KNOWN_CRYPTO.filter(c =>
    c.sym.startsWith(upper) || c.name.toLowerCase().includes(q.toLowerCase())
  ).map(c => ({ sym: c.sym, name: c.name, type: 'Crypto' }))

  // Check known ETFs
  const etfMatches = KNOWN_ETFS.filter(e =>
    e.sym.startsWith(upper) || e.name.toLowerCase().includes(q.toLowerCase())
  ).map(e => ({ sym: e.sym, name: e.name, type: 'ETF' }))

  // Finnhub symbol search for stocks (skip if query matches a known futures sym to avoid noise)
  const key = process.env.FINNHUB_API_KEY
  let stockResults: { sym: string; name: string; type: string }[] = []

  if (key && !FUTURES_SYMS.has(upper)) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`,
        { next: { revalidate: 3600 } }
      )
      if (res.ok) {
        const data = await res.json()
        stockResults = (data.result ?? [])
          .filter((r: any) => r.symbol && !r.symbol.includes('.') && r.type !== 'Crypto Currency')
          .slice(0, 10)
          .map((r: any) => ({
            sym:  r.symbol,
            name: r.description,
            type: classifyType(r.symbol, r.type),
          }))
      }
    } catch (err) {
      console.error('[search] Finnhub error:', err)
    }
  }

  // Merge: futures + crypto + ETF matches first, then stocks (dedup)
  const seen = new Set<string>()
  const results: { sym: string; name: string; type: string }[] = []

  for (const r of [...futuresMatches, ...cryptoMatches, ...etfMatches, ...stockResults]) {
    if (!seen.has(r.sym)) {
      seen.add(r.sym)
      results.push(r)
    }
  }

  return NextResponse.json({ results: results.slice(0, 10) })
}