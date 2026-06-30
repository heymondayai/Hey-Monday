// VENDOR: Finnhub (FINNHUB_API_KEY)
// To swap: replace fetchCompanyNews / fetchMarketNews bodies below. Keep exports identical.

import Anthropic from '@anthropic-ai/sdk'

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

// Batch-classify all headlines in a single Haiku call (~$0.0002 per batch).
// Falls back to keyword scoring on any error so cron jobs never fail.
async function classifyBatchSentiment(
  articles: { headline: string; summary: string }[],
): Promise<('bullish' | 'bearish' | 'neutral')[]> {
  if (!articles.length) return []
  try {
    const client = new Anthropic()
    const prompt = articles
      .map((a, i) => `${i + 1}. ${a.headline}${a.summary ? ' — ' + a.summary.slice(0, 100) : ''}`)
      .join('\n')

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Classify each news headline as bullish, bearish, or neutral for US equity market sentiment. Reply with a JSON array only — one label per headline, same order. Example: ["bullish","neutral","bearish"]\n\n${prompt}`,
      }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '[]'
    const match = text.match(/\[[\s\S]*?\]/)
    if (!match) throw new Error('no JSON array in response')
    const parsed: string[] = JSON.parse(match[0])
    return articles.map((_, i) => {
      const s = parsed[i]?.toLowerCase()
      return s === 'bullish' ? 'bullish' : s === 'bearish' ? 'bearish' : 'neutral'
    })
  } catch {
    return articles.map(a => sentimentKeyword(a.headline + ' ' + a.summary))
  }
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
