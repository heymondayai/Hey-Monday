import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

function toIso(ts?: number | null) {
  return ts ? new Date(ts * 1000).toISOString() : null
}

async function syncSubscriptionToProfile(subscriptionId: string) {
  const admin = createAdminSupabaseClient()

  const retrieved = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['customer'],
  })

  const subscription = retrieved as Stripe.Subscription

  const customer =
    typeof subscription.customer === 'string'
      ? await stripe.customers.retrieve(subscription.customer)
      : subscription.customer

  if (!customer || ('deleted' in customer && customer.deleted)) return

  const supabaseUserId =
    subscription.metadata?.supabase_user_id ||
    customer.metadata?.supabase_user_id

  if (!supabaseUserId) {
    console.warn('No supabase_user_id found on subscription/customer', subscription.id)
    return
  }

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  const stripeSub = subscription as any

await admin
  .from('profiles')
  .update({
    stripe_customer_id: customerId,
    stripe_subscription_id: stripeSub.id,
    stripe_price_id: stripeSub.items?.data?.[0]?.price?.id || null,
    billing_interval: stripeSub.items?.data?.[0]?.price?.recurring?.interval || null,
    subscription_status: stripeSub.status,
    trial_ends_at: toIso(stripeSub.trial_end),
    current_period_end: toIso(stripeSub.current_period_end),
    cancel_at_period_end: stripeSub.cancel_at_period_end,
  })
  .eq('id', supabaseUserId)
}

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const signature = (await headers()).get('stripe-signature')

    if (!signature || !webhookSecret) {
      return new NextResponse('Missing webhook config.', { status: 400 })
    }

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.subscription && typeof session.subscription === 'string') {
          await syncSubscriptionToProfile(session.subscription)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await syncSubscriptionToProfile(subscription.id)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any

        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id

        if (subscriptionId) {
          await syncSubscriptionToProfile(subscriptionId)
        }
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('stripe webhook error:', err)
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }
}