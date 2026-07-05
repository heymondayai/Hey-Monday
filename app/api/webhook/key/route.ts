// GET /api/webhook/key?uid=USER_ID
// Returns the webhook URL for the given user to paste into TradingView.
// The key is derived server-side via HMAC so no extra DB storage is needed.

import { NextResponse } from 'next/server'
import { deriveWebhookKey } from '../tv/route'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get('uid')
  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

  const key = deriveWebhookKey(uid)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://heymonday.store'
  const webhookUrl = `${baseUrl}/api/webhook/tv?uid=${uid}&key=${key}`

  return NextResponse.json({ webhookUrl })
}
