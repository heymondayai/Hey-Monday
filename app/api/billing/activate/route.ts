import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function toIso(ts?: number | null) {
  return ts ? new Date(ts * 1000).toISOString() : null
}

interface SessionExtras {
  userId: string | null
  email: string | null
  fullName: string | null
  customerId: string | null
}

async function resolveSessionExtras(session: Stripe.Checkout.Session, sub: Stripe.Subscription): Promise<SessionExtras> {
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : (session.customer as Stripe.Customer | null)?.id ?? null

  // Email/name from Stripe's collected customer details (most reliable)
  let email: string | null = session.customer_details?.email ?? null
  let fullName: string | null = session.customer_details?.name ?? null

  // 1. Session-level metadata (set at checkout creation time)
  let userId: string | null = session.metadata?.supabase_user_id ?? null

  // 2. Subscription metadata
  if (!userId) userId = (sub as any).metadata?.supabase_user_id ?? null

  // 3. Stripe customer metadata + fill in email/name gaps
  if (customerId && (!userId || !email || !fullName)) {
    try {
      const customer = await stripe.customers.retrieve(customerId)
      if (!('deleted' in customer)) {
        if (!userId) userId = customer.metadata?.supabase_user_id ?? null
        if (!email) email = customer.email ?? null
        if (!fullName) fullName = customer.name ?? null
      }
    } catch {}
  }

  return { userId, email, fullName, customerId }
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

    const { userId, email, fullName, customerId } = await resolveSessionExtras(session, sub)

    if (!userId) {
      console.error('[billing/activate] No supabase_user_id found for session', session.id)
      return NextResponse.json({ ok: false, reason: 'no_user_id' })
    }

    // plan comes from checkout session metadata ('edge' | 'core')
    const plan = session.metadata?.plan ?? null

    const profileFields = {
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      stripe_price_id: (sub as any).items?.data?.[0]?.price?.id ?? null,
      billing_interval: (sub as any).items?.data?.[0]?.price?.recurring?.interval ?? null,
      subscription_status: sub.status,
      trial_ends_at: toIso(sub.trial_end),
      current_period_end: toIso((sub as any).current_period_end),
      cancel_at_period_end: (sub as any).cancel_at_period_end,
      trial_used: true,
      ...(plan ? { plan } : {}),
      ...(email ? { email } : {}),
      ...(fullName ? { full_name: fullName } : {}),
    }

    const { error: updateErr, count } = await admin.from('profiles').update(
      profileFields, { count: 'exact' }
    ).eq('id', userId)

    if (updateErr) {
      console.error('[billing/activate] Profile update failed', updateErr.message, 'userId:', userId)
      return NextResponse.json({ ok: false, reason: 'db_error', detail: updateErr.message })
    }

    // count === 0 means the profile row doesn't exist — try upsert instead
    if (count === 0) {
      console.warn('[billing/activate] Profile row not found for userId, attempting upsert', userId)
      const { error: upsertErr } = await admin.from('profiles').upsert({
        id: userId,
        ...profileFields,
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
