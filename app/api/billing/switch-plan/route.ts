import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const ALLOWED_PRICE_IDS = [
  process.env.NEXT_PUBLIC_STRIPE_PRICE_CORE_MONTHLY,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_CORE_ANNUAL,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_EDGE_MONTHLY,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_EDGE_ANNUAL,
  // legacy fallback IDs
  process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL,
].filter(Boolean) as string[]

function toIso(ts?: number | null) {
  return ts ? new Date(ts * 1000).toISOString() : null
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const admin = createAdminSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const newPriceId: string | undefined = body.priceId

    if (!newPriceId || !ALLOWED_PRICE_IDS.includes(newPriceId)) {
      return NextResponse.json({ error: 'Invalid price ID.' }, { status: 400 })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found.' }, { status: 400 })
    }

    const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id) as any
    const itemId = sub.items?.data?.[0]?.id

    if (!itemId) {
      return NextResponse.json({ error: 'Could not find subscription item.' }, { status: 400 })
    }

    // Already on this price — no-op
    if (sub.items?.data?.[0]?.price?.id === newPriceId) {
      return NextResponse.json({ ok: true, alreadyCurrent: true })
    }

    // Resolve promo code string → Stripe promotion_code ID
    const promoCodeStr: string | undefined = typeof body.promoCode === 'string' ? body.promoCode.trim() : undefined
    let promotionCodeId: string | undefined
    if (promoCodeStr) {
      const promoCodes = await stripe.promotionCodes.list({ code: promoCodeStr, active: true, limit: 1 })
      if (promoCodes.data.length === 0) {
        return NextResponse.json({ error: 'Invalid or expired promo code.' }, { status: 400 })
      }
      promotionCodeId = promoCodes.data[0].id
    }

    const updateParams: Stripe.SubscriptionUpdateParams & { promotion_code?: string } = {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
    }
    if (promotionCodeId) updateParams.promotion_code = promotionCodeId

    const updated = await stripe.subscriptions.update(profile.stripe_subscription_id, updateParams) as any

    const newPriceObj = updated.items?.data?.[0]?.price
    const updates = {
      stripe_price_id: newPriceObj?.id ?? newPriceId,
      billing_interval: newPriceObj?.recurring?.interval ?? null,
      subscription_status: updated.status,
      trial_ends_at: toIso(updated.trial_end),
      current_period_end: toIso(updated.current_period_end),
      cancel_at_period_end: updated.cancel_at_period_end,
    }

    await admin.from('profiles').update(updates).eq('id', user.id)

    return NextResponse.json({ ok: true, ...updates })
  } catch (err: any) {
    console.error('switch-plan error:', err)
    return NextResponse.json(
      { error: err?.message || 'Could not switch plan.' },
      { status: 500 }
    )
  }
}
