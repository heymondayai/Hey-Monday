'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Suspense } from 'react'

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [message, setMessage] = useState('Finalizing your subscription...')

  useEffect(() => {
    let cancelled = false

    async function run() {
      const sessionId = searchParams.get('session_id')
      const { data: { session } } = await supabase.auth.getSession()

      // Without session_id we need auth for the fallback poll
      if (!sessionId && !session?.user) { router.replace('/login'); return }

      // ── Fast path: session_id → activate via Stripe API (no browser auth needed) ──
      if (sessionId) {
        for (let attempt = 0; attempt < 5; attempt++) {
          if (cancelled) return
          try {
            const res = await fetch('/api/billing/activate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            })
            const data = await res.json()
            if (cancelled) return
            if (data.ok) {
              if (!data.traderType || !data.onboardingComplete) {
                router.replace('/onboarding')
              } else {
                router.replace('/dashboard')
              }
              return
            }
            const reason = data.reason ?? data.detail ?? data.error ?? 'unknown'
            console.warn('[billing/success] activate attempt', attempt + 1, 'failed:', reason)
            if (data.reason === 'session_not_complete') {
              setMessage(`Waiting for payment to confirm... (${attempt + 1}/5)`)
            } else {
              setMessage(`Setting up your account... (${attempt + 1}/5)`)
            }
            await new Promise(r => setTimeout(r, 2000))
          } catch (err: any) {
            console.warn('[billing/success] activate fetch error:', err?.message)
            await new Promise(r => setTimeout(r, 2000))
          }
        }
      }

      // ── Fallback: poll Supabase for webhook write ─────────────────────────────
      if (!session?.user) { router.replace('/login'); return }

      for (let i = 0; i < 20; i++) {
        if (cancelled) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_subscription_id, trader_type, onboarding_complete')
          .eq('id', session.user.id)
          .maybeSingle()
        if (cancelled) return
        if (profile?.stripe_subscription_id) {
          if (!profile?.trader_type || !profile?.onboarding_complete) {
            router.replace('/onboarding')
          } else {
            router.replace('/dashboard')
          }
          return
        }
        setMessage(`Finalizing your subscription... (${i + 1}/20)`)
        await new Promise(r => setTimeout(r, 1500))
      }

      setMessage('Subscription is still processing. Please refresh in a moment.')
    }

    run()
    return () => { cancelled = true }
  }, [router, supabase, searchParams])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a08', color: '#c9922a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", flexDirection: 'column', gap: 14 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ width: 18, height: 18, border: '2px solid #c9922a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
      <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{message}</div>
    </div>
  )
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0a08', color: '#c9922a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", flexDirection: 'column', gap: 14 }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span style={{ width: 18, height: 18, border: '2px solid #c9922a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
        <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Loading...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
