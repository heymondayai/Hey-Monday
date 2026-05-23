// VENDOR: FRED / St. Louis Fed (FRED_API_KEY — free)
// To swap: replace fetchMacroSeries body below. Keep exports identical.

export interface MacroObservation {
  seriesId:   string
  seriesName: string
  date:       string   // YYYY-MM-DD
  value:      number
}

const SERIES: Record<string, string> = {
  FEDFUNDS:     'Federal Funds Rate',
  DGS10:        '10-Year Treasury Yield',
  DGS2:         '2-Year Treasury Yield',
  T10Y2Y:       '10Y-2Y Yield Spread',
  CPIAUCSL:     'CPI (All Urban Consumers)',
  PCEPI:        'PCE Price Index',
  UNRATE:       'Unemployment Rate',
  GDP:          'Gross Domestic Product',
  MORTGAGE30US: '30-Year Fixed Mortgage Rate',
  BAMLH0A0HYM2: 'High Yield Spread (OAS)',
}

export async function fetchMacroSeries(): Promise<MacroObservation[]> {
  const key = process.env.FRED_API_KEY
  if (!key) return []

  const since = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const results = await Promise.all(
    Object.entries(SERIES).map(async ([seriesId, seriesName]): Promise<MacroObservation[]> => {
      try {
        const params = new URLSearchParams({
          series_id:         seriesId,
          api_key:           key,
          file_type:         'json',
          sort_order:        'desc',
          observation_start: since,
        })
        const res = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?${params}`,
          { next: { revalidate: 3600 } }
        )
        if (!res.ok) return []
        const data = await res.json()
        return (data.observations ?? [])
          .filter((o: any) => o.value !== '.' && o.date)
          .map((o: any): MacroObservation => ({
            seriesId,
            seriesName,
            date:  o.date,
            value: parseFloat(o.value),
          }))
      } catch { return [] }
    })
  )
  return results.flat()
}
