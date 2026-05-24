import { NextRequest, NextResponse } from 'next/server'
import { getNyseEquitiesStatus } from '@/lib/market-hours'
import { runAlertCheck } from '@/lib/alert-engine'
import { deleteOldCandles } from '@/lib/candle-store'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret when configured
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Skip outside trading hours
  const { session } = getNyseEquitiesStatus()
  if (session === 'closed') {
    return NextResponse.json({ skipped: true, reason: 'market closed' })
  }

  // Daily candle cleanup at 6 PM ET (first two minutes only to avoid running 60×)
  const now = new Date()
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour:   'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now)
  const etHour   = parseInt(etParts.find((p) => p.type === 'hour')?.value   ?? '0', 10)
  const etMinute = parseInt(etParts.find((p) => p.type === 'minute')?.value ?? '99', 10)
  if (etHour === 18 && etMinute < 2) {
    await deleteOldCandles(95)
  }

  // Evaluate all enabled alert rules against latest candle data
  const firings = await runAlertCheck()

  // Broadcast each firing to the owning user via Supabase Realtime
  if (firings.length > 0) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey':        serviceKey,
        },
        body: JSON.stringify({
          messages: firings.map((f) => ({
            topic:   `realtime:proactive-alert-${f.user_id}`,
            event:   'alert-fired',
            payload: f,
          })),
        }),
      }).catch((err) => console.error('[check-alerts] broadcast:', err.message))
    }
  }

  return NextResponse.json({ ok: true, fired: firings.length, session })
}
