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

    const { data: inserted } = await supabase.from('tradingview_alerts').insert({
      user_id: keyRow.user_id,
      ticker,
      price,
      message: message.slice(0, 1000),
      interval,
      exchange,
      raw_payload: payload,
    }).select().single()

    // Broadcast to the user's realtime channel so the dashboard gets instant delivery
    if (inserted) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({
          messages: [{
            topic: `realtime:tv-alert-${keyRow.user_id}`,
            event: 'new-alert',
            payload: inserted,
          }],
        }),
      }).catch(() => {/* non-fatal */})
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[webhook/tradingview]', err.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
