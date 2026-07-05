'use client'

// Tape Reading AI — Level 2 / time & sales scaffold.
// Live data wire-in requires a Polygon.io websocket connection.
// Replace the mock pump with real T&S prints when Polygon is connected.

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK_C = {
  pageBg:  '#080808',
  panelBg: '#0a0a0a',
  cardBg:  '#0d0d0d',
  border:  'rgba(232,184,75,0.18)',
  borderFt:'rgba(232,184,75,0.09)',
  gold:    '#e8b84b',
  goldFt:  'rgba(232,184,75,0.08)',
  green:   '#4ade80',
  greenFt: 'rgba(74,222,128,0.09)',
  red:     '#f87171',
  redFt:   'rgba(248,113,113,0.09)',
  blue:    '#93c5fd',
  blueFt:  'rgba(147,197,253,0.06)',
  text:    '#ffffff',
  text2:   'rgba(255,255,255,0.75)',
  text3:   'rgba(255,255,255,0.45)',
  text4:   'rgba(255,255,255,0.25)',
  rowBorder:   'rgba(255,255,255,0.03)',
  darkPoolBg:  'rgba(147,197,253,0.05)',
  narrationBg: 'rgba(255,255,255,0.04)',
  inputBg:     'rgba(255,255,255,0.06)',
  pausedBg:    'rgba(232,184,75,0.15)',
  unpausedBg:  'rgba(255,255,255,0.05)',
}
const LIGHT_C = {
  pageBg:  '#f8f7f5',
  panelBg: '#ffffff',
  cardBg:  '#f0eeeb',
  border:  'rgba(0,0,0,0.14)',
  borderFt:'rgba(0,0,0,0.07)',
  gold:    '#b8750c',
  goldFt:  'rgba(184,117,12,0.09)',
  green:   '#16a34a',
  greenFt: 'rgba(22,163,74,0.09)',
  red:     '#dc2626',
  redFt:   'rgba(220,38,38,0.09)',
  blue:    '#3b82f6',
  blueFt:  'rgba(59,130,246,0.07)',
  text:    '#1a1a1a',
  text2:   'rgba(0,0,0,0.72)',
  text3:   'rgba(0,0,0,0.50)',
  text4:   'rgba(0,0,0,0.28)',
  rowBorder:   'rgba(0,0,0,0.05)',
  darkPoolBg:  'rgba(59,130,246,0.06)',
  narrationBg: 'rgba(0,0,0,0.03)',
  inputBg:     'rgba(0,0,0,0.05)',
  pausedBg:    'rgba(184,117,12,0.12)',
  unpausedBg:  'rgba(0,0,0,0.04)',
}
type CT = typeof DARK_C

// ── Types ─────────────────────────────────────────────────────────────────────
interface TapeEntry {
  id: number; time: string; price: number; size: number
  side: 'buy' | 'sell' | 'unknown'; exchange: string; condition: string
  large: boolean; dark: boolean; narrative: string
}
interface L2Level { price: number; bidSize: number; askSize: number }

// ── Mock data pump (replace with Polygon WS) ──────────────────────────────────
let mockId = 1
function generateMockEntry(lastPrice: number): TapeEntry {
  const price = Math.round((lastPrice + (Math.random() - 0.49) * 0.15) * 100) / 100
  const size  = Math.floor(Math.random() * 15000) + 100
  const side: 'buy' | 'sell' = Math.random() > 0.5 ? 'buy' : 'sell'
  const large = size > 10000
  const dark  = Math.random() < 0.08
  let narrative = ''
  if (large && side === 'buy')  narrative = `Large ${size.toLocaleString()} bid lift at $${price} — institutional buying`
  else if (large)               narrative = `${size.toLocaleString()} shares hitting bid at $${price} — institutional distribution`
  else if (dark)                narrative = `Dark pool print: ${size.toLocaleString()} @ $${price}`
  const now  = new Date()
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
  return { id: mockId++, time, price, size, side, exchange: dark ? 'D' : 'N', condition: '@', large, dark, narrative }
}
function generateMockL2(center: number): L2Level[] {
  return Array.from({ length: 6 }, (_, i) => ({
    price:   Math.round((center - 0.10 + i * 0.04) * 100) / 100,
    bidSize: Math.floor(Math.random() * 50000) + 500,
    askSize: Math.floor(Math.random() * 50000) + 500,
  }))
}

// ── Tape Row ──────────────────────────────────────────────────────────────────
function TapeRow({ entry, C }: { entry: TapeEntry; C: CT }) {
  const color = entry.side === 'buy' ? C.green : entry.side === 'sell' ? C.red : C.text3
  const bg    = entry.large ? (entry.side === 'buy' ? C.greenFt : C.redFt)
    : entry.dark ? C.darkPoolBg : 'transparent'

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '70px 70px 80px 60px 24px 24px',
      gap: 4, padding: '3px 10px', borderBottom: `1px solid ${C.rowBorder}`,
      background: bg, alignItems: 'center', fontSize: 11, fontFamily: 'monospace',
      borderLeft: entry.large ? `2px solid ${color}` : '2px solid transparent',
      animation: 'fadeIn 0.15s ease',
    }}>
      <span style={{ color: C.text3 }}>{entry.time}</span>
      <span style={{ color, fontWeight: entry.large ? 700 : 400 }}>${entry.price.toFixed(2)}</span>
      <span style={{ color: entry.large ? color : C.text2, fontWeight: entry.large ? 700 : 400 }}>
        {entry.size.toLocaleString()}
      </span>
      <span style={{ color }}>{entry.side.toUpperCase()}</span>
      <span style={{ color: entry.dark ? C.blue : C.text4, fontSize: 9 }}>{entry.exchange}</span>
      {entry.large && <span style={{ color, fontSize: 9 }}>LRGE</span>}
    </div>
  )
}

// ── Level 2 Panel ─────────────────────────────────────────────────────────────
function L2Panel({ levels, livePrice, C, isDark }: { levels: L2Level[]; livePrice: number; C: CT; isDark: boolean }) {
  const maxSize = Math.max(...levels.flatMap(l => [l.bidSize, l.askSize]), 1)
  const bids = [...levels].filter(l => l.price < livePrice).sort((a, b) => b.price - a.price).slice(0, 5)
  const asks = [...levels].filter(l => l.price >= livePrice).sort((a, b) => a.price - b.price).slice(0, 5)

  return (
    <div style={{ background: C.cardBg, borderLeft: `1px solid ${C.border}`, width: 200, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '8px 10px 6px', fontSize: 10, color: C.text3, fontWeight: 700, letterSpacing: '0.07em', borderBottom: `1px solid ${C.borderFt}`, textTransform: 'uppercase' }}>Level 2</div>
      {asks.reverse().map(l => (
        <div key={l.price} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', position: 'relative' }}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${l.askSize / maxSize * 60}%`, background: isDark ? 'rgba(248,113,113,0.08)' : 'rgba(220,38,38,0.08)' }} />
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.red, zIndex: 1 }}>${l.price.toFixed(2)}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 10, color: C.text3, zIndex: 1 }}>{(l.askSize / 100).toFixed(0)}L</span>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: C.gold, fontFamily: 'monospace', textAlign: 'center' }}>
        ${livePrice.toFixed(2)}
      </div>
      {bids.map(l => (
        <div key={l.price} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', position: 'relative' }}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${l.bidSize / maxSize * 60}%`, background: isDark ? 'rgba(74,222,128,0.08)' : 'rgba(22,163,74,0.09)' }} />
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.green, zIndex: 1 }}>${l.price.toFixed(2)}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 10, color: C.text3, zIndex: 1 }}>{(l.bidSize / 100).toFixed(0)}L</span>
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TapeReaderPage() {
  const router = useRouter()

  const [isDark, setIsDark] = useState(true)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('heymonday_dashboard_prefs_v1')
      if (raw) {
        const p = JSON.parse(raw)
        if (typeof p.isDark === 'boolean') setIsDark(p.isDark)
      }
    } catch {}
  }, [])

  const C = isDark ? DARK_C : LIGHT_C

  const [ticker, setTicker]     = useState('SPY')
  const [input,  setInput]      = useState('SPY')
  const [tape,   setTape]       = useState<TapeEntry[]>([])
  const [l2,     setL2]         = useState<L2Level[]>([])
  const [price,  setPrice]      = useState(595.00)
  const [paused, setPaused]     = useState(false)
  const [filter, setFilter]     = useState<'all' | 'large' | 'dark'>('all')
  const [narrations, setNarrations] = useState<string[]>([])
  const pausedRef = useRef(false)
  pausedRef.current = paused

  useEffect(() => {
    let localPrice = price
    const interval = setInterval(() => {
      if (pausedRef.current) return
      const entry = generateMockEntry(localPrice)
      localPrice  = entry.price
      setPrice(localPrice)
      setTape(prev => [entry, ...prev].slice(0, 300))
      if (entry.narrative) setNarrations(prev => [entry.narrative, ...prev].slice(0, 20))
      if (Math.random() < 0.1) setL2(generateMockL2(localPrice))
    }, 180)
    setL2(generateMockL2(localPrice))
    return () => clearInterval(interval)
  }, [ticker])

  const visibleTape = tape.filter(e =>
    filter === 'all' ? true : filter === 'large' ? e.large : e.dark
  )
  const buyPressure      = tape.slice(0, 50).filter(e => e.side === 'buy').length / Math.max(tape.slice(0, 50).length, 1)
  const recentLargeCount = tape.slice(0, 20).filter(e => e.large).length

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    try {
      const raw = localStorage.getItem('heymonday_dashboard_prefs_v1')
      const p   = raw ? JSON.parse(raw) : {}
      localStorage.setItem('heymonday_dashboard_prefs_v1', JSON.stringify({ ...p, isDark: next }))
    } catch {}
  }

  return (
    <div style={{ height: '100vh', background: C.pageBg, color: C.text, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:none } }`}</style>

      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: C.panelBg, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: 12, padding: 0 }}>← Monday</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.gold, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Tape Reader</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{ticker}</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: C.gold, fontFamily: 'monospace' }}>${price.toFixed(2)}</span>

        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.text3 }}>
          <span>Buy pressure: <span style={{ color: buyPressure > 0.55 ? C.green : buyPressure < 0.45 ? C.red : C.text2, fontWeight: 600 }}>{Math.round(buyPressure * 100)}%</span></span>
          <span>Large prints (last 20): <span style={{ color: recentLargeCount > 3 ? C.gold : C.text2, fontWeight: 600 }}>{recentLargeCount}</span></span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <form onSubmit={e => { e.preventDefault(); setTicker(input.toUpperCase()) }} style={{ display: 'flex', gap: 6 }}>
            <input
              value={input} onChange={e => setInput(e.target.value.toUpperCase())}
              style={{ background: C.inputBg, border: `1px solid ${C.border}`, padding: '5px 10px', color: C.text, fontSize: 12, width: 70, outline: 'none' }}
            />
            <button type="submit" style={{ background: C.goldFt, border: `1px solid ${C.border}`, padding: '5px 12px', color: C.gold, fontSize: 12, cursor: 'pointer' }}>Load</button>
          </form>
          <button onClick={() => setPaused(p => !p)} style={{ background: paused ? C.pausedBg : C.unpausedBg, border: `1px solid ${C.border}`, padding: '5px 12px', color: paused ? C.gold : C.text3, fontSize: 12, cursor: 'pointer' }}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button onClick={toggleTheme} style={{ background: C.inputBg, border: `1px solid ${C.border}`, padding: '5px 10px', color: C.text3, fontSize: 13, cursor: 'pointer' }} title="Toggle light/dark">
            {isDark ? '☀' : '◑'}
          </button>
        </div>
      </div>

      {/* Simulated data notice */}
      <div style={{ padding: '6px 16px', background: C.blueFt, borderBottom: `1px solid ${isDark ? 'rgba(147,197,253,0.14)' : 'rgba(59,130,246,0.18)'}`, fontSize: 11, color: isDark ? 'rgba(147,197,253,0.75)' : C.blue, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span>⚡</span>
        <span>Simulated tape — live data requires Polygon.io websocket. Wire in when Polygon is connected.</span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Tape column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '70px 70px 80px 60px 24px 24px', gap: 4, padding: '6px 10px', borderBottom: `1px solid ${C.border}`, background: C.cardBg, flexShrink: 0 }}>
            {['TIME', 'PRICE', 'SIZE', 'SIDE', 'EX', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 9, color: C.text4, fontWeight: 700, letterSpacing: '0.06em' }}>{h}</span>
            ))}
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 1, padding: '6px 10px', borderBottom: `1px solid ${C.borderFt}`, background: C.panelBg, flexShrink: 0 }}>
            {(['all', 'large', 'dark'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? C.goldFt : 'transparent',
                border: `1px solid ${filter === f ? C.border : 'transparent'}`,
                padding: '3px 10px', color: filter === f ? C.gold : C.text3,
                fontSize: 11, cursor: 'pointer', textTransform: 'capitalize',
              }}>
                {f === 'all' ? 'All prints' : f === 'large' ? '10k+ shares' : 'Dark pool'}
              </button>
            ))}
          </div>

          {/* Scrollable tape */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {visibleTape.map(entry => <TapeRow key={entry.id} entry={entry} C={C} />)}
          </div>
        </div>

        {/* Level 2 */}
        <L2Panel levels={l2} livePrice={price} C={C} isDark={isDark} />

        {/* AI narration panel */}
        <div style={{ width: 260, borderLeft: `1px solid ${C.border}`, background: C.cardBg, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '8px 12px 6px', fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: '0.07em', borderBottom: `1px solid ${C.borderFt}`, textTransform: 'uppercase' }}>Monday Reads the Tape</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {narrations.length === 0 && (
              <div style={{ fontSize: 11, color: C.text4, marginTop: 12 }}>Large prints and dark pool activity will be narrated here in real time.</div>
            )}
            {narrations.map((n, i) => (
              <div key={i} style={{
                fontSize: 11, color: i === 0 ? C.text2 : C.text3, lineHeight: 1.5,
                padding: '6px 8px',
                background: i === 0 ? C.narrationBg : 'transparent',
                borderLeft: `2px solid ${i === 0 ? C.gold : 'transparent'}`,
                animation: i === 0 ? 'fadeIn 0.3s ease' : 'none',
              }}>{n}</div>
            ))}
          </div>
          <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.borderFt}`, fontSize: 10, color: C.text4 }}>
            Live AI narration of large prints &amp; sweeps.
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ padding: '5px 16px', borderTop: `1px solid ${C.borderFt}`, background: C.panelBg, display: 'flex', gap: 20, fontSize: 10, color: C.text4, alignItems: 'center', flexShrink: 0 }}>
        <span>{tape.length} prints buffered</span>
        <span>{tape.filter(e => e.large).length} large</span>
        <span>{tape.filter(e => e.dark).length} dark pool</span>
        <span style={{ marginLeft: 'auto', color: paused ? C.gold : C.green }}>{paused ? '⏸ Paused' : '● Live (simulated)'}</span>
      </div>
    </div>
  )
}
