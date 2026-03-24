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
    const cancelAtPeriodEnd = !!body.cancelAtPeriodEnd

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found.' },
        { status: 400 }
      )
    }

    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: cancelAtPeriodEnd,
    })

    const subscription = await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id
    )

    const stripeSub = subscription as any

    const currentPeriodEnd =
      stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000).toISOString()
        : null

    const trialEndsAt =
      stripeSub.trial_end
        ? new Date(stripeSub.trial_end * 1000).toISOString()
        : null

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        subscription_status: stripeSub.status,
        cancel_at_period_end: stripeSub.cancel_at_period_end,
        current_period_end: currentPeriodEnd,
        trial_ends_at: trialEndsAt,
      })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      cancel_at_period_end: stripeSub.cancel_at_period_end,
      subscription_status: stripeSub.status,
      current_period_end: currentPeriodEnd,
      trial_ends_at: trialEndsAt,
    })
  } catch (err: any) {
    console.error('billing cancel/reactivate error:', err)
    return NextResponse.json(
      { error: err?.message || 'Could not update subscription.' },
      { status: 500 }
    )
  }
}