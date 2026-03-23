'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthConfirmPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function handleHashSession() {
      // Supabase will automatically parse the hash and set the session
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session?.user) {
        router.replace('/login?error=confirmation_failed')
        return
      }

      const user = session.user

      const { data: profile } = await supabase
        .from('profiles')
        .select('trader_type, onboarding_complete, stripe_subscription_id')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile?.stripe_subscription_id) {
        router.replace(`/signup?confirmed=1&email=${encodeURIComponent(user.email ?? '')}`)
        return
      }

      if (!profile?.trader_type || !profile?.onboarding_complete) {
        router.replace('/onboarding')
        return
      }

      router.replace('/dashboard')
    }

    handleHashSession()
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
        Confirming your account…
      </span>
    </div>
  )
}