import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  const loginUrl = new URL('/login', origin)
  const dashboardUrl = new URL('/dashboard', origin)
  const resetPasswordUrl = new URL('/reset-password', origin)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // ── OAUTH / EMAIL CONFIRMATION CODE EXCHANGE ───────────────────
  // Both Google OAuth and Supabase email confirmation use the `code` param
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      loginUrl.searchParams.set('error', 'oauth_failed')
      return NextResponse.redirect(loginUrl)
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('trader_type, onboarding_complete, stripe_subscription_id')
        .eq('id', user.id)
        .maybeSingle()

      // No Stripe subscription yet → this is a fresh signup (email or Google)
      // Send them to payment step
      if (!profile?.stripe_subscription_id) {
        const signupUrl = new URL('/signup', origin)
        signupUrl.searchParams.set('confirmed', '1')
        signupUrl.searchParams.set('email', user.email ?? '')
        return NextResponse.redirect(signupUrl)
      }

      // Has subscription but hasn't finished onboarding
      if (!profile?.trader_type || !profile?.onboarding_complete) {
        return NextResponse.redirect(new URL('/onboarding', origin))
      }

      // Fully set up → dashboard
      return NextResponse.redirect(dashboardUrl)
    }

    loginUrl.searchParams.set('error', 'oauth_failed')
    return NextResponse.redirect(loginUrl)
  }

  // ── EMAIL OTP (token_hash) — magic links, password reset, etc. ─
  if (!token_hash || !type) {
    loginUrl.searchParams.set('error', 'missing_confirmation_link')
    return NextResponse.redirect(loginUrl)
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  })

  if (error) {
    if (type === 'recovery') {
      resetPasswordUrl.searchParams.set('error', 'recovery_link_invalid')
      return NextResponse.redirect(resetPasswordUrl)
    }
    loginUrl.searchParams.set('error', 'confirmation_failed')
    return NextResponse.redirect(loginUrl)
  }

  // Password reset
  if (type === 'recovery') {
    if (next) return NextResponse.redirect(new URL(next, origin))
    return NextResponse.redirect(resetPasswordUrl)
  }

  // Magic link
  if (type === 'magiclink') {
    if (next) return NextResponse.redirect(new URL(next, origin))
    return NextResponse.redirect(dashboardUrl)
  }

  // Email signup confirmation via token_hash (older flow)
  if (type === 'signup' || type === 'email') {
    // Get the user to check their subscription status
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_subscription_id, trader_type, onboarding_complete')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile?.stripe_subscription_id) {
        const signupUrl = new URL('/signup', origin)
        signupUrl.searchParams.set('confirmed', '1')
        signupUrl.searchParams.set('email', user.email ?? '')
        return NextResponse.redirect(signupUrl)
      }

      if (!profile?.trader_type || !profile?.onboarding_complete) {
        return NextResponse.redirect(new URL('/onboarding', origin))
      }

      return NextResponse.redirect(dashboardUrl)
    }

    // Fallback — send to login with confirmed flag
    const confirmedUrl = next ? new URL(next, origin) : loginUrl
    confirmedUrl.searchParams.set('confirmed', '1')
    return NextResponse.redirect(confirmedUrl)
  }

  // Catch-all
  if (next) return NextResponse.redirect(new URL(next, origin))
  return NextResponse.redirect(loginUrl)
}