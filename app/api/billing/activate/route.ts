import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function toIso(ts?: number | null) {
  return ts ? new Date(ts * 1000).toISOString() : null
}

// Called from the billing success page with the Stripe checkout session_id.
// Retrieves the session directly from Stripe — no webhook required.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const admin = createAdminSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { sessionId } = await req.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId.' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.items.data.price'],
    })

    if (session.status !== 'complete') {
      return NextResponse.json({ ok: false, reason: 'session_not_complete' })
    }

    const sub = session.subscription as Stripe.Subscription | null
    if (!sub) {
      return NextResponse.json({ ok: false, reason: 'no_subscription' })
    }

    await admin.from('profiles').update({
      stripe_subscription_id: sub.id,
      stripe_price_id: (sub as any).items?.data?.[0]?.price?.id ?? null,
      billing_interval: (sub as any).items?.data?.[0]?.price?.recurring?.interval ?? null,
      subscription_status: sub.status,
      trial_ends_at: toIso(sub.trial_end),
      current_period_end: toIso((sub as any).current_period_end),
      cancel_at_period_end: (sub as any).cancel_at_period_end,
      trial_used: true,
    }).eq('id', user.id)

    return NextResponse.json({ ok: true, subscriptionId: sub.id, status: sub.status })
  } catch (err: any) {
    console.error('[billing/activate]', err.message)
    return NextResponse.json({ error: err.message ?? 'Activation failed.' }, { status: 500 })
  }
}
