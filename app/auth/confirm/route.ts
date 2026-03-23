import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code') // OAuth PKCE code
  const next = searchParams.get('next')

  const loginUrl = new URL('/login', origin)
  const dashboardUrl = new URL('/dashboard', origin)
  const resetPasswordUrl = new URL('/reset-password', origin)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // ── GOOGLE OAUTH CALLBACK ──────────────────────────────────────
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

      if (!profile?.trader_type || !profile?.onboarding_complete) {
        return NextResponse.redirect(new URL('/onboarding', origin))
      }
      return NextResponse.redirect(dashboardUrl)
    }

    loginUrl.searchParams.set('error', 'oauth_failed')
    return NextResponse.redirect(loginUrl)
  }

  // ── EMAIL OTP / MAGIC LINK (your existing logic) ───────────────
  if (!token_hash || !type) {
    loginUrl.searchParams.set('error', 'missing_confirmation_link')
    return NextResponse.redirect(loginUrl)
  }

  const { error } = await supabase.auth.verifyOtp({ token_hash, type })

  if (error) {
    if (type === 'recovery') {
      resetPasswordUrl.searchParams.set('error', 'recovery_link_invalid')
      return NextResponse.redirect(resetPasswordUrl)
    }
    loginUrl.searchParams.set('error', 'confirmation_failed')
    return NextResponse.redirect(loginUrl)
  }

  if (type === 'recovery') {
    return NextResponse.redirect(next ? new URL(next, origin) : resetPasswordUrl)
  }
  if (type === 'magiclink') {
    return NextResponse.redirect(next ? new URL(next, origin) : dashboardUrl)
  }
  if (type === 'signup' || type === 'email') {
    const confirmedUrl = next ? new URL(next, origin) : loginUrl
    confirmedUrl.searchParams.set('confirmed', '1')
    return NextResponse.redirect(confirmedUrl)
  }

  return NextResponse.redirect(next ? new URL(next, origin) : loginUrl)
}