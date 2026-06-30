'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ── Design tokens (matches dashboard) ────────────────────────────────────────
const C = {
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
  text:     '#ffffff',
  text2:    'rgba(255,255,255,0.75)',
  text3:    'rgba(255,255,255,0.45)',
  text4:    'rgba(255,255,255,0.25)',
}

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
  ticker:     string
  livePrice:  number | null
  sessionOpen: number | null
  vwap:       number | null
  hod:        number | null
  lod:        number | null
  strikes:    StrikeData[]
  volProfile: VolBucket[]
  unusualFlow: UnusualFlow[]
  updatedAt:  string
}

function fmt(n: number | null, decimals = 2) {
  if (n === null || n === undefined) return '—'
  return n.toFixed(decimals)
}
function fmtK(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString()
}

// ── Colour scale: blue→green for calls, blue→red for puts ───────────────────
function callColor(ratio: number, alpha = 1) {
  const a = Math.min(ratio, 1)
  return `rgba(74,222,128,${(0.12 + a * 0.75).toFixed(2)})`
}
function putColor(ratio: number) {
  const a = Math.min(ratio, 1)
  return `rgba(248,113,113,${(0.12 + a * 0.75).toFixed(2)})`
}

// ── Strike Row ────────────────────────────────────────────────────────────────
function StrikeRow({
  s, maxOI, livePrice, vwap, hod, lod,
}: { s: StrikeData; maxOI: number; livePrice: number | null; vwap: number | null; hod: number | null; lod: number | null }) {
  const isAtPrice = livePrice ? Math.abs(s.strike - livePrice) / livePrice < 0.005 : false
  const isVwap    = vwap      ? Math.abs(s.strike - vwap)      / vwap      < 0.005 : false
  const isHod     = hod       ? Math.abs(s.strike - hod)       / hod       < 0.005 : false
  const isLod     = lod       ? Math.abs(s.strike - lod)       / lod       < 0.005 : false

  const callRatio = maxOI > 0 ? s.callOI / maxOI : 0
  const putRatio  = maxOI > 0 ? s.putOI  / maxOI : 0
  const callVolSweep = s.calls.some(c => c.unusual)
  const putVolSweep  = s.puts.some(c => c.unusual)

  const rowBg = isAtPrice
    ? 'rgba(232,184,75,0.10)'
    : s.gammaWall ? 'rgba(255,255,255,0.03)' : 'transparent'

  return (
    <div
      style={{
        display:         'grid',
        gridTemplateColumns: '80px 1fr 90px 1fr 80px',
        alignItems:      'center',
        borderBottom:    `1px solid ${C.borderFt}`,
        background:      rowBg,
        borderLeft:      isAtPrice ? `2px solid ${C.gold}` : isVwap ? `2px solid rgba(147,197,253,0.6)` : '2px solid transparent',
        minHeight:       30,
        padding:         '2px 0',
        position:        'relative',
      }}
    >
      {/* Call OI bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px', justifyContent: 'flex-end' }}>
        {callVolSweep && <span style={{ color: C.green, fontSize: 9, fontWeight: 700 }}>⚡</span>}
        <span style={{ color: C.text3, fontSize: 10 }}>{fmtK(s.callOI)}</span>
      </div>
      <div style={{ padding: '0 4px 0 8px', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: `${callRatio * 100}%`, maxWidth: '100%', height: 14, background: callColor(callRatio), borderRadius: 2, minWidth: callRatio > 0 ? 2 : 0, transition: 'width 0.3s' }} />
        {s.callVol > 0 && <span style={{ marginLeft: 4, color: C.text3, fontSize: 9 }}>{fmtK(s.callVol)}v</span>}
      </div>

      {/* Strike label */}
      <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 12, fontWeight: s.gammaWall ? 700 : 400, color: isAtPrice ? C.gold : s.gammaWall ? C.text : C.text2 }}>
        ${s.strike}
        {s.gammaWall && <span style={{ color: C.gold, fontSize: 9, marginLeft: 3 }}>●</span>}
        {isHod && <span style={{ color: C.green, fontSize: 8, marginLeft: 3 }}>H</span>}
        {isLod && <span style={{ color: C.red,   fontSize: 8, marginLeft: 3 }}>L</span>}
        {isVwap && <span style={{ color: '#93c5fd', fontSize: 8, marginLeft: 3 }}>V</span>}
        {isAtPrice && <span style={{ color: C.gold, fontSize: 8, marginLeft: 3 }}>◄</span>}
      </div>

      {/* Put OI bar */}
      <div style={{ padding: '0 8px 0 4px', display: 'flex', alignItems: 'center', flexDirection: 'row-reverse' }}>
        <div style={{ width: `${putRatio * 100}%`, maxWidth: '100%', height: 14, background: putColor(putRatio), borderRadius: 2, minWidth: putRatio > 0 ? 2 : 0, transition: 'width 0.3s', marginLeft: 4 }} />
        {s.putVol > 0 && <span style={{ marginRight: 4, color: C.text3, fontSize: 9 }}>{fmtK(s.putVol)}v</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px' }}>
        <span style={{ color: C.text3, fontSize: 10 }}>{fmtK(s.putOI)}</span>
        {putVolSweep && <span style={{ color: C.red, fontSize: 9, fontWeight: 700 }}>⚡</span>}
      </div>
    </div>
  )
}

// ── Volume Profile sidebar ────────────────────────────────────────────────────
function VolumeProfile({ profile, livePrice }: { profile: VolBucket[]; livePrice: number | null }) {
  if (!profile.length) return null
  return (
    <div style={{ width: 70, flexShrink: 0, overflowY: 'auto', borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 6px 4px', fontSize: 9, color: C.text3, fontWeight: 600, letterSpacing: '0.05em', textAlign: 'center', borderBottom: `1px solid ${C.borderFt}` }}>VOL</div>
      {profile.map(b => {
        const isNear = livePrice ? Math.abs(b.price - livePrice) / livePrice < 0.005 : false
        return (
          <div key={b.price} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', minHeight: 20, background: isNear ? 'rgba(232,184,75,0.06)' : 'transparent' }}>
            <div style={{ flex: 1, height: 10, background: `rgba(147,197,253,${0.08 + b.ratio * 0.65})`, borderRadius: 1 }} />
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FlowMapPage() {
  const router        = useRouter()
  const [ticker, setTicker] = useState('SPY')
  const [input,  setInput]  = useState('SPY')
  const [data,   setData]   = useState<FlowData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (sym: string) => {
    if (!sym) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/flow?ticker=${sym}`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(ticker)
    pollRef.current = setInterval(() => fetchData(ticker), 120_000)  // refresh every 2 min
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [ticker, fetchData])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const sym = input.toUpperCase().trim()
    if (sym) { setTicker(sym); fetchData(sym) }
  }

  const maxOI = data ? Math.max(...data.strikes.map(s => Math.max(s.callOI, s.putOI)), 1) : 1
  const priceChange = data?.livePrice && data?.sessionOpen
    ? (data.livePrice - data.sessionOpen) / data.sessionOpen * 100
    : null

  return (
    <div style={{ minHeight: '100vh', background: C.pageBg, color: C.text, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, background: C.panelBg, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: 13, padding: 0 }}>← Monday</button>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.gold, letterSpacing: '0.06em' }}>OPTIONS FLOW MAP</div>
        {data && (
          <>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>${fmt(data.livePrice)}</div>
            {priceChange !== null && (
              <div style={{ fontSize: 13, color: priceChange >= 0 ? C.green : C.red, fontWeight: 600 }}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.text3 }}>
              {data.vwap  && <span>VWAP <span style={{ color: '#93c5fd' }}>${fmt(data.vwap)}</span></span>}
              {data.hod   && <span>HOD <span style={{ color: C.green }}>${fmt(data.hod)}</span></span>}
              {data.lod   && <span>LOD <span style={{ color: C.red }}>${fmt(data.lod)}</span></span>}
            </div>
          </>
        )}
        <form onSubmit={handleSearch} style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            placeholder="Ticker…"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 12px', color: C.text, fontSize: 13, width: 90, outline: 'none' }}
          />
          <button type="submit" style={{ background: C.goldFt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 16px', color: C.gold, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Load
          </button>
        </form>
        {loading && <div style={{ fontSize: 11, color: C.text3 }}>Refreshing…</div>}
        {data && <div style={{ fontSize: 10, color: C.text4 }}>Updated {new Date(data.updatedAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET</div>}
      </div>

      {error && <div style={{ padding: 20, color: C.red, fontSize: 13 }}>{error}</div>}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main heat map */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 1fr 80px', padding: '8px 0', borderBottom: `1px solid ${C.border}`, background: C.cardBg, position: 'sticky', top: 0, zIndex: 1 }}>
            <div style={{ textAlign: 'right', padding: '0 6px', fontSize: 10, color: C.green, fontWeight: 600, letterSpacing: '0.05em' }}>OI</div>
            <div style={{ textAlign: 'center', fontSize: 10, color: C.green, fontWeight: 600, letterSpacing: '0.05em' }}>CALLS ▲</div>
            <div style={{ textAlign: 'center', fontSize: 10, color: C.text3, fontWeight: 600, letterSpacing: '0.05em' }}>STRIKE</div>
            <div style={{ textAlign: 'center', fontSize: 10, color: C.red, fontWeight: 600, letterSpacing: '0.05em' }}>PUTS ▼</div>
            <div style={{ textAlign: 'left', padding: '0 6px', fontSize: 10, color: C.red, fontWeight: 600, letterSpacing: '0.05em' }}>OI</div>
          </div>

          {/* Strike rows — scrollable */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!data && !loading && (
              <div style={{ padding: 40, textAlign: 'center', color: C.text3, fontSize: 14 }}>
                Load a ticker to see the options flow map
              </div>
            )}
            {loading && !data && (
              <div style={{ padding: 40, textAlign: 'center', color: C.text3, fontSize: 14 }}>Loading…</div>
            )}
            {data?.strikes.map(s => (
              <StrikeRow key={s.strike} s={s} maxOI={maxOI} livePrice={data.livePrice} vwap={data.vwap} hod={data.hod} lod={data.lod} />
            ))}
          </div>
        </div>

        {/* Volume profile sidebar */}
        {data && <VolumeProfile profile={data.volProfile} livePrice={data.livePrice} />}
      </div>

      {/* Unusual flow feed */}
      {data?.unusualFlow?.length ? (
        <div style={{ borderTop: `1px solid ${C.border}`, background: C.cardBg, padding: '10px 20px' }}>
          <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>⚡ UNUSUAL ACTIVITY (vol {'>'} OI — new positioning)</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {data.unusualFlow.map((f, i) => (
              <div key={i} style={{
                background: f.type === 'call' ? C.greenFt : C.redFt,
                border:     `1px solid ${f.type === 'call' ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
                borderRadius: 6, padding: '4px 10px', fontSize: 11, display: 'flex', gap: 8, alignItems: 'center',
              }}>
                <span style={{ color: f.type === 'call' ? C.green : C.red, fontWeight: 700 }}>{f.type.toUpperCase()}</span>
                <span style={{ color: C.text2 }}>${f.strike}</span>
                <span style={{ color: C.text3 }}>{f.expiry}</span>
                <span style={{ color: C.text2, fontWeight: 600 }}>{fmtK(f.volume)}v</span>
                <span style={{ color: C.text3 }}>OI:{fmtK(f.openInterest)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Legend */}
      <div style={{ borderTop: `1px solid ${C.borderFt}`, padding: '8px 20px', display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 10, color: C.text4 }}>
        <span>● Gamma wall (high OI — market maker anchor)</span>
        <span style={{ color: C.gold }}>◄ Current price</span>
        <span style={{ color: '#93c5fd' }}>V VWAP</span>
        <span style={{ color: C.green }}>H HOD</span>
        <span style={{ color: C.red }}>L LOD</span>
        <span>⚡ Sweep (vol {'>'} OI = new positioning)</span>
        <span>Bar width = OI relative to max strike</span>
      </div>
    </div>
  )
}
