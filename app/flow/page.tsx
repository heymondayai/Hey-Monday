'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK_C = {
  pageBg:   '#080808',
  panelBg:  '#0a0a0a',
  cardBg:   '#0d0d0d',
  border:   'rgba(232,184,75,0.18)',
  borderFt: 'rgba(232,184,75,0.09)',
  gold:     '#e8b84b',
  goldFt:   'rgba(232,184,75,0.12)',
  goldFt2:  'rgba(232,184,75,0.06)',
  green:    '#4ade80',
  greenFt:  'rgba(74,222,128,0.10)',
  red:      '#f87171',
  redFt:    'rgba(248,113,113,0.10)',
  blue:     '#93c5fd',
  text:     '#ffffff',
  text2:    'rgba(255,255,255,0.75)',
  text3:    'rgba(255,255,255,0.45)',
  text4:    'rgba(255,255,255,0.25)',
}
const LIGHT_C = {
  pageBg:   '#f8f7f5',
  panelBg:  '#ffffff',
  cardBg:   '#f0eeeb',
  border:   'rgba(0,0,0,0.14)',
  borderFt: 'rgba(0,0,0,0.07)',
  gold:     '#b8750c',
  goldFt:   'rgba(184,117,12,0.12)',
  goldFt2:  'rgba(184,117,12,0.06)',
  green:    '#16a34a',
  greenFt:  'rgba(22,163,74,0.10)',
  red:      '#dc2626',
  redFt:    'rgba(220,38,38,0.10)',
  blue:     '#3b82f6',
  text:     '#1a1a1a',
  text2:    'rgba(0,0,0,0.72)',
  text3:    'rgba(0,0,0,0.50)',
  text4:    'rgba(0,0,0,0.28)',
}
type CT = typeof DARK_C

// ── Types ─────────────────────────────────────────────────────────────────────
interface StrikeData {
  strike:       number
  callOI:       number; putOI:   number
  callVol:      number; putVol:  number
  netSentiment: 'bullish' | 'bearish' | 'neutral'
  gammaWall:    boolean
  gammaRatio:   number
  calls:        { expiry: string; volume: number; openInterest: number; unusual: boolean }[]
  puts:         { expiry: string; volume: number; openInterest: number; unusual: boolean }[]
}
interface VolBucket { price: number; vol: number; ratio: number }
interface UnusualFlow {
  strike: number; type: 'call' | 'put'
  expiry: string; volume: number; openInterest: number; unusual: boolean
}
interface FlowData {
  ticker:      string
  livePrice:   number | null
  sessionOpen: number | null
  vwap:        number | null
  hod:         number | null
  lod:         number | null
  strikes:     StrikeData[]
  volProfile:  VolBucket[]
  unusualFlow: UnusualFlow[]
  updatedAt:   string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | null, d = 2) { return n == null ? '—' : n.toFixed(d) }
function fmtK(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n) }

function callBarColor(ratio: number, isDark: boolean) {
  const a = Math.min(ratio, 1)
  return isDark
    ? `rgba(74,222,128,${(0.10 + a * 0.78).toFixed(2)})`
    : `rgba(22,163,74,${(0.18 + a * 0.68).toFixed(2)})`
}
function putBarColor(ratio: number, isDark: boolean) {
  const a = Math.min(ratio, 1)
  return isDark
    ? `rgba(248,113,113,${(0.10 + a * 0.78).toFixed(2)})`
    : `rgba(220,38,38,${(0.18 + a * 0.68).toFixed(2)})`
}

// ── Demo data factory ─────────────────────────────────────────────────────────
function ms(
  strike: number,
  cOI: number, pOI: number,
  cVol: number, pVol: number,
  opts: { gw?: boolean; cs?: boolean; ps?: boolean } = {}
): StrikeData {
  return {
    strike, callOI: cOI, putOI: pOI, callVol: cVol, putVol: pVol,
    netSentiment: cOI > pOI * 1.15 ? 'bullish' : pOI > cOI * 1.15 ? 'bearish' : 'neutral',
    gammaWall: !!opts.gw,
    gammaRatio: cOI / Math.max(pOI, 1),
    calls: [{ expiry: 'Jul 18', volume: cVol, openInterest: cOI, unusual: !!opts.cs }],
    puts:  [{ expiry: 'Jul 18', volume: pVol, openInterest: pOI, unusual: !!opts.ps }],
  }
}

// Realistic SPY chain centred at $543.28 — pre-loaded so the map shows instantly
const DEMO_DATA: FlowData = {
  ticker: 'SPY', livePrice: 543.28, sessionOpen: 540.10,
  vwap: 542.15, hod: 545.82, lod: 538.45,
  strikes: [
    ms(531,  7800, 38400,  2100, 16800),
    ms(532,  9200, 42600,  2800, 18400),
    ms(533, 11400, 46200,  3200, 20200),
    ms(534, 14200, 54800,  4100, 24200),
    ms(535, 18600, 72400,  5400, 31800, { gw: true, ps: true }),  // put wall / gamma wall
    ms(536, 15800, 56000,  4800, 23600),
    ms(537, 17600, 48400,  5600, 20400),
    ms(538, 22800, 54200,  7400, 23200),
    ms(539, 29400, 62600,  9200, 26800),
    ms(540, 46800, 91200, 13600, 40200, { gw: true }),            // major ATM gamma wall
    ms(541, 44200, 60800, 14200, 25600),
    ms(542, 56400, 42600, 17800, 17200),
    ms(543, 68200, 50400, 22400, 20800),                          // ← live price
    ms(544, 54600, 36200, 16200, 13800),
    ms(545, 82400, 26800, 52800,  8600, { gw: true, cs: true }),  // call resistance / sweep
    ms(546, 64800, 21200, 19600,  6800),
    ms(547, 52400, 17400, 15800,  5200),
    ms(548, 42800, 14200, 12600,  3800),
    ms(549, 36200, 11600, 10400,  3000),
    ms(550, 88600, 16800, 62400,  4800, { gw: true, cs: true }),  // major call wall / sweep
    ms(551, 56200, 11800, 13800,  3200),
    ms(552, 42400,  9400,  9200,  2200),
    ms(553, 34600,  8000,  7200,  1600),
    ms(554, 26400,  6600,  5200,  1200),
    ms(555, 36800,  9200, 11600,  2000),
    ms(556, 22400,  5800,  4400,   900),
    ms(557, 16800,  4600,  3200,   700),
    ms(558, 12400,  3800,  2400,   500),
  ],
  volProfile: [
    { price: 531, vol: 16200,  ratio: 0.13 },
    { price: 532, vol: 21400,  ratio: 0.18 },
    { price: 533, vol: 28600,  ratio: 0.24 },
    { price: 534, vol: 38200,  ratio: 0.32 },
    { price: 535, vol: 54600,  ratio: 0.46 },
    { price: 536, vol: 68800,  ratio: 0.57 },
    { price: 537, vol: 84200,  ratio: 0.70 },
    { price: 538, vol: 94600,  ratio: 0.79 },
    { price: 539, vol: 108400, ratio: 0.90 },
    { price: 540, vol: 118200, ratio: 0.99 },
    { price: 541, vol: 116000, ratio: 0.97 },
    { price: 542, vol: 120000, ratio: 1.00 },
    { price: 543, vol: 114800, ratio: 0.96 },
    { price: 544, vol: 98200,  ratio: 0.82 },
    { price: 545, vol: 86400,  ratio: 0.72 },
    { price: 546, vol: 71200,  ratio: 0.59 },
    { price: 547, vol: 56800,  ratio: 0.47 },
    { price: 548, vol: 44200,  ratio: 0.37 },
    { price: 549, vol: 34800,  ratio: 0.29 },
    { price: 550, vol: 50200,  ratio: 0.42 },
    { price: 551, vol: 27400,  ratio: 0.23 },
    { price: 552, vol: 21200,  ratio: 0.18 },
    { price: 553, vol: 16800,  ratio: 0.14 },
    { price: 554, vol: 13200,  ratio: 0.11 },
    { price: 555, vol: 11800,  ratio: 0.10 },
    { price: 556, vol:  9200,  ratio: 0.08 },
    { price: 557, vol:  7000,  ratio: 0.06 },
    { price: 558, vol:  5400,  ratio: 0.04 },
  ],
  unusualFlow: [
    { strike: 550, type: 'call', expiry: 'Jul 18', volume: 62400, openInterest: 16800, unusual: true },
    { strike: 545, type: 'call', expiry: 'Jun 28', volume: 52800, openInterest: 26800, unusual: true },
    { strike: 535, type: 'put',  expiry: 'Jul 05', volume: 31800, openInterest: 24400, unusual: true },
    { strike: 540, type: 'put',  expiry: 'Jun 28', volume: 40200, openInterest: 36200, unusual: true },
  ],
  updatedAt: new Date().toISOString(),
}

// ── Strike Row ────────────────────────────────────────────────────────────────
function StrikeRow({ s, maxOI, livePrice, vwap, hod, lod, C, isDark }: {
  s: StrikeData; maxOI: number
  livePrice: number | null; vwap: number | null; hod: number | null; lod: number | null
  C: CT; isDark: boolean
}) {
  const isAtPrice = livePrice ? Math.abs(s.strike - livePrice) / livePrice < 0.005 : false
  const isVwap    = vwap      ? Math.abs(s.strike - vwap)      / vwap      < 0.005 : false
  const isHod     = hod       ? Math.abs(s.strike - hod)       / hod       < 0.005 : false
  const isLod     = lod       ? Math.abs(s.strike - lod)       / lod       < 0.005 : false

  const callRatio = maxOI > 0 ? s.callOI / maxOI : 0
  const putRatio  = maxOI > 0 ? s.putOI  / maxOI : 0
  const callSweep = s.calls.some(c => c.unusual)
  const putSweep  = s.puts.some(p => p.unusual)

  const rowBg = isAtPrice
    ? C.goldFt
    : s.gammaWall
    ? (isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)')
    : 'transparent'

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '80px 1fr 90px 1fr 80px',
      alignItems: 'center',
      borderBottom: `1px solid ${C.borderFt}`,
      background: rowBg,
      borderLeft: isAtPrice ? `2px solid ${C.gold}` : isVwap ? `2px solid ${C.blue}40` : '2px solid transparent',
      minHeight: 30, padding: '2px 0',
    }}>
      {/* Call side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px', justifyContent: 'flex-end' }}>
        {callSweep && <span style={{ color: C.green, fontSize: 9, fontWeight: 700 }}>⚡</span>}
        <span style={{ color: C.text3, fontSize: 10, fontFamily: 'monospace' }}>{fmtK(s.callOI)}</span>
      </div>
      <div style={{ padding: '0 4px 0 8px', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: `${callRatio * 100}%`, maxWidth: '100%', height: 14, background: callBarColor(callRatio, isDark), borderRadius: 2, minWidth: callRatio > 0 ? 2 : 0, transition: 'width 0.4s ease' }} />
        {s.callVol > 0 && <span style={{ marginLeft: 4, color: C.text3, fontSize: 9, fontFamily: 'monospace', flexShrink: 0 }}>{fmtK(s.callVol)}v</span>}
      </div>

      {/* Strike label */}
      <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 12, fontWeight: s.gammaWall ? 700 : 400, color: isAtPrice ? C.gold : s.gammaWall ? C.text : C.text2 }}>
        ${s.strike}
        {s.gammaWall  && <span style={{ color: C.gold,  fontSize: 9, marginLeft: 3 }}>●</span>}
        {isHod        && <span style={{ color: C.green, fontSize: 8, marginLeft: 3 }}>H</span>}
        {isLod        && <span style={{ color: C.red,   fontSize: 8, marginLeft: 3 }}>L</span>}
        {isVwap       && <span style={{ color: C.blue,  fontSize: 8, marginLeft: 3 }}>V</span>}
        {isAtPrice    && <span style={{ color: C.gold,  fontSize: 8, marginLeft: 3 }}>◄</span>}
      </div>

      {/* Put side */}
      <div style={{ padding: '0 8px 0 4px', display: 'flex', alignItems: 'center', flexDirection: 'row-reverse' }}>
        <div style={{ width: `${putRatio * 100}%`, maxWidth: '100%', height: 14, background: putBarColor(putRatio, isDark), borderRadius: 2, minWidth: putRatio > 0 ? 2 : 0, transition: 'width 0.4s ease', marginLeft: 4 }} />
        {s.putVol > 0 && <span style={{ marginRight: 4, color: C.text3, fontSize: 9, fontFamily: 'monospace', flexShrink: 0 }}>{fmtK(s.putVol)}v</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px' }}>
        <span style={{ color: C.text3, fontSize: 10, fontFamily: 'monospace' }}>{fmtK(s.putOI)}</span>
        {putSweep && <span style={{ color: C.red, fontSize: 9, fontWeight: 700 }}>⚡</span>}
      </div>
    </div>
  )
}

// ── Volume Profile ────────────────────────────────────────────────────────────
function VolumeProfile({ profile, livePrice, C, isDark }: {
  profile: VolBucket[]; livePrice: number | null; C: CT; isDark: boolean
}) {
  if (!profile.length) return null
  return (
    <div style={{ width: 68, flexShrink: 0, overflowY: 'auto', borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', background: C.cardBg }}>
      <div style={{ padding: '8px 6px 4px', fontSize: 9, color: C.text3, fontWeight: 700, letterSpacing: '0.06em', textAlign: 'center', borderBottom: `1px solid ${C.borderFt}`, textTransform: 'uppercase' }}>Vol</div>
      {profile.map(b => {
        const isNear = livePrice ? Math.abs(b.price - livePrice) / livePrice < 0.005 : false
        return (
          <div key={b.price} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', minHeight: 20, background: isNear ? C.goldFt2 : 'transparent' }}>
            <div style={{ flex: 1, height: 10, background: isDark ? `rgba(147,197,253,${(0.08 + b.ratio * 0.65).toFixed(2)})` : `rgba(59,130,246,${(0.15 + b.ratio * 0.60).toFixed(2)})`, borderRadius: 1 }} />
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FlowMapPage() {
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

  const [ticker,   setTicker]   = useState('SPY')
  const [input,    setInput]    = useState('SPY')
  const [data,     setData]     = useState<FlowData>(DEMO_DATA)
  const [isDemo,   setIsDemo]   = useState(true)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (sym: string) => {
    if (!sym) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/flow?ticker=${sym}`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json); setIsDemo(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => { if (!isDemo) fetchData(ticker) }, 120_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [ticker, isDemo, fetchData])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const sym = input.toUpperCase().trim()
    if (sym) { setTicker(sym); fetchData(sym) }
  }

  const maxOI = Math.max(...data.strikes.map(s => Math.max(s.callOI, s.putOI)), 1)
  const priceChange = data.livePrice && data.sessionOpen
    ? (data.livePrice - data.sessionOpen) / data.sessionOpen * 100
    : null

  return (
    <div style={{ minHeight: '100vh', background: C.pageBg, color: C.text, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, background: C.panelBg, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: 13, padding: 0 }}>← Monday</button>

        <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Options Flow</div>

        {/* Price strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>${fmt(data.livePrice)}</div>
          {priceChange !== null && (
            <div style={{ fontSize: 13, color: priceChange >= 0 ? C.green : C.red, fontWeight: 600 }}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: C.text3 }}>
            {data.vwap && <span>VWAP <span style={{ color: C.blue, fontFamily: 'monospace' }}>${fmt(data.vwap)}</span></span>}
            {data.hod  && <span>HOD <span style={{ color: C.green, fontFamily: 'monospace' }}>${fmt(data.hod)}</span></span>}
            {data.lod  && <span>LOD <span style={{ color: C.red,   fontFamily: 'monospace' }}>${fmt(data.lod)}</span></span>}
          </div>
        </div>

        {/* Ticker search */}
        <form onSubmit={handleSearch} style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            placeholder="Ticker…"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border: `1px solid ${C.border}`, padding: '6px 12px', color: C.text, fontSize: 13, width: 90, outline: 'none' }}
          />
          <button type="submit" style={{ background: C.goldFt, border: `1px solid ${C.border}`, padding: '6px 16px', color: C.gold, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Load
          </button>
        </form>

        {/* Dark/light toggle */}
        <button
          onClick={() => {
            const next = !isDark
            setIsDark(next)
            try {
              const raw = localStorage.getItem('heymonday_dashboard_prefs_v1')
              const p = raw ? JSON.parse(raw) : {}
              localStorage.setItem('heymonday_dashboard_prefs_v1', JSON.stringify({ ...p, isDark: next }))
            } catch {}
          }}
          style={{ background: C.goldFt2, border: `1px solid ${C.border}`, padding: '6px 10px', color: C.text3, fontSize: 13, cursor: 'pointer' }}
          title="Toggle light/dark"
        >
          {isDark ? '☀' : '◑'}
        </button>

        {loading && <div style={{ fontSize: 11, color: C.text3 }}>Refreshing…</div>}
        {!loading && !isDemo && <div style={{ fontSize: 10, color: C.text4 }}>Updated {new Date(data.updatedAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET</div>}
      </div>

      {/* Demo banner */}
      {isDemo && (
        <div style={{ background: isDark ? 'rgba(232,184,75,0.08)' : 'rgba(184,117,12,0.09)', borderBottom: `1px solid ${C.border}`, padding: '7px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: C.gold, fontWeight: 600 }}>DEMO —</span>
          <span style={{ fontSize: 11, color: C.text3 }}>Showing sample SPY data. Search a ticker above to load live options chain.</span>
        </div>
      )}

      {error && <div style={{ padding: '12px 20px', color: C.red, fontSize: 13 }}>{error}</div>}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Heat map */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 1fr 80px', padding: '8px 0', borderBottom: `1px solid ${C.border}`, background: C.cardBg, flexShrink: 0 }}>
            <div style={{ textAlign: 'right', padding: '0 6px', fontSize: 10, color: C.green, fontWeight: 700, letterSpacing: '0.06em' }}>OI</div>
            <div style={{ textAlign: 'center', fontSize: 10, color: C.green, fontWeight: 700, letterSpacing: '0.06em' }}>CALLS ▲</div>
            <div style={{ textAlign: 'center', fontSize: 10, color: C.text3, fontWeight: 700, letterSpacing: '0.06em' }}>STRIKE</div>
            <div style={{ textAlign: 'center', fontSize: 10, color: C.red,   fontWeight: 700, letterSpacing: '0.06em' }}>PUTS ▼</div>
            <div style={{ textAlign: 'left',  padding: '0 6px', fontSize: 10, color: C.red,   fontWeight: 700, letterSpacing: '0.06em' }}>OI</div>
          </div>

          {/* Strike rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {data.strikes.map(s => (
              <StrikeRow key={s.strike} s={s} maxOI={maxOI} livePrice={data.livePrice} vwap={data.vwap} hod={data.hod} lod={data.lod} C={C} isDark={isDark} />
            ))}
          </div>
        </div>

        {/* Volume profile sidebar */}
        <VolumeProfile profile={data.volProfile} livePrice={data.livePrice} C={C} isDark={isDark} />
      </div>

      {/* Unusual flow feed */}
      {data.unusualFlow?.length ? (
        <div style={{ borderTop: `1px solid ${C.border}`, background: C.cardBg, padding: '10px 20px', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>⚡ Unusual Activity — vol {'>'} OI (new positioning)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {data.unusualFlow.map((f, i) => (
              <div key={i} style={{
                background: f.type === 'call' ? C.greenFt : C.redFt,
                border:     `1px solid ${f.type === 'call' ? (isDark ? 'rgba(74,222,128,0.28)' : 'rgba(22,163,74,0.30)') : (isDark ? 'rgba(248,113,113,0.28)' : 'rgba(220,38,38,0.30)')}`,
                padding: '5px 12px', fontSize: 11, display: 'flex', gap: 8, alignItems: 'center',
              }}>
                <span style={{ color: f.type === 'call' ? C.green : C.red, fontWeight: 700, textTransform: 'uppercase' }}>{f.type}</span>
                <span style={{ color: C.text, fontFamily: 'monospace', fontWeight: 600 }}>${f.strike}</span>
                <span style={{ color: C.text3 }}>{f.expiry}</span>
                <span style={{ color: C.text2, fontWeight: 600, fontFamily: 'monospace' }}>{fmtK(f.volume)}v</span>
                <span style={{ color: C.text3, fontFamily: 'monospace' }}>OI {fmtK(f.openInterest)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Legend */}
      <div style={{ borderTop: `1px solid ${C.borderFt}`, padding: '8px 20px', display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 10, color: C.text4, background: C.panelBg, flexShrink: 0 }}>
        <span><span style={{ color: C.gold }}>●</span> Gamma wall</span>
        <span><span style={{ color: C.gold }}>◄</span> Current price</span>
        <span><span style={{ color: C.blue }}>V</span> VWAP</span>
        <span><span style={{ color: C.green }}>H</span> HOD</span>
        <span><span style={{ color: C.red }}>L</span> LOD</span>
        <span>⚡ Sweep (vol {'>'} OI = new positioning)</span>
        <span>Bar width = OI relative to max strike</span>
      </div>
    </div>
  )
}
