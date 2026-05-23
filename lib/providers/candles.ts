// VENDOR: Twelve Data (TWELVE_DATA_API_KEY)
// To swap: replace fetchCandles / fetchLiveQuotes bodies below. Keep exports identical.

import { fetchIntraday, fetchLivePrices } from '@/lib/market-data'
import type { Candle, LiveQuote, FetchIntradayOptions } from '@/lib/market-data'

export type { Candle, LiveQuote, FetchIntradayOptions }

export async function fetchCandles(tickers: string[], options?: FetchIntradayOptions) {
  return fetchIntraday(tickers, options)
}

export async function fetchLiveQuotes(tickers: string[]): Promise<LiveQuote[]> {
  return fetchLivePrices(tickers)
}
