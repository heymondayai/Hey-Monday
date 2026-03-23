'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthConfirmPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function routeUser(userId: string, userEmail: string) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('trader_type, onboarding_complete, stripe_subscription_id')
        .eq('id', userId)
        .maybeSingle()

      if (!profile?.stripe_subscription_id) {
        router.replace(`/signup?confirmed=1&email=${encodeURIComponent(userEmail)}`)
        return
      }

      if (!profile?.trader_type || !profile?.onboarding_complete) {
        router.replace('/onboarding')
        return
      }

      router.replace('/dashboard')
    }

    // First try: check if session already exists (handles page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        routeUser(session.user.id, session.user.email ?? '')
        return
      }

      // Second try: listen for the auth event (handles fresh OAuth redirect)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
            subscription.unsubscribe()
            await routeUser(session.user.id, session.user.email ?? '')
          }
        }
      )

      // Timeout fallback — if nothing fires in 5 seconds, try getSession one more time
      const timeout = setTimeout(async () => {
        subscription.unsubscribe()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          await routeUser(session.user.id, session.user.email ?? '')
        } else {
          router.replace('/login?error=oauth_failed')
        }
      }, 5000)

      return () => {
        clearTimeout(timeout)
        subscription.unsubscribe()
      }
    })
  }, [])

  return (
    <div style={{
      background: '#0a0a08',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace",
      color: '#c9922a',
      flexDirection: 'column',
      gap: 16,
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{
        width: 20,
        height: 20,
        border: '2px solid #c9922a',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        display: 'inline-block',
      }} />
      <span style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        Signing you in…
      </span>
    </div>
  )
}