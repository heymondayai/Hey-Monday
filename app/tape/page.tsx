'use client'

// Tape Reading AI — Level 2 / time & sales scaffold.
// UI is fully built. Live data wire-in requires a Polygon.io websocket
// connection (ws://delayed.polygon.io/stocks or wss://socket.polygon.io/stocks).
// When connected, replace the mock tape entries with real T&S prints.

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  pageBg:  '#080808',
  panelBg: '#0a0a0a',
  cardBg:  '#0d0d0d',
  border:  'rgba(232,184,75,0.18)',
  borderFt:'rgba(232,184,75,0.09)',
  gold:    '#e8b84b',
  goldFt:  'rgba(232,184,75,0.08)',
  green:   '#4ade80',
  greenFt: 'rgba(74,222,128,0.08)',
  red:     '#f87171',
  redFt:   'rgba(248,113,113,0.08)',
  text:    '#ffffff',
  text2:   'rgba(255,255,255,0.75)',
  text3:   'rgba(255,255,255,0.45)',
  text4:   'rgba(255,255,255,0.25)',
}

interface TapeEntry {
  id:        number
  time:      string     // HH:MM:SS
  price:     number
  size:      number     // shares
  side:      'buy' | 'sell' | 'unknown'
  exchange:  string
  condition: string     // e.g. "@", "F", "T"
  large:     boolean    // > 10,000 shares
  dark:      boolean    // dark pool print
  narrative: string     // AI narration (computed or streamed)
}

interface L2Level {
  price:    number
  bidSize:  number
  askSize:  number
}

// ── Mock data generator (replace with Polygon WS stream) ────────────────────
let mockId = 1
function generateMockEntry(lastPrice: number): TapeEntry {
  const delta = (Math.random() - 0.49) * 0.15
  const price = Math.round((lastPrice + delta) * 100) / 100
  const size  = Math.floor(Math.random() * 15000) + 100
  const side: 'buy' | 'sell' = Math.random() > 0.5 ? 'buy' : 'sell'
  const large = size > 10000
  const dark  = Math.random() < 0.08

  let narrative = ''
  if (large && side === 'buy')  narrative = `Large ${size.toLocaleString()} bid lift at $${price} — institutional buying`
  else if (large && side === 'sell') narrative = `${size.toLocaleString()} shares hitting bid at $${price} — institutional distribution`
  else if (dark) narrative = `Dark pool print: ${size.toLocaleString()} @ $${price}`

  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  return { id: mockId++, time, price, size, side, exchange: dark ? 'D' : 'N', condition: '@', large, dark, narrative }
}

function generateMockL2(center: number): L2Level[] {
  return Array.from({ length: 6 }, (_, i) => ({
    price:   Math.round((center - 0.10 + i * 0.04) * 100) / 100,
    bidSize: Math.floor(Math.random() * 50000) + 500,
    askSize: Math.floor(Math.random() * 50000) + 500,
  }))
}

// ── Components ────────────────────────────────────────────────────────────────

function TapeRow({ entry }: { entry: TapeEntry }) {
  const color   = entry.side === 'buy' ? C.green : entry.side === 'sell' ? C.red : C.text3
  const bgColor = entry.large ? (entry.side === 'buy' ? C.greenFt : C.redFt)
    : entry.dark ? 'rgba(147,197,253,0.04)' : 'transparent'

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '70px 70px 80px 60px 24px 24px',
      gap: 4, padding: '3px 10px', borderBottom: `1px solid rgba(255,255,255,0.03)`,
      background: bgColor, alignItems: 'center', fontSize: 11, fontFamily: 'monospace',
      borderLeft: entry.large ? `2px solid ${color}` : '2px solid transparent',
      animation: 'fadeIn 0.15s ease',
    }}>
      <span style={{ color: C.text3 }}>{entry.time}</span>
      <span style={{ color, fontWeight: entry.large ? 700 : 400 }}>${entry.price.toFixed(2)}</span>
      <span style={{ color: entry.large ? color : C.text2, fontWeight: entry.large ? 700 : 400 }}>
        {entry.size.toLocaleString()}
      </span>
      <span style={{ color }}>{entry.side.toUpperCase()}</span>
      <span style={{ color: entry.dark ? '#93c5fd' : C.text4, fontSize: 9 }}>{entry.exchange}</span>
      {entry.large && <span style={{ color, fontSize: 9 }}>LRGE</span>}
    </div>
  )
}

function L2Panel({ levels, livePrice }: { levels: L2Level[]; livePrice: number }) {
  const maxSize = Math.max(...levels.flatMap(l => [l.bidSize, l.askSize]), 1)
  const bids    = [...levels].filter(l => l.price < livePrice).sort((a, b) => b.price - a.price).slice(0, 5)
  const asks    = [...levels].filter(l => l.price >= livePrice).sort((a, b) => a.price - b.price).slice(0, 5)

  return (
    <div style={{ background: C.cardBg, borderLeft: `1px solid ${C.border}`, width: 200, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '8px 10px 6px', fontSize: 10, color: C.text3, fontWeight: 600, letterSpacing: '0.07em', borderBottom: `1px solid ${C.borderFt}` }}>LEVEL 2</div>
      {asks.reverse().map(l => (
        <div key={l.price} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', position: 'relative' }}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${l.askSize / maxSize * 60}%`, background: 'rgba(248,113,113,0.08)' }} />
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.red, zIndex: 1 }}>${l.price.toFixed(2)}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 10, color: C.text3, zIndex: 1 }}>{(l.askSize / 100).toFixed(0)}L</span>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: C.gold, fontFamily: 'monospace', textAlign: 'center' }}>
        ${livePrice.toFixed(2)}
      </div>
      {bids.map(l => (
        <div key={l.price} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', position: 'relative' }}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${l.bidSize / maxSize * 60}%`, background: 'rgba(74,222,128,0.08)' }} />
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
  const [ticker, setTicker]       = useState('SPY')
  const [input,  setInput]        = useState('SPY')
  const [tape,   setTape]         = useState<TapeEntry[]>([])
  const [l2,     setL2]           = useState<L2Level[]>([])
  const [price,  setPrice]        = useState(595.00)
  const [paused, setPaused]       = useState(false)
  const [filter, setFilter]       = useState<'all' | 'large' | 'dark'>('all')
  const [narrations, setNarrations] = useState<string[]>([])
  const tapeRef  = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  // Mock data pump — replace with Polygon WS in production
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
    filter === 'all'  ? true :
    filter === 'large' ? e.large :
    filter === 'dark'  ? e.dark  : true
  )

  const recentLargeCount = tape.slice(0, 20).filter(e => e.large).length
  const buyPressure = tape.slice(0, 50).filter(e => e.side === 'buy').length / Math.max(tape.slice(0, 50).length, 1)

  return (
    <div style={{ height: '100vh', background: C.pageBg, color: C.text, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:none } }`}</style>

      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: C.panelBg, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: 12, padding: 0 }}>← Monday</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.gold, letterSpacing: '0.06em' }}>TAPE READER</span>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{ticker}</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: C.gold, fontFamily: 'monospace' }}>${price.toFixed(2)}</span>

        {/* Live metrics */}
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.text3 }}>
          <span>Buy pressure: <span style={{ color: buyPressure > 0.55 ? C.green : buyPressure < 0.45 ? C.red : C.text2, fontWeight: 600 }}>{Math.round(buyPressure * 100)}%</span></span>
          <span>Large prints (last 20): <span style={{ color: recentLargeCount > 3 ? C.gold : C.text2, fontWeight: 600 }}>{recentLargeCount}</span></span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <form onSubmit={e => { e.preventDefault(); setTicker(input.toUpperCase()) }} style={{ display: 'flex', gap: 6 }}>
            <input value={input} onChange={e => setInput(e.target.value.toUpperCase())} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', color: C.text, fontSize: 12, width: 70, outline: 'none' }} />
            <button type="submit" style={{ background: C.goldFt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', color: C.gold, fontSize: 12, cursor: 'pointer' }}>Load</button>
          </form>
          <button onClick={() => setPaused(p => !p)} style={{ background: paused ? 'rgba(232,184,75,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', color: paused ? C.gold : C.text3, fontSize: 12, cursor: 'pointer' }}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </div>

      {/* Data source notice */}
      <div style={{ padding: '6px 16px', background: 'rgba(147,197,253,0.05)', borderBottom: `1px solid rgba(147,197,253,0.12)`, fontSize: 11, color: 'rgba(147,197,253,0.7)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>⚡</span>
        <span>Simulated tape — live data requires Polygon.io websocket (wss://socket.polygon.io/stocks). Wire in when Polygon is connected.</span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Tape */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tape header */}
          <div style={{ display: 'grid', gridTemplateColumns: '70px 70px 80px 60px 24px 24px', gap: 4, padding: '6px 10px', borderBottom: `1px solid ${C.border}`, background: C.cardBg }}>
            {['TIME', 'PRICE', 'SIZE', 'SIDE', 'EX', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 9, color: C.text4, fontWeight: 600, letterSpacing: '0.06em' }}>{h}</span>
            ))}
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 1, padding: '6px 10px', borderBottom: `1px solid ${C.borderFt}`, background: C.panelBg }}>
            {(['all', 'large', 'dark'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background:  filter === f ? C.goldFt : 'transparent',
                border:      `1px solid ${filter === f ? C.border : 'transparent'}`,
                borderRadius: 4, padding: '3px 10px', color: filter === f ? C.gold : C.text3,
                fontSize: 11, cursor: 'pointer', textTransform: 'capitalize',
              }}>{f === 'all' ? 'All prints' : f === 'large' ? '10k+ shares' : 'Dark pool'}</button>
            ))}
          </div>

          {/* Tape scroll */}
          <div ref={tapeRef} style={{ flex: 1, overflowY: 'auto' }}>
            {visibleTape.map(entry => <TapeRow key={entry.id} entry={entry} />)}
          </div>
        </div>

        {/* Level 2 */}
        <L2Panel levels={l2} livePrice={price} />

        {/* AI narration feed */}
        <div style={{ width: 260, borderLeft: `1px solid ${C.border}`, background: C.cardBg, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '8px 12px 6px', fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: '0.07em', borderBottom: `1px solid ${C.borderFt}` }}>MONDAY READS THE TAPE</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {narrations.length === 0 && (
              <div style={{ fontSize: 11, color: C.text4, marginTop: 12 }}>Large prints and dark pool activity will be narrated here in real time.</div>
            )}
            {narrations.map((n, i) => (
              <div key={i} style={{
                fontSize: 11, color: i === 0 ? C.text2 : C.text3, lineHeight: 1.5,
                padding: '6px 8px', background: i === 0 ? 'rgba(255,255,255,0.04)' : 'transparent',
                borderRadius: 5, borderLeft: `2px solid ${i === 0 ? C.gold : 'transparent'}`,
                animation: i === 0 ? 'fadeIn 0.3s ease' : 'none',
              }}>{n}</div>
            ))}
          </div>
          <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.borderFt}`, fontSize: 10, color: C.text4 }}>
            Live AI narration of large prints &amp; sweeps. Connects to Monday chat for deeper analysis.
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ padding: '5px 16px', borderTop: `1px solid ${C.borderFt}`, background: C.panelBg, display: 'flex', gap: 20, fontSize: 10, color: C.text4, alignItems: 'center' }}>
        <span>{tape.length} prints buffered</span>
        <span>{tape.filter(e => e.large).length} large</span>
        <span>{tape.filter(e => e.dark).length} dark pool</span>
        <span style={{ marginLeft: 'auto', color: paused ? C.gold : C.green }}>{paused ? '⏸ Paused' : '● Live (simulated)'}</span>
      </div>
    </div>
  )
}
