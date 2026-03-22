'use client'

import Link from 'next/link'
import { useState } from 'react'

const STEPS = [
  {
    num: '01',
    color: '#00e8a2',
    title: 'Set up your watchlist',
    sub: 'Any asset. Any exchange.',
    desc: 'Add stocks, ETFs, futures, commodities, or crypto to your personal watchlist in seconds. Monday tracks everything in real time — prices refresh every 30 seconds automatically.',
    detail: 'Search by ticker or name. NVDA, /ES, BTC, GLD, QQQ — it all works. Monday monitors your list constantly and is ready to give you an instant status update on any holding the moment you ask.',
    visual: [
      { sym: 'NVDA',  price: '$891.40', chg: '+3.21%', up: true  },
      { sym: 'AAPL',  price: '$219.07', chg: '+1.14%', up: true  },
      { sym: 'TSLA',  price: '$178.22', chg: '-2.08%', up: false },
      { sym: '/ES',   price: '5,412',   chg: '+0.38%', up: true  },
      { sym: 'BTC',   price: '$68,420', chg: '+2.44%', up: true  },
    ],
  },
  {
    num: '02',
    color: '#3b9eff',
    title: 'Say "Hey Monday"',
    sub: 'Voice-first. Always listening.',
    desc: 'Monday listens for your wake word in the background. The moment you say it, you have a market analyst on the line — no clicking, no searching, no typing.',
    detail: "You can also type if you prefer. But the magic is in the voice. Ask anything natural — 'What's NVDA doing right now?' or 'How does today's CPI number affect my positions?' — and Monday knows exactly what you mean.",
    visual: 'voice',
  },
  {
    num: '03',
    color: '#f0b429',
    title: 'Monday pulls all live data',
    sub: 'Every API. Every source. One answer.',
    desc: "When you ask a question, Monday doesn't answer from memory. It fetches live prices, pulls recent news, checks the economic calendar, reads order flow, and scans your watchlist — all in real time.",
    detail: "This is what makes Monday different from a chatbot. Every single response is grounded in data that's accurate to the minute. You'll never get stale information or hallucinated prices.",
    visual: [
      { icon: '◈', label: 'Live Prices', detail: 'Stocks, ETFs, futures, crypto' },
      { icon: '◫', label: 'News Feed', detail: 'Scored for impact & sentiment' },
      { icon: '◐', label: 'Macro Calendar', detail: 'CPI, FOMC, NFP, earnings' },
      { icon: '▦', label: 'Order Flow', detail: 'Level 2 — block trades, sweeps' },
    ],
  },
  {
    num: '04',
    color: '#a855f7',
    title: 'Get a spoken, intelligent answer',
    sub: 'Like a real analyst. Not a robot.',
    desc: "Monday synthesizes all that data using Claude AI and delivers the answer in natural human speech via ElevenLabs voices. It explains the why behind the numbers — not just the what.",
    detail: "The answer sounds like a senior trader explaining a position, not a dashboard reading out numbers. Context, nuance, and judgment — all delivered in under 5 seconds.",
    visual: 'chat',
  },
  {
    num: '05',
    color: '#00e8a2',
    title: 'Get briefed automatically',
    sub: 'Daily. Before the market opens.',
    desc: "Every morning, Monday prepares a spoken briefing covering pre-market movers, today's macro calendar, your watchlist performance, and anything you should know before the open.",
    detail: "Midday pulse, power hour summary, end-of-day wrap — all automatically delivered as spoken audio. When a high-impact event drops (CPI, FOMC, earnings), Monday immediately briefs you without being asked.",
    visual: [
      { time: '7:00 AM', label: 'Pre-Market Briefing', status: 'ready', color: '#f0b429' },
      { time: '9:35 AM', label: 'Open Pulse', status: 'ready', color: '#00e8a2' },
      { time: '12:00 PM', label: 'Midday Summary', status: 'upcoming', color: '#3b9eff' },
      { time: 'Auto', label: 'CPI Alert', status: 'live', color: '#ff3d5a' },
      { time: '4:15 PM', label: 'End of Day', status: 'upcoming', color: '#a855f7' },
    ],
  },
]

const DEMO_QUESTIONS = [
  "Hey Monday, what's NVDA doing right now?",
  "How does today's CPI print affect my tech positions?",
  "Any unusual options activity on my watchlist?",
  "What's the market expecting from the Fed today?",
  "Where is money rotating this week?",
  "Give me a full earnings breakdown for NVDA tonight.",
]

export default function HowItWorksPage() {
  const [activeStep, setActiveStep] = useState(0)
  const [playingQ, setPlayingQ] = useState<number | null>(null)

  return (
    <div style={{ background: '#030507', color: '#c8daea', fontFamily: "'Syne', sans-serif", minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --green: #00e8a2; --green2: rgba(0,232,162,0.08); --green3: rgba(0,232,162,0.15);
          --red: #ff3d5a; --gold: #f0b429; --blue: #3b9eff; --purple: #a855f7;
          --bg: #030507; --s1: #070c11; --s2: #0b1219; --s3: #101820;
          --border: #172030; --border2: #1e2e42;
          --text: #c8daea; --text2: #8aa8c0; --muted: #3a5570; --muted2: #527090;
        }
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,232,162,.4)} 50%{opacity:.8;box-shadow:0 0 0 6px rgba(0,232,162,0)} }
        @keyframes wave { 0%,100%{height:4px} 50%{height:22px} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .step-btn { transition: all 0.2s; cursor: pointer; }
        .step-btn:hover { background: #0b1219 !important; }
        .cta-btn { transition: all 0.2s; cursor: pointer; }
        .cta-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .wave-bar { width: 3px; background: var(--green); border-radius: 2px; opacity: 0.6; animation: wave 1.2s ease-in-out infinite; }
        .wave-bar:nth-child(1){animation-delay:0s}
        .wave-bar:nth-child(2){animation-delay:0.1s}
        .wave-bar:nth-child(3){animation-delay:0.2s}
        .wave-bar:nth-child(4){animation-delay:0.15s}
        .wave-bar:nth-child(5){animation-delay:0.05s}
        .wave-bar:nth-child(6){animation-delay:0.25s}
        .wave-bar:nth-child(7){animation-delay:0.1s}
        .step-visual { animation: fadeIn 0.35s ease; }
        .q-pill { transition: all 0.15s; cursor: pointer; }
        .q-pill:hover { border-color: rgba(0,232,162,0.4) !important; background: rgba(0,232,162,0.06) !important; color: var(--text) !important; }
        .grid-bg { background-image: linear-gradient(rgba(0,232,162,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,232,162,0.03) 1px, transparent 1px); background-size: 60px 60px; }
      `}</style>

      {/* ── HERO ── */}
      <section className="grid-bg" style={{ padding: '80px 24px 60px', textAlign: 'center', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(0,232,162,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: 'var(--green)', marginBottom: 16, textTransform: 'uppercase' }}>How Monday works</div>
          <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 20 }}>
            Five steps.<br />
            <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', color: 'var(--green)' }}>Infinite market intelligence.</span>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text2)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
            Monday is built around a simple idea: every trader deserves real-time intelligence, spoken in plain English, without needing a finance degree.
          </p>
        </div>
      </section>

      {/* ── INTERACTIVE STEPS ── */}
      <section style={{ padding: '80px 24px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 40 }}>

          {/* Step nav */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {STEPS.map((s, i) => (
              <div
                key={i}
                className="step-btn"
                onClick={() => setActiveStep(i)}
                style={{
                  padding: '16px 16px',
                  background: activeStep === i ? 'var(--s2)' : 'transparent',
                  borderLeft: `3px solid ${activeStep === i ? s.color : 'var(--border)'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: activeStep === i ? s.color : 'var(--muted)', fontWeight: 700 }}>{s.num}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: activeStep === i ? 'var(--text)' : 'var(--text2)' }}>{s.title}</div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--muted2)', marginTop: 4, marginLeft: 28 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Step detail */}
          <div key={activeStep} className="step-visual" style={{ background: 'var(--s1)', border: '1px solid var(--border2)', padding: '32px' }}>
            <div style={{ borderTop: `3px solid ${STEPS[activeStep].color}`, marginBottom: 28, paddingTop: 0 }} />

            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.15em', color: STEPS[activeStep].color, marginBottom: 10, textTransform: 'uppercase' }}>
              Step {STEPS[activeStep].num}
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>
              {STEPS[activeStep].title}
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 12 }}>
              {STEPS[activeStep].desc}
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.7, marginBottom: 28 }}>
              {STEPS[activeStep].detail}
            </p>

            {/* Visuals per step */}
            {activeStep === 0 && Array.isArray(STEPS[0].visual) && (
              <div style={{ border: '1px solid var(--border2)', background: 'var(--s2)' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--muted2)', letterSpacing: '0.15em' }}>YOUR WATCHLIST — LIVE</div>
                {(STEPS[0].visual as {sym:string;price:string;chg:string;up:boolean}[]).map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', gap: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, width: 50, color: t.up ? 'var(--green)' : 'var(--red)' }}>{t.sym}</div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 20 }}>
                      {Array.from({ length: 20 }, (_, j) => (
                        <div key={j} style={{ flex: 1, height: `${30 + Math.sin(j + i) * 20}%`, background: t.up ? 'var(--green)' : 'var(--red)', opacity: 0.4, minHeight: 3 }} />
                      ))}
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text2)', width: 60, textAlign: 'right' }}>{t.price}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.up ? 'var(--green)' : 'var(--red)', width: 56, textAlign: 'right' }}>{t.chg}</div>
                  </div>
                ))}
              </div>
            )}

            {activeStep === 1 && (
              <div style={{ border: '1px solid var(--border2)', background: 'var(--s2)', padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--green), #00a8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#030507', flexShrink: 0 }}>M</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>Monday</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 2s ease infinite' }} />
                      LISTENING FOR WAKE WORD
                    </div>
                  </div>
                </div>
                <div style={{ background: 'rgba(0,232,162,0.05)', border: '1px solid rgba(0,232,162,0.15)', padding: '12px 14px', marginBottom: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--green)' }}>
                  "Hey Monday" → wake word detected
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s3)', padding: '10px 14px', border: '1px solid var(--border2)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#030507', flexShrink: 0 }}>🎙</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 22 }}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <div key={i} className="wave-bar" style={{ animationDelay: `${(i % 7) * 0.08}s` }} />
                    ))}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--green)' }}>LISTENING…</div>
                </div>
              </div>
            )}

            {activeStep === 2 && Array.isArray(STEPS[2].visual) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(STEPS[2].visual as {icon:string;label:string;detail:string}[]).map((src, i) => (
                  <div key={i} style={{ background: 'var(--s2)', border: '1px solid var(--border2)', padding: '14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ fontSize: 18, color: 'var(--green)', flexShrink: 0 }}>{src.icon}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{src.label}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--muted2)' }}>{src.detail}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s ease infinite', flexShrink: 0 }} />
                  </div>
                ))}
                <div style={{ gridColumn: 'span 2', background: 'rgba(0,232,162,0.04)', border: '1px solid rgba(0,232,162,0.15)', padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--green)', textAlign: 'center' }}>
                  All sources called simultaneously on every question
                </div>
              </div>
            )}

            {activeStep === 3 && (
              <div style={{ border: '1px solid var(--border2)', background: 'var(--s2)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--green), #00a8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#030507' }}>M</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                    SPEAKING
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2, height: 22 }}>
                    {Array.from({ length: 14 }, (_, i) => (
                      <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.08}s` }} />
                    ))}
                  </div>
                </div>
                <div style={{ background: 'rgba(0,232,162,0.05)', border: '1px solid rgba(0,232,162,0.12)', padding: '12px 14px', fontSize: 13, color: 'var(--text)', lineHeight: 1.7, marginBottom: 10 }}>
                  "NVDA is up 3.2% ahead of earnings tonight. The options market is implying an ±8.4% move — historical average is closer to 9.2%, so the move could be larger. Three sell-side analysts raised targets this morning. Key number to watch: data center revenue."
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--muted2)' }}>
                  Powered by Claude AI · Voiced by ElevenLabs · ~3 seconds end-to-end
                </div>
              </div>
            )}

            {activeStep === 4 && Array.isArray(STEPS[4].visual) && (
              <div style={{ border: '1px solid var(--border2)', background: 'var(--s2)' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--muted2)', letterSpacing: '0.15em' }}>SCHEDULED BRIEFINGS — TODAY</div>
                {(STEPS[4].visual as {time:string;label:string;status:string;color:string}[]).map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 3, alignSelf: 'stretch', background: b.color, borderRadius: 2, flexShrink: 0 }} />
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted2)', width: 60, flexShrink: 0 }}>{b.time}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{b.label}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, padding: '3px 8px', background: b.status === 'ready' ? 'rgba(0,232,162,0.08)' : b.status === 'live' ? 'rgba(255,61,90,0.08)' : 'var(--s3)', border: `1px solid ${b.status === 'ready' ? 'rgba(0,232,162,0.2)' : b.status === 'live' ? 'rgba(255,61,90,0.2)' : 'var(--border2)'}`, color: b.status === 'ready' ? 'var(--green)' : b.status === 'live' ? 'var(--red)' : 'var(--muted2)', animation: b.status === 'live' ? 'blink 1.5s ease infinite' : 'none' }}>
                      {b.status === 'ready' ? '▶ READY' : b.status === 'live' ? '● LIVE' : '⏳ UPCOMING'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                disabled={activeStep === 0}
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '8px 16px', background: 'transparent', border: '1px solid var(--border2)', color: activeStep === 0 ? 'var(--muted)' : 'var(--text2)', cursor: activeStep === 0 ? 'default' : 'pointer' }}
              >
                ← Prev
              </button>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {STEPS.map((_, i) => (
                  <div key={i} onClick={() => setActiveStep(i)} style={{ width: i === activeStep ? 20 : 6, height: 6, background: i === activeStep ? STEPS[activeStep].color : 'var(--border2)', cursor: 'pointer', transition: 'all 0.2s', borderRadius: 3 }} />
                ))}
              </div>
              <button
                onClick={() => setActiveStep(Math.min(STEPS.length - 1, activeStep + 1))}
                disabled={activeStep === STEPS.length - 1}
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '8px 16px', background: 'transparent', border: '1px solid var(--border2)', color: activeStep === STEPS.length - 1 ? 'var(--muted)' : 'var(--text2)', cursor: activeStep === STEPS.length - 1 ? 'default' : 'pointer' }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── EXAMPLE QUESTIONS ── */}
      <section style={{ padding: '80px 24px', background: 'var(--s1)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted2)', marginBottom: 12, textTransform: 'uppercase' }}>Real questions. Real answers.</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>Ask Monday anything.</h2>
            <p style={{ fontSize: 15, color: 'var(--text2)' }}>No jargon required. No specific format. Just talk like you'd talk to a trader you trust.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {DEMO_QUESTIONS.map((q, i) => (
              <div
                key={i}
                className="q-pill"
                onClick={() => setPlayingQ(playingQ === i ? null : i)}
                style={{ padding: '14px 16px', border: `1px solid ${playingQ === i ? 'rgba(0,232,162,0.3)' : 'var(--border2)'}`, background: playingQ === i ? 'rgba(0,232,162,0.05)' : 'var(--s2)', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: playingQ === i ? 'var(--green)' : 'var(--s3)', border: `1px solid ${playingQ === i ? 'var(--green)' : 'var(--border2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: playingQ === i ? '#030507' : 'var(--muted2)', flexShrink: 0, marginTop: 2 }}>
                    {playingQ === i ? '▶' : '🎙'}
                  </div>
                  <div style={{ fontSize: 13, color: playingQ === i ? 'var(--text)' : 'var(--text2)', lineHeight: 1.5 }}>"{q}"</div>
                </div>
                {playingQ === i && (
                  <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(0,232,162,0.06)', border: '1px solid rgba(0,232,162,0.12)', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 2, height: 14 }}>
                      {Array.from({ length: 6 }, (_, j) => (
                        <div key={j} className="wave-bar" style={{ animationDelay: `${j * 0.1}s`, height: `${8 + j % 3 * 4}px` }} />
                      ))}
                    </div>
                    Monday is answering in real time…
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECH STACK TRANSPARENCY ── */}
      <section style={{ padding: '80px 24px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted2)', marginBottom: 12, textTransform: 'uppercase' }}>Built on best-in-class infrastructure</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.02em' }}>Institutional-grade. Trader-priced.</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: 'var(--border)' }}>
            {[
              { name: 'Claude AI', role: 'Intelligence engine', desc: 'Anthropic\'s frontier model synthesizes data into answers', color: '#a855f7' },
              { name: 'ElevenLabs', role: 'Voice delivery', desc: 'Human-quality text-to-speech for every spoken response', color: '#ff3d5a' },
              { name: 'Finnhub', role: 'Market data', desc: 'Real-time prices, news, and economic calendar', color: '#3b9eff' },
              { name: 'Porcupine', role: 'Wake word', desc: '"Hey Monday" detection — always-on, privacy-first', color: '#f0b429' },
              { name: 'FMP', role: 'Fundamentals', desc: 'Earnings, financials, and deep company data', color: '#00e8a2' },
              { name: 'FRED', role: 'Macro data', desc: 'Federal Reserve economic indicators and history', color: '#2dd4bf' },
            ].map((t, i) => (
              <div key={i} style={{ background: 'var(--s1)', padding: '20px' }}>
                <div style={{ width: 32, height: 3, background: t.color, marginBottom: 14, opacity: 0.8 }} />
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t.name}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.color, marginBottom: 8, letterSpacing: '0.08em' }}>{t.role}</div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '80px 24px', background: 'var(--s1)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16 }}>
            See it for yourself.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 32, lineHeight: 1.6 }}>
            7-day free trial. No credit card. Full Monday experience from the first second.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup">
              <div className="cta-btn" style={{ background: 'var(--green)', color: '#030507', padding: '16px 36px', fontWeight: 800, fontSize: 15, letterSpacing: '0.04em', display: 'inline-block' }}>
                Start Free Trial →
              </div>
            </Link>
            <Link href="/pricing">
              <div className="cta-btn" style={{ background: 'transparent', color: 'var(--text)', padding: '16px 28px', fontWeight: 600, fontSize: 15, border: '1px solid var(--border2)', display: 'inline-block' }}>
                View Pricing
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}