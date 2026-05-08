import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function toIso(ts?: number | null) {
  return ts ? new Date(ts * 1000).toISOString() : null
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const admin = createAdminSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json({ ok: true, synced: false })
    }

    const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, {
      expand: ['items.data.price', 'customer'],
    }) as any

    // Pull billing ZIP from the Stripe customer's address if available
    const customer = typeof sub.customer === 'object' ? sub.customer : null
    const billingZip = customer?.address?.postal_code ?? null

    const updates: Record<string, any> = {
      stripe_price_id: sub.items?.data?.[0]?.price?.id ?? null,
      billing_interval: sub.items?.data?.[0]?.price?.recurring?.interval ?? null,
      subscription_status: sub.status,
      trial_ends_at: toIso(sub.trial_end),
      current_period_end: toIso(sub.current_period_end),
      cancel_at_period_end: sub.cancel_at_period_end,
    }
    if (billingZip) updates.billing_zip = billingZip

    await admin.from('profiles').update(updates).eq('id', user.id)

    return NextResponse.json({ ok: true, synced: true, billing_zip: billingZip, ...updates })
  } catch (err: any) {
    console.error('billing sync error:', err)
    return NextResponse.json({ error: err?.message ?? 'Sync failed.' }, { status: 500 })
  }
}
