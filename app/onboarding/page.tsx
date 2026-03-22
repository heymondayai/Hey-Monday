'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const TRADER_TYPES = [
  {
    id: 'day',
    icon: '⚡',
    label: 'Day Trader',
    sub: 'I open and close positions same day',
    features: [
      'Streaming real-time prices',
      'Unusual options flow alerts',
      'Volume spike detection',
      'Instant voice alerts on big moves',
      '"What just happened" explanations',
      'Pre & post-market data',
    ],
    color: '#f87171',
    borderColor: 'rgba(248,113,113,0.4)',
    bgColor: 'rgba(248,113,113,0.06)',
    glowColor: 'rgba(248,113,113,0.15)',
  },
  {
    id: 'swing',
    icon: '📈',
    label: 'Swing Trader',
    sub: 'I hold positions for days or weeks',
    features: [
      'Daily morning briefing',
      'Earnings calendar & previews',
      'Sector rotation signals',
      'AI-curated watchlist news',
      'Scheduled summaries',
      'Technical level alerts',
    ],
    color: '#e8b84b',
    borderColor: 'rgba(232,184,75,0.4)',
    bgColor: 'rgba(232,184,75,0.06)',
    glowColor: 'rgba(232,184,75,0.15)',
  },
  {
    id: 'longterm',
    icon: '🏦',
    label: 'Long-Term Investor',
    sub: 'I think in months and years',
    features: [
      'Macro & Fed calendar focus',
      'Monthly portfolio briefings',
      'Deep AI research mode',
      'Sector allocation insights',
      'Earnings report summaries',
      'Low noise, calm interface',
    ],
    color: '#7ab8e8',
    borderColor: 'rgba(122,184,232,0.4)',
    bgColor: 'rgba(122,184,232,0.06)',
    glowColor: 'rgba(122,184,232,0.15)',
  },
]

export default function OnboardingPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    async function validateUser() {
      const { data, error } = await supabase.auth.getUser()
      const user = data.user

      if (!mounted) return

      if (error || !user) {
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }

      if (!user.email_confirmed_at) {
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('trader_type, onboarding_complete')
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return

      if (profile?.trader_type && profile?.onboarding_complete) {
        router.replace('/dashboard')
        return
      }

      setChecking(false)
    }

    validateUser()

    return () => {
      mounted = false
    }
  }, [supabase, router])

  async function handleContinue() {
    if (!selected || loading) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: userError } = await supabase.auth.getUser()
      const user = data.user

      if (userError || !user) {
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }

      if (!user.email_confirmed_at) {
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            trader_type: selected,
            onboarding_complete: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )

      if (upsertError) throw upsertError

      router.push('/dashboard')
    } catch (err: any) {
      console.error('Onboarding setup failed:', err)
      setError(err?.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const activeType = TRADER_TYPES.find((t) => t.id === selected)

  if (checking) {
    return (
      <div style={{
        background: '#080808',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e8b84b',
        fontFamily: 'sans-serif',
      }}>
        Loading...
      </div>
    )
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />

      <div style={{ background: '#080808', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", color: '#ffffff', padding: '40px 20px', position: 'relative', overflow: 'hidden' }}>
        {selected && (
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', borderRadius: '50%', background: activeType?.glowColor, filter: 'blur(120px)', pointerEvents: 'none', transition: 'background 0.5s', zIndex: 0 }}></div>
        )}

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '860px' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: 600, fontStyle: 'italic', color: '#ffffff', marginBottom: '8px' }}>
              Hey <span style={{ color: '#e8b84b' }}>Monday</span>
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>
              Let&apos;s personalize your experience
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500, fontStyle: 'italic', color: '#ffffff', marginBottom: '10px' }}>
              How do you trade?
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', lineHeight: 1.7 }}>
              Your dashboard, data, and Monday&apos;s voice will be tailored to your style.
              <br />
              You can change this anytime in Settings.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' }}>
            {TRADER_TYPES.map((type) => {
              const isSelected = selected === type.id
              return (
                <div
                  key={type.id}
                  onClick={() => setSelected(type.id)}
                  style={{
                    background: isSelected ? type.bgColor : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isSelected ? type.borderColor : 'rgba(255,255,255,0.08)'}`,
                    padding: '24px 20px',
                    cursor: 'pointer',
                    transition: 'all 0.25s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: isSelected ? type.color : 'transparent', transition: 'background 0.25s' }}></div>

                  {isSelected && (
                    <div style={{ position: 'absolute', top: '14px', right: '14px', width: '18px', height: '18px', borderRadius: '50%', background: type.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#080808', fontWeight: 700 }}>
                      ✓
                    </div>
                  )}

                  <div style={{ fontSize: '28px', marginBottom: '12px' }}>{type.icon}</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: isSelected ? type.color : '#ffffff', marginBottom: '4px', transition: 'color 0.25s' }}>{type.label}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px', lineHeight: 1.5 }}>{type.sub}</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {type.features.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: isSelected ? type.color : 'rgba(255,255,255,0.25)', flexShrink: 0, marginTop: '5px', transition: 'background 0.25s' }}></div>
                        <span style={{ fontSize: '11px', color: isSelected ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)', lineHeight: 1.5, transition: 'color 0.25s' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div
              onClick={!loading && selected ? handleContinue : undefined}
              style={{
                padding: '14px 48px',
                background: selected ? (activeType?.color === '#e8b84b' ? 'rgba(232,184,75,0.18)' : activeType?.bgColor) : 'rgba(255,255,255,0.04)',
                border: `1px solid ${selected ? activeType?.borderColor : 'rgba(255,255,255,0.1)'}`,
                color: selected ? activeType?.color : 'rgba(255,255,255,0.25)',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: selected && !loading ? 'pointer' : 'default',
                transition: 'all 0.25s',
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {loading ? 'Setting up your dashboard...' : selected ? `Continue as ${activeType?.label} →` : 'Select your trading style'}
            </div>

            {error && (
              <div style={{ fontSize: '11px', color: '#f87171', letterSpacing: '0.04em' }}>{error}</div>
            )}

            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em' }}>
              You can change this anytime in Settings
            </div>
          </div>
        </div>
      </div>
    </>
  )
}