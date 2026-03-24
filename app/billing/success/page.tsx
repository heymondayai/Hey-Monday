'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function BillingSuccessPage() {
  const router = useRouter()
  const supabase = createClient()
  const [message, setMessage] = useState('Finalizing your subscription...')

  useEffect(() => {
    let cancelled = false

    async function run() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.replace('/login')
        return
      }

      for (let i = 0; i < 20; i++) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_subscription_id, subscription_status, trader_type, onboarding_complete')
          .eq('id', session.user.id)
          .maybeSingle()

        if (cancelled) return

        if (profile?.stripe_subscription_id) {
          if (!profile?.trader_type || !profile?.onboarding_complete) {
            router.replace('/onboarding')
            return
          }
          router.replace('/dashboard')
          return
        }

        setMessage(`Finalizing your subscription... (${i + 1}/20)`)
        await new Promise(r => setTimeout(r, 1000))
      }

      setMessage('Subscription is still processing. Please refresh in a moment.')
    }

    run()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a08',
      color: '#c9922a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace",
      flexDirection: 'column',
      gap: 14,
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{
        width: 18,
        height: 18,
        border: '2px solid #c9922a',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        display: 'inline-block',
      }} />
      <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {message}
      </div>
    </div>
  )
}