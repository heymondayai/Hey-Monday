'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from '@/app/context/theme-context'
import Link from 'next/link'

const DARK = {
  pageBg: '#0a0a08', bg2: '#120f07',
  border: '#2a2618', border2: '#3a3420',
  gold: '#c9922a', goldDim: '#8a6420',
  red: '#c94242',
  text: '#d4c5a0', text2: '#a08040', text3: '#6a6050',
  heading: '#e8d5a0',
  inputBg: '#0d0b07', inputBorder: '#2a2618', inputFocus: 'rgba(201,146,42,.4)',
  btnBg: 'rgba(201,146,42,.12)', btnBorder: 'rgba(201,146,42,.35)',
  ghostColor: 'rgba(212,197,160,.5)', ghostBorder: 'rgba(212,197,160,.1)',
  successBg: 'rgba(74,222,128,.06)', successBorder: 'rgba(74,222,128,.2)', successText: '#4ade80',
  errBg: 'rgba(201,66,66,.08)', errBorder: 'rgba(201,66,66,.25)',
  infoBg: 'rgba(201,146,42,.06)', infoBorder: 'rgba(201,146,42,.18)', infoText: 'rgba(201,146,42,.8)',
  gridLine: 'rgba(201,146,42,.03)',
  divider: 'rgba(201,146,42,.3)',
}

const LIGHT = {
  pageBg: '#f5f0e8', bg2: '#ede6d6',
  border: '#c8b898', border2: '#b8a47e',
  gold: '#a06818', goldDim: '#7a5010',
  red: '#b83232',
  text: '#2a1f0e', text2: '#6b4c20', text3: '#8a7050',
  heading: '#1a1008',
  inputBg: '#faf7f0', inputBorder: '#c8b898', inputFocus: 'rgba(160,104,24,.4)',
  btnBg: 'rgba(160,104,24,.1)', btnBorder: 'rgba(160,104,24,.35)',
  ghostColor: 'rgba(42,31,14,.45)', ghostBorder: 'rgba(42,31,14,.1)',
  successBg: 'rgba(74,222,128,.06)', successBorder: 'rgba(74,222,128,.3)', successText: '#15803d',
  errBg: 'rgba(184,50,50,.06)', errBorder: 'rgba(184,50,50,.3)',
  infoBg: 'rgba(160,104,24,.06)', infoBorder: 'rgba(160,104,24,.2)', infoText: 'rgba(160,104,24,.9)',
  gridLine: 'rgba(160,104,24,.04)',
  divider: 'rgba(160,104,24,.3)',
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

function LoginPageContent() {
  const { isDark, toggle } = useTheme()
  const T = isDark ? DARK : LIGHT

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [pendingEmail, setPendingEmail] = useState('')
  const [screen, setScreen] = useState<'auth' | 'check-email'>('auth')
  const [emailFocused, setEmailFocused] = useState(false)
  const [passFocused, setPassFocused] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const confirmed = searchParams.get('confirmed') === '1'
  const reset = searchParams.get('reset') === '1'
  const loginError = searchParams.get('error')

  const confirmedBanner = useMemo(() => {
    if (confirmed) return 'Your account has been confirmed. Log in to continue.'
    if (reset) return 'Your password has been reset. Log in with your new password.'
    return ''
  }, [confirmed, reset])

  const linkErrorBanner = useMemo(() => {
    if (loginError === 'missing_confirmation_link') return 'That link is incomplete. Request a new email and try again.'
    if (loginError === 'confirmation_failed') return 'That confirmation link is invalid or expired.'
    return ''
  }, [loginError])

  function getResetRedirectTo() {
    if (typeof window === 'undefined') return undefined
    return `${window.location.origin}/reset-password`
  }

  function humanizeAuthError(message: string) {
    const lower = message.toLowerCase()
    if (lower.includes('email not confirmed')) return 'Your account is not confirmed yet. Check your email for the confirmation link.'
    if (lower.includes('invalid login credentials')) return 'Incorrect email or password.'
    if (lower.includes('password should be at least')) return 'Your password is too short.'
    return message
  }

  useEffect(() => {
    let mounted = true

    async function inspectCurrentSession() {
      setCheckingSession(true)
      const timeout = setTimeout(() => { if (mounted) setCheckingSession(false) }, 3000)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        clearTimeout(timeout)
        if (!mounted) return

        if (!session?.user) { setCheckingSession(false); return }

        const user = session.user
        if (!user.email_confirmed_at) {
          await supabase.auth.signOut()
          if (!mounted) return
          setPendingEmail(user.email ?? '')
          setScreen('check-email')
          setCheckingSession(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('trader_type, onboarding_complete')
          .eq('id', user.id)
          .maybeSingle()

        if (!mounted) return
        if (!profile?.trader_type || !profile?.onboarding_complete) { router.replace('/onboarding'); return }
        router.replace('/dashboard')
      } catch {
        clearTimeout(timeout)
        if (mounted) setCheckingSession(false)
      }
    }

    inspectCurrentSession()
    return () => { mounted = false }
  }, [supabase, router])

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { setError('Enter your email and password.'); return }
    setLoading(true); setError(''); setInfo('')

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) { setError(humanizeAuthError(error.message)); setLoading(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { await supabase.auth.signOut(); setError('Could not verify your session. Please try again.'); setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('trader_type, onboarding_complete')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.trader_type || !profile?.onboarding_complete) { window.location.href = '/onboarding'; return }
    window.location.href = '/dashboard'
  }

  async function handleForgotPassword() {
    const targetEmail = email.trim()
    if (!targetEmail) { setError('Enter your email first, then click Forgot Password.'); setInfo(''); return }
    setSendingReset(true); setError(''); setInfo('')

    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, { redirectTo: getResetRedirectTo() })
    if (error) { setError(humanizeAuthError(error.message)); setSendingReset(false); return }
    setInfo(`We sent a password reset email to ${targetEmail}.`)
    setSendingReset(false)
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: '100%',
    background: T.inputBg,
    border: `1px solid ${focused ? T.inputFocus : T.inputBorder}`,
    color: T.text,
    padding: '11px 14px',
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    outline: 'none',
    transition: 'border-color 0.15s, background 0.3s',
  })

  if (checkingSession) {
    return (
      <div style={{ background: T.pageBg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", color: T.gold, transition: 'background 0.3s' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}`}</style>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ background: T.pageBg, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'JetBrains Mono', monospace", color: T.text, transition: 'background 0.3s, color 0.3s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        input::placeholder{color:${T.text3}}
        input:-webkit-autofill{-webkit-box-shadow:0 0 0 100px ${T.inputBg} inset!important;-webkit-text-fill-color:${T.text}!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp 0.3s ease both}
      `}</style>

      {/* Grid background */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `linear-gradient(${T.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${T.gridLine} 1px, transparent 1px)`, backgroundSize: '48px 48px', pointerEvents: 'none' }} />

      {/* NAV */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.pageBg, position: 'relative', zIndex: 1, transition: 'background 0.3s, border-color 0.3s' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.heading, fontWeight: 600, transition: 'color 0.3s' }}>Hey </span>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.gold, fontWeight: 700, transition: 'color 0.3s' }}>Monday</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={toggle}
            style={{ background: T.bg2, border: `1px solid ${T.border2}`, borderRadius: 24, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: T.text2, transition: 'all 0.3s' }}>
            {isDark ? <SunIcon color={T.text2} /> : <MoonIcon color={T.text2} />}
          </button>
          <span style={{ fontSize: 11, color: T.text3 }}>New here?</span>
          <Link href="/signup" style={{ textDecoration: 'none', fontSize: 10, fontWeight: 600, color: T.text2, padding: '6px 14px', border: `1px solid ${T.border2}`, letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'all 0.3s' }}>
            Start Free Trial
          </Link>
        </div>
      </nav>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* LOGO */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 42, fontStyle: 'italic', fontWeight: 700, lineHeight: 1.1, marginBottom: 8 }}>
              <span style={{ color: T.heading }}>Hey </span>
              <span style={{ color: T.gold }}>Monday</span>
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: T.text3 }}>
              AI Market Intelligence
            </div>
            <div style={{ width: 40, height: 1, background: T.divider, margin: '14px auto 0' }} />
          </div>

          {/* CARD */}
          <div className="fade-up" style={{ background: T.bg2, border: `1px solid ${T.border}`, padding: '32px 28px', transition: 'background 0.3s, border-color 0.3s' }}>

            {confirmedBanner && (
              <div style={{ color: T.successText, fontSize: 11, padding: '10px 12px', marginBottom: 16, background: T.successBg, border: `1px solid ${T.successBorder}`, lineHeight: 1.5 }}>
                ✓ {confirmedBanner}
              </div>
            )}

            {linkErrorBanner && (
              <div style={{ color: T.red, fontSize: 11, padding: '10px 12px', marginBottom: 16, background: T.errBg, border: `1px solid ${T.errBorder}`, lineHeight: 1.5 }}>
                ⚠ {linkErrorBanner}
              </div>
            )}

            {screen === 'check-email' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontStyle: 'italic', color: T.heading }}>
                  Check your email
                </div>
                <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.7 }}>
                  We sent a confirmation link to <strong style={{ color: T.text }}>{pendingEmail}</strong>. Open that email, confirm your account, and then log in here.
                </div>
                <div style={{ fontSize: 10, color: T.infoText, background: T.infoBg, border: `1px solid ${T.infoBorder}`, padding: '10px 12px', lineHeight: 1.6 }}>
                  💡 Check spam or promotions if you don't see it within a minute.
                </div>
                <button onClick={() => { setScreen('auth'); setError(''); setInfo('') }}
                  style={{ background: 'transparent', color: T.ghostColor, border: `1px solid ${T.ghostBorder}`, padding: '11px', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em', textTransform: 'uppercase', width: '100%', transition: 'all 0.15s' }}>
                  ← Back to Login
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: T.text3, marginBottom: 4 }}>
                  Sign in to your account
                </div>

                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={inputStyle(emailFocused)}
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  style={inputStyle(passFocused)}
                />

                {error && (
                  <div style={{ color: T.red, fontSize: 11, padding: '8px 12px', background: T.errBg, border: `1px solid ${T.errBorder}`, lineHeight: 1.5 }}>
                    ⚠ {error}
                  </div>
                )}

                {info && (
                  <div style={{ color: T.successText, fontSize: 11, padding: '8px 12px', background: T.successBg, border: `1px solid ${T.successBorder}`, lineHeight: 1.5 }}>
                    ✓ {info}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={handleLogin}
                    disabled={loading || sendingReset}
                    style={{ background: T.btnBg, color: T.gold, border: `1px solid ${T.btnBorder}`, padding: '12px', fontSize: 11, fontWeight: 700, cursor: loading || sendingReset ? 'default' : 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em', textTransform: 'uppercase', opacity: loading || sendingReset ? 0.6 : 1, width: '100%', transition: 'all 0.15s' }}>
                    {loading ? 'Logging in…' : 'Log In'}
                  </button>

                  <button
                    onClick={handleForgotPassword}
                    disabled={sendingReset || !email.trim()}
                    style={{ background: 'transparent', color: email.trim() ? T.ghostColor : T.text3, border: `1px solid ${T.ghostBorder}`, padding: '11px', fontSize: 10, fontWeight: 600, cursor: sendingReset || !email.trim() ? 'default' : 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase', opacity: sendingReset ? 0.6 : 1, width: '100%', transition: 'all 0.15s' }}>
                    {sendingReset ? 'Sending…' : 'Forgot Password'}
                  </button>
                </div>

                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14, textAlign: 'center', fontSize: 11, color: T.text3 }}>
                  Don't have an account?{' '}
                  <Link href="/signup" style={{ color: T.gold, textDecoration: 'underline' }}>
                    Start free trial →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 9, color: T.text3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Market Data · AI Intelligence · Voice Briefings
          </div>
        </div>
      </div>
    </div>
  )
}

function LoginFallback() {
  return (
    <div style={{ background: '#0a0a08', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9922a', fontFamily: "'JetBrains Mono', monospace" }}>
      Loading...
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  )
}