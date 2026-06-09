import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function toIso(ts?: number | null) {
  return ts ? new Date(ts * 1000).toISOString() : null
}

async function resolveUserId(session: Stripe.Checkout.Session, sub: Stripe.Subscription): Promise<string | null> {
  // 1. Session-level metadata (set at checkout creation time)
  if (session.metadata?.supabase_user_id) return session.metadata.supabase_user_id

  // 2. Subscription metadata
  if ((sub as any).metadata?.supabase_user_id) return (sub as any).metadata.supabase_user_id

  // 3. Stripe customer metadata (fallback — customer was created with this)
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : (session.customer as any)?.id

  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId)
      if (!('deleted' in customer) && customer.metadata?.supabase_user_id) {
        return customer.metadata.supabase_user_id
      }
    } catch {}
  }

  return null
}

// Called from the billing success page with the Stripe checkout session_id.
// Uses Stripe session/customer metadata for user identity — no browser auth cookie required.
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

    const userId = await resolveUserId(session, sub)

    if (!userId) {
      console.error('[billing/activate] No supabase_user_id found for session', session.id)
      return NextResponse.json({ ok: false, reason: 'no_user_id' })
    }

    const { error: updateErr, count } = await admin.from('profiles').update({
      stripe_subscription_id: sub.id,
      stripe_price_id: (sub as any).items?.data?.[0]?.price?.id ?? null,
      billing_interval: (sub as any).items?.data?.[0]?.price?.recurring?.interval ?? null,
      subscription_status: sub.status,
      trial_ends_at: toIso(sub.trial_end),
      current_period_end: toIso((sub as any).current_period_end),
      cancel_at_period_end: (sub as any).cancel_at_period_end,
      trial_used: true,
    }, { count: 'exact' }).eq('id', userId)

    if (updateErr) {
      console.error('[billing/activate] Profile update failed', updateErr.message, 'userId:', userId)
      return NextResponse.json({ ok: false, reason: 'db_error', detail: updateErr.message })
    }

    // count === 0 means the profile row doesn't exist — try upsert instead
    if (count === 0) {
      console.warn('[billing/activate] Profile row not found for userId, attempting upsert', userId)
      const { error: upsertErr } = await admin.from('profiles').upsert({
        id: userId,
        stripe_subscription_id: sub.id,
        stripe_price_id: (sub as any).items?.data?.[0]?.price?.id ?? null,
        billing_interval: (sub as any).items?.data?.[0]?.price?.recurring?.interval ?? null,
        subscription_status: sub.status,
        trial_ends_at: toIso(sub.trial_end),
        current_period_end: toIso((sub as any).current_period_end),
        cancel_at_period_end: (sub as any).cancel_at_period_end,
        trial_used: true,
      }, { onConflict: 'id' })

      if (upsertErr) {
        console.error('[billing/activate] Profile upsert failed', upsertErr.message, 'userId:', userId)
        return NextResponse.json({ ok: false, reason: 'db_error', detail: upsertErr.message })
      }
    }

    // Fetch routing info so client doesn't need a second auth-dependent query
    const { data: profile } = await admin
      .from('profiles')
      .select('trader_type, onboarding_complete')
      .eq('id', userId)
      .maybeSingle()

    return NextResponse.json({
      ok: true,
      subscriptionId: sub.id,
      status: sub.status,
      userId,
      traderType: profile?.trader_type ?? null,
      onboardingComplete: profile?.onboarding_complete ?? false,
    })
  } catch (err: any) {
    console.error('[billing/activate]', err.message)
    return NextResponse.json({ ok: false, reason: 'exception', detail: err.message ?? 'Activation failed.' }, { status: 500 })
  }
}
