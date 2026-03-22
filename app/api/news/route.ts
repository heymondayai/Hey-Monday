import { NextRequest, NextResponse } from 'next/server'

const CACHE_TTL = 90 * 1000
const cache = new Map<string, { data: any; ts: number }>()
const CACHE_VERSION = 'v8'

const SKIP = new Set(['NQ','ES','RTY','YM','CL','NG','GC','SI','HG','PL','PA','ZW','ZC','ZS','ZB','ZN','ZF','6E','6J','6B','BTC','ETH','SOL','DOGE','ADA','XRP','BNB','AVAX','MATIC','DOT'])

const STOCK_TICKERS = ['NVDA','AAPL','MSFT','TSLA','META','AMZN','GOOGL','AMD','UBER','SNAP','NFLX','JPM','BAC','XOM','CVX','LMT','PFE','JNJ','WMT','DIS','SPY','QQQ','GS']

const CATEGORY_KEYWORDS: { label: string; words: string[] }[] = [
  { label: 'FED / RATES', words: ['fed','fomc','federal reserve','interest rate','powell','inflation','cpi','pce','rate cut','rate hike','basis point','yield','treasury','monetary'] },
  { label: 'GEOPOLITICAL', words: ['iran','russia','china','ukraine','israel','war','sanction','military','strike','conflict','nato','missile','taiwan','north korea'] },
  { label: 'ENERGY', words: ['oil','opec','crude','natural gas','petroleum','energy','barrel','refinery','pipeline','lng'] },
  { label: 'CRYPTO', words: ['bitcoin','crypto','ethereum','blockchain','coinbase','binance','solana','token','defi','nft'] },
  { label: 'EARNINGS', words: ['earnings','revenue','eps','profit','quarterly','guidance','beat','miss','fiscal','q1','q2','q3','q4'] },
  { label: 'TECH', words: ['ai','artificial intelligence','chip','semiconductor','cloud','software','data center','cybersecurity','openai','nvidia','apple','microsoft','google','amazon'] },
  { label: 'ECONOMY', words: ['gdp','jobs','unemployment','recession','growth','consumer','retail','housing','inflation','economy','economic'] },
  { label: 'M&A', words: ['merger','acquisition','deal','buyout','takeover','ipo','spac','spin-off','acquire'] },
]

function getLabel(headline: string): string {
  const lower = headline.toLowerCase()
  // First check for specific stock tickers
  const upper = ' ' + headline.toUpperCase() + ' '
  for (const t of STOCK_TICKERS) {
    const re = new RegExp(`[^A-Z]${t}[^A-Z]`)
    if (re.test(upper)) return t
  }
  // Then check category keywords
  for (const cat of CATEGORY_KEYWORDS) {
    if (cat.words.some(w => lower.includes(w))) return cat.label
  }
  return 'MARKETS'
}

function relTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function getSentiment(headline: string, summary: string): 'bullish' | 'bearish' | 'neutral' {
  const text = (headline + ' ' + summary).toLowerCase()
  const bullish = ['surge','jump','soar','beat','record','rally','gain','rise','boost','upgrade','buy','outperform','strong','growth','profit','exceed','top','high','positive','bullish']
  const bearish = ['fall','drop','plunge','miss','loss','decline','cut','downgrade','sell','underperform','weak','concern','risk','below','warn','layoff','lawsuit','probe','investigation','bearish','crash','tumble']
  let score = 0
  bullish.forEach(w => { if (text.includes(w)) score++ })
  bearish.forEach(w => { if (text.includes(w)) score-- })
  if (score > 0) return 'bullish'
  if (score < 0) return 'bearish'
  return 'neutral'
}

function makeSummary(headline: string, raw: string): string {
  const s = (raw || '').trim()
  if (s.length > 30 && s !== headline) return s
  // Finnhub free tier rarely returns summaries — use headline as fallback display
  return ''
}

async function fetchFinnhubNews(ticker: string, apiKey: string) {
  const to = new Date()
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const toStr = to.toISOString().split('T')[0]
  const fromStr = from.toISOString().split('T')[0]
  const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fromStr}&to=${toStr}&token=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' as RequestCache })
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data.slice(0, 3).map((item: any) => {
    const headline = item.headline || ''
    const summary = makeSummary(headline, item.summary)
    return {
      id: `${ticker}-${item.id}`,
      ticker,
      headline,
      summary,
      source: item.source || 'Finnhub',
      publishedAt: new Date(item.datetime * 1000).toISOString(),
      relTime: relTime(new Date(item.datetime * 1000).toISOString()),
      url: item.url || '',
      sentiment: getSentiment(headline, summary),
      category: 'watchlist',
    }
  })
}

async function fetchFinnhubMarketNews(apiKey: string) {
  const url = `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' as RequestCache })
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data.slice(0, 20).map((item: any) => {
    const headline = item.headline || ''
    const summary = makeSummary(headline, item.summary)
    return {
      id: `general-${item.id}`,
      ticker: getLabel(headline),
      headline,
      summary,
      source: item.source || 'Finnhub',
      publishedAt: new Date(item.datetime * 1000).toISOString(),
      relTime: relTime(new Date(item.datetime * 1000).toISOString()),
      url: item.url || '',
      sentiment: getSentiment(headline, summary),
      category: 'general',
    }
  })
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY not set' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'general'
  const tickersParam = searchParams.get('tickers') || ''

  const cacheKey = `${CACHE_VERSION}:news:${type}:${tickersParam}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  try {
    let articles: any[] = []

    if (type === 'watchlist' && tickersParam) {
      const tickers = tickersParam.split(',').filter(t => t && !SKIP.has(t)).slice(0, 5)
      const results = await Promise.all(tickers.map(t => fetchFinnhubNews(t, apiKey)))
      articles = results.flat()
      articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      articles = articles.slice(0, 20)
    } else {
      articles = await fetchFinnhubMarketNews(apiKey)
    }

    const payload = { news: articles }
    cache.set(cacheKey, { data: payload, ts: Date.now() })
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[news] error:', err)
    return NextResponse.json({ news: [] })
  }
}