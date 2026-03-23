import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ExpandedInvoice = Stripe.Invoice & {
  payment_intent?: Stripe.PaymentIntent | string | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      email,
      name,
      cardholderName,
      zip,
      paymentMethodId,
      priceId,
      billing,
    } = body ?? {}

    if (!email || !paymentMethodId || !priceId) {
      return NextResponse.json(
        { error: 'Missing required payment fields.' },
        { status: 400 }
      )
    }

    const finalName =
      String(cardholderName || '').trim() ||
      String(name || '').trim() ||
      String(email).split('@')[0]

    const normalizedZip = String(zip || '').trim()

    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    })

    const customer =
      existingCustomers.data[0] ??
      (await stripe.customers.create({
        email,
        name: finalName,
        address: normalizedZip ? { postal_code: normalizedZip } : undefined,
        metadata: { billing },
      }))

    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      })
    } catch (err: any) {
      const alreadyAttached =
        err?.code === 'resource_already_exists' ||
        String(err?.message || '').toLowerCase().includes('already attached')

      if (!alreadyAttached) {
        throw err
      }
    }

    await stripe.customers.update(customer.id, {
      name: finalName,
      address: normalizedZip ? { postal_code: normalizedZip } : undefined,
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      trial_period_days: 5,
      payment_behavior: 'default_incomplete',
      collection_method: 'charge_automatically',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        billing,
        email,
        cardholderName: finalName,
        zip: normalizedZip,
      },
    })

    const expandedInvoice = subscription.latest_invoice as ExpandedInvoice | null
    const paymentIntent =
      expandedInvoice?.payment_intent &&
      typeof expandedInvoice.payment_intent !== 'string'
        ? expandedInvoice.payment_intent
        : null

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        email,
        full_name: finalName,
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        billing_interval: billing,
        subscription_status: subscription.status,
        trial_ends_at: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        current_period_end:
          subscription.items.data[0]?.current_period_end
            ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
            : null,
      })
      .eq('email', email)

    if (profileError) {
      console.error('Profile update error:', profileError)
      return NextResponse.json(
        { error: 'Subscription created, but profile update failed.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret: paymentIntent?.client_secret ?? null,
    })
  } catch (err: any) {
    console.error('create-subscription error:', {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      decline_code: err?.decline_code,
      raw: err,
    })

    return NextResponse.json(
      { error: err?.message || 'Subscription creation failed.' },
      { status: 500 }
    )
  }
}