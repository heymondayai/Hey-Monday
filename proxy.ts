import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const PAID_STATUSES = new Set(['trialing', 'active'])

export async function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl

  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No session → must log in
  if (!user) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('email, trader_type, onboarding_complete, stripe_subscription_id, subscription_status')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('proxy profile error:', profileError.message)
    return NextResponse.redirect(new URL('/login', origin))
  }

  const hasPaidAccess =
    !!profile?.stripe_subscription_id &&
    PAID_STATUSES.has(profile?.subscription_status ?? '')

  // Logged in but not subscribed/trialing → force billing paywall
  if (!hasPaidAccess) {
    const email = encodeURIComponent(profile?.email || user.email || '')
    return NextResponse.redirect(
      new URL(`/signup?confirmed=1&email=${email}`, origin)
    )
  }

  // User is subscribed but has not finished onboarding
  if ((!profile?.trader_type || !profile?.onboarding_complete) && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/onboarding', origin))
  }

  // User already finished onboarding → don't let them sit on onboarding
  if (profile?.trader_type && profile?.onboarding_complete && pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/dashboard', origin))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding'],
}