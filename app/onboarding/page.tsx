'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/app/context/theme-context'
import Link from 'next/link'

const DARK = {
  pageBg: '#0a0a08', bg2: '#120f07', bg4: '#1c1608',
  border: '#2a2618', border2: '#3a3420',
  gold: '#c9922a', goldDim: '#8a6420',
  text: '#d4c5a0', text2: '#a08040', text3: '#6a6050',
  heading: '#e8d5a0',
  navBg: '#0a0a08',
  cardBg: 'rgba(255,255,255,0.02)', cardBorder: 'rgba(255,255,255,0.07)',
  featureText: 'rgba(212,197,160,0.35)', featureTextOn: 'rgba(212,197,160,0.8)',
  subText: 'rgba(212,197,160,0.4)',
  btnDisabledBg: 'rgba(255,255,255,0.04)', btnDisabledBorder: 'rgba(255,255,255,0.08)', btnDisabledColor: 'rgba(212,197,160,0.2)',
  gridLine: 'rgba(201,146,42,.03)',
  errColor: '#c94242',
}

const LIGHT = {
  pageBg: '#f5f0e8', bg2: '#ede6d6', bg4: '#ddd3ba',
  border: '#c8b898', border2: '#b8a47e',
  gold: '#a06818', goldDim: '#7a5010',
  text: '#2a1f0e', text2: '#6b4c20', text3: '#8a7050',
  heading: '#1a1008',
  navBg: '#f5f0e8',
  cardBg: 'rgba(42,31,14,0.02)', cardBorder: 'rgba(42,31,14,0.08)',
  featureText: 'rgba(42,31,14,0.35)', featureTextOn: 'rgba(42,31,14,0.8)',
  subText: 'rgba(42,31,14,0.4)',
  btnDisabledBg: 'rgba(42,31,14,0.03)', btnDisabledBorder: 'rgba(42,31,14,0.08)', btnDisabledColor: 'rgba(42,31,14,0.2)',
  gridLine: 'rgba(160,104,24,.04)',
  errColor: '#b83232',
}

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
    color: '#e05c5c',
    borderColor: 'rgba(224,92,92,0.35)',
    bgColor: 'rgba(224,92,92,0.05)',
    glowColorDark: 'rgba(224,92,92,0.12)',
    glowColorLight: 'rgba(224,92,92,0.07)',
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
    color: '#c9922a',
    borderColor: 'rgba(201,146,42,0.35)',
    bgColor: 'rgba(201,146,42,0.05)',
    glowColorDark: 'rgba(201,146,42,0.12)',
    glowColorLight: 'rgba(201,146,42,0.07)',
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
    color: '#5a8fc2',
    borderColor: 'rgba(90,143,194,0.35)',
    bgColor: 'rgba(90,143,194,0.05)',
    glowColorDark: 'rgba(90,143,194,0.12)',
    glowColorLight: 'rgba(90,143,194,0.07)',
  },
]

function SunIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}
function MoonIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export default function OnboardingPage() {
  const { isDark, toggle } = useTheme()
  const T = isDark ? DARK : LIGHT

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
    return () => { mounted = false }
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
      setError(err?.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const activeType = TRADER_TYPES.find(t => t.id === selected)

  if (checking) {
    return (
      <div style={{ background: T.pageBg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.gold, fontFamily: "'JetBrains Mono', monospace", transition: 'background 0.3s' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}`}</style>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ background: T.pageBg, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'JetBrains Mono', monospace", color: T.text, transition: 'background 0.3s, color 0.3s', position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fade-up{animation:fadeUp 0.4s ease both}
        @media(max-width:700px){.trader-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* Glow */}
      {selected && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: isDark ? activeType?.glowColorDark : activeType?.glowColorLight,
          filter: 'blur(100px)', pointerEvents: 'none',
          transition: 'background 0.5s', zIndex: 0,
        }} />
      )}

      {/* Grid */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `linear-gradient(${T.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${T.gridLine} 1px, transparent 1px)`, backgroundSize: '48px 48px', pointerEvents: 'none', zIndex: 0 }} />

      {/* NAV */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.navBg, position: 'relative', zIndex: 2, transition: 'background 0.3s, border-color 0.3s' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.heading, fontWeight: 600 }}>Hey </span>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.gold, fontWeight: 700 }}>Monday</span>
        </Link>
        <button onClick={toggle}
          style={{ background: T.bg2, border: `1px solid ${T.border2}`, borderRadius: 24, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: T.text2, transition: 'all 0.3s' }}>
          {isDark ? <SunIcon color={T.text2} /> : <MoonIcon color={T.text2} />}
        </button>
      </nav>

      {/* CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 900 }}>

          {/* HEADER */}
          <div className="fade-up" style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontStyle: 'italic', fontWeight: 700, color: T.heading, marginBottom: 8, transition: 'color 0.3s' }}>
              Let's personalize your experience
            </div>
            <div style={{ fontSize: 11, color: T.text3, letterSpacing: '0.08em', lineHeight: 1.7, transition: 'color 0.3s' }}>
              How do you trade? Your dashboard, data, and Monday's voice will be tailored to your style.
              <br />You can change this anytime in Settings.
            </div>
          </div>

          {/* CARDS */}
          <div className="trader-grid fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 36 }}>
            {TRADER_TYPES.map(type => {
              const isSelected = selected === type.id
              return (
                <div
                  key={type.id}
                  onClick={() => setSelected(type.id)}
                  style={{
                    background: isSelected ? type.bgColor : T.cardBg,
                    border: `1px solid ${isSelected ? type.borderColor : T.cardBorder}`,
                    padding: '24px 20px',
                    cursor: 'pointer',
                    transition: 'all 0.25s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Top accent line */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: isSelected ? type.color : 'transparent', transition: 'background 0.25s' }} />

                  {/* Check */}
                  {isSelected && (
                    <div style={{ position: 'absolute', top: 14, right: 14, width: 18, height: 18, borderRadius: '50%', background: type.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700 }}>
                      ✓
                    </div>
                  )}

                  <div style={{ fontSize: 28, marginBottom: 12 }}>{type.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? type.color : T.heading, marginBottom: 4, transition: 'color 0.25s' }}>
                    {type.label}
                  </div>
                  <div style={{ fontSize: 10, color: T.subText, marginBottom: 18, lineHeight: 1.6, letterSpacing: '0.02em', transition: 'color 0.3s' }}>
                    {type.sub}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {type.features.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? type.color : T.text3, flexShrink: 0, marginTop: 5, transition: 'background 0.25s' }} />
                        <span style={{ fontSize: 11, color: isSelected ? T.featureTextOn : T.featureText, lineHeight: 1.5, transition: 'color 0.25s' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* CTA */}
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleContinue}
              disabled={!selected || loading}
              style={{
                padding: '14px 48px',
                background: selected ? type_bgFor(selected) : T.btnDisabledBg,
                border: `1px solid ${selected ? activeType?.borderColor ?? T.border : T.btnDisabledBorder}`,
                color: selected ? (activeType?.color ?? T.gold) : T.btnDisabledColor,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: selected && !loading ? 'pointer' : 'default',
                fontFamily: "'JetBrains Mono', monospace",
                transition: 'all 0.25s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {loading ? (
                <>
                  <span style={{ width: 12, height: 12, border: `2px solid ${activeType?.color ?? T.gold}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Setting up your dashboard…
                </>
              ) : selected
                ? `Continue as ${activeType?.label} →`
                : 'Select your trading style'
              }
            </button>

            {error && (
              <div style={{ fontSize: 11, color: T.errColor, letterSpacing: '0.04em' }}>{error}</div>
            )}

            <div style={{ fontSize: 9, color: T.text3, letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'color 0.3s' }}>
              You can change this anytime in Settings
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function type_bgFor(id: string) {
  const t = TRADER_TYPES.find(t => t.id === id)
  return t?.bgColor ?? 'transparent'
}