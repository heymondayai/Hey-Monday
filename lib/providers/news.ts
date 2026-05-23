// VENDOR: Finnhub (FINNHUB_API_KEY)
// To swap: replace fetchCompanyNews / fetchMarketNews bodies below. Keep exports identical.

export interface NewsArticle {
  externalId:  string
  headline:    string
  summary:     string
  url:         string
  source:      string
  publishedAt: string  // ISO
  tickers:     string[]
  sentiment:   'bullish' | 'bearish' | 'neutral'
}

function computeSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const t = text.toLowerCase()
  let score = 0
  ;['surge','jump','soar','beat','record','rally','gain','rise','boost','upgrade','outperform','strong','growth','profit','exceed','bullish']
    .forEach(w => { if (t.includes(w)) score++ })
  ;['fall','drop','plunge','miss','loss','decline','cut','downgrade','underperform','weak','concern','warn','layoff','bearish','crash','tumble']
    .forEach(w => { if (t.includes(w)) score-- })
  return score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral'
}

export async function fetchCompanyNews(tickers: string[]): Promise<NewsArticle[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key || !tickers.length) return []

  const to   = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const results = await Promise.all(
    tickers.slice(0, 10).map(async (ticker): Promise<NewsArticle[]> => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${key}`,
          { cache: 'no-store' }
        )
        if (!res.ok) return []
        const data = await res.json()
        if (!Array.isArray(data)) return []
        return data.slice(0, 5)
          .filter((item: any) => item.url && item.headline)
          .map((item: any): NewsArticle => ({
            externalId:  String(item.id ?? `${ticker}-${item.datetime}`),
            headline:    item.headline ?? '',
            summary:     item.summary  ?? '',
            url:         item.url      ?? '',
            source:      item.source   ?? 'Finnhub',
            publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
            tickers:     [ticker],
            sentiment:   computeSentiment((item.headline ?? '') + ' ' + (item.summary ?? '')),
          }))
      } catch { return [] }
    })
  )
  return results.flat()
}

export async function fetchMarketNews(): Promise<NewsArticle[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${key}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.slice(0, 30)
      .filter((item: any) => item.url && item.headline)
      .map((item: any): NewsArticle => ({
        externalId:  String(item.id ?? `general-${item.datetime}`),
        headline:    item.headline ?? '',
        summary:     item.summary  ?? '',
        url:         item.url      ?? '',
        source:      item.source   ?? 'Finnhub',
        publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
        tickers:     [],
        sentiment:   computeSentiment((item.headline ?? '') + ' ' + (item.summary ?? '')),
      }))
  } catch { return [] }
}
