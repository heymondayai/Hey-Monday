'use client'

import { useState } from 'react'
import { useTheme } from '@/app/context/theme-context'
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
}

const LIGHT = {
  pageBg: '#f5f0e8', bg2: '#ede6d6', bg3: '#e5dcc8', bg4: '#ddd3ba',
  border: '#c8b898', border2: '#b8a47e',
  gold: '#a06818', goldDim: '#7a5010',
  red: '#b83232', green: '#2e7d52', amber: '#8a5c10',
  text: '#2a1f0e', text2: '#6b4c20', text3: '#8a7050',
  heading: '#1a1008',
  badgeBg: 'rgba(160,104,24,.08)', badgeBorder: 'rgba(160,104,24,.25)',
  btnText: '#f5f0e8',
  cardBg: '#faf7f0',
  errBg: 'rgba(184,50,50,.06)', errBorder: 'rgba(184,50,50,.3)',
  successBg: 'rgba(46,125,82,.06)', successBorder: 'rgba(46,125,82,.25)',
  dangerBg: 'rgba(184,50,50,.05)', dangerBorder: 'rgba(184,50,50,.2)',
  toggleBg: '#e5dcc8', toggleBorder: '#b8a47e',
  navBg: '#ede6d6',
  modalOverlay: 'rgba(0,0,0,0.5)',
}

const MOCK = {
  name: 'Jane Smith',
  email: 'jane@example.com',
  plan: 'Pro' as const,
  billing: 'monthly' as 'monthly' | 'annual',
  status: 'active' as 'active' | 'trialing' | 'canceled' | 'past_due',
  trialEndsAt: null as string | null,
  currentPeriodEnd: '2026-04-20',
  cancelAtPeriodEnd: false,
  price: 79.99,
  card: { brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2027 },
  invoices: [
    { id: 'inv_001', date: '2026-03-20', amount: 79.99, status: 'paid', description: 'Pro Plan — March 2026' },
    { id: 'inv_002', date: '2026-02-20', amount: 79.99, status: 'paid', description: 'Pro Plan — February 2026' },
    { id: 'inv_003', date: '2026-01-20', amount: 79.99, status: 'paid', description: 'Pro Plan — January 2026' },
    { id: 'inv_004', date: '2025-12-20', amount: 79.99, status: 'paid', description: 'Pro Plan — December 2025' },
  ],
  repliesUsed: 3,
  repliesLimit: 5,
  repliesResetAt: 'midnight ET',
}

type Modal = 'cancel' | 'reactivate' | 'change-billing' | 'update-card' | null

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

export default function BillingPage() {
  const { isDark, toggle } = useTheme()
  const T = isDark ? DARK : LIGHT

  const [data, setData] = useState(MOCK)
  const [modal, setModal] = useState<Modal>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [billingChoice, setBillingChoice] = useState<'monthly' | 'annual'>(data.billing)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleCancel() {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    setData(d => ({ ...d, cancelAtPeriodEnd: true }))
    setLoading(false); setModal(null)
    showToast('Subscription will cancel at period end. You keep access until then.')
  }

  async function handleReactivate() {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    setData(d => ({ ...d, cancelAtPeriodEnd: false }))
    setLoading(false); setModal(null)
    showToast("Subscription reactivated — you're all set.")
  }

  async function handleChangeBilling() {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    setData(d => ({ ...d, billing: billingChoice, price: billingChoice === 'annual' ? 66.66 : 79.99 }))
    setLoading(false); setModal(null)
    showToast(`Switched to ${billingChoice} billing successfully.`)
  }

  const renewDate = new Date(data.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const isTrial = data.status === 'trialing'
  const isCanceled = data.cancelAtPeriodEnd

  const statusColor = isCanceled ? T.red : isTrial ? T.amber : T.green
  const statusLabel = isCanceled ? 'Cancels ' + renewDate : isTrial ? 'Trial' : 'Active'

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

  return (
    <div style={{ background: T.pageBg, color: T.text, fontFamily: "'JetBrains Mono', monospace", minHeight: '100vh', transition: 'background 0.3s, color 0.3s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(201,146,42,.4)}50%{opacity:.8;box-shadow:0 0 0 5px rgba(201,146,42,0)}}
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
          <Link href="/dashboard" style={{ textDecoration: 'none', fontSize: 10, color: T.text3, letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'color 0.3s' }}>← Dashboard</Link>
          <div style={{ fontSize: 11, color: T.text2, transition: 'color 0.3s' }}>{data.email}</div>
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
          {card(
            <div style={{ padding: '20px' }}>
              {sectionHead('Current plan')}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.heading, marginBottom: 4, transition: 'color 0.3s' }}>Pro Plan</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block', animation: isTrial ? 'pulse 2s ease infinite' : 'none' }} />
                    <span style={{ fontSize: 10, letterSpacing: '0.12em', color: statusColor, textTransform: 'uppercase' }}>{statusLabel}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: T.gold, lineHeight: 1, transition: 'color 0.3s' }}>${data.price.toFixed(2)}</div>
                  <div style={{ fontSize: 9, color: T.text3, marginTop: 2, transition: 'color 0.3s' }}>/{data.billing === 'annual' ? 'mo, billed annually' : 'month'}</div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: T.text3, transition: 'color 0.3s' }}>
                  {isCanceled ? `Access until ${renewDate}` : isTrial ? `Trial ends ${renewDate}` : `Renews ${renewDate}`}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setBillingChoice(data.billing); setModal('change-billing') }}
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

          {card(
            <div style={{ padding: '20px' }}>
              {sectionHead('Daily usage')}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 700, color: T.gold, lineHeight: 1, transition: 'color 0.3s' }}>{data.repliesUsed}</span>
                <span style={{ fontSize: 14, color: T.text3, transition: 'color 0.3s' }}>/ {data.repliesLimit} replies used</span>
              </div>
              <div style={{ height: 4, background: T.border2, borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(data.repliesUsed / data.repliesLimit) * 100}%`, background: data.repliesUsed >= data.repliesLimit ? T.red : T.gold, borderRadius: 2, transition: 'width 0.4s ease, background 0.3s' }} />
              </div>
              <div style={{ fontSize: 10, color: T.text3, lineHeight: 1.6, transition: 'color 0.3s' }}>
                {data.repliesUsed >= data.repliesLimit
                  ? <span style={{ color: T.red }}>Daily limit reached — resets at {data.repliesResetAt}</span>
                  : <>{data.repliesLimit - data.repliesUsed} replies remaining today · Resets at {data.repliesResetAt}</>
                }
              </div>
              {isTrial && (
                <div style={{ marginTop: 12, background: T.badgeBg, border: `1px solid ${T.badgeBorder}`, padding: '8px 10px', fontSize: 10, color: T.gold, transition: 'all 0.3s' }}>
                  Upgrade for unlimited replies after trial
                </div>
              )}
            </div>
          )}
        </div>

        {card(
          <div style={{ padding: '20px' }}>
            {sectionHead('Payment method')}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 30, background: T.bg3, border: `1px solid ${T.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
                  <CardIcon color={T.text2} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.heading, marginBottom: 2, transition: 'color 0.3s' }}>{data.card.brand} ending in {data.card.last4}</div>
                  <div style={{ fontSize: 10, color: T.text3, transition: 'color 0.3s' }}>Expires {data.card.expMonth}/{data.card.expYear}</div>
                </div>
              </div>
              <button onClick={() => setModal('update-card')}
                style={{ fontSize: 9, padding: '7px 14px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'all 0.2s' }}>
                Update Card
              </button>
            </div>
          </div>,
          { marginBottom: 16 }
        )}

        {card(
          <div style={{ padding: '20px' }}>
            {sectionHead('Invoice history')}
            {data.invoices.map((inv, i) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '11px 0', borderBottom: i < data.invoices.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ fontSize: 10, color: T.text3, width: 90, flexShrink: 0, transition: 'color 0.3s' }}>
                  {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div style={{ flex: 1, fontSize: 12, color: T.text, transition: 'color 0.3s' }}>{inv.description}</div>
                <div style={{ fontSize: 8, padding: '2px 7px', background: T.successBg, border: `1px solid ${T.successBorder}`, color: T.green, letterSpacing: '0.1em', textTransform: 'uppercase' as const, flexShrink: 0 }}>
                  {inv.status}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.heading, width: 56, textAlign: 'right', flexShrink: 0, transition: 'color 0.3s' }}>
                  ${inv.amount.toFixed(2)}
                </div>
                <button style={{ fontSize: 9, padding: '4px 10px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.text3, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.06em', flexShrink: 0 }}>
                  PDF
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 32, borderTop: `1px solid ${T.border}`, paddingTop: 28 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: T.red, textTransform: 'uppercase', marginBottom: 14, opacity: 0.7 }}>Danger zone</div>
          <div style={{ background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.heading, marginBottom: 3, transition: 'color 0.3s' }}>Delete account</div>
              <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.6, transition: 'color 0.3s' }}>Permanently delete your account and all data. This cannot be undone.</div>
            </div>
            <button style={{ fontSize: 9, padding: '8px 14px', background: 'transparent', border: `1px solid ${T.red}`, color: T.red, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0, opacity: 0.7 }}>
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {modal && (
        <div className="fade" onClick={() => { if (!loading) setModal(null) }}
          style={{ position: 'fixed', inset: 0, background: T.modalOverlay, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="slide" onClick={e => e.stopPropagation()}
            style={{ background: T.cardBg, border: `1px solid ${T.border2}`, width: '100%', maxWidth: 440, overflow: 'hidden', transition: 'background 0.3s, border-color 0.3s' }}>
            <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${modal === 'cancel' ? T.red : T.gold}, transparent)` }} />
            <div style={{ padding: '24px' }}>
              {modal === 'cancel' && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.heading, marginBottom: 6 }}>Cancel subscription?</div>
                  <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.7, marginBottom: 20 }}>
                    You'll keep full access until <strong style={{ color: T.gold }}>{renewDate}</strong>. After that, your account will downgrade — no further charges.
                  </div>
                  <div style={{ background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, padding: '10px 14px', fontSize: 11, color: T.text2, lineHeight: 1.6, marginBottom: 20 }}>
                    You'll lose: unlimited voice replies, live briefings, order flow, and news feed access.
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Keep Plan</button>
                    <button onClick={handleCancel} disabled={loading} style={{ flex: 1, padding: '11px', background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, color: T.red, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {loading ? spinner(T.red) : 'Confirm Cancel'}
                    </button>
                  </div>
                </>
              )}
              {modal === 'reactivate' && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.heading, marginBottom: 6 }}>Reactivate subscription?</div>
                  <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.7, marginBottom: 20 }}>
                    Your plan will continue and you'll be billed <strong style={{ color: T.gold }}>${data.price.toFixed(2)}/{data.billing === 'annual' ? 'mo' : 'month'}</strong> starting <strong style={{ color: T.gold }}>{renewDate}</strong>.
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Back</button>
                    <button onClick={handleReactivate} disabled={loading} style={{ flex: 1, padding: '11px', background: T.gold, border: 'none', color: T.btnText, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {loading ? spinner(T.btnText) : 'Reactivate →'}
                    </button>
                  </div>
                </>
              )}
              {modal === 'change-billing' && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.heading, marginBottom: 6 }}>Change billing cycle</div>
                  <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.7, marginBottom: 20 }}>The change takes effect at your next billing date.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                    {(['monthly', 'annual'] as const).map(b => (
                      <div key={b} onClick={() => setBillingChoice(b)} style={{ padding: '14px 16px', border: `1px solid ${billingChoice === b ? T.gold : T.border2}`, background: billingChoice === b ? T.badgeBg : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: billingChoice === b ? T.gold : T.heading, marginBottom: 2, textTransform: 'capitalize' }}>{b}</div>
                          <div style={{ fontSize: 10, color: T.text3 }}>{b === 'annual' ? 'Billed as $799.92/year' : 'Billed each month'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: billingChoice === b ? T.gold : T.text2 }}>${b === 'annual' ? '66.66' : '79.99'}</div>
                          <div style={{ fontSize: 9, color: T.text3 }}>/mo</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {billingChoice === 'annual' && <div style={{ marginBottom: 16, fontSize: 11, color: T.gold }}>You save $159.96/year</div>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cancel</button>
                    <button onClick={handleChangeBilling} disabled={loading || billingChoice === data.billing} style={{ flex: 1, padding: '11px', background: billingChoice === data.billing ? T.bg3 : T.gold, border: 'none', color: billingChoice === data.billing ? T.text3 : T.btnText, cursor: billingChoice === data.billing ? 'default' : 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {loading ? spinner(T.btnText) : 'Confirm Change →'}
                    </button>
                  </div>
                </>
              )}
              {modal === 'update-card' && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.heading, marginBottom: 6 }}>Update payment method</div>
                  <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.7, marginBottom: 20 }}>Enter your new card details below.</div>
                  <div style={{ background: T.bg2, border: `1px solid ${T.border2}`, padding: '20px 16px', marginBottom: 20, fontSize: 12, color: T.text3, textAlign: 'center', lineHeight: 1.7 }}>
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><CardIcon color={T.goldDim} /></div>
                    Stripe payment form goes here.<br />
                    <span style={{ fontSize: 10 }}>Use <code style={{ color: T.gold }}>{'<CardElement />'}</code> from <code style={{ color: T.gold }}>@stripe/react-stripe-js</code></span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.text2, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cancel</button>
                    <button style={{ flex: 1, padding: '11px', background: T.gold, border: 'none', color: T.btnText, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Save Card →</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}