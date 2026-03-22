'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginPageContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [pendingEmail, setPendingEmail] = useState('')
  const [screen, setScreen] = useState<'auth' | 'check-email'>('auth')

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
    if (loginError === 'missing_confirmation_link') {
      return 'That link is incomplete. Request a new email and try again.'
    }
    if (loginError === 'confirmation_failed') {
      return 'That confirmation link is invalid or expired. Request a new one below.'
    }
    return ''
  }, [loginError])

  function getResetRedirectTo() {
    if (typeof window === 'undefined') return undefined
    return `${window.location.origin}/reset-password`
  }

  function humanizeAuthError(message: string) {
    const lower = message.toLowerCase()
    if (lower.includes('email not confirmed')) {
      return 'Your account is not confirmed yet. Check your email for the confirmation link.'
    }
    if (lower.includes('invalid login credentials')) {
      return 'Incorrect email or password.'
    }
    if (lower.includes('password should be at least')) {
      return 'Your password is too short.'
    }
    return message
  }

  useEffect(() => {
    let mounted = true

    async function inspectCurrentSession() {
      setCheckingSession(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return

      if (!session?.user) {
        setCheckingSession(false)
        return
      }

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

      if (!profile?.trader_type || !profile?.onboarding_complete) {
        router.replace('/onboarding')
        return
      }

      router.replace('/dashboard')
    }

    inspectCurrentSession()
    return () => { mounted = false }
  }, [supabase, router])

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password.')
      return
    }

    setLoading(true)
    setError('')
    setInfo('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setError(humanizeAuthError(error.message))
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      await supabase.auth.signOut()
      setError('Could not verify your session. Please try again.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('trader_type, onboarding_complete')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.trader_type || !profile?.onboarding_complete) {
      window.location.href = '/onboarding'
      return
    }

    window.location.href = '/dashboard'
  }

  async function handleForgotPassword() {
    const targetEmail = email.trim()
    if (!targetEmail) {
      setError('Enter your email first, then click Forgot Password.')
      setInfo('')
      return
    }

    setSendingReset(true)
    setError('')
    setInfo('')

    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: getResetRedirectTo(),
    })

    if (error) {
      setError(humanizeAuthError(error.message))
      setSendingReset(false)
      return
    }

    setInfo(`We sent a password reset email to ${targetEmail}.`)
    setSendingReset(false)
  }

  if (checkingSession) {
    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
        <div style={{ background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", color: '#e8b84b' }}>
          Loading...
        </div>
      </>
    )
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />

      <div style={{ background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(232,184,75,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(232,184,75,0.03) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', width: '100%', maxWidth: '430px', margin: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '40px', fontWeight: 600, fontStyle: 'italic', color: '#ffffff', marginBottom: '8px' }}>
              Hey <span style={{ color: '#e8b84b' }}>Monday</span>
            </div>
            <div style={{ fontSize: '15px', color: 'rgba(232,184,75,0.5)', letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}>
              AI Market Intelligence
            </div>
            <div style={{ width: '40px', height: '1px', background: 'rgba(232,184,75,0.3)', margin: '16px auto 0' }} />
          </div>

          <div style={{ background: '#0a0a0a', border: '1px solid rgba(232,184,75,0.18)', padding: '36px 32px' }}>
            {confirmedBanner && (
              <div style={{ color: '#4ade80', fontSize: '11px', fontFamily: "'DM Mono', monospace", padding: '10px 12px', marginBottom: '12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.22)' }}>
                {confirmedBanner}
              </div>
            )}

            {linkErrorBanner && (
              <div style={{ color: '#f87171', fontSize: '11px', fontFamily: "'DM Mono', monospace", padding: '10px 12px', marginBottom: '12px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
                {linkErrorBanner}
              </div>
            )}

            {screen === 'check-email' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontStyle: 'italic', color: '#ffffff' }}>
                  Check your email
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.62)', lineHeight: 1.7 }}>
                  We sent a confirmation link to <span style={{ color: '#ffffff' }}>{pendingEmail}</span>. Open that email, confirm your account, and then log in here.
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(232,184,75,0.7)', background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.18)', padding: '10px 12px', fontFamily: "'DM Mono', monospace" }}>
                  Tip: check spam or promotions if you don't see it within a minute.
                </div>
                <button onClick={() => { setScreen('auth'); setError(''); setInfo('') }}
                  style={{ background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Mono', monospace", letterSpacing: '0.15em', textTransform: 'uppercase', width: '100%' }}>
                  Back to Login
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(232,184,75,0.18)', color: '#ffffff', padding: '11px 14px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none', width: '100%' }}
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(232,184,75,0.18)', color: '#ffffff', padding: '11px 14px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none', width: '100%' }}
                />

                {error && (
                  <div style={{ color: '#f87171', fontSize: '11px', fontFamily: "'DM Mono', monospace", padding: '8px 12px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    {error}
                  </div>
                )}

                {info && (
                  <div style={{ color: '#4ade80', fontSize: '11px', fontFamily: "'DM Mono', monospace", padding: '8px 12px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
                    {info}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <button
                    onClick={handleLogin}
                    disabled={loading || sendingReset}
                    style={{ background: 'rgba(232,184,75,0.15)', color: '#e8b84b', border: '1px solid rgba(232,184,75,0.4)', padding: '12px', fontSize: '11px', fontWeight: 600, cursor: loading || sendingReset ? 'default' : 'pointer', fontFamily: "'DM Mono', monospace", letterSpacing: '0.15em', textTransform: 'uppercase', opacity: loading || sendingReset ? 0.6 : 1, width: '100%' }}>
                    {loading ? 'Loading...' : 'Log In'}
                  </button>

                  <button
                    onClick={handleForgotPassword}
                    disabled={sendingReset || !email.trim()}
                    style={{ background: 'transparent', color: email.trim() ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px', fontSize: '10px', fontWeight: 600, cursor: sendingReset || !email.trim() ? 'default' : 'pointer', fontFamily: "'DM Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase', opacity: sendingReset ? 0.6 : 1, width: '100%' }}>
                    {sendingReset ? 'Sending Reset...' : 'Forgot Password'}
                  </button>

                  {/* No account? Link to signup page */}
                  <div style={{ textAlign: 'center', paddingTop: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Mono', monospace" }}>
                    Don't have an account?{' '}
                    <a href="/signup" style={{ color: 'rgba(232,184,75,0.7)', textDecoration: 'underline', cursor: 'pointer' }}>
                      Start free trial →
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '9px', color: 'rgba(255,255,255,0.2)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em' }}>
            MARKET DATA · AI INTELLIGENCE · VOICE BRIEFINGS
          </div>
        </div>

        <style>{`
          input::placeholder { color: rgba(255,255,255,0.22); }
          button:hover:not(:disabled) { opacity: 0.85 !important; }
        `}</style>
      </div>
    </>
  )
}

function LoginFallback() {
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      <div style={{ background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", color: '#e8b84b' }}>
        Loading...
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  )
}