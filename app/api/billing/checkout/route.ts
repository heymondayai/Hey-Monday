import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const admin = createAdminSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const billing = String(body?.billing || 'monthly')

    const monthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
    const annualPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL

    if (!monthlyPriceId || !annualPriceId) {
  return NextResponse.json(
    { error: 'Stripe price IDs are not configured.' },
    { status: 500 }
  )
    }

    const priceId =
    billing === 'annual' ? annualPriceId : monthlyPriceId

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, full_name, stripe_customer_id, trader_type, onboarding_complete')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const email =
      profile?.email ||
      user.email ||
      null

    if (!email) {
      return NextResponse.json(
        { error: 'No email found for this account.' },
        { status: 400 }
      )
    }

    const fullName =
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      [user.user_metadata?.given_name, user.user_metadata?.family_name].filter(Boolean).join(' ') ||
      email.split('@')[0]

    let customerId = profile?.stripe_customer_id || null

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: fullName,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      await admin
        .from('profiles')
        .update({
          stripe_customer_id: customer.id,
          email,
          full_name: fullName,
        })
        .eq('id', user.id)
    } else {
      await stripe.customers.update(customerId, {
        email,
        name: fullName,
        metadata: {
          supabase_user_id: user.id,
        },
      })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://heymonday.store'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      phone_number_collection: {
        enabled: false,
      },
      subscription_data: {
        trial_period_days: 5,
        metadata: {
          supabase_user_id: user.id,
          billing,
        },
      },
      metadata: {
        supabase_user_id: user.id,
        billing,
      },
      success_url: `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/billing/cancel`,
      customer_update: {
        name: 'auto',
        address: 'auto',
      },
    })

    return NextResponse.json({
      ok: true,
      url: session.url,
    })
  } catch (err: any) {
    console.error('checkout route error:', err)
    return NextResponse.json(
      { error: err?.message || 'Could not create checkout session.' },
      { status: 500 }
    )
  }
}