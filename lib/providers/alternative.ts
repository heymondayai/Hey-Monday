// VENDORS: Finnhub (FINNHUB_API_KEY) for insider trades + SEC filings
//          FMP (FMP_API_KEY) for analyst ratings, options flow, sector performance
// Scaffolded (no vendor yet): congressional trades, short interest,
//   institutional holdings, dark pool — add implementations when vendors configured.
// To swap a vendor: replace only the relevant fetch* body. Keep exports identical.

import {
  fetchInsiderTransactions,
  fetchAnalystRatings,
  fetchOptionsFlow,
  fetchSecFilings,
  fetchSectorPerformance,
} from '@/lib/market-data'
import type {
  InsiderTransaction,
  AnalystRating,
  OptionsFlow,
  SecFiling,
  SectorPerformance,
} from '@/lib/market-data'

export type { InsiderTransaction, AnalystRating, OptionsFlow, SecFiling, SectorPerformance }

export async function fetchInsiderTrades(tickers: string[]): Promise<InsiderTransaction[]> {
  const results = await Promise.all(tickers.map(fetchInsiderTransactions))
  return results.flat()
}

export async function fetchAnalystRatingsForTickers(tickers: string[]): Promise<AnalystRating[]> {
  const results = await Promise.all(tickers.map(fetchAnalystRatings))
  return results.flat()
}

export async function fetchOptionsFlowForTickers(tickers: string[]): Promise<OptionsFlow[]> {
  const results = await Promise.all(tickers.map(fetchOptionsFlow))
  return results.flat()
}

export async function fetchSecFilingsForTickers(tickers: string[]): Promise<SecFiling[]> {
  const results = await Promise.all(tickers.map(fetchSecFilings))
  return results.flat()
}

export async function fetchSectorPerf(): Promise<SectorPerformance[]> {
  return fetchSectorPerformance()
}

// ── Scaffolded providers — no vendor yet ──────────────────────────────────────

export interface CongressionalTrade {
  externalId:      string
  ticker:          string | null
  politicianName:  string
  chamber:         'house' | 'senate'
  party:           string | null
  state:           string | null
  transactionType: 'purchase' | 'sale'
  amountRange:     string | null
  transactionDate: string | null
  disclosureDate:  string | null
}

// TODO: implement with Quiver Quantitative or House/Senate disclosure API
export async function fetchCongressionalTrades(): Promise<CongressionalTrade[]> {
  return []
}

export interface ShortInterestRow {
  ticker:           string
  reportDate:       string
  shortVolume:      number | null
  shortVolumeRatio: number | null
  daysToCover:      number | null
}

// TODO: implement with FINRA, Quiver Quantitative, or similar
export async function fetchShortInterest(_tickers: string[]): Promise<ShortInterestRow[]> {
  return []
}

export interface InstitutionalHolding {
  externalId:      string
  ticker:          string
  institutionName: string
  shares:          number
  valueUsd:        number
  quarter:         string  // YYYY-MM-DD (quarter start)
  changeShares:    number | null
}

// TODO: implement with SEC EDGAR, Quiver Quantitative, or similar
export async function fetchInstitutionalHoldings(_tickers: string[]): Promise<InstitutionalHolding[]> {
  return []
}

export interface DarkPoolPrint {
  externalId:    string
  ticker:        string
  price:         number
  volume:        number
  notionalValue: number
  tradedAt:      string  // ISO
}

// TODO: implement with Quiver Quantitative, Unusual Whales, or similar
export async function fetchDarkPoolPrints(_tickers: string[]): Promise<DarkPoolPrint[]> {
  return []
}
