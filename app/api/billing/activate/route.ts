import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function toIso(ts?: number | null) {
  return ts ? new Date(ts * 1000).toISOString() : null
}

// Called from the billing success page with the Stripe checkout session_id.
// Uses metadata.supabase_user_id from the Stripe session — no browser auth cookie required.
// This avoids auth session loss after the Stripe redirect.
export async function POST(req: NextRequest) {
  try {
    const admin = createAdminSupabaseClient()

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

    // The user ID is embedded in the Stripe session metadata at checkout creation time.
    const userId =
      session.metadata?.supabase_user_id ||
      (sub as any).metadata?.supabase_user_id

    if (!userId) {
      console.error('[billing/activate] No supabase_user_id in session metadata', session.id)
      return NextResponse.json({ ok: false, reason: 'no_user_id' })
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
    }).eq('id', userId)

    // Fetch trader_type + onboarding_complete so the client can route without its own auth query
    const { data: profile } = await admin
      .from('profiles')
      .select('trader_type, onboarding_complete')
      .eq('id', userId)
      .maybeSingle()

    return NextResponse.json({
      ok: true,
      subscriptionId: sub.id,
      status: sub.status,
      traderType: profile?.trader_type ?? null,
      onboardingComplete: profile?.onboarding_complete ?? false,
    })
  } catch (err: any) {
    console.error('[billing/activate]', err.message)
    return NextResponse.json({ error: err.message ?? 'Activation failed.' }, { status: 500 })
  }
}
