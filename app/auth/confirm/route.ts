import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')

  const loginUrl = new URL('/login', origin)
  const dashboardUrl = new URL('/dashboard', origin)
  const resetPasswordUrl = new URL('/reset-password', origin)

  if (!token_hash || !type) {
    loginUrl.searchParams.set('error', 'missing_confirmation_link')
    return NextResponse.redirect(loginUrl)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

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

  if (type === 'recovery') {
    if (next) {
      return NextResponse.redirect(new URL(next, origin))
    }
    return NextResponse.redirect(resetPasswordUrl)
  }

  if (type === 'magiclink') {
    if (next) {
      return NextResponse.redirect(new URL(next, origin))
    }
    return NextResponse.redirect(dashboardUrl)
  }

  if (type === 'signup' || type === 'email') {
    const confirmedUrl = next ? new URL(next, origin) : loginUrl
    confirmedUrl.searchParams.set('confirmed', '1')
    return NextResponse.redirect(confirmedUrl)
  }

  if (next) {
    return NextResponse.redirect(new URL(next, origin))
  }

  return NextResponse.redirect(loginUrl)
}