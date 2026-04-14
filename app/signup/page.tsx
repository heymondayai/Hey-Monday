'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/app/context/theme-context'

const supabase = createClient()

const DARK = {
  pageBg: '#0a0a08', bg2: '#120f07', bg3: '#181208', bg4: '#1c1608',
  border: '#2a2618', border2: '#3a3420',
  gold: '#c9922a', goldDim: '#8a6420', amber: '#b8860b',
  red: '#c94242',
  text: '#d4c5a0', text2: '#a08040', text3: '#6a6050',
  heading: '#e8d5a0',
  badgeBg: 'rgba(201,146,42,.08)', badgeBorder: 'rgba(201,146,42,.2)',
  inputBg: '#0d0b07', inputBorder: '#2a2618', inputFocus: 'rgba(201,146,42,.5)',
  btnText: '#0a0a08',
  cardBg: '#120f07', cardBorder: 'rgba(201,146,42,.2)',
  trustBg: 'rgba(74,156,106,.06)', trustBorder: 'rgba(74,156,106,.2)',
  errBg: 'rgba(201,66,66,.08)', errBorder: 'rgba(201,66,66,.25)',
  successBg: 'rgba(74,222,128,.06)', successBorder: 'rgba(74,222,128,.2)', successText: '#4ade80',
  googleBg: '#120f07', googleBorder: '#3a3420', googleText: '#d4c5a0',
  checkBg: 'rgba(201,146,42,.04)', checkBorder: 'rgba(201,146,42,.15)',
}

const LIGHT = {
  pageBg: '#fafaf8', bg2: '#f2f1ee', bg3: '#e8e6e2', bg4: '#dedad5',
  border: '#d8d5d0', border2: '#c4c1bc',
  gold: '#b8750c', goldDim: '#9a6008', amber: '#b45309',
  red: '#dc2626',
  text: '#1a1a1a', text2: '#4a4a4a', text3: '#737373',
  heading: '#0f0f0f',
  badgeBg: 'rgba(184,117,12,.07)', badgeBorder: 'rgba(184,117,12,.22)',
  inputBg: '#ffffff', inputBorder: '#d8d5d0', inputFocus: 'rgba(184,117,12,.45)',
  btnText: '#ffffff',
  cardBg: '#ffffff', cardBorder: 'rgba(0,0,0,.10)',
  trustBg: 'rgba(22,163,74,.05)', trustBorder: 'rgba(22,163,74,.22)',
  errBg: 'rgba(220,38,38,.06)', errBorder: 'rgba(220,38,38,.28)',
  successBg: 'rgba(22,163,74,.06)', successBorder: 'rgba(22,163,74,.28)', successText: '#16a34a',
  googleBg: '#ffffff', googleBorder: '#d8d5d0', googleText: '#1a1a1a',
  checkBg: 'rgba(184,117,12,.04)', checkBorder: 'rgba(184,117,12,.18)',
}

const PLAN_FEATURES = [
  'Full AI voice — "Hey Monday" wake word',
  'Live prices: stocks, ETFs, futures, crypto',
  'High-impact economic calendar',
  'News feed with sentiment scoring',
  'Level 2 / order flow descriptions',
  'Morning & EOD spoken briefings',
]

type Field = 'email' | 'password' | 'name'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function LockIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function ShieldIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

function EyeOpen({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOff({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function SignupForm({
  isDark,
  billing,
  setBilling,
}: {
  isDark: boolean
  billing: 'monthly' | 'annual'
  setBilling: (b: 'monthly' | 'annual') => void
}) {
  const T = isDark ? DARK : LIGHT
  const searchParams = useSearchParams()

  const confirmedParam = searchParams.get('confirmed') === '1'
  const emailParam = searchParams.get('email') || ''

  const [step, setStep] = useState<1 | 2>(1)
  const [emailSent, setEmailSent] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState<Field | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  })

  useEffect(() => {
    if (confirmedParam && emailParam) {
      setForm(f => ({ ...f, email: emailParam }))
      setStep(2)
      window.history.replaceState({}, '', '/signup')
    }
  }, [confirmedParam, emailParam])

  const chargeDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 5)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  })()

  function set(field: Field, val: string) {
    setError('')
    setForm(f => ({ ...f, [field]: val }))
  }

  async function handleGoogleSignup() {
  setGoogleLoading(true)
  setError('')

  await supabase.auth.signOut()

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        prompt: 'select_account',
      },
    },
  })

  if (error) {
    setError(error.message)
    setGoogleLoading(false)
  }
}

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) {
      setError('Full name is required')
      return
    }

    if (!form.email.trim() || !form.email.includes('@')) {
      setError('Valid email required')
      return
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    setError('')

    const { error: signUpErr } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          full_name: form.name.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signUpErr) {
      const msg = signUpErr.message.toLowerCase()

      if (msg.includes('already') || msg.includes('registered')) {
        setError('An account with this email already exists. Please log in.')
      } else {
        setError(signUpErr.message)
      }

      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    setEmailSent(true)
    setLoading(false)
  }

  async function handleSecureCheckout() {
    try {
      setError('')
      setLoading(true)

      const billingMode = billing === 'annual' ? 'annual' : 'monthly'

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing: billingMode }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Could not start secure checkout.')
      }

      if (!data.url) {
        throw new Error('No checkout URL returned.')
      }

      window.location.href = data.url
    } catch (err: any) {
      setError(err.message || 'Could not start secure checkout.')
      setLoading(false)
    }
  }

  const inputStyle = (field: Field): React.CSSProperties => ({
    width: '100%',
    background: T.inputBg,
    border: `1px solid ${focused === field ? T.inputFocus : T.inputBorder}`,
    color: T.text,
    padding: '12px 14px',
    fontSize: 14,
    fontFamily: "'JetBrains Mono', monospace",
    outline: 'none',
    borderRadius: 4,
    transition: 'border-color 0.15s',
  })

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: T.text2,
    marginBottom: 6,
  }

  const [isGoogleUser, setIsGoogleUser] = useState(false)
  useEffect(() => {
    if (step === 2) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setIsGoogleUser(session?.user?.app_metadata?.provider === 'google')
      })
    }
  }, [step])

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {step === 1 && emailSent && (
        <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: T.checkBg, border: `1px solid ${T.checkBorder}`, padding: '32px 24px', textAlign: 'center', borderRadius: 8 }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>📬</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.heading, marginBottom: 8 }}>Check your email</div>
            <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.7 }}>
              Confirmation link sent to <strong style={{ color: T.gold }}>{form.email}</strong>.<br />
              Click it to proceed to payment.
            </div>
          </div>
          <div style={{ background: T.bg2, border: `1px solid ${T.border}`, padding: '12px 16px', fontSize: 12, color: T.text3, lineHeight: 1.6, borderRadius: 4 }}>
            💡 Check spam if you don't see it within a minute.
          </div>
          <button
            onClick={() => {
              setEmailSent(false)
              setError('')
            }}
            style={{ background: 'transparent', border: `1px solid ${T.border2}`, color: T.text3, padding: '11px', fontSize: 12, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", borderRadius: 4 }}
          >
            ← Use a different email
          </button>
        </div>
      )}

      {step === 1 && !emailSent && (
        <div className="fade-up">
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.18em', color: T.goldDim, textTransform: 'uppercase', marginBottom: 10 }}>Choose your plan</div>
            <div style={{ display: 'flex', background: T.bg2, border: `1px solid ${T.border2}`, padding: 3, gap: 3, borderRadius: 6 }}>
              {(['monthly', 'annual'] as const).map(b => (
                <div
                  key={b}
                  onClick={() => setBilling(b)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: billing === b ? T.bg4 : 'transparent',
                    color: billing === b ? T.heading : T.text3,
                    border: billing === b ? `1px solid ${T.border2}` : '1px solid transparent',
                    borderRadius: 4,
                    transition: 'all .15s',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {b === 'monthly' ? '$79.99/mo' : '$66.66/mo'}
                  {b === 'annual' && (
                    <span style={{ fontSize: 9, padding: '1px 6px', background: T.badgeBg, border: `1px solid ${T.badgeBorder}`, color: T.gold, borderRadius: 3 }}>
                      SAVE 17%
                    </span>
                  )}
                </div>
              ))}
            </div>
            {billing === 'annual' && <div style={{ marginTop: 8, fontSize: 11, color: T.gold }}>Billed as $799.92/year — save $159.96</div>}
          </div>

          <button
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            style={{
              width: '100%',
              background: T.googleBg,
              border: `1px solid ${T.googleBorder}`,
              color: T.googleText,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              borderRadius: 4,
              marginBottom: 16,
              fontFamily: 'system-ui, sans-serif',
              opacity: googleLoading ? 0.7 : 1,
            }}
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: T.border }} />
            <span style={{ fontSize: 12, color: T.text3 }}>or sign up with email</span>
            <div style={{ flex: 1, height: 1, background: T.border }} />
          </div>

          <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && <div style={{ background: T.errBg, border: `1px solid ${T.errBorder}`, color: T.red, padding: '11px 14px', fontSize: 13, borderRadius: 4 }}>⚠ {error}</div>}

            <div>
              <label style={labelStyle}>Full name</label>
              <input
                style={inputStyle('name')}
                type="text"
                placeholder="Jane Smith"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                onFocus={() => setFocused('name')}
                onBlur={() => setFocused(null)}
                autoComplete="name"
              />
            </div>
            <div>
              <label style={labelStyle}>Email address</label>
              <input
                style={inputStyle('email')}
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoComplete="email"
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle('password'), paddingRight: 44 }}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', background: 'none', border: 'none', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.6 }}
                >
                  {showPass ? <EyeOff color={T.text2} /> : <EyeOpen color={T.text2} />}
                </button>
              </div>
              {form.password && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 2,
                        background: form.password.length >= i * 3 ? (form.password.length >= 12 ? T.gold : T.amber) : T.border2,
                        transition: 'background 0.2s',
                      }}
                    />
                  ))}
                  <span style={{ fontSize: 10, color: T.text3, marginLeft: 6 }}>
                    {form.password.length < 8 ? 'Weak' : form.password.length < 12 ? 'Good' : 'Strong'}
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? T.goldDim : T.gold,
                color: T.btnText,
                padding: '13px',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                cursor: loading ? 'default' : 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 4,
                marginTop: 4,
                transition: 'background 0.2s',
              }}
            >
              {loading ? (
                <>
                  <span style={{ width: 14, height: 14, border: `2px solid ${T.btnText}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Sending confirmation…
                </>
              ) : 'Continue →'}
            </button>

            <div style={{ fontSize: 12, color: T.text3, lineHeight: 1.6, textAlign: 'center' }}>
              By continuing you agree to our{' '}
              <Link href="/terms" style={{ color: T.text2, textDecoration: 'underline' }}>Terms</Link> and{' '}
              <Link href="/privacy" style={{ color: T.text2, textDecoration: 'underline' }}>Privacy Policy</Link>.
            </div>
          </form>
        </div>
      )}

      {step === 2 && (
        <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: T.successBg, border: `1px solid ${T.successBorder}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 4 }}>
            <span style={{ fontSize: 16 }} />
            <div style={{ fontSize: 13, color: T.successText, fontWeight: 500 }}>
              {isGoogleUser ? 'Google account connected! Continue to secure checkout below.' : 'Email confirmed! Continue to secure checkout below.'}
            </div>
          </div>

          <div style={{ background: T.trustBg, border: `1px solid ${T.trustBorder}`, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', borderRadius: 4 }}>
            <ShieldIcon color="#4a9c6a" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.heading, marginBottom: 2 }}>Your card won't be charged today</div>
              <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.6 }}>
                5-day free trial. {billing === 'monthly' ? '$79.99/month' : '$66.66/month'} starts <strong style={{ color: T.gold }}>{chargeDate}</strong>. Cancel anytime.
              </div>
            </div>
          </div>

          {error && <div style={{ background: T.errBg, border: `1px solid ${T.errBorder}`, color: T.red, padding: '11px 14px', fontSize: 13, borderRadius: 4 }}>⚠ {error}</div>}

          <div style={{
            background: T.bg2,
            border: `1px solid ${T.border}`,
            padding: '20px',
            marginBottom: 4,
            borderRadius: 6,
          }}>
            <div style={{
              color: T.successText,
              marginBottom: 10,
              fontSize: 12,
              fontWeight: 600,
            }}>
              ✓ Payment is handled on secure Stripe checkout
            </div>

            <div style={{
              color: T.text2,
              fontSize: 13,
              lineHeight: 1.7,
              marginBottom: 14,
            }}>
              You’ll be redirected to Stripe to start your 5-day free trial securely.
              Your card won’t be charged today.
            </div>

            <div style={{
              color: T.text3,
              fontSize: 12,
              lineHeight: 1.7,
            }}>
              • Secure Stripe-hosted checkout<br />
              • 5-day free trial<br />
              • Cancel anytime from billing settings
            </div>
          </div>

          <button
            type="button"
            onClick={handleSecureCheckout}
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? T.goldDim : T.gold,
              color: T.btnText,
              padding: '14px',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: loading ? 'default' : 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              borderRadius: 4,
              transition: 'background 0.2s',
              marginTop: 4,
            }}
          >
            {loading ? (
              <>
                <span style={{ width: 14, height: 14, border: `2px solid ${T.btnText}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Redirecting…
              </>
            ) : (
              <>
                <LockIcon color={T.btnText} />
                Continue to Secure Checkout →
              </>
            )}
          </button>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
            {['256-bit SSL', 'Cancel anytime', 'Powered by Stripe'].map((t, i) => (
              <div key={i} style={{ fontSize: 11, color: T.text3, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: T.goldDim, display: 'inline-block' }} />
                {t}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SignupPageInner() {
  const { isDark } = useTheme()
  const T = isDark ? DARK : LIGHT
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const searchParams = useSearchParams()
  const confirmedParam = searchParams.get('confirmed') === '1'
  const currentStep = confirmedParam ? 2 : 1

  const price = billing === 'monthly' ? '79.99' : '66.66'
  const chargeDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 5)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  })()

  return (
    <div style={{ background: T.pageBg, color: T.text, fontFamily: "'JetBrains Mono', monospace", minHeight: '100vh', transition: 'background 0.3s, color 0.3s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        input:-webkit-autofill{-webkit-box-shadow:0 0 0 100px ${T.inputBg} inset!important;-webkit-text-fill-color:${T.text}!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
        .fade-up{animation:fadeUp 0.35s ease both}
        @media(max-width:640px){.layout{flex-direction:column!important}.sidebar{display:none!important}}
      `}</style>

      <nav style={{ borderBottom: `1px solid ${T.border}`, padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.bg2 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.heading, fontWeight: 600 }}>Hey </span>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.gold, fontWeight: 700 }}>Monday</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: T.text3 }}>Already have an account?</span>
          <Link href="/login?switch=1" style={{ textDecoration: 'none', fontSize: 11, fontWeight: 600, color: T.text2, padding: '6px 14px', border: `1px solid ${T.border2}`, letterSpacing: '0.08em', borderRadius: 4 }}>Log In</Link>
        </div>
      </nav>

      <div style={{ borderBottom: `1px solid ${T.border}`, padding: '14px 24px', background: T.bg2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {[{ n: 1, label: 'Account' }, { n: 2, label: 'Payment' }].map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: currentStep >= s.n ? T.gold : 'transparent', border: `1px solid ${currentStep >= s.n ? T.gold : T.border2}`, fontSize: 11, fontWeight: 700, color: currentStep >= s.n ? T.btnText : T.text3, transition: 'all 0.3s' }}>
                {currentStep > s.n ? '✓' : s.n}
              </div>
              <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: currentStep >= s.n ? T.gold : T.text3 }}>{s.label}</span>
            </div>
            {i === 0 && <div style={{ width: 48, height: 1, background: currentStep > 1 ? T.goldDim : T.border, margin: '0 14px' }} />}
          </div>
        ))}
      </div>

      <div className="layout" style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 24px', display: 'flex', gap: 48, alignItems: 'flex-start' }}>
        <SignupForm isDark={isDark} billing={billing} setBilling={setBilling} />

        <div className="sidebar" style={{ width: 300, flexShrink: 0, position: 'sticky', top: 80 }}>
          <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, overflow: 'hidden', borderRadius: 8 }}>
            <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${T.gold}, transparent)` }} />
            <div style={{ padding: '22px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 9, letterSpacing: '0.18em', color: T.gold, background: T.badgeBg, border: `1px solid ${T.badgeBorder}`, padding: '3px 10px', marginBottom: 16, textTransform: 'uppercase', borderRadius: 3 }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: T.gold, display: 'inline-block', animation: 'pulse 2s ease infinite' }} />
                Pro Plan · 5-Day Free Trial
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 4 }}>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 48, fontWeight: 700, color: T.gold, lineHeight: 1 }}>${price.split('.')[0]}</span>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: T.goldDim }}>.{price.split('.')[1]}</span>
                <span style={{ fontSize: 11, color: T.text3 }}>/mo</span>
              </div>
              <div style={{ fontSize: 11, color: T.text2, marginBottom: 18 }}>
                {billing === 'annual' ? 'Billed as $799.92 annually' : 'Billed monthly, cancel anytime'}
              </div>
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.15em', color: T.text3, textTransform: 'uppercase', marginBottom: 12 }}>What's included</div>
                {PLAN_FEATURES.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: i < PLAN_FEATURES.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                    <span style={{ color: T.gold, fontSize: 11, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 12, color: T.text2 }}>{f}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(201,146,42,.05)', border: `1px solid rgba(201,146,42,.15)`, padding: '10px 12px', borderRadius: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.gold, marginBottom: 3 }}>Trial: 5 voice/chat replies/day</div>
                <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.6 }}>Full features. Unlimited after trial.</div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[`No charge for 5 days`, `Cancel before ${chargeDate} — free`, 'Secured by Stripe'].map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: T.goldDim }}>✓</span>
                    <span style={{ fontSize: 11, color: T.text3 }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, background: T.bg2, border: `1px solid ${T.border}`, padding: '16px', borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontStyle: 'italic', color: T.text2, lineHeight: 1.7, fontFamily: "'Cormorant Garamond',serif", marginBottom: 10 }}>
              "The second CPI dropped, Monday explained the impact on my positions before I even opened a chart."
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.bg4, border: `1px solid ${T.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond',serif", fontSize: 13, fontStyle: 'italic', color: T.gold }}>S</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.heading }}>Sarah K.</div>
                <div style={{ fontSize: 10, color: T.text3 }}>Options Trader</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ color: T.gold, fontSize: 11 }}>★</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ background: '#0a0a08', minHeight: '100vh' }} />}>
      <SignupPageInner />
    </Suspense>
  )
}