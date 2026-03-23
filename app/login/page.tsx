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
  googleBg: '#120f07', googleBorder: '#3a3420', googleText: '#d4c5a0',
  orDivider: '#2a2618',
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
  googleBg: '#faf7f0', googleBorder: '#c8b898', googleText: '#2a1f0e',
  orDivider: '#c8b898',
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
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
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [showPass, setShowPass] = useState(false)
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
    if (loginError === 'oauth_failed') return 'Google sign-in failed. Please try again.'
    return ''
  }, [loginError])

  // Route user based on profile state
  async function routeUser(userId: string, userEmail: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('trader_type, onboarding_complete, stripe_subscription_id')
      .eq('id', userId)
      .maybeSingle()

    if (!profile?.stripe_subscription_id) {
      window.location.href = `/signup?confirmed=1&email=${encodeURIComponent(userEmail)}`
      return
    }
    if (!profile?.trader_type || !profile?.onboarding_complete) {
      window.location.href = '/onboarding'
      return
    }
    window.location.href = '/dashboard'
  }

  useEffect(() => {
    let mounted = true

    async function init() {
      // ── Handle Google OAuth implicit flow hash ──
      // Supabase sends #access_token=... to the Site URL (this page)
      if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
        setCheckingSession(false)
        setGoogleLoading(true)

        // Supabase SSR client auto-parses the hash on getSession()
        // Try immediately, then retry once after a short delay
        let session = (await supabase.auth.getSession()).data.session
        if (!session) {
          await new Promise(r => setTimeout(r, 800))
          session = (await supabase.auth.getSession()).data.session
        }

        if (session?.user && mounted) {
          await routeUser(session.user.id, session.user.email ?? '')
          return
        }

        // Still no session — listen for auth state change
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, s) => {
            if (s?.user && mounted) {
              subscription.unsubscribe()
              await routeUser(s.user.id, s.user.email ?? '')
            }
          }
        )

        // Timeout after 5s
        setTimeout(() => {
          if (mounted) {
            subscription.unsubscribe()
            setGoogleLoading(false)
            setError('Google sign-in timed out. Please try again.')
          }
        }, 5000)

        return
      }

      // ── Normal session check ──
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
          setCheckingSession(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('trader_type, onboarding_complete, stripe_subscription_id')
          .eq('id', user.id)
          .maybeSingle()

        if (!mounted) return
        if (!profile?.stripe_subscription_id) { router.replace(`/signup?confirmed=1&email=${encodeURIComponent(user.email ?? '')}`); return }
        if (!profile?.trader_type || !profile?.onboarding_complete) { router.replace('/onboarding'); return }
        router.replace('/dashboard')
      } catch {
        clearTimeout(timeout)
        if (mounted) setCheckingSession(false)
      }
    }

    init()
    return () => { mounted = false }
  }, [])

  async function handleGoogleLogin() {
    setGoogleLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { setError('Enter your email and password.'); return }
    setLoading(true); setError(''); setInfo('')

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('invalid login credentials')) setError('Incorrect email or password.')
      else if (msg.includes('email not confirmed')) setError('Please confirm your email first.')
      else setError(error.message)
      setLoading(false); return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { await supabase.auth.signOut(); setError('Could not verify session. Try again.'); setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('trader_type, onboarding_complete, stripe_subscription_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.stripe_subscription_id) { window.location.href = `/signup?confirmed=1&email=${encodeURIComponent(user.email ?? '')}`; return }
    if (!profile?.trader_type || !profile?.onboarding_complete) { window.location.href = '/onboarding'; return }
    window.location.href = '/dashboard'
  }

  async function handleForgotPassword() {
    const targetEmail = email.trim()
    if (!targetEmail) { setError('Enter your email first.'); return }
    setSendingReset(true); setError(''); setInfo('')
    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) { setError(error.message); setSendingReset(false); return }
    setInfo(`Password reset email sent to ${targetEmail}.`)
    setSendingReset(false)
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: '100%',
    background: T.inputBg,
    border: `1px solid ${focused ? T.inputFocus : T.inputBorder}`,
    color: T.text,
    padding: '12px 14px',
    fontSize: 14,
    fontFamily: "'JetBrains Mono', monospace",
    outline: 'none',
    borderRadius: 4,
    transition: 'border-color 0.15s',
  })

  if (checkingSession || googleLoading) {
    return (
      <div style={{ background: T.pageBg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", flexDirection: 'column', gap: 14, transition: 'background 0.3s' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span style={{ width: 18, height: 18, border: `2px solid ${T.gold}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
        <span style={{ fontSize: 11, color: T.gold, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {googleLoading ? 'Signing you in…' : 'Loading…'}
        </span>
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
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes toggleSpin{from{transform:rotate(-20deg);opacity:0}to{transform:rotate(0);opacity:1}}
        .fade-up{animation:fadeUp 0.3s ease both}
        .toggle-icon{animation:toggleSpin 0.25s ease both}
      `}</style>

      <div style={{ position: 'fixed', inset: 0, backgroundImage: `linear-gradient(${T.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${T.gridLine} 1px, transparent 1px)`, backgroundSize: '48px 48px', pointerEvents: 'none' }} />

      {/* NAV */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.pageBg, position: 'relative', zIndex: 1, transition: 'background 0.3s, border-color 0.3s' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.heading, fontWeight: 600 }}>Hey </span>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.gold, fontWeight: 700 }}>Monday</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={toggle} style={{ background: T.bg2, border: `1px solid ${T.border2}`, borderRadius: 24, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: T.text2, transition: 'all 0.3s' }}>
            <span key={String(isDark)} className="toggle-icon">
              {isDark ? <SunIcon color={T.text2} /> : <MoonIcon color={T.text2} />}
            </span>
          </button>
          <span style={{ fontSize: 12, color: T.text3 }}>New here?</span>
          <Link href="/signup" style={{ textDecoration: 'none', fontSize: 11, fontWeight: 600, color: T.text2, padding: '6px 14px', border: `1px solid ${T.border2}`, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 4 }}>
            Start Free Trial
          </Link>
        </div>
      </nav>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 42, fontStyle: 'italic', fontWeight: 700, lineHeight: 1.1, marginBottom: 8 }}>
              <span style={{ color: T.heading }}>Hey </span>
              <span style={{ color: T.gold }}>Monday</span>
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: T.text3 }}>AI Market Intelligence</div>
            <div style={{ width: 40, height: 1, background: T.divider, margin: '14px auto 0' }} />
          </div>

          <div className="fade-up" style={{ background: T.bg2, border: `1px solid ${T.border}`, padding: '32px 28px', borderRadius: 8, transition: 'background 0.3s, border-color 0.3s' }}>

            {confirmedBanner && (
              <div style={{ color: T.successText, fontSize: 12, padding: '10px 12px', marginBottom: 20, background: T.successBg, border: `1px solid ${T.successBorder}`, lineHeight: 1.5, borderRadius: 4 }}>
                ✓ {confirmedBanner}
              </div>
            )}
            {linkErrorBanner && (
              <div style={{ color: T.red, fontSize: 12, padding: '10px 12px', marginBottom: 20, background: T.errBg, border: `1px solid ${T.errBorder}`, lineHeight: 1.5, borderRadius: 4 }}>
                ⚠ {linkErrorBanner}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: T.text3, marginBottom: 20 }}>
                Sign in to your account
              </div>

              {/* GOOGLE */}
              <button onClick={handleGoogleLogin} disabled={loading || googleLoading}
                style={{ width: '100%', background: T.googleBg, border: `1px solid ${T.googleBorder}`, color: T.googleText, padding: '12px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 4, marginBottom: 16, fontFamily: 'system-ui, -apple-system, sans-serif', transition: 'opacity 0.15s', opacity: googleLoading ? 0.7 : 1 }}>
                <GoogleIcon />
                Continue with Google
              </button>

              {/* DIVIDER */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: T.orDivider }} />
                <span style={{ fontSize: 11, color: T.text3 }}>or</span>
                <div style={{ flex: 1, height: 1, background: T.orDivider }} />
              </div>

              {/* EMAIL */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>Email address</label>
                <input type="email" placeholder="you@example.com" value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)}
                  style={inputStyle(emailFocused)} autoComplete="email" />
              </div>

              {/* PASSWORD */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 500 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} placeholder="Your password" value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    onFocus={() => setPassFocused(true)} onBlur={() => setPassFocused(false)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    style={{ ...inputStyle(passFocused), paddingRight: 44 }} autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', background: 'none', border: 'none', padding: 4, opacity: 0.5, display: 'flex', alignItems: 'center' }}>
                    {showPass ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ color: T.red, fontSize: 12, padding: '10px 12px', background: T.errBg, border: `1px solid ${T.errBorder}`, lineHeight: 1.5, marginBottom: 16, borderRadius: 4 }}>
                  ⚠ {error}
                </div>
              )}
              {info && (
                <div style={{ color: T.successText, fontSize: 12, padding: '10px 12px', background: T.successBg, border: `1px solid ${T.successBorder}`, lineHeight: 1.5, marginBottom: 16, borderRadius: 4 }}>
                  ✓ {info}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={handleLogin} disabled={loading || googleLoading}
                  style={{ background: loading ? T.goldDim : T.gold, color: '#0a0a08', border: 'none', padding: '13px', fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase', opacity: loading || googleLoading ? 0.7 : 1, width: '100%', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s' }}>
                  {loading ? (
                    <><span style={{ width: 13, height: 13, border: '2px solid #0a0a08', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />Logging in…</>
                  ) : 'Log In →'}
                </button>

                <button onClick={handleForgotPassword} disabled={sendingReset || loading || !email.trim()}
                  style={{ background: 'transparent', color: email.trim() ? T.ghostColor : T.text3, border: `1px solid ${T.ghostBorder}`, padding: '11px', fontSize: 11, fontWeight: 600, cursor: !email.trim() ? 'default' : 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', opacity: sendingReset ? 0.6 : 1, width: '100%', borderRadius: 4 }}>
                  {sendingReset ? 'Sending…' : 'Forgot Password'}
                </button>
              </div>

              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16, marginTop: 20, textAlign: 'center', fontSize: 12, color: T.text3 }}>
                Don't have an account?{' '}
                <Link href="/signup" style={{ color: T.gold, textDecoration: 'underline' }}>Start free trial →</Link>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 9, color: T.text3, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Market Data · AI Intelligence · Voice Briefings
          </div>
        </div>
      </div>
    </div>
  )
}

function LoginFallback() {
  return (
    <div style={{ background: '#0a0a08', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9922a', fontFamily: "'JetBrains Mono', monospace", gap: 10 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ width: 14, height: 14, border: '2px solid #c9922a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
      Loading…
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