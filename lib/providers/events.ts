// VENDORS: Benzinga (BENZINGA_API_KEY) for economic calendar,
//          FMP (FMP_API_KEY) for earnings calendar
// To swap: replace fetchEconomicEvents / fetchEarningsEvents bodies. Keep exports identical.

import { fetchEconomicCalendar, fetchEarningsCalendar } from '@/lib/market-data'
import type { EconomicEvent, EarningsEvent } from '@/lib/market-data'

export type { EconomicEvent, EarningsEvent }

export async function fetchEconomicEvents(from: string, to: string): Promise<EconomicEvent[]> {
  return fetchEconomicCalendar(from, to)
}

export async function fetchEarningsEvents(
  symbols: string[],
  from: string,
  to: string,
): Promise<EarningsEvent[]> {
  return fetchEarningsCalendar(symbols, from, to)
}
