'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

// ── Supabase client (browser) ──────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// ── Theme ──────────────────────────────────────────────────────────
const DARK = {
  pageBg: '#0a0a08', bg2: '#120f07', bg3: '#181208', bg4: '#1c1608',
  border: '#2a2618', border2: '#3a3420',
  gold: '#c9922a', goldDim: '#8a6420', amber: '#b8860b',
  red: '#c94242',
  text: '#d4c5a0', text2: '#a08040', text3: '#6a6050',
  heading: '#e8d5a0',
  badgeBg: 'rgba(201,146,42,.08)', badgeBorder: 'rgba(201,146,42,.2)',
  inputBg: '#0d0b07', inputBorder: '#2a2618', inputFocus: 'rgba(201,146,42,.4)',
  btnText: '#0a0a08',
  cardBg: '#120f07', cardBorder: 'rgba(201,146,42,.2)',
  trustBg: 'rgba(201,146,42,.04)', trustBorder: 'rgba(201,146,42,.12)',
  errBg: 'rgba(201,66,66,.08)', errBorder: 'rgba(201,66,66,.25)',
  navBg: '#0a0a08',
}

const LIGHT = {
  pageBg: '#f5f0e8', bg2: '#ede6d6', bg3: '#e5dcc8', bg4: '#ddd3ba',
  border: '#c8b898', border2: '#b8a47e',
  gold: '#a06818', goldDim: '#7a5010', amber: '#8a5c10',
  red: '#b83232',
  text: '#2a1f0e', text2: '#6b4c20', text3: '#8a7050',
  heading: '#1a1008',
  badgeBg: 'rgba(160,104,24,.08)', badgeBorder: 'rgba(160,104,24,.25)',
  inputBg: '#faf7f0', inputBorder: '#c8b898', inputFocus: 'rgba(160,104,24,.4)',
  btnText: '#f5f0e8',
  cardBg: '#faf7f0', cardBorder: 'rgba(160,104,24,.3)',
  trustBg: 'rgba(160,104,24,.05)', trustBorder: 'rgba(160,104,24,.15)',
  errBg: 'rgba(184,50,50,.06)', errBorder: 'rgba(184,50,50,.3)',
  navBg: '#f5f0e8',
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

// ── SVG icons ──────────────────────────────────────────────────────
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
function LockIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
function ShieldIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
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

// ── Inner form (needs stripe/elements hooks) ──────────────────────
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
  const stripe = useStripe()
  const elements = useElements()

  const [step, setStep] = useState<1 | 2>(1)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState<Field | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  const priceId =
    billing === 'monthly'
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!
      : process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL!

  const price = billing === 'monthly' ? '79.99' : '66.66'
  const chargeDate = (() => {
    const d = new Date(); d.setDate(d.getDate() + 5)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  })()

  function set(field: Field, val: string) {
    setError(''); setForm(f => ({ ...f, [field]: val }))
  }

  function validateStep1() {
    if (!form.name.trim()) return 'Full name is required'
    if (!form.email.includes('@')) return 'Valid email required'
    if (form.password.length < 8) return 'Password must be at least 8 characters'
    return ''
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    const err = validateStep1()
    if (err) { setError(err); return }
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) { setError('Stripe not loaded — please refresh.'); return }
    const cardElement = elements.getElement(CardElement)
    if (!cardElement) { setError('Card input missing — please refresh.'); return }

    setLoading(true)
    setError('')

    try {
      // 1. Create Supabase auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.name },
        },
      })
      if (authErr) throw new Error(authErr.message)
      if (!authData.user) throw new Error('No user returned from Supabase')

      // 2. Update profile with full name (the trigger creates the row automatically)
      await supabase
        .from('profiles')
        .update({ full_name: form.name, email: form.email })
        .eq('id', authData.user.id)

      // 3. Create Stripe PaymentMethod from card element
      const { paymentMethod, error: pmErr } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: { name: form.name, email: form.email },
      })
      if (pmErr) throw new Error(pmErr.message ?? 'Card error')

      // 4. Create Stripe subscription (trial, no charge today)
      const res = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          paymentMethodId: paymentMethod!.id,
          priceId,
          billing,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Subscription failed')

      // 5. Confirm card payment if clientSecret returned (rare for trial)
      if (data.clientSecret) {
        const { error: confirmErr } = await stripe.confirmCardPayment(data.clientSecret, {
          payment_method: paymentMethod!.id,
        })
        if (confirmErr) throw new Error(confirmErr.message ?? 'Payment confirmation failed')
      }

      // 6. Update profile with Stripe customer ID
      if (data.customerId) {
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: data.customerId })
          .eq('id', authData.user.id)
      }

      // 7. Go to onboarding (not dashboard — user needs to set up watchlist + trader type)
      window.location.href = '/onboarding'
    } catch (err: any) {
      setError(err.message ?? 'Unexpected error')
      setLoading(false)
    }
  }

  const inputStyle = (field: Field): React.CSSProperties => ({
    width: '100%',
    background: T.inputBg,
    border: `1px solid ${focused === field ? T.inputFocus : T.inputBorder}`,
    color: T.text,
    padding: '11px 14px',
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    outline: 'none',
    transition: 'border-color 0.15s',
    WebkitAppearance: 'none',
  })

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 9, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: T.text3, marginBottom: 6,
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* BILLING TOGGLE — step 1 only */}
      {step === 1 && (
        <div className="fade-up" style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: T.goldDim, textTransform: 'uppercase', marginBottom: 10 }}>
            5 days free, then:
          </div>
          <div style={{ display: 'flex', background: T.bg2, border: `1px solid ${T.border2}`, padding: 3, gap: 3, width: 'fit-content' }}>
            {(['monthly', 'annual'] as const).map(b => (
              <div key={b} onClick={() => setBilling(b)}
                style={{ padding: '9px 20px', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', background: billing === b ? T.bg4 : 'transparent', color: billing === b ? T.heading : T.text3, border: billing === b ? `1px solid ${T.border2}` : '1px solid transparent', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 8 }}>
                {b === 'monthly' ? '$79.99/mo' : '$66.66/mo'}
                {b === 'annual' && <span style={{ fontSize: 8, padding: '1px 5px', background: T.badgeBg, border: `1px solid ${T.badgeBorder}`, color: T.gold }}>SAVE 17%</span>}
              </div>
            ))}
          </div>
          {billing === 'annual' && (
            <div style={{ marginTop: 8, fontSize: 10, color: T.gold }}>Billed as $799.92/year — save $159.96</div>
          )}
        </div>
      )}

      {/* STEP 1: ACCOUNT */}
      {step === 1 && (
        <form onSubmit={handleStep1} className="fade-up">
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: T.goldDim, textTransform: 'uppercase', marginBottom: 20 }}>Your account</div>

          {error && (
            <div style={{ background: T.errBg, border: `1px solid ${T.errBorder}`, color: T.red, padding: '10px 14px', fontSize: 11, marginBottom: 20 }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Full Name</label>
            <input style={inputStyle('name')} type="text" placeholder="Jane Smith" value={form.name}
              onChange={e => set('name', e.target.value)} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} autoComplete="name" />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Email Address</label>
            <input style={inputStyle('email')} type="email" placeholder="you@example.com" value={form.email}
              onChange={e => set('email', e.target.value)} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} autoComplete="email" />
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inputStyle('password'), paddingRight: 44 }} type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters" value={form.password}
                onChange={e => set('password', e.target.value)} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} autoComplete="new-password" />
              <button type="button" onClick={() => setShowPass(s => !s)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', background: 'none', border: 'none', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.6 }}>
                {showPass ? <EyeOff color={T.text2} /> : <EyeOpen color={T.text2} />}
              </button>
            </div>
            {form.password && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ flex: 1, height: 2, borderRadius: 1, background: form.password.length >= i * 3 ? (form.password.length >= 12 ? T.gold : T.amber) : T.border2, transition: 'background 0.2s' }} />
                ))}
                <span style={{ fontSize: 9, color: T.text3, marginLeft: 6, whiteSpace: 'nowrap' }}>
                  {form.password.length < 8 ? 'Weak' : form.password.length < 12 ? 'Good' : 'Strong'}
                </span>
              </div>
            )}
          </div>

          <button type="submit" style={{ width: '100%', background: T.gold, color: T.btnText, padding: '14px', fontWeight: 700, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>
            Continue to Payment →
          </button>
          <div style={{ marginTop: 14, fontSize: 10, color: T.text3, lineHeight: 1.6, textAlign: 'center' }}>
            By continuing, you agree to our{' '}
            <Link href="/terms" style={{ color: T.text2, textDecoration: 'underline' }}>Terms</Link> and{' '}
            <Link href="/privacy" style={{ color: T.text2, textDecoration: 'underline' }}>Privacy Policy</Link>.
          </div>
        </form>
      )}

      {/* STEP 2: PAYMENT */}
      {step === 2 && (
        <form onSubmit={handleStep2} className="fade-up">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button type="button" onClick={() => { setStep(1); setError('') }}
              style={{ background: 'transparent', border: `1px solid ${T.border2}`, color: T.text3, padding: '5px 12px', fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>
              ← Back
            </button>
            <div style={{ fontSize: 9, letterSpacing: '0.22em', color: T.goldDim, textTransform: 'uppercase' }}>Payment details</div>
          </div>

          {/* Trial reminder */}
          <div style={{ background: T.trustBg, border: `1px solid ${T.trustBorder}`, padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <ShieldIcon color={T.gold} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.heading, marginBottom: 3 }}>Your card won't be charged today</div>
              <div style={{ fontSize: 11, color: T.text2, lineHeight: 1.6 }}>
                5-day free trial starts now. Your {billing === 'monthly' ? '$79.99/month' : '$66.66/month'} subscription begins on{' '}
                <strong style={{ color: T.gold }}>{chargeDate}</strong>. Cancel anytime before then.
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: T.errBg, border: `1px solid ${T.errBorder}`, color: T.red, padding: '10px 14px', fontSize: 11, marginBottom: 20 }}>
              ⚠ {error}
            </div>
          )}

          {/* Real Stripe CardElement */}
          <div style={{ marginBottom: 28 }}>
            <label style={labelStyle}>Card Details</label>
            <div style={{ background: T.inputBg, border: `1px solid ${T.inputBorder}`, padding: '12px 14px' }}>
              <CardElement
                options={{
                  style: {
                    base: {
                      color: T.text,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '13px',
                      '::placeholder': { color: T.text3 },
                      iconColor: T.text2,
                    },
                    invalid: { color: T.red, iconColor: T.red },
                  },
                }}
                onChange={e => { if (e.error) setError(e.error.message ?? 'Card error'); else setError('') }}
              />
            </div>
            <div style={{ marginTop: 6, fontSize: 9, color: T.text3 }}>
              Secured by Stripe · 256-bit SSL encryption
            </div>
          </div>

          <button type="submit" disabled={loading || !stripe}
            style={{ width: '100%', background: loading ? T.goldDim : T.gold, color: T.btnText, padding: '15px', fontWeight: 700, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: loading ? 'default' : 'pointer', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'background 0.2s' }}>
            {loading ? (
              <>
                <span style={{ width: 14, height: 14, border: `2px solid ${T.btnText}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Creating your account…
              </>
            ) : (
              <>
                <LockIcon color={T.btnText} />
                Start Free Trial — No Charge Today →
              </>
            )}
          </button>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            {['256-bit SSL', 'Cancel anytime', 'Secured by Stripe'].map((t, i) => (
              <div key={i} style={{ fontSize: 9, color: T.text3, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: T.goldDim, display: 'inline-block' }} />
                {t}
              </div>
            ))}
          </div>
        </form>
      )}
    </div>
  )
}

// ── Page wrapper — provides Elements context ──────────────────────
export default function SignupPage() {
  const [isDark, setIsDark] = useState(true)
  const T = isDark ? DARK : LIGHT
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')

  const price = billing === 'monthly' ? '79.99' : '66.66'
  const chargeDate = (() => {
    const d = new Date(); d.setDate(d.getDate() + 5)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  })()

  return (
    <div style={{ background: T.pageBg, color: T.text, fontFamily: "'JetBrains Mono', monospace", minHeight: '100vh', transition: 'background 0.3s, color 0.3s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        input:-webkit-autofill{-webkit-box-shadow:0 0 0 100px #0d0b07 inset!important;-webkit-text-fill-color:#d4c5a0!important;caret-color:#d4c5a0}
        @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(201,146,42,.4)}50%{opacity:.8;box-shadow:0 0 0 5px rgba(201,146,42,0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fade-up{animation:fadeUp 0.35s ease both}
        .StripeElement{width:100%}
        @media(max-width:640px){
          .layout{flex-direction:column!important}
          .sidebar{display:none!important}
        }
      `}</style>

      {/* NAV */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.navBg }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.heading, fontWeight: 600 }}>Hey </span>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.gold, fontWeight: 700 }}>Monday</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setIsDark(d => !d)}
            style={{ background: isDark ? '#1c1608' : '#e5dcc8', border: `1px solid ${T.border2}`, borderRadius: 24, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: T.text2, transition: 'all 0.3s' }}>
            {isDark ? <SunIcon color={T.text2} /> : <MoonIcon color={T.text2} />}
          </button>
          <span style={{ fontSize: 11, color: T.text3 }}>Already have an account?</span>
          <Link href="/login" style={{ textDecoration: 'none', fontSize: 10, fontWeight: 600, color: T.text2, padding: '6px 14px', border: `1px solid ${T.border2}`, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Log In</Link>
        </div>
      </nav>

      {/* STEP BAR */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: '12px 24px', background: T.bg2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[{ n: 1, label: 'Account' }, { n: 2, label: 'Payment' }].map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.gold, border: `1px solid ${T.gold}`, fontSize: 10, fontWeight: 700, color: T.btnText }}>
                {s.n}
              </div>
              <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.gold }}>{s.label}</span>
            </div>
            {i === 0 && <div style={{ width: 48, height: 1, background: T.border, margin: '0 12px' }} />}
          </div>
        ))}
      </div>

      {/* LAYOUT */}
      <div className="layout" style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px', display: 'flex', gap: 40, alignItems: 'flex-start' }}>
        {/* FORM */}
        <Elements stripe={stripePromise}>
          <SignupForm isDark={isDark} billing={billing} setBilling={setBilling} />
        </Elements>

        {/* SIDEBAR */}
        <div className="sidebar" style={{ width: 300, flexShrink: 0, position: 'sticky', top: 80 }}>
          <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, overflow: 'hidden' }}>
            <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${T.gold}, transparent)` }} />
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 8, letterSpacing: '0.18em', color: T.gold, background: T.badgeBg, border: `1px solid ${T.badgeBorder}`, padding: '3px 10px', marginBottom: 16, textTransform: 'uppercase' }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: T.gold, display: 'inline-block', animation: 'pulse 2s ease infinite' }} />
                Pro Plan · 5-Day Free Trial
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 48, fontWeight: 700, color: T.gold, lineHeight: 1 }}>${price.split('.')[0]}</span>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: T.goldDim }}>.{price.split('.')[1]}</span>
                <span style={{ fontSize: 10, color: T.text3 }}>/mo</span>
              </div>
              <div style={{ fontSize: 10, color: T.text2, marginBottom: 18, lineHeight: 1.5 }}>
                {billing === 'annual' ? 'Billed as $799.92 annually' : 'Billed monthly, cancel anytime'}
              </div>
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16, marginBottom: 4 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.15em', color: T.text3, textTransform: 'uppercase', marginBottom: 12 }}>What's included</div>
                {PLAN_FEATURES.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < PLAN_FEATURES.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                    <span style={{ color: T.gold, fontSize: 10, flexShrink: 0, marginTop: 2 }}>✓</span>
                    <span style={{ fontSize: 11, color: T.text2 }}>{f}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, background: 'rgba(201,146,42,.05)', border: `1px solid rgba(201,146,42,.15)`, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.gold, marginBottom: 4 }}>Trial: 5 voice/chat replies/day</div>
                <div style={{ fontSize: 10, color: T.text3, lineHeight: 1.6 }}>Full features, limited replies. Unlimited after trial.</div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { text: 'No charge for 5 days' },
                  { text: `Cancel before ${chargeDate} — free` },
                  { text: 'Secured by Stripe' },
                ].map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: T.goldDim }}>✓</span>
                    <span style={{ fontSize: 10, color: T.text3 }}>{b.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Testimonial */}
          <div style={{ marginTop: 16, background: T.bg2, border: `1px solid ${T.border}`, padding: '16px' }}>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: T.text2, lineHeight: 1.7, fontFamily: "'Cormorant Garamond',serif", marginBottom: 10 }}>
              "The second CPI dropped, Monday explained the impact on my positions before I even opened a chart."
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: T.bg4, border: `1px solid ${T.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond',serif", fontSize: 12, fontStyle: 'italic', color: T.gold }}>S</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.heading }}>Sarah K.</div>
                <div style={{ fontSize: 9, color: T.text3, letterSpacing: '0.08em' }}>Options Trader</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ color: T.gold, fontSize: 10 }}>★</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}