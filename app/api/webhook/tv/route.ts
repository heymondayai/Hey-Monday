// POST /api/webhook/tv?uid=USER_ID&key=WEBHOOK_KEY
// Receives TradingView alert webhooks and logs trades to the journal.
// Auth: HMAC-SHA256(userId, ANTHROPIC_API_KEY) — stateless, no extra DB table needed.
//
// Minimum TradingView alert message body:
//   {"ticker":"{{ticker}}","action":"buy","price":{{close}},"qty":1}
//
// Full payload fields accepted:
//   ticker / symbol — the instrument (e.g. "NQ1!", "NVDA")
//   action          — buy | sell | long | short | cover | close | exit | buy_to_cover | sell_short
//   price           — fill price (float)
//   qty / shares / contracts — position size (optional)
//   notes           — free text (optional)

import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { saveTrade } from '@/lib/trade-journal'

export function deriveWebhookKey(userId: string): string {
  return createHmac('sha256', process.env.ANTHROPIC_API_KEY!)
    .update(`tv-webhook:${userId}`)
    .digest('hex')
    .slice(0, 32)
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get('uid')
  const key = searchParams.get('key')

  if (!uid || !key || key !== deriveWebhookKey(uid)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    const text = await req.text()
    // TradingView sometimes sends plain JSON without content-type, parse manually
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const symbol = ((body.ticker ?? body.symbol ?? '') as string).toUpperCase().replace(/[^A-Z0-9.^/!]/g, '')
  const price  = parseFloat(body.price ?? body.entryPrice ?? body.entry_price ?? 0)

  if (!symbol || !price) {
    return NextResponse.json({ error: 'ticker and price are required' }, { status: 400 })
  }

  const actionRaw = ((body.action ?? body.side ?? 'buy') as string).toLowerCase().replace(/[\s_-]/g, '')

  // Map TradingView action strings to side + status
  const isShortEntry = /sellshort|short$/.test(actionRaw)
  const isShortExit  = /buytocov|cover|buytocover/.test(actionRaw)
  const isLongExit   = /^sell$|^exit$|^close$/.test(actionRaw)

  const side: 'long' | 'short' = isShortEntry ? 'short' : isShortExit ? 'short' : 'long'
  const status: 'open' | 'closed' = (isLongExit || isShortExit) ? 'closed' : 'open'

  const qtyRaw = body.qty ?? body.shares ?? body.contracts
  const shares = qtyRaw ? Math.abs(parseInt(qtyRaw)) : undefined

  const today = new Date()
  const sessionDate = today.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // YYYY-MM-DD

  await saveTrade({
    userId: uid,
    symbol,
    side,
    entryPrice: price,
    shares,
    status,
    notes: body.notes ?? `TV alert: ${body.action ?? actionRaw}`,
    sessionDate,
  })

  return NextResponse.json({ ok: true, symbol, side, status, price })
}
