'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const DARK = {
  pageBg: '#0a0a08',
  panelBg: '#100d07',
  panelBg2: '#120f07',
  border: '#2a2618',
  border2: '#3a3420',
  gold: '#c9922a',
  goldDim: '#8a6420',
  text: '#e8d5a0',
  text2: '#d4c5a0',
  text3: '#a08040',
  text4: '#6a6050',
  inputBg: '#0d0b07',
  inputBorder: '#2a2618',
  inputFocus: 'rgba(201,146,42,.45)',
  green: '#4ade80',
  greenBg: 'rgba(74,222,128,.07)',
  greenBorder: 'rgba(74,222,128,.28)',
  red: '#f87171',
  redBg: 'rgba(248,113,113,.07)',
  redBorder: 'rgba(248,113,113,.25)',
  blue: '#60a5fa',
  blueBg: 'rgba(96,165,250,.08)',
  blueBorder: 'rgba(96,165,250,.22)',
  divider: 'rgba(201,146,42,.18)',
  gridLine: 'rgba(201,146,42,.03)',
  mutedBtn: '#17130b',
}

const LIGHT = {
  pageBg: '#fafaf8',
  panelBg: '#ffffff',
  panelBg2: '#f2f1ee',
  border: '#d8d5d0',
  border2: '#c4c1bc',
  gold: '#b8750c',
  goldDim: '#9a6008',
  text: '#1a1a1a',
  text2: '#2e2e2e',
  text3: '#666666',
  text4: '#969696',
  inputBg: '#ffffff',
  inputBorder: '#d8d5d0',
  inputFocus: 'rgba(184,117,12,.35)',
  green: '#16a34a',
  greenBg: 'rgba(22,163,74,.07)',
  greenBorder: 'rgba(22,163,74,.24)',
  red: '#dc2626',
  redBg: 'rgba(220,38,38,.06)',
  redBorder: 'rgba(220,38,38,.20)',
  blue: '#2563eb',
  blueBg: 'rgba(37,99,235,.07)',
  blueBorder: 'rgba(37,99,235,.20)',
  divider: 'rgba(0,0,0,.10)',
  gridLine: 'rgba(0,0,0,.04)',
  mutedBtn: '#f0efec',
}

const TRADER_TYPES = [
  { id: 'day', label: 'Day Trader', icon: '⚡' },
  { id: 'swing', label: 'Swing Trader', icon: '📈' },
  { id: 'longterm', label: 'Long-Term Investor', icon: '🏦' },
] as const

type TraderType = 'day' | 'swing' | 'longterm'

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  trader_type: TraderType | null
  onboarding_complete: boolean | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  subscription_status: string | null
  billing_interval: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  billing_zip: string | null
  wake_word_enabled: boolean | null
  voice_replies_enabled: boolean | null
  event_alerts_enabled: boolean | null
  event_alert_minutes_before: number | null
  event_alert_announce_results: boolean | null
  event_alert_impact_filter: string | null
}

function fmtDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusPill(status: string | null) {
  const s = (status || '').toLowerCase()
  if (s === 'trialing') return { label: 'Trialing', tone: 'green' as const }
  if (s === 'active') return { label: 'Active', tone: 'blue' as const }
  if (s === 'past_due') return { label: 'Past Due', tone: 'red' as const }
  if (s === 'canceled' || s === 'cancelled') return { label: 'Canceled', tone: 'red' as const }
  return { label: status || 'Unknown', tone: 'blue' as const }
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

function SettingsPageInner() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const supabase = createClient()
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const raw = window.localStorage.getItem('heymonday_dashboard_prefs_v1')
      if (!raw) return true
      const parsed = JSON.parse(raw)
      return typeof parsed.isDark === 'boolean' ? parsed.isDark : true
    } catch {
      return true
    }
  })
  const T = isDark ? DARK : LIGHT

  const [loading, setLoading] = useState(true)
  const [savingAccount, setSavingAccount] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [userId, setUserId] = useState('')
  const [provider, setProvider] = useState<'google' | 'email' | 'unknown'>('unknown')

  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [fullName, setFullName] = useState('')
  const [traderType, setTraderType] = useState<TraderType>('day')
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true)
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(true)
  const [savedTraderType, setSavedTraderType] = useState<TraderType>('day')
  const [savedWakeWord, setSavedWakeWord] = useState(true)
  const [savedVoiceReplies, setSavedVoiceReplies] = useState(true)
  const [eventAlertsEnabled, setEventAlertsEnabled] = useState(false)
  const [eventAlertMinutes, setEventAlertMinutes] = useState(10)
  const [eventAlertResults, setEventAlertResults] = useState(false)
  const [eventAlertImpactFilter, setEventAlertImpactFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM'>('HIGH')
  const [savedEventAlertsEnabled, setSavedEventAlertsEnabled] = useState(false)
  const [savedEventAlertMinutes, setSavedEventAlertMinutes] = useState(10)
  const [savedEventAlertResults, setSavedEventAlertResults] = useState(false)
  const [savedEventAlertImpactFilter, setSavedEventAlertImpactFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM'>('HIGH')

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')

      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.replace('/login')
        return
      }

      const user = session.user
      const rawProvider = user.app_metadata?.provider
      const normalizedProvider =
        rawProvider === 'google' ? 'google' :
        rawProvider === 'email' ? 'email' :
        'unknown'

      const { data: row, error: rowError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          trader_type,
          onboarding_complete,
          stripe_customer_id,
          stripe_subscription_id,
          stripe_price_id,
          subscription_status,
          billing_interval,
          trial_ends_at,
          current_period_end,
          cancel_at_period_end,
          billing_zip,
          wake_word_enabled,
          voice_replies_enabled,
          event_alerts_enabled,
          event_alert_minutes_before,
          event_alert_announce_results,
          event_alert_impact_filter
        `)
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return

      if (rowError) {
        setError(rowError.message)
        setLoading(false)
        return
      }

      setUserId(user.id)
      setProvider(normalizedProvider)
      setProfile((row as ProfileRow) || null)
      setFullName(
        row?.full_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        [user.user_metadata?.given_name, user.user_metadata?.family_name].filter(Boolean).join(' ') ||
        ''
      )
      const tt = (row?.trader_type as TraderType) || 'day'
      const ww = row?.wake_word_enabled !== false
      const vr = row?.voice_replies_enabled !== false
      const ea = !!row?.event_alerts_enabled
      const eam = typeof row?.event_alert_minutes_before === 'number' ? row.event_alert_minutes_before : 10
      const ear = !!row?.event_alert_announce_results
      const eaif = (row?.event_alert_impact_filter === 'ALL' || row?.event_alert_impact_filter === 'MEDIUM')
        ? row.event_alert_impact_filter as 'ALL' | 'MEDIUM'
        : 'HIGH' as const

      setTraderType(tt); setSavedTraderType(tt)
      setWakeWordEnabled(ww); setSavedWakeWord(ww)
      setVoiceRepliesEnabled(vr); setSavedVoiceReplies(vr)
      setEventAlertsEnabled(ea); setSavedEventAlertsEnabled(ea)
      setEventAlertMinutes(eam); setSavedEventAlertMinutes(eam)
      setEventAlertResults(ear); setSavedEventAlertResults(ear)
      setEventAlertImpactFilter(eaif); setSavedEventAlertImpactFilter(eaif)

      setLoading(false)

      // Sync latest billing state from Stripe in the background
      if (row?.stripe_subscription_id) {
        fetch('/api/billing/sync', { method: 'POST' })
          .then(r => r.json())
          .then(data => {
            if (!mounted || !data.synced) return
            setProfile(prev => prev ? {
              ...prev,
              subscription_status: data.subscription_status ?? prev.subscription_status,
              billing_interval: data.billing_interval ?? prev.billing_interval,
              current_period_end: data.current_period_end ?? prev.current_period_end,
              trial_ends_at: data.trial_ends_at ?? prev.trial_ends_at,
              cancel_at_period_end: data.cancel_at_period_end ?? prev.cancel_at_period_end,
              stripe_price_id: data.stripe_price_id ?? prev.stripe_price_id,
              billing_zip: data.billing_zip ?? prev.billing_zip,
            } : prev)
          })
          .catch(() => {})
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [router, supabase])

  const subscriptionMeta = useMemo(() => statusPill(profile?.subscription_status || null), [profile])

  async function saveAccount() {
    if (!userId) return
    setSavingAccount(true)
    setError('')
    setSuccess('')

    const trimmedName = fullName.trim()
    if (!trimmedName) {
      setError('Full name is required.')
      setSavingAccount(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: trimmedName })
      .eq('id', userId)

    if (error) {
      setError(error.message)
      setSavingAccount(false)
      return
    }

    setProfile(prev => prev ? { ...prev, full_name: trimmedName } : prev)
    setSuccess('Account settings saved.')
    setSavingAccount(false)
  }

  const hasUnsavedChanges =
    traderType !== savedTraderType ||
    wakeWordEnabled !== savedWakeWord ||
    voiceRepliesEnabled !== savedVoiceReplies ||
    eventAlertsEnabled !== savedEventAlertsEnabled ||
    eventAlertMinutes !== savedEventAlertMinutes ||
    eventAlertResults !== savedEventAlertResults ||
    eventAlertImpactFilter !== savedEventAlertImpactFilter

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  async function savePreferences() {
    if (!userId) return
    setSavingPrefs(true)
    setError('')
    const { error } = await supabase
      .from('profiles')
      .update({
        trader_type: traderType,
        wake_word_enabled: wakeWordEnabled,
        voice_replies_enabled: voiceRepliesEnabled,
        event_alerts_enabled: eventAlertsEnabled,
        event_alert_minutes_before: eventAlertMinutes,
        event_alert_announce_results: eventAlertResults,
        event_alert_impact_filter: eventAlertImpactFilter,
      })
      .eq('id', userId)
    setSavingPrefs(false)
    if (error) {
      setError(error.message)
      return
    }
    // Sync to localStorage so dashboard polling picks up new values immediately
    try {
      const raw = window.localStorage.getItem('heymonday_dashboard_prefs_v1')
      const parsed = raw ? JSON.parse(raw) : {}
      window.localStorage.setItem('heymonday_dashboard_prefs_v1', JSON.stringify({
        ...parsed,
        eventAlertsEnabled,
        eventAlertMinutesBefore: eventAlertMinutes,
        eventAlertAnnounceResults: eventAlertResults,
        eventAlertImpactFilter,
      }))
    } catch {}
    setProfile(prev => prev ? {
      ...prev,
      trader_type: traderType,
      wake_word_enabled: wakeWordEnabled,
      voice_replies_enabled: voiceRepliesEnabled,
      event_alerts_enabled: eventAlertsEnabled,
      event_alert_minutes_before: eventAlertMinutes,
      event_alert_announce_results: eventAlertResults,
      event_alert_impact_filter: eventAlertImpactFilter,
    } : prev)
    setSavedTraderType(traderType)
    setSavedWakeWord(wakeWordEnabled)
    setSavedVoiceReplies(voiceRepliesEnabled)
    setSavedEventAlertsEnabled(eventAlertsEnabled)
    setSavedEventAlertMinutes(eventAlertMinutes)
    setSavedEventAlertResults(eventAlertResults)
    setSavedEventAlertImpactFilter(eventAlertImpactFilter)
    setSuccess('Preferences saved.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function openCustomerPortal() {
    setBillingLoading(true)
    setError('')

    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Could not open billing portal.')
      if (!data.url) throw new Error('No portal URL returned.')

      window.location.href = data.url
    } catch (err: any) {
      setError(err.message || 'Could not open billing portal.')
      setBillingLoading(false)
    }
  }

  async function toggleCancelAtPeriodEnd() {
    setBillingLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancelAtPeriodEnd: !profile?.cancel_at_period_end,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not update subscription.')

      setProfile(prev =>
        prev
          ? {
              ...prev,
              cancel_at_period_end: !!data.cancel_at_period_end,
              subscription_status: data.subscription_status ?? prev.subscription_status,
              current_period_end: data.current_period_end ?? prev.current_period_end,
            }
          : prev
      )

      setSuccess(
        data.cancel_at_period_end
          ? 'Your subscription will end at the end of the current period.'
          : 'Auto-renew has been restored.'
      )
    } catch (err: any) {
      setError(err.message || 'Could not update subscription.')
    } finally {
      setBillingLoading(false)
    }
  }

  async function sendPasswordReset() {
    if (!profile?.email) return
    setError('')
    setSuccess('')

    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(`Password reset email sent to ${profile.email}.`)
  }

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const pillStyles = subscriptionMeta.tone === 'green'
    ? { color: T.green, background: T.greenBg, border: T.greenBorder }
    : subscriptionMeta.tone === 'red'
    ? { color: T.red, background: T.redBg, border: T.redBorder }
    : { color: T.blue, background: T.blueBg, border: T.blueBorder }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: T.inputBg,
    border: `1px solid ${T.inputBorder}`,
    color: T.text2,
    padding: '13px 14px',
    fontSize: 14,
    outline: 'none',
    borderRadius: 4,
    fontFamily: "'DM Mono', monospace",
  }

  const sectionCard: React.CSSProperties = {
    background: T.panelBg,
    border: `1px solid ${T.border}`,
    padding: isMobile ? '16px' : '24px',
    borderRadius: 8,
  }

  const actionBtn = (primary = false): React.CSSProperties => ({
    padding: '12px 16px',
    borderRadius: 4,
    border: primary ? 'none' : `1px solid ${T.border2}`,
    background: primary ? T.gold : T.mutedBtn,
    color: primary ? '#0a0a08' : T.text2,
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  })

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: T.pageBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: T.gold,
        fontFamily: "'DM Mono', monospace",
      }}>
        Loading settings...
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.pageBg,
      color: T.text2,
      fontFamily: "'DM Mono', monospace",
      position: 'relative',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: ${T.text4}; }
      `}</style>

      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `linear-gradient(${T.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${T.gridLine} 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1180, margin: '0 auto', padding: isMobile ? '16px 16px 120px' : '32px 24px 80px' }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? 12 : 16,
          marginBottom: isMobile ? 20 : 28,
        }}>
          <div>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: isMobile ? 28 : 38,
              fontStyle: 'italic',
              color: T.text,
              marginBottom: 4,
            }}>
              Settings
            </div>
            <div style={{ color: T.text4, fontSize: 13 }}>
              Manage your account, billing, and preferences.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div
              onClick={() => {
                const next = !isDark
                setIsDark(next)
                try {
                  const raw = window.localStorage.getItem('heymonday_dashboard_prefs_v1')
                  const parsed = raw ? JSON.parse(raw) : {}
                  window.localStorage.setItem('heymonday_dashboard_prefs_v1', JSON.stringify({ ...parsed, isDark: next }))
                } catch {}
              }}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                border: `1px solid ${T.border2}`,
                background: T.mutedBtn,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 15, color: T.gold,
              }}
            >
              {isDark ? '☀' : '☾'}
            </div>
            <div
              onClick={() => {
                if (hasUnsavedChanges) {
                  setShowUnsavedModal(true)
                } else {
                  router.push('/dashboard')
                }
              }}
              style={{
                textDecoration: 'none',
                ...actionBtn(false),
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {isMobile ? '← Back' : '← Back to Dashboard'}
            </div>
          </div>
        </div>

        {(error || success) && (
          <div style={{ marginBottom: 20 }}>
            {error && (
              <div style={{
                color: T.red,
                background: T.redBg,
                border: `1px solid ${T.redBorder}`,
                padding: '12px 14px',
                borderRadius: 4,
                marginBottom: success ? 10 : 0,
                fontSize: 13,
              }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{
                color: T.green,
                background: T.greenBg,
                border: `1px solid ${T.greenBorder}`,
                padding: '12px 14px',
                borderRadius: 4,
                fontSize: 13,
              }}>
                {success}
              </div>
            )}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr',
          gap: isMobile ? 16 : 20,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={sectionCard}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ color: T.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Account</div>
                <div style={{ color: T.text4, fontSize: 13 }}>Your identity and login information.</div>
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <div style={{ color: T.text3, fontSize: 12, marginBottom: 6 }}>Full name</div>
                  <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    style={inputStyle}
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <div style={{ color: T.text3, fontSize: 12, marginBottom: 6 }}>Email address</div>
                  <div style={{
                    ...inputStyle,
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 46,
                    color: T.text4,
                  }}>
                    {profile?.email || '—'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{
                    padding: '8px 10px',
                    border: `1px solid ${T.border2}`,
                    borderRadius: 999,
                    fontSize: 12,
                    color: T.text3,
                    background: T.panelBg2,
                  }}>
                    Sign-in method: {provider === 'google' ? 'Google' : provider === 'email' ? 'Email & Password' : 'Unknown'}
                  </div>

                  <div style={{
                    padding: '8px 10px',
                    border: `1px solid ${T.border2}`,
                    borderRadius: 999,
                    fontSize: 12,
                    color: T.text3,
                    background: T.panelBg2,
                  }}>
                    User ID: {userId ? `${userId.slice(0, 8)}...` : '—'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                  <button onClick={saveAccount} disabled={savingAccount} style={actionBtn(true)}>
                    {savingAccount ? 'Saving...' : 'Save Account'}
                  </button>

                  {provider === 'email' ? (
                    <button onClick={sendPasswordReset} style={actionBtn(false)}>
                      Change Password
                    </button>
                  ) : (
                    <div style={{
                      padding: '12px 14px',
                      border: `1px solid ${T.border2}`,
                      borderRadius: 4,
                      fontSize: 12,
                      color: T.text4,
                      background: T.panelBg2,
                    }}>
                      Password managed by Google
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={sectionCard}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ color: T.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Preferences</div>
                <div style={{ color: T.text4, fontSize: 13 }}>Control how Monday behaves for you.</div>
              </div>

              <div style={{ display: 'grid', gap: 18 }}>
                <div>
                  <div style={{ color: T.text3, fontSize: 12, marginBottom: 8 }}>Trading style</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {TRADER_TYPES.map(type => {
                      const selected = traderType === type.id
                      return (
                        <div
                          key={type.id}
                          onClick={() => setTraderType(type.id)}
                          style={{
                            cursor: 'pointer',
                            border: `1px solid ${selected ? T.gold : T.border}`,
                            background: selected ? T.panelBg2 : T.panelBg,
                            padding: '14px 16px',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ color: selected ? T.gold : T.text2, fontSize: 15, fontWeight: 700 }}>
                              {type.label}
                            </div>
                          </div>
                          {selected && (
                            <div style={{ color: T.gold, fontSize: 12 }}>Active</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>


              </div>
            </div>

            <div style={sectionCard}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ color: T.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Event Alerts</div>
                <div style={{ color: T.text4, fontSize: 13 }}>Get voice announcements before and after high-impact economic events.</div>
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                {/* Voice event alerts toggle */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '14px 16px',
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  background: T.panelBg2,
                }}>
                  <div>
                    <div style={{ color: T.text2, fontWeight: 700, marginBottom: 4 }}>
                      Voice event alerts
                    </div>
                    <div style={{ color: T.text4, fontSize: 12 }}>
                      Monday announces upcoming high-impact events aloud.
                    </div>
                  </div>
                  <div
                    onClick={() => setEventAlertsEnabled(prev => !prev)}
                    style={{
                      width: 42,
                      height: 24,
                      borderRadius: 999,
                      background: eventAlertsEnabled ? 'rgba(201,146,42,0.15)' : T.inputBg,
                      border: `1px solid ${eventAlertsEnabled ? T.gold : T.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      padding: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: eventAlertsEnabled ? T.gold : '#666',
                        transform: `translateX(${eventAlertsEnabled ? '18px' : '0px'})`,
                        transition: 'all 0.2s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Expanded options when enabled */}
                {eventAlertsEnabled && (
                  <>
                    <div style={{ padding: '14px 16px', border: `1px solid ${T.border}`, borderRadius: 6, background: T.panelBg2 }}>
                      <div style={{ color: T.text3, fontSize: 12, marginBottom: 10 }}>Alert me for:</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {([{ id: 'ALL', label: 'All Events' }, { id: 'HIGH', label: 'High Impact' }, { id: 'MEDIUM', label: 'Medium Impact' }] as const).map(opt => {
                          const selected = eventAlertImpactFilter === opt.id
                          return (
                            <div
                              key={opt.id}
                              onClick={() => setEventAlertImpactFilter(opt.id)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 999,
                                background: selected ? 'rgba(201,146,42,0.12)' : T.panelBg2,
                                color: selected ? T.gold : T.text3,
                                border: `1px solid ${selected ? T.gold : T.border}`,
                                fontFamily: "'DM Mono', monospace",
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ padding: '14px 16px', border: `1px solid ${T.border}`, borderRadius: 6, background: T.panelBg2 }}>
                      <div style={{ color: T.text3, fontSize: 12, marginBottom: 10 }}>Alert me this many minutes before:</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {([1, 5, 10, 15, 30, 60] as const).map(min => {
                          const selected = eventAlertMinutes === min
                          const label = min === 1 ? '1 min' : `${min}m`
                          return (
                            <div
                              key={min}
                              onClick={() => setEventAlertMinutes(min)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 999,
                                background: selected ? 'rgba(201,146,42,0.12)' : T.panelBg2,
                                color: selected ? T.gold : T.text3,
                                border: `1px solid ${selected ? T.gold : T.border}`,
                                fontFamily: "'DM Mono', monospace",
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              {label}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Announce results toggle */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 12,
                      alignItems: 'center',
                      padding: '14px 16px',
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      background: T.panelBg2,
                    }}>
                      <div>
                        <div style={{ color: T.text2, fontWeight: 700, marginBottom: 4 }}>
                          Announce results
                        </div>
                        <div style={{ color: T.text4, fontSize: 12 }}>
                          Read the actual result when an event is published.
                        </div>
                      </div>
                      <div
                        onClick={() => setEventAlertResults(prev => !prev)}
                        style={{
                          width: 42,
                          height: 24,
                          borderRadius: 999,
                          background: eventAlertResults ? 'rgba(201,146,42,0.15)' : T.inputBg,
                          border: `1px solid ${eventAlertResults ? T.gold : T.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          padding: 2,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: eventAlertResults ? T.gold : '#666',
                            transform: `translateX(${eventAlertResults ? '18px' : '0px'})`,
                            transition: 'all 0.2s ease',
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div style={{ color: T.text4, fontSize: 11 }}>
                  All changes require Save Changes · Only fires if voice replies are on.
                </div>
              </div>
            </div>

            <div style={sectionCard}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ color: T.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Support & legal</div>
                <div style={{ color: T.text4, fontSize: 13 }}>Important links for production use.</div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/privacy" style={{ ...actionBtn(false), textDecoration: 'none' }}>Privacy Policy</Link>
                <Link href="/terms" style={{ ...actionBtn(false), textDecoration: 'none' }}>Terms</Link>
                <a href="mailto:support@heymonday.store" style={{ ...actionBtn(false), textDecoration: 'none' }}>Contact Support</a>
                <button onClick={signOut} disabled={signingOut} style={actionBtn(false)}>
                  {signingOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={sectionCard}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ color: T.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Billing & subscription</div>
                <div style={{ color: T.text4, fontSize: 13 }}>Manage your Hey Monday plan and trial.</div>
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  width: 'fit-content',
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: pillStyles.background,
                  border: `1px solid ${pillStyles.border}`,
                  color: pillStyles.color,
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {subscriptionMeta.label}
                </div>

                <div style={{
                  border: `1px solid ${T.border}`,
                  background: T.panelBg2,
                  borderRadius: 6,
                  overflow: 'hidden',
                }}>
                  {[
  ['Plan', profile?.billing_interval === 'year' ? 'Hey Monday Pro (Annual)' : profile?.billing_interval === 'month' ? 'Hey Monday Pro (Monthly)' : 'Hey Monday Pro'],
  ['Status', subscriptionMeta.label],
  ['Billing interval', profile?.billing_interval || '—'],
  ['Trial ends', fmtDate(profile?.trial_ends_at || null)],
  ['Renews / current period end', fmtDate(profile?.current_period_end || null)],
  ['Billing ZIP', profile?.billing_zip || '—'],
].map(([label, value], i, arr) => (
  <div
    key={label}
    style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '110px 1fr' : '170px 1fr',
      gap: isMobile ? 8 : 12,
      padding: isMobile ? '10px 12px' : '12px 14px',
      borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${T.border}`,
    }}
  >
    <div style={{ color: T.text4, fontSize: 12 }}>{label}</div>
    <div style={{ color: T.text2, fontSize: 13, wordBreak: 'break-word' }}>{value}</div>
  </div>
))}
                </div>

                {profile?.cancel_at_period_end ? (
                  <div style={{
                    color: T.red,
                    background: T.redBg,
                    border: `1px solid ${T.redBorder}`,
                    padding: '12px 14px',
                    borderRadius: 4,
                    fontSize: 13,
                  }}>
                    Your subscription is set to cancel at the end of the current period.
                  </div>
                ) : (
                  <div style={{
                    color: T.green,
                    background: T.greenBg,
                    border: `1px solid ${T.greenBorder}`,
                    padding: '12px 14px',
                    borderRadius: 4,
                    fontSize: 13,
                  }}>
                    Your subscription is active and will continue automatically unless canceled.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={openCustomerPortal} disabled={billingLoading} style={actionBtn(true)}>
                    {billingLoading ? 'Opening...' : 'Manage Billing'}
                  </button>

                  <button
  onClick={toggleCancelAtPeriodEnd}
  disabled={billingLoading || !profile?.stripe_subscription_id}
  style={actionBtn(false)}
>
  {profile?.cancel_at_period_end
    ? 'Reactivate Subscription'
    : profile?.subscription_status === 'trialing'
    ? 'Cancel Free Trial'
    : 'Cancel Subscription'}
</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky save bar ── */}
      {hasUnsavedChanges && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: isDark ? 'rgba(16,13,7,0.96)' : 'rgba(255,255,255,0.96)',
          borderTop: `1px solid ${T.border2}`,
          backdropFilter: 'blur(8px)',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div style={{ color: T.text3, fontSize: 13 }}>You have unsaved preference changes.</div>
          <button
            onClick={savePreferences}
            disabled={savingPrefs}
            style={{ ...actionBtn(true), minWidth: 140 }}
          >
            {savingPrefs ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* ── Unsaved changes modal ── */}
      {showUnsavedModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: T.panelBg,
            border: `1px solid ${T.border2}`,
            borderRadius: 10,
            padding: '28px 28px 24px',
            maxWidth: 420,
            width: '100%',
            fontFamily: "'DM Mono', monospace",
          }}>
            <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Unsaved changes
            </div>
            <div style={{ color: T.text3, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
              You have unsaved preference changes. Save them before leaving, or discard?
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  await savePreferences()
                  setShowUnsavedModal(false)
                  router.push('/dashboard')
                }}
                disabled={savingPrefs}
                style={{ ...actionBtn(true), flex: 1 }}
              >
                {savingPrefs ? 'Saving...' : 'Save & Go Back'}
              </button>
              <button
                onClick={() => {
                  setShowUnsavedModal(false)
                  router.push('/dashboard')
                }}
                style={{ ...actionBtn(false), flex: 1 }}
              >
                Discard
              </button>
              <button
                onClick={() => setShowUnsavedModal(false)}
                style={{ ...actionBtn(false), flex: 1 }}
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return <SettingsPageInner />
}