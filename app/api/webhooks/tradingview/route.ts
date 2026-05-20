import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get('key')
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 401 })

    const supabase = createAdminSupabaseClient()

    const { data: keyRow } = await supabase
      .from('webhook_keys')
      .select('user_id')
      .eq('secret_key', key)
      .maybeSingle()

    if (!keyRow) return NextResponse.json({ error: 'Invalid key' }, { status: 401 })

    const rawText = await req.text()
    let payload: Record<string, unknown> = {}
    try { payload = JSON.parse(rawText) } catch { payload = { message: rawText } }

    const ticker =
      typeof payload.ticker === 'string' && payload.ticker ? payload.ticker.toUpperCase() : null
    const priceRaw = payload.price != null ? parseFloat(String(payload.price)) : NaN
    const price = isFinite(priceRaw) ? priceRaw : null
    const message =
      typeof payload.message === 'string' && payload.message ? payload.message : rawText
    const interval = typeof payload.interval === 'string' ? payload.interval : null
    const exchange = typeof payload.exchange === 'string' ? payload.exchange : null

    await supabase.from('tradingview_alerts').insert({
      user_id: keyRow.user_id,
      ticker,
      price,
      message: message.slice(0, 1000),
      interval,
      exchange,
      raw_payload: payload,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[webhook/tradingview]', err.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
