import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

// Full options chain for the flow map — unfiltered, grouped by strike.
// Also returns a volume-at-price profile from today's 1m candles.

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') ?? '').toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const key = process.env.FMP_API_KEY
  if (!key) return NextResponse.json({ error: 'no data key' }, { status: 500 })

  const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  // Fetch options chain + candles in parallel
  const [optRes, supaData] = await Promise.all([
    fetch(`https://financialmodelingprep.com/api/v4/options/chain?symbol=${ticker}&apikey=${key}`, {
      next: { revalidate: 120 },
    }).then(r => r.ok ? r.json() : []).catch(() => []),

    createAdminSupabaseClient()
      .from('candles_1m')
      .select('ts,high,low,close,volume')
      .eq('ticker', ticker)
      .gte('ts', new Date(Date.now() - 26 * 3600_000).toISOString())
      .order('ts', { ascending: true }),
  ])

  // Live price from most recent candle
  const candles: any[] = supaData.data ?? []
  const todayCandles = candles.filter(c =>
    new Date(c.ts).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) === todayEt
  )
  const lastCandle  = todayCandles[todayCandles.length - 1]
  const livePrice   = lastCandle?.close ?? null
  const sessionOpen = todayCandles[0]?.close ?? null

  // Volume profile: bucket candle volume by $0.50 price level
  const volProfile: Record<number, number> = {}
  for (const c of todayCandles) {
    const mid    = (c.high + c.low) / 2
    const bucket = Math.round(mid * 2) / 2  // round to nearest $0.50
    volProfile[bucket] = (volProfile[bucket] ?? 0) + c.volume
  }

  // Session VWAP
  let cumPV = 0, cumVol = 0
  for (const c of todayCandles) {
    const tp = (c.high + c.low + c.close) / 3
    cumPV += tp * c.volume; cumVol += c.volume
  }
  const vwap = cumVol > 0 ? cumPV / cumVol : null

  // HOD / LOD
  const hod = todayCandles.length ? Math.max(...todayCandles.map((c: any) => c.high)) : null
  const lod = todayCandles.length ? Math.min(...todayCandles.map((c: any) => c.low))  : null

  // Process options chain: group by strike
  const raw: any[] = Array.isArray(optRes) ? optRes : []
  type StrikeEntry = {
    strike: number
    calls: { expiry: string; volume: number; openInterest: number; iv: number; premium: number; unusual: boolean }[]
    puts:  { expiry: string; volume: number; openInterest: number; iv: number; premium: number; unusual: boolean }[]
    callOI: number; putOI: number; callVol: number; putVol: number
    netSentiment: 'bullish' | 'bearish' | 'neutral'
    gammaScore: number  // combined OI — higher = stronger wall
  }
  const strikeMap: Record<number, StrikeEntry> = {}

  for (const o of raw) {
    const strike = o.strike ?? 0
    const type   = o.optionType?.toLowerCase()
    if (!strike || !type) continue

    // Skip illiquid contracts
    if ((o.openInterest ?? 0) < 100 && (o.volume ?? 0) < 50) continue

    if (!strikeMap[strike]) {
      strikeMap[strike] = {
        strike, calls: [], puts: [], callOI: 0, putOI: 0, callVol: 0, putVol: 0,
        netSentiment: 'neutral', gammaScore: 0,
      }
    }

    const entry = {
      expiry:        o.expirationDate ?? '',
      volume:        o.volume         ?? 0,
      openInterest:  o.openInterest   ?? 0,
      iv:            o.impliedVolatility ?? 0,
      premium:       (o.lastPrice ?? 0) * (o.contractSize ?? 100),
      unusual:       (o.volume ?? 0) > (o.openInterest ?? 1),  // sweep signal
    }

    if (type === 'call') {
      strikeMap[strike].calls.push(entry)
      strikeMap[strike].callOI  += entry.openInterest
      strikeMap[strike].callVol += entry.volume
    } else {
      strikeMap[strike].puts.push(entry)
      strikeMap[strike].putOI  += entry.openInterest
      strikeMap[strike].putVol += entry.volume
    }
  }

  // Compute net sentiment and gamma score per strike
  for (const s of Object.values(strikeMap)) {
    const totalOI  = s.callOI + s.putOI
    const callBias = totalOI > 0 ? s.callOI / totalOI : 0.5
    s.netSentiment = callBias > 0.60 ? 'bullish' : callBias < 0.40 ? 'bearish' : 'neutral'
    s.gammaScore   = totalOI
  }

  // Sort by strike, filter to ±15% around live price
  let strikes = Object.values(strikeMap).sort((a, b) => b.strike - a.strike)
  if (livePrice) {
    strikes = strikes.filter(s =>
      s.strike >= livePrice * 0.85 && s.strike <= livePrice * 1.15
    )
  }
  // Cap to 40 strikes for render performance
  if (strikes.length > 40) {
    const mid = strikes.findIndex(s => livePrice ? s.strike <= livePrice : false)
    const from = Math.max(0, mid - 20)
    strikes = strikes.slice(from, from + 40)
  }

  // Find max gamma for normalisation
  const maxGamma = Math.max(...strikes.map(s => s.gammaScore), 1)
  const maxVol   = Math.max(...Object.values(volProfile), 1)

  // Mark gamma walls (top 3 by OI)
  const wallStrikes = new Set(
    [...strikes].sort((a, b) => b.gammaScore - a.gammaScore).slice(0, 3).map(s => s.strike)
  )

  // Summarise unusual flow
  const unusualFlow = strikes
    .flatMap(s => [
      ...s.calls.filter(c => c.unusual).map(c => ({ strike: s.strike, type: 'call', ...c })),
      ...s.puts.filter(c => c.unusual).map(c => ({ strike: s.strike, type: 'put',  ...c })),
    ])
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8)

  return NextResponse.json({
    ticker,
    livePrice,
    sessionOpen,
    vwap,
    hod,
    lod,
    strikes: strikes.map(s => ({
      ...s,
      gammaWall: wallStrikes.has(s.strike),
      gammaRatio: s.gammaScore / maxGamma,
    })),
    volProfile: Object.entries(volProfile)
      .map(([price, vol]) => ({ price: parseFloat(price), vol, ratio: vol / maxVol }))
      .sort((a, b) => b.price - a.price),
    unusualFlow,
    updatedAt: new Date().toISOString(),
  })
}
