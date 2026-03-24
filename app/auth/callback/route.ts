import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')

  const loginUrl = new URL('/login', origin)
  const resetPasswordUrl = new URL('/reset-password', origin)

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {}
        },
      },
    }
  )

  async function routeUser(userId: string, userEmail: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('trader_type, onboarding_complete, stripe_subscription_id, subscription_status')
    .eq('id', userId)
    .maybeSingle()

  const hasPaidAccess =
    !!profile?.stripe_subscription_id &&
    ['trialing', 'active'].includes(profile?.subscription_status ?? '')

  if (!hasPaidAccess) {
    const url = new URL('/signup', origin)
    url.searchParams.set('confirmed', '1')
    url.searchParams.set('email', userEmail)
    return NextResponse.redirect(url)
  }

  if (!profile?.trader_type || !profile?.onboarding_complete) {
    return NextResponse.redirect(new URL('/onboarding', origin))
  }

  return NextResponse.redirect(new URL('/dashboard', origin))
}

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.user) {
      console.error('OAuth/code exchange error:', error?.message)
      loginUrl.searchParams.set('error', 'oauth_failed')
      return NextResponse.redirect(loginUrl)
    }

    return routeUser(data.user.id, data.user.email ?? '')
  }

  if (token_hash && type) {
    if (type === 'recovery') {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type })

      if (error) {
        resetPasswordUrl.searchParams.set('error', 'recovery_link_invalid')
        return NextResponse.redirect(resetPasswordUrl)
      }

      return NextResponse.redirect(next ? new URL(next, origin) : resetPasswordUrl)
    }

    const { error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (error) {
      loginUrl.searchParams.set('error', 'confirmation_failed')
      return NextResponse.redirect(loginUrl)
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      loginUrl.searchParams.set('error', 'confirmation_failed')
      return NextResponse.redirect(loginUrl)
    }

    return routeUser(user.id, user.email ?? '')
  }

  loginUrl.searchParams.set('error', 'missing_confirmation_link')
  return NextResponse.redirect(loginUrl)
}