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

// Keyword fallback — used when Haiku is unavailable or times out
function sentimentKeyword(text: string): 'bullish' | 'bearish' | 'neutral' {
  const t = text.toLowerCase()
  let score = 0
  ;['surge','jump','soar','beat','record','rally','gain','rise','boost','upgrade','outperform','strong','growth','profit','exceed','bullish']
    .forEach(w => { if (t.includes(w)) score++ })
  ;['fall','drop','plunge','miss','loss','decline','cut','downgrade','underperform','weak','concern','warn','layoff','bearish','crash','tumble']
    .forEach(w => { if (t.includes(w)) score-- })
  return score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral'
}

function classifyBatchSentiment(
  articles: { headline: string; summary: string }[],
): ('bullish' | 'bearish' | 'neutral')[] {
  return articles.map(a => sentimentKeyword(a.headline + ' ' + a.summary))
}

export async function fetchCompanyNews(tickers: string[]): Promise<NewsArticle[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key || !tickers.length) return []

  const to   = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Collect raw articles first, then batch-classify sentiment in one Haiku call
  const rawBatches = await Promise.all(
    tickers.slice(0, 10).map(async (ticker): Promise<Array<{ raw: any; ticker: string }>> => {
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
          .map((item: any) => ({ raw: item, ticker }))
      } catch { return [] }
    })
  )

  const allRaw = rawBatches.flat()
  if (!allRaw.length) return []

  const sentiments = await classifyBatchSentiment(
    allRaw.map(({ raw }) => ({ headline: raw.headline ?? '', summary: raw.summary ?? '' }))
  )

  return allRaw.map(({ raw, ticker }, i) => ({
    externalId:  String(raw.id ?? `${ticker}-${raw.datetime}`),
    headline:    raw.headline ?? '',
    summary:     raw.summary  ?? '',
    url:         raw.url      ?? '',
    source:      raw.source   ?? 'Finnhub',
    publishedAt: raw.datetime ? new Date(raw.datetime * 1000).toISOString() : new Date().toISOString(),
    tickers:     [ticker],
    sentiment:   sentiments[i] ?? 'neutral',
  }))
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

    const rawItems = data.slice(0, 30).filter((item: any) => item.url && item.headline)
    if (!rawItems.length) return []

    const sentiments = await classifyBatchSentiment(
      rawItems.map((item: any) => ({ headline: item.headline ?? '', summary: item.summary ?? '' }))
    )

    return rawItems.map((item: any, i: number) => ({
      externalId:  String(item.id ?? `general-${item.datetime}`),
      headline:    item.headline ?? '',
      summary:     item.summary  ?? '',
      url:         item.url      ?? '',
      source:      item.source   ?? 'Finnhub',
      publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
      tickers:     [],
      sentiment:   sentiments[i] ?? 'neutral',
    }))
  } catch { return [] }
}
