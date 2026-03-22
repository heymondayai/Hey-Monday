'use client'

import Link from 'next/link'
import { useState } from 'react'

const FEATURES_ALL = [
  { label: 'Live prices — stocks, ETFs, futures, commodities, crypto', included: true },
  { label: 'Price refresh every 30 seconds', included: true },
  { label: 'Customizable watchlist (unlimited assets)', included: true },
  { label: 'AI voice assistant — "Hey Monday" wake word', included: true },
  { label: 'Morning & end-of-day spoken briefings', included: true },
  { label: 'High-impact economic calendar with live actuals', included: true },
  { label: 'Watchlist + macro + earnings events', included: true },
  { label: 'News feed with AI sentiment scoring', included: true },
  { label: 'AI explains news → price movement impact', included: true },
  { label: 'Level 2 order flow — AI-described', included: true },
  { label: 'Chat with Monday — every API called on each question', included: true },
  { label: 'Interval summaries (midday, power hour, EOD)', included: true },
  { label: 'Price alerts — spoken + on-screen', included: true },
  { label: 'Macro event alerts — CPI, FOMC, NFP auto-briefings', included: true },
  { label: 'Adjustable voice speed & quiet hours', included: true },
  { label: 'Conversation history with audio replay', included: true },
  { label: 'Multi-device access (web, mobile, desktop)', included: true },
]

const FAQ = [
  {
    q: 'What exactly is included in the free trial?',
    a: 'The 5-day trial includes access to Monday\'s core features — live prices, calendar, news, and briefings — with a limited number of AI voice replies and chat messages per day. Upgrade anytime to unlock unlimited usage.',
  },
  {
    q: 'How does the AI voice actually work?',
    a: 'When you say "Hey Monday" (or type a question), Monday pulls live data from every connected API — prices, news, order flow, macro calendar, your watchlist — synthesizes it using Claude AI, and delivers a spoken response via ElevenLabs natural voice. It sounds like a real analyst, not a robot.',
  },
  {
    q: 'What assets does Monday cover?',
    a: 'US stocks, ETFs, futures (/ES, /NQ, /CL, /GC and more), commodities, crypto (BTC, ETH, SOL, etc.), and forex pairs. If it trades on a major exchange, Monday knows about it.',
  },
  {
    q: 'How is Monday different from a Bloomberg terminal?',
    a: "Bloomberg costs $25,000/year and is data-first. Monday is intelligence-first — it doesn't just show you data, it explains it in real-time spoken English. It's closer to having a senior analyst on call 24/7 than a data terminal.",
  },
  {
    q: 'Can I cancel anytime?',
    a: "Yes, always. No contracts, no cancellation fees, no friction. If you cancel, you keep access until the end of your billing period.",
  },
  {
    q: "What happens when a big economic event drops — like CPI or the Fed decision?",
    a: "Within seconds of the actual number hitting the wire, Monday detects it, updates the calendar, scores it against the forecast, and automatically delivers a spoken briefing explaining the impact on your specific watchlist. You don't have to ask.",
  },
  {
    q: 'Is there a mobile app?',
    a: "Monday works in any browser — desktop, tablet, or mobile. A native iOS and Android app is on the roadmap for Q3 2026.",
  },
]

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const monthlyPrice = 79.99
  const annualPrice = 66.66 // 2 months free
  const displayPrice = billing === 'monthly' ? monthlyPrice : annualPrice

  return (
    <div style={{ background: '#030507', color: '#c8daea', fontFamily: "'Syne', sans-serif", minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --green: #00e8a2; --green2: rgba(0,232,162,0.08); --green3: rgba(0,232,162,0.15);
          --red: #ff3d5a; --gold: #f0b429; --blue: #3b9eff;
          --bg: #030507; --s1: #070c11; --s2: #0b1219; --s3: #101820;
          --border: #172030; --border2: #1e2e42;
          --text: #c8daea; --text2: #8aa8c0; --muted: #3a5570; --muted2: #527090;
        }
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,232,162,.4)} 50%{opacity:.8;box-shadow:0 0 0 6px rgba(0,232,162,0)} }
        @keyframes glow { 0%,100%{box-shadow:0 0 30px rgba(0,232,162,.15), inset 0 0 30px rgba(0,232,162,.03)} 50%{box-shadow:0 0 60px rgba(0,232,162,.3), inset 0 0 60px rgba(0,232,162,.06)} }
        .cta-btn { transition: all 0.2s; cursor: pointer; }
        .cta-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .faq-item { transition: background 0.15s; cursor: pointer; }
        .faq-item:hover { background: #0b1219 !important; }
        .toggle-btn { transition: all 0.15s; cursor: pointer; }
        .feature-row:nth-child(even) { background: rgba(255,255,255,0.015); }
        .grid-bg { background-image: linear-gradient(rgba(0,232,162,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,232,162,0.03) 1px, transparent 1px); background-size: 60px 60px; }
      `}</style>

      {/* ── HERO ── */}
      <section className="grid-bg" style={{ padding: '80px 24px 60px', textAlign: 'center', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, height: 400, background: 'radial-gradient(ellipse, rgba(0,232,162,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: 'var(--green)', marginBottom: 16, textTransform: 'uppercase' }}>Simple, transparent pricing</div>
          <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 20 }}>
            One plan.<br />
            <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', color: 'var(--green)' }}>Everything included.</span>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text2)', maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.6 }}>
            No tiers. No feature gates. No gotchas. Every trader gets the full Monday experience from day one.
          </p>

          {/* Billing toggle */}
          <div style={{ display: 'inline-flex', background: 'var(--s2)', border: '1px solid var(--border2)', padding: 4, gap: 4, marginBottom: 60 }}>
            <div
              className="toggle-btn"
              onClick={() => setBilling('monthly')}
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, background: billing === 'monthly' ? 'var(--s3)' : 'transparent', color: billing === 'monthly' ? 'var(--text)' : 'var(--muted2)', border: billing === 'monthly' ? '1px solid var(--border2)' : '1px solid transparent' }}
            >
              Monthly
            </div>
            <div
              className="toggle-btn"
              onClick={() => setBilling('annual')}
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, background: billing === 'annual' ? 'var(--s3)' : 'transparent', color: billing === 'annual' ? 'var(--text)' : 'var(--muted2)', border: billing === 'annual' ? '1px solid var(--border2)' : '1px solid transparent', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              Annual
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, padding: '2px 6px', background: 'var(--green2)', border: '1px solid rgba(0,232,162,0.25)', color: 'var(--green)' }}>2 MO FREE</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICE CARD ── */}
      <section style={{ padding: '60px 24px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          {/* Main card */}
          <div style={{ background: 'var(--s1)', border: '1px solid rgba(0,232,162,0.3)', position: 'relative', animation: 'glow 5s ease infinite', overflow: 'hidden' }}>
            {/* Top accent */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, var(--green), transparent)' }} />

            <div style={{ padding: '40px 40px 32px' }}>
              {/* Badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.15em', color: 'var(--green)', background: 'var(--green2)', border: '1px solid rgba(0,232,162,0.2)', padding: '4px 10px', marginBottom: 24 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 2s ease infinite' }} />
                PRO PLAN · FULL ACCESS
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 14, color: 'var(--muted2)', marginBottom: 12 }}>$</div>
                <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--green)' }}>
                  {displayPrice.toFixed(2).split('.')[0]}
                </div>
                <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
                  .{displayPrice.toFixed(2).split('.')[1]}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--muted2)', marginBottom: 12 }}>
                  / month{billing === 'annual' ? ', billed annually' : ''}
                </div>
              </div>

              {billing === 'annual' && (
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--green)', marginBottom: 8 }}>
                  You save $159.96/year vs monthly
                </div>
              )}

              <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 32, lineHeight: 1.5 }}>
                Full Monday access — live prices, AI voice, calendar, news, Level 2, briefings, alerts. No limits.
              </p>

              <Link href="/signup">
                <div className="cta-btn" style={{ background: 'var(--green)', color: '#030507', padding: '16px 0', fontWeight: 800, fontSize: 16, letterSpacing: '0.04em', textAlign: 'center', display: 'block', width: '100%' }}>
                  Start 5-Day Free Trial →
                </div>
              </Link>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted2)' }}>
                <span>✓ Cancel anytime</span>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)', margin: '0 40px' }} />

            {/* Feature list */}
            <div style={{ padding: '24px 40px 32px' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.2em', color: 'var(--muted2)', marginBottom: 16, textTransform: 'uppercase' }}>Everything included</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                {FEATURES_ALL.map((f, i) => (
                  <div key={i} className="feature-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
                    <span style={{ color: 'var(--green)', fontSize: 12, flexShrink: 0, marginTop: 2 }}>✓</span>
                    <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Comparison note */}
          <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)' }}>
            {[
              { name: 'Monday', price: '$79.99/mo', note: 'Voice + intelligence', highlight: true },
              { name: 'Bloomberg', price: '$2,083/mo', note: 'Data only, no AI voice', highlight: false },
              { name: 'Trade Ideas', price: '$254/mo', note: 'No voice, no macro', highlight: false },
            ].map((c, i) => (
              <div key={i} style={{ background: c.highlight ? 'var(--green2)' : 'var(--s1)', padding: '16px', textAlign: 'center', borderTop: c.highlight ? '2px solid var(--green)' : '2px solid transparent' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: c.highlight ? 'var(--green)' : 'var(--muted2)', marginBottom: 6, letterSpacing: '0.1em' }}>{c.name}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.highlight ? 'var(--green)' : 'var(--text)', marginBottom: 4 }}>{c.price}</div>
                <div style={{ fontSize: 11, color: 'var(--muted2)' }}>{c.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT YOU'RE GETTING ── */}
      <section style={{ padding: '80px 24px', background: 'var(--s1)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>
              $79.99 for a personal market analyst.
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text2)' }}>Think about what that used to cost.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: 'var(--border)' }}>
            {[
              { label: 'Bloomberg Terminal', cost: '$25,000/yr', icon: '📊' },
              { label: 'Dedicated Analyst', cost: '$120,000/yr', icon: '👔' },
              { label: 'Benzinga Pro', cost: '$1,992/yr', icon: '📰' },
              { label: 'Trade Ideas Premium', cost: '$3,048/yr', icon: '⚡' },
              { label: 'Monday', cost: '$959/yr', icon: '🤖', highlight: true },
            ].map((c, i) => (
              <div key={i} style={{ background: c.highlight ? 'rgba(0,232,162,0.05)' : 'var(--s2)', padding: '24px 20px', textAlign: 'center', borderTop: c.highlight ? '2px solid var(--green)' : '2px solid transparent' }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{c.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: c.highlight ? 'var(--text)' : 'var(--text2)' }}>{c.label}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: c.highlight ? 'var(--green)' : 'var(--muted2)', textDecoration: c.highlight ? 'none' : 'line-through' }}>{c.cost}</div>
                {c.highlight && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--green)', marginTop: 4 }}>← YOU PAY THIS</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '80px 24px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted2)', marginBottom: 12, textTransform: 'uppercase' }}>Common questions</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.02em' }}>Everything you need to know.</h2>
          </div>

          <div style={{ border: '1px solid var(--border2)' }}>
            {FAQ.map((item, i) => (
              <div
                key={i}
                className="faq-item"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ borderBottom: i < FAQ.length - 1 ? '1px solid var(--border)' : 'none', background: openFaq === i ? 'var(--s1)' : 'transparent' }}
              >
                <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: openFaq === i ? 'var(--green)' : 'var(--text)' }}>{item.q}</div>
                  <div style={{ color: 'var(--muted2)', flexShrink: 0, fontSize: 16, marginTop: 2, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</div>
                </div>
                {openFaq === i && (
                  <div style={{ padding: '0 20px 18px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.75 }}>
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '80px 24px', background: 'var(--s1)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16 }}>
            Start trading smarter<br />
            <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', color: 'var(--green)' }}>in the next 60 seconds.</span>
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 32, lineHeight: 1.6 }}>5-day free trial. Cancel anytime.</p>
          <Link href="/signup">
            <div className="cta-btn" style={{ background: 'var(--green)', color: '#030507', padding: '16px 40px', fontWeight: 800, fontSize: 16, letterSpacing: '0.04em', display: 'inline-block' }}>
              Try Monday Free →
            </div>
          </Link>
          <div style={{ marginTop: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted2)' }}>
            Questions? Email us at hello@heymonday.ai
          </div>
        </div>
      </section>
    </div>
  )
}