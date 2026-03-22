'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function ResetPasswordPageContent() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const pageError = useMemo(() => {
    const e = searchParams.get('error')
    if (e === 'recovery_link_invalid') {
      return 'This password reset link is invalid or has expired. Request a new one.'
    }
    return ''
  }, [searchParams])

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (session) {
        setReady(true)
      } else if (!pageError) {
        setError('This reset link is no longer valid. Request a new password reset email.')
      }
    }

    checkSession()

    return () => {
      mounted = false
    }
  }, [supabase, pageError])

  async function handleUpdatePassword() {
    setError('')
    setInfo('')

    if (!password.trim() || !confirmPassword.trim()) {
      setError('Enter and confirm your new password.')
      return
    }

    if (password.length < 6) {
      setError('Your new password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setInfo('Your password has been updated. Redirecting to login...')
    setLoading(false)

    await supabase.auth.signOut()

    setTimeout(() => {
      router.push('/login?reset=1')
    }, 1200)
  }

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      <div
        style={{
          background: '#080808',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(232,184,75,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(232,184,75,0.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', width: '100%', maxWidth: '430px', margin: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '40px',
                fontWeight: 600,
                fontStyle: 'italic',
                color: '#ffffff',
                marginBottom: '8px',
              }}
            >
              Hey <span style={{ color: '#e8b84b' }}>Monday</span>
            </div>
            <div
              style={{
                fontSize: '15px',
                color: 'rgba(232,184,75,0.5)',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                fontFamily: "'DM Mono', monospace",
              }}
            >
              AI Market Intelligence
            </div>
            <div
              style={{
                width: '40px',
                height: '1px',
                background: 'rgba(232,184,75,0.3)',
                margin: '16px auto 0',
              }}
            />
          </div>

          <div
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(232,184,75,0.18)',
              padding: '36px 32px',
            }}
          >
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '24px',
                fontStyle: 'italic',
                color: '#ffffff',
                marginBottom: '10px',
              }}
            >
              Reset your password
            </div>

            <div
              style={{
                fontSize: '13px',
                color: 'rgba(255,255,255,0.58)',
                lineHeight: 1.7,
                marginBottom: '18px',
              }}
            >
              Choose a new password for your Hey Monday account.
            </div>

            {pageError && (
              <div
                style={{
                  color: '#f87171',
                  fontSize: '11px',
                  fontFamily: "'DM Mono', monospace",
                  padding: '10px 12px',
                  marginBottom: '12px',
                  background: 'rgba(248,113,113,0.06)',
                  border: '1px solid rgba(248,113,113,0.2)',
                }}
              >
                {pageError}
              </div>
            )}

            {error && (
              <div
                style={{
                  color: '#f87171',
                  fontSize: '11px',
                  fontFamily: "'DM Mono', monospace",
                  padding: '10px 12px',
                  marginBottom: '12px',
                  background: 'rgba(248,113,113,0.06)',
                  border: '1px solid rgba(248,113,113,0.2)',
                }}
              >
                {error}
              </div>
            )}

            {info && (
              <div
                style={{
                  color: '#4ade80',
                  fontSize: '11px',
                  fontFamily: "'DM Mono', monospace",
                  padding: '10px 12px',
                  marginBottom: '12px',
                  background: 'rgba(74,222,128,0.06)',
                  border: '1px solid rgba(74,222,128,0.2)',
                }}
              >
                {info}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!ready || loading}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(232,184,75,0.18)',
                  color: '#ffffff',
                  padding: '11px 14px',
                  fontSize: '13px',
                  fontFamily: "'DM Sans', sans-serif",
                  outline: 'none',
                  width: '100%',
                  opacity: !ready || loading ? 0.6 : 1,
                }}
              />

              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={!ready || loading}
                onKeyDown={(e) => e.key === 'Enter' && ready && !loading && handleUpdatePassword()}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(232,184,75,0.18)',
                  color: '#ffffff',
                  padding: '11px 14px',
                  fontSize: '13px',
                  fontFamily: "'DM Sans', sans-serif",
                  outline: 'none',
                  width: '100%',
                  opacity: !ready || loading ? 0.6 : 1,
                }}
              />

              <button
                onClick={handleUpdatePassword}
                disabled={!ready || loading}
                style={{
                  background: 'rgba(232,184,75,0.15)',
                  color: '#e8b84b',
                  border: '1px solid rgba(232,184,75,0.4)',
                  padding: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: !ready || loading ? 'default' : 'pointer',
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  opacity: !ready || loading ? 0.6 : 1,
                  width: '100%',
                  marginTop: '4px',
                }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>

              <button
                onClick={() => router.push('/login')}
                style={{
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.4)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  width: '100%',
                }}
              >
                Back to Login
              </button>
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              marginTop: '24px',
              fontSize: '9px',
              color: 'rgba(255,255,255,0.2)',
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '0.1em',
            }}
          >
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

function ResetPasswordFallback() {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400;500&display=swap"
        rel="stylesheet"
      />
      <div
        style={{
          background: '#080808',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
          color: '#e8b84b',
        }}
      >
        Loading...
      </div>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordPageContent />
    </Suspense>
  )
}