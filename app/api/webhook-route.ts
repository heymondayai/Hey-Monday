export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('[webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await syncSubscription(sub)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await syncSubscription(sub, true)
        break
      }

      case 'invoice.payment_succeeded': {
  const invoice = event.data.object as Stripe.Invoice
  const subId = (invoice as any).subscription as string | null
  if (subId) {
    const sub = await stripe.subscriptions.retrieve(subId)
    await syncSubscription(sub)
  }
  break
}

case 'invoice.payment_failed': {
  const invoice = event.data.object as Stripe.Invoice
  const customerId = (invoice as any).customer as string | null
  if (customerId) {
    await supabase
      .from('profiles')
      .update({ subscription_status: 'past_due' })
      .eq('stripe_customer_id', customerId)
  }
  break
}
    }
  } catch (err: any) {
    console.error('[webhook] Handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function syncSubscription(sub: Stripe.Subscription, deleted = false) {
  const customerId = typeof sub.customer === 'string'
    ? sub.customer
    : sub.customer.id

  const priceId = sub.items.data[0]?.price?.id ?? null
  const billing = priceId === process.env.STRIPE_PRICE_ANNUAL ? 'annual' : 'monthly'

  // current_period_end is on items in newer Stripe API — use billing_cycle_anchor as fallback
  const periodEnd = (sub as any).current_period_end
    ?? sub.items.data[0]?.current_period_end
    ?? null

  const payload = {
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    subscription_status: deleted ? 'canceled' : sub.status,
    billing_interval: billing,
    trial_ends_at: sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null,
    current_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('[webhook] Supabase update failed:', error)
    throw error
  }
}