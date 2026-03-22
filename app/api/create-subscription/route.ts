export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

export async function POST(req: NextRequest) {
  try {
    const { email, name, paymentMethodId, priceId, billing } = await req.json()

    if (!email || !paymentMethodId || !priceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Create or retrieve Stripe customer
    const existingCustomers = await stripe.customers.list({ email, limit: 1 })
    let customer: Stripe.Customer

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id })
    } else {
      customer = await stripe.customers.create({
        email,
        name,
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId },
        metadata: { billing },
      })
    }

    // 2. Set as default payment method
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    // 3. Create subscription with 5-day trial
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: 5,
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: { email, name, billing },
    })

    // Access expanded invoice + payment_intent safely
    const invoice = subscription.latest_invoice as Stripe.Invoice & {
      payment_intent: Stripe.PaymentIntent | null
    }
    const clientSecret = invoice?.payment_intent?.client_secret ?? null

    return NextResponse.json({
      subscriptionId: subscription.id,
      customerId: customer.id,
      clientSecret,
      status: subscription.status,
      trialEnd: subscription.trial_end,
    })
  } catch (err: any) {
    console.error('[create-subscription]', err)
    return NextResponse.json(
      { error: err.message ?? 'Subscription creation failed' },
      { status: 500 }
    )
  }
}