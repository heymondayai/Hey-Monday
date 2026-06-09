'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/app/context/theme-context'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

// ── THEMES ────────────────────────────────────────────────────────────────────
const DARK = {
  pageBg: '#0a0a08', bg2: '#120f07', bg3: '#181208', bg4: '#1c1608',
  border: '#2a2618', border2: '#3a3420',
  gold: '#c9922a', goldDim: '#8a6420',
  red: '#c94242', green: '#4a9c6a', amber: '#b8860b',
  text: '#d4c5a0', text2: '#a08040', text3: '#6a6050',
  heading: '#e8d5a0',
  badgeBg: 'rgba(201,146,42,.08)', badgeBorder: 'rgba(201,146,42,.2)',
  btnText: '#0a0a08',
  cardBg: '#120f07',
  errBg: 'rgba(201,66,66,.08)', errBorder: 'rgba(201,66,66,.25)',
  successBg: 'rgba(74,156,106,.08)', successBorder: 'rgba(74,156,106,.25)',
  dangerBg: 'rgba(201,66,66,.06)', dangerBorder: 'rgba(201,66,66,.2)',
  toggleBg: '#1c1608', toggleBorder: '#3a3420',
  navBg: '#120f07',
  modalOverlay: 'rgba(0,0,0,0.78)',
  featureBg: 'rgba(201,146,42,.04)',
}

const LIGHT = {
  pageBg: '#fafaf8', bg2: '#f2f1ee', bg3: '#e8e6e2', bg4: '#dedad5',
  border: '#d8d5d0', border2: '#c4c1bc',
  gold: '#b8750c', goldDim: '#9a6008',
  red: '#dc2626', green: '#16a34a', amber: '#b45309',
  text: '#1a1a1a', text2: '#4a4a4a', text3: '#737373',
  heading: '#0f0f0f',
  badgeBg: 'rgba(184,117,12,.07)', badgeBorder: 'rgba(184,117,12,.22)',
  btnText: '#ffffff',
  cardBg: '#ffffff',
  errBg: 'rgba(220,38,38,.06)', errBorder: 'rgba(220,38,38,.28)',
  successBg: 'rgba(22,163,74,.06)', successBorder: 'rgba(22,163,74,.25)',
  dangerBg: 'rgba(220,38,38,.05)', dangerBorder: 'rgba(220,38,38,.20)',
  toggleBg: '#e8e6e2', toggleBorder: '#c4c1bc',
  navBg: '#f2f1ee',
  modalOverlay: 'rgba(0,0,0,0.50)',
  featureBg: 'rgba(184,117,12,.04)',
}

// ── PLAN HELPERS ─────────────────────────────────────────────────────────────
function derivePlan(priceId: string | null | undefined): 'core' | 'edge' | null {
  if (!priceId) return null
  const coreIds = [
    process.env.NEXT_PUBLIC_STRIPE_PRICE_CORE_MONTHLY,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_CORE_ANNUAL,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL,
  ].filter(Boolean) as string[]
  const edgeIds = [
    process.env.NEXT_PUBLIC_STRIPE_PRICE_EDGE_MONTHLY,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_EDGE_ANNUAL,
  ].filter(Boolean) as string[]
  if (coreIds.includes(priceId)) return 'core'
  if (edgeIds.includes(priceId)) return 'edge'
  return null
}

const PLAN_FEATURES: Record<'core' | 'edge', string[]> = {
  core: [
    'AI voice — "Hey Monday" wake word',
    'Live prices — stocks, ETFs, futures, crypto',
    'High-impact economic calendar',
    'News feed with sentiment scoring',
    'Options flow & dark pool activity',
    'Full data history',
    'Up to 5 active alerts',
    '2 AI summaries / day',
  ],
  edge: [
    'AI voice — "Hey Monday" wake word',
    'Live prices — stocks, ETFs, futures, crypto',
    'High-impact economic calendar',
    'News feed with sentiment scoring',
    'Options flow & dark pool activity',
    'Full data history',
    'Unlimited active alerts',
    'Unlimited AI summaries & briefings',
    'Custom scheduled summaries',
    'Political & social media intel',
    'Congressional & insider trades',
    'TradingView alert integration',
  ],
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  subscription_status: string | null
  billing_interval: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
}

type Modal = 'cancel' | 'reactivate' | 'change-plan' | 'delete-account' | null

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

function CardIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 6 5 9 10 3"/>
    </svg>
  )
}

export default function BillingPage() {
  const { isDark, toggle } = useTheme()
  const T = isDark ? DARK : LIGHT
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Plan change modal state
  const [changeTier, setChangeTier] = useState<'core' | 'edge'>('core')
  const [changeCycle, setChangeCycle] = useState<'monthly' | 'annual'>('monthly')
  const [switchLoading, setSwitchLoading] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [showPromo, setShowPromo] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.replace('/login'); return }

      const { data: row } = await supabase
        .from('profiles')
        .select('id, email, full_name, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, billing_interval, trial_ends_at, current_period_end, cancel_at_period_end')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!mounted) return
      const p = (row as ProfileRow) || null
      setProfile(p)
      setLoading(false)

      // Pre-seed the change modal to current plan
      if (p) {
        const cur = derivePlan(p.stripe_price_id)
        setChangeTier(cur === 'edge' ? 'edge' : 'core')
        setChangeCycle(p.billing_interval === 'year' ? 'annual' : 'monthly')
      }

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
            } : prev)
          })
          .catch(() => {})
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4500)
  }

  async function openPortal() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not open billing portal.')
      window.location.href = data.url
    } catch (err: any) {
      showToast(err.message || 'Could not open billing portal.', 'error')
      setActionLoading(false)
    }
  }

  async function handleCancel() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelAtPeriodEnd: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not cancel subscription.')
      setProfile(prev => prev ? { ...prev, cancel_at_period_end: true } : prev)
      setModal(null)
      showToast('Subscription will cancel at period end. You keep access until then.')
    } catch (err: any) {
      showToast(err.message || 'Could not cancel.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDeleteAccount() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not delete account.')
      await supabase.auth.signOut()
      router.replace('/')
    } catch (err: any) {
      showToast(err.message || 'Could not delete account.', 'error')
      setActionLoading(false)
    }
  }

  async function handleReactivate() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelAtPeriodEnd: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not reactivate.')
      setProfile(prev => prev ? { ...prev, cancel_at_period_end: false } : prev)
      setModal(null)
      showToast("Subscription reactivated — you're all set.")
    } catch (err: any) {
      showToast(err.message || 'Could not reactivate.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  function resolvePriceId(tier: 'core' | 'edge', cycle: 'monthly' | 'annual'): string | null {
    if (tier === 'edge') {
      return cycle === 'annual'
        ? (process.env.NEXT_PUBLIC_STRIPE_PRICE_EDGE_ANNUAL ?? null)
        : (process.env.NEXT_PUBLIC_STRIPE_PRICE_EDGE_MONTHLY ?? null)
    }
    return cycle === 'annual'
      ? (process.env.NEXT_PUBLIC_STRIPE_PRICE_CORE_ANNUAL ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL ?? null)
      : (process.env.NEXT_PUBLIC_STRIPE_PRICE_CORE_MONTHLY ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? null)
  }

  async function handleSwitchPlan() {
    const priceId = resolvePriceId(changeTier, changeCycle)
    if (!priceId) {
      showToast('Plan price not configured — contact support.', 'error')
      return
    }
    setSwitchLoading(true)
    try {
      const res = await fetch('/api/billing/switch-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, promoCode: promoCode.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not switch plan.')
      if (data.alreadyCurrent) {
        setModal(null)
        setPromoCode(''); setShowPromo(false)
        showToast('You are already on that plan.')
        return
      }
      setProfile(prev => prev ? {
        ...prev,
        stripe_price_id: data.stripe_price_id ?? prev.stripe_price_id,
        billing_interval: data.billing_interval ?? prev.billing_interval,
        subscription_status: data.subscription_status ?? prev.subscription_status,
        current_period_end: data.current_period_end ?? prev.current_period_end,
        trial_ends_at: data.trial_ends_at ?? prev.trial_ends_at,
        cancel_at_period_end: data.cancel_at_period_end ?? prev.cancel_at_period_end,
      } : prev)
      setModal(null)
      setPromoCode(''); setShowPromo(false)
      const newPlanName = changeTier === 'edge' ? 'Advantage' : 'Essential'
      showToast(`Switched to ${newPlanName} (${changeCycle}). Changes take effect immediately.`)
    } catch (err: any) {
      showToast(err.message || 'Could not switch plan.', 'error')
    } finally {
      setSwitchLoading(false)
    }
  }

  // Derived values
  const plan = derivePlan(profile?.stripe_price_id)
  const planName = plan === 'core' ? 'Essential' : plan === 'edge' ? 'Advantage' : '—'
  const billingInterval = profile?.billing_interval
  const price = plan === 'edge'
    ? (billingInterval === 'year' ? 91.66 : 109.99)
    : plan === 'core'
    ? (billingInterval === 'year' ? 66.66 : 79.99)
    : null

  const renewDate = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—'
  const isTrial = profile?.subscription_status === 'trialing'
  const isCanceled = !!profile?.cancel_at_period_end
  const statusColor = isCanceled ? T.red : isTrial ? T.amber : T.green
  const statusLabel = isCanceled ? `Cancels ${renewDate}` : isTrial ? 'Trial' : 'Active'
  const planFeatures = plan ? PLAN_FEATURES[plan] : []

  const sectionHead = (label: string) => (
    <div style={{ fontSize: 9, letterSpacing: '0.22em', color: T.goldDim, textTransform: 'uppercase' as const, marginBottom: 16, transition: 'color 0.3s' }}>{label}</div>
  )

  const card = (children: React.ReactNode, extra?: React.CSSProperties) => (
    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, overflow: 'hidden', transition: 'background 0.3s, border-color 0.3s', ...extra }}>
      {children}
    </div>
  )

  const spinner = (color: string) => (
    <span style={{ width: 12, height: 12, border: `2px solid ${color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
  )

  if (loading) {
    return (
      <div style={{ background: T.pageBg, color: T.gold, fontFamily: "'JetBrains Mono', monospace", minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, letterSpacing: '0.1em' }}>
        Loading billing...
      </div>
    )
  }

  // Plan card helpers for change-plan modal
  const planPrice = (tier: 'core' | 'edge', cycle: 'monthly' | 'annual') =>
    tier === 'edge'
      ? (cycle === 'annual' ? '91.66' : '109.99')
      : (cycle === 'annual' ? '66.66' : '79.99')

  const planLabel = (tier: 'core' | 'edge') => tier === 'core' ? 'Essential' : 'Advantage'

  return (
    <div style={{ background: T.pageBg, color: T.text, fontFamily: "'JetBrains Mono', monospace", minHeight: '100vh', transition: 'background 0.3s, color 0.3s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes toggleSpin{from{transform:rotate(-20deg);opacity:0}to{transform:rotate(0);opacity:1}}
        .fade{animation:fadeIn 0.2s ease both}
        .slide{animation:slideDown 0.25s ease both}
        .toggle-icon{animation:toggleSpin 0.25s ease both}
        @media(max-width:700px){.billing-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* NAV */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.navBg, transition: 'background 0.3s, border-color 0.3s' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.heading, fontWeight: 600, transition: 'color 0.3s' }}>Hey </span>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.gold, fontWeight: 700, transition: 'color 0.3s' }}>Monday</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={toggle}
            style={{ background: T.toggleBg, border: `1px solid ${T.toggleBorder}`, borderRadius: 24, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: T.text2, transition: 'all 0.3s' }}>
            <span key={String(isDark)} className="toggle-icon">
              {isDark ? <SunIcon color={T.text2} /> : <MoonIcon color={T.text2} />}
            </span>
          </button>
          <Link href="/dashboard/settings" style={{ textDecoration: 'none', fontSize: 10, color: T.text3, letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'color 0.3s' }}>← Settings</Link>
          <div style={{ fontSize: 11, color: T.text2, transition: 'color 0.3s' }}>{profile?.email || '—'}</div>
        </div>
      </nav>

      {/* TOAST */}
      {toast && (
        <div className="slide" style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: toast.type === 'success' ? T.successBg : T.errBg, border: `1px solid ${toast.type === 'success' ? T.successBorder : T.errBorder}`, color: toast.type === 'success' ? T.green : T.red, padding: '11px 20px', fontSize: 12, letterSpacing: '0.04em', boxShadow: '0 4px 24px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
          {toast.type === 'success' ? '✓ ' : '⚠ '}{toast.msg}
        </div>
      )}

      {/* PAGE BODY */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontStyle: 'italic', fontWeight: 600, color: T.heading, marginBottom: 4, transition: 'color 0.3s' }}>Billing & Subscription</h1>
          <div style={{ fontSize: 11, color: T.text3, transition: 'color 0.3s' }}>Manage your Monday plan, payment method, and invoices.</div>
        </div>

        <div className="billing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Current plan */}
          {card(
            <div style={{ padding: '20px' }}>
              {sectionHead('Current plan')}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.heading, marginBottom: 4, transition: 'color 0.3s' }}>
                    {planName} Plan
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                    <span style={{ fontSize: 10, letterSpacing: '0.12em', color: statusColor, textTransform: 'uppercase' }}>{statusLabel}</span>
                  </div>
                </div>
                {price !== null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: T.gold, lineHeight: 1, transition: 'color 0.3s' }}>${price.toFixed(2)}</div>
                    <div style={{ fontSize: 9, color: T.text3, marginTop: 2, transition: 'color 0.3s' }}>/{billingInterval === 'year' ? 'mo, billed annually' : 'month'}</div>
                  </div>
                )}
              </div>
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: T.text3, transition: 'color 0.3s' }}>
                  {isCanceled ? `Access until ${renewDate}` : isTrial ? `Trial ends ${renewDate}` : `Renews ${renewDate}`}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      if (plan) {
                        setChangeTier(plan)
                        setChangeCycle(billingInterval === 'year' ? 'annual' : 'monthly')
                      }
                      setPromoCode(''); setShowPromo(false)
                      setModal('change-plan')
                    }}
                    style={{ fontSize: 9, padding: '5px 10px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.text3, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'all 0.2s' }}>
                    Change
                  </button>
                  {isCanceled
                    ? <button onClick={() => setModal('reactivate')} style={{ fontSize: 9, padding: '5px 10px', background: T.badgeBg, border: `1px solid ${T.badgeBorder}`, color: T.gold, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'all 0.2s' }}>Reactivate</button>
                    : <button onClick={() => setModal('cancel')} style={{ fontSize: 9, padding: '5px 10px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.red, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'all 0.2s' }}>Cancel</button>
                  }
                </div>
              </div>
            </div>
          )}

          {/* What's included */}
          {card(
            <div style={{ padding: '20px' }}>
              {sectionHead("What's included")}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {planFeatures.length === 0 && (
                  <div style={{ fontSize: 11, color: T.text3 }}>No plan detected — contact support.</div>
                )}
                {planFeatures.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckIcon color={T.gold} />
                    <span style={{ fontSize: 11, color: T.text, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payment method + Invoice history */}
        {card(
          <div style={{ padding: '20px' }}>
            {sectionHead('Payment & invoices')}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 30, background: T.bg3, border: `1px solid ${T.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
                  <CardIcon color={T.text2} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.heading, marginBottom: 2, transition: 'color 0.3s' }}>Card & invoice management</div>
                  <div style={{ fontSize: 10, color: T.text3, transition: 'color 0.3s' }}>Update payment method, download invoices, and view billing history in the Stripe portal.</div>
                </div>
              </div>
              <button
                onClick={openPortal}
                disabled={actionLoading}
                style={{ fontSize: 9, padding: '7px 14px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'all 0.2s', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {actionLoading ? spinner(T.text2) : 'Open Portal →'}
              </button>
            </div>
          </div>,
          { marginBottom: 16 }
        )}

        <div style={{ marginTop: 32, borderTop: `1px solid ${T.border}`, paddingTop: 28 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: T.red, textTransform: 'uppercase', marginBottom: 14, opacity: 0.7 }}>Danger zone</div>
          <div style={{ background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.heading, marginBottom: 3, transition: 'color 0.3s' }}>Delete account</div>
              <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.6, transition: 'color 0.3s' }}>Permanently delete your account and all data. This cannot be undone.</div>
            </div>
            <button onClick={() => setModal('delete-account')} style={{ fontSize: 9, padding: '8px 14px', background: 'transparent', border: `1px solid ${T.red}`, color: T.red, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0, opacity: 0.7 }}>
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {modal && (
        <div className="fade" onClick={() => { if (!actionLoading) setModal(null) }}
          style={{ position: 'fixed', inset: 0, background: T.modalOverlay, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="slide" onClick={e => e.stopPropagation()}
            style={{ background: T.cardBg, border: `1px solid ${T.border2}`, width: '100%', maxWidth: modal === 'change-plan' ? 520 : 440, overflow: 'hidden', transition: 'background 0.3s, border-color 0.3s' }}>
            <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${modal === 'cancel' ? T.red : T.gold}, transparent)` }} />
            <div style={{ padding: '24px' }}>

              {/* ── Cancel ── */}
              {modal === 'cancel' && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.heading, marginBottom: 6 }}>Cancel subscription?</div>
                  <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.7, marginBottom: 20 }}>
                    You'll keep full access until <strong style={{ color: T.gold }}>{renewDate}</strong>. After that, no further charges.
                  </div>
                  <div style={{ background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, padding: '10px 14px', fontSize: 11, color: T.text2, lineHeight: 1.6, marginBottom: 20 }}>
                    You'll lose: unlimited voice replies, live briefings, order flow, and news feed access.
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Keep Plan</button>
                    <button onClick={handleCancel} disabled={actionLoading} style={{ flex: 1, padding: '11px', background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, color: T.red, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {actionLoading ? spinner(T.red) : 'Confirm Cancel'}
                    </button>
                  </div>
                </>
              )}

              {/* ── Reactivate ── */}
              {modal === 'reactivate' && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.heading, marginBottom: 6 }}>Reactivate subscription?</div>
                  <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.7, marginBottom: 20 }}>
                    Your plan will continue and you'll be billed starting <strong style={{ color: T.gold }}>{renewDate}</strong>.
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Back</button>
                    <button onClick={handleReactivate} disabled={actionLoading} style={{ flex: 1, padding: '11px', background: T.gold, border: 'none', color: T.btnText, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {actionLoading ? spinner(T.btnText) : 'Reactivate →'}
                    </button>
                  </div>
                </>
              )}

              {/* ── Delete account ── */}
              {modal === 'delete-account' && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.red, marginBottom: 6 }}>Delete account?</div>
                  <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.7, marginBottom: 16 }}>
                    This will permanently delete your account, cancel your subscription, and erase all your data. <strong style={{ color: T.heading }}>This cannot be undone.</strong>
                  </div>
                  <div style={{ background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, padding: '10px 14px', fontSize: 11, color: T.text2, lineHeight: 1.6, marginBottom: 20 }}>
                    You'll lose: all chat history, watchlists, alerts, scheduled summaries, and access to Monday.
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Keep Account</button>
                    <button onClick={handleDeleteAccount} disabled={actionLoading} style={{ flex: 1, padding: '11px', background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, color: T.red, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {actionLoading ? spinner(T.red) : 'Delete Forever'}
                    </button>
                  </div>
                </>
              )}

              {/* ── Change plan ── */}
              {modal === 'change-plan' && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.heading, marginBottom: 4 }}>Change plan</div>
                  <div style={{ fontSize: 12, color: T.text3, marginBottom: 20 }}>Select a plan and billing cycle. Changes are processed via the billing portal.</div>

                  {/* Billing cycle toggle */}
                  <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: `1px solid ${T.border2}`, overflow: 'hidden' }}>
                    {(['monthly', 'annual'] as const).map(cycle => (
                      <button key={cycle} onClick={() => setChangeCycle(cycle)}
                        style={{ flex: 1, padding: '9px 12px', background: changeCycle === cycle ? T.badgeBg : 'transparent', border: 'none', borderRight: cycle === 'monthly' ? `1px solid ${T.border2}` : 'none', color: changeCycle === cycle ? T.gold : T.text3, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'all 0.15s' }}>
                        {cycle === 'monthly' ? 'Monthly' : 'Annual'}
                        {cycle === 'annual' && <span style={{ marginLeft: 6, fontSize: 9, color: T.green }}>Save ~17%</span>}
                      </button>
                    ))}
                  </div>

                  {/* Plan options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                    {(['core', 'edge'] as const).map(tier => {
                      const selected = changeTier === tier
                      const isCurrent = tier === plan && (billingInterval === 'year' ? 'annual' : 'monthly') === changeCycle
                      return (
                        <div key={tier} onClick={() => setChangeTier(tier)}
                          style={{ padding: '14px 16px', border: `1px solid ${selected ? T.gold : T.border2}`, background: selected ? T.badgeBg : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: selected ? T.gold : T.heading, marginBottom: 2 }}>
                                {planLabel(tier)}
                                {isCurrent && <span style={{ marginLeft: 8, fontSize: 9, color: T.text3, fontWeight: 400 }}>Current</span>}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: selected ? T.gold : T.text2 }}>${planPrice(tier, changeCycle)}</div>
                              <div style={{ fontSize: 9, color: T.text3 }}>/mo{changeCycle === 'annual' ? ', billed annually' : ''}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {PLAN_FEATURES[tier].slice(0, 4).map((f, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CheckIcon color={selected ? T.gold : T.goldDim} />
                                <span style={{ fontSize: 10, color: selected ? T.text : T.text3 }}>{f}</span>
                              </div>
                            ))}
                            {PLAN_FEATURES[tier].length > 4 && (
                              <div style={{ fontSize: 10, color: T.text3, paddingLeft: 17 }}>+{PLAN_FEATURES[tier].length - 4} more</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Promo code */}
                  <div style={{ marginBottom: 16 }}>
                    <button
                      onClick={() => setShowPromo(p => !p)}
                      style={{ background: 'none', border: 'none', color: T.gold, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer', padding: 0 }}>
                      {showPromo ? '− Hide promo code' : '+ Have a promo code?'}
                    </button>
                    {showPromo && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                        <input
                          value={promoCode}
                          onChange={e => setPromoCode(e.target.value.toUpperCase())}
                          placeholder="PROMO CODE"
                          style={{ flex: 1, background: T.bg2, border: `1px solid ${T.border2}`, color: T.heading, padding: '9px 12px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '0.1em', outline: 'none' }}
                        />
                      </div>
                    )}
                  </div>

                  {(() => {
                    const isCurrent = changeTier === plan && changeCycle === (billingInterval === 'year' ? 'annual' : 'monthly')
                    return (
                      <>
                        {isCurrent && (
                          <div style={{ fontSize: 10, color: T.text3, marginBottom: 12 }}>
                            This is your current plan. Select a different plan or billing cycle to switch.
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cancel</button>
                          <button
                            onClick={handleSwitchPlan}
                            disabled={switchLoading || isCurrent}
                            style={{ flex: 1, padding: '11px', background: isCurrent ? T.bg3 : T.gold, border: 'none', color: isCurrent ? T.text3 : T.btnText, cursor: isCurrent ? 'default' : 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            {switchLoading ? spinner(isCurrent ? T.text3 : T.btnText) : 'Confirm Change →'}
                          </button>
                        </div>
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
