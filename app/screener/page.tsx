'use client'
import { useState, useMemo } from 'react'

const T = {
  bg:     '#0a0a0a',
  panel:  '#111111',
  border: '#1e1e1e',
  gold:   '#c9922a',
  goldDim:'#7a5a1a',
  text:   '#e8e0d0',
  dim:    '#6b6560',
  green:  '#00c896',
  red:    '#e05252',
  blue:   '#4a9eff',
}

interface Stock {
  ticker: string
  name: string
  price: number
  change: number
  volume: number
  avgVolume: number
  rsi: number
  ma20: boolean
  ma50: boolean
  ma200: boolean
  marketCap: number
  sector: string
  setup: string
  signal: number
  atr: number
}

const STOCKS: Stock[] = [
  { ticker:'NVDA', name:'NVIDIA Corp',            price:127.40, change: 3.2,  volume:42100000, avgVolume:38000000, rsi:62, ma20:true,  ma50:true,  ma200:true,  marketCap:3100, sector:'Technology',    setup:'Momentum',  signal:5, atr:4.2 },
  { ticker:'AMD',  name:'Advanced Micro Devices',  price:164.80, change: 2.1,  volume:31200000, avgVolume:28000000, rsi:58, ma20:true,  ma50:true,  ma200:true,  marketCap:267,  sector:'Technology',    setup:'Breakout',  signal:4, atr:5.1 },
  { ticker:'TSLA', name:'Tesla Inc',               price:218.60, change:-1.4,  volume:88500000, avgVolume:75000000, rsi:44, ma20:false, ma50:true,  ma200:true,  marketCap:697,  sector:'Consumer',      setup:'Pullback',  signal:3, atr:8.3 },
  { ticker:'META', name:'Meta Platforms',          price:512.30, change: 1.8,  volume:14200000, avgVolume:16000000, rsi:67, ma20:true,  ma50:true,  ma200:true,  marketCap:1290, sector:'Technology',    setup:'Momentum',  signal:4, atr:9.6 },
  { ticker:'MSFT', name:'Microsoft Corp',          price:415.70, change: 0.6,  volume:18900000, avgVolume:20000000, rsi:54, ma20:true,  ma50:true,  ma200:true,  marketCap:3090, sector:'Technology',    setup:'Pullback',  signal:3, atr:5.8 },
  { ticker:'AAPL', name:'Apple Inc',               price:226.40, change: 0.9,  volume:52300000, avgVolume:55000000, rsi:56, ma20:true,  ma50:true,  ma200:true,  marketCap:3380, sector:'Technology',    setup:'Momentum',  signal:3, atr:3.4 },
  { ticker:'GOOGL',name:'Alphabet Inc',            price:172.80, change: 1.4,  volume:21400000, avgVolume:22000000, rsi:59, ma20:true,  ma50:true,  ma200:true,  marketCap:2140, sector:'Technology',    setup:'Breakout',  signal:4, atr:4.7 },
  { ticker:'AMZN', name:'Amazon.com Inc',          price:191.50, change: 2.3,  volume:34600000, avgVolume:31000000, rsi:61, ma20:true,  ma50:true,  ma200:true,  marketCap:2020, sector:'Consumer',      setup:'Momentum',  signal:4, atr:4.9 },
  { ticker:'PLTR', name:'Palantir Technologies',   price:38.20,  change: 5.4,  volume:92100000, avgVolume:71000000, rsi:71, ma20:true,  ma50:true,  ma200:true,  marketCap:82,   sector:'Technology',    setup:'Breakout',  signal:5, atr:1.4 },
  { ticker:'ARM',  name:'Arm Holdings',            price:148.60, change: 4.1,  volume:18700000, avgVolume:12000000, rsi:68, ma20:true,  ma50:true,  ma200:true,  marketCap:155,  sector:'Technology',    setup:'Breakout',  signal:5, atr:6.2 },
  { ticker:'SMCI', name:'Super Micro Computer',    price:42.80,  change:-2.8,  volume:44200000, avgVolume:38000000, rsi:28, ma20:false, ma50:false, ma200:false, marketCap:25,   sector:'Technology',    setup:'Oversold',  signal:4, atr:2.8 },
  { ticker:'CRWD', name:'CrowdStrike Holdings',    price:318.40, change: 1.2,  volume:7800000,  avgVolume:8200000,  rsi:52, ma20:true,  ma50:true,  ma200:true,  marketCap:78,   sector:'Technology',    setup:'Pullback',  signal:3, atr:9.4 },
  { ticker:'NET',  name:'Cloudflare Inc',          price:98.70,  change: 2.6,  volume:9200000,  avgVolume:7800000,  rsi:63, ma20:true,  ma50:true,  ma200:true,  marketCap:32,   sector:'Technology',    setup:'Breakout',  signal:4, atr:3.2 },
  { ticker:'SNOW', name:'Snowflake Inc',           price:142.30, change:-0.8,  volume:6100000,  avgVolume:6800000,  rsi:46, ma20:false, ma50:true,  ma200:false, marketCap:48,   sector:'Technology',    setup:'Pullback',  signal:2, atr:5.6 },
  { ticker:'DDOG', name:'Datadog Inc',             price:118.50, change: 3.4,  volume:7400000,  avgVolume:5900000,  rsi:64, ma20:true,  ma50:true,  ma200:true,  marketCap:38,   sector:'Technology',    setup:'Momentum',  signal:4, atr:4.1 },
  { ticker:'XOM',  name:'Exxon Mobil Corp',        price:112.40, change: 1.6,  volume:16800000, avgVolume:15200000, rsi:57, ma20:true,  ma50:true,  ma200:true,  marketCap:449,  sector:'Energy',        setup:'Breakout',  signal:3, atr:2.1 },
  { ticker:'CVX',  name:'Chevron Corp',            price:158.70, change: 0.9,  volume:9400000,  avgVolume:10100000, rsi:53, ma20:true,  ma50:false, ma200:true,  marketCap:288,  sector:'Energy',        setup:'Pullback',  signal:2, atr:2.8 },
  { ticker:'JPM',  name:'JPMorgan Chase',          price:218.90, change: 1.1,  volume:10200000, avgVolume:9800000,  rsi:58, ma20:true,  ma50:true,  ma200:true,  marketCap:629,  sector:'Financials',    setup:'Momentum',  signal:3, atr:3.6 },
  { ticker:'GS',   name:'Goldman Sachs',           price:498.60, change: 1.8,  volume:2800000,  avgVolume:2600000,  rsi:62, ma20:true,  ma50:true,  ma200:true,  marketCap:167,  sector:'Financials',    setup:'Breakout',  signal:4, atr:9.2 },
  { ticker:'BAC',  name:'Bank of America',         price:41.20,  change: 0.7,  volume:38400000, avgVolume:36000000, rsi:55, ma20:true,  ma50:true,  ma200:true,  marketCap:324,  sector:'Financials',    setup:'Momentum',  signal:3, atr:0.8 },
  { ticker:'LLY',  name:'Eli Lilly & Co',          price:842.30, change: 2.4,  volume:3100000,  avgVolume:2800000,  rsi:65, ma20:true,  ma50:true,  ma200:true,  marketCap:800,  sector:'Healthcare',    setup:'Momentum',  signal:4, atr:18.4 },
  { ticker:'UNH',  name:'UnitedHealth Group',      price:312.40, change:-1.2,  volume:4600000,  avgVolume:4900000,  rsi:38, ma20:false, ma50:false, ma200:true,  marketCap:285,  sector:'Healthcare',    setup:'Oversold',  signal:4, atr:6.8 },
  { ticker:'ABBV', name:'AbbVie Inc',              price:184.60, change: 0.4,  volume:5800000,  avgVolume:6100000,  rsi:51, ma20:true,  ma50:true,  ma200:true,  marketCap:326,  sector:'Healthcare',    setup:'Pullback',  signal:2, atr:2.9 },
  { ticker:'CAT',  name:'Caterpillar Inc',         price:368.40, change: 1.3,  volume:3200000,  avgVolume:3000000,  rsi:60, ma20:true,  ma50:true,  ma200:true,  marketCap:181,  sector:'Industrials',   setup:'Momentum',  signal:3, atr:6.4 },
  { ticker:'DE',   name:'Deere & Company',         price:402.10, change:-0.6,  volume:1900000,  avgVolume:2100000,  rsi:42, ma20:false, ma50:true,  ma200:true,  marketCap:119,  sector:'Industrials',   setup:'Pullback',  signal:2, atr:7.8 },
  { ticker:'UBER', name:'Uber Technologies',       price:74.80,  change: 2.9,  volume:18600000, avgVolume:16000000, rsi:66, ma20:true,  ma50:true,  ma200:true,  marketCap:154,  sector:'Consumer',      setup:'Breakout',  signal:4, atr:2.1 },
  { ticker:'NFLX', name:'Netflix Inc',             price:682.40, change: 1.7,  volume:4800000,  avgVolume:4400000,  rsi:63, ma20:true,  ma50:true,  ma200:true,  marketCap:292,  sector:'Consumer',      setup:'Momentum',  signal:4, atr:14.2 },
  { ticker:'SHOP', name:'Shopify Inc',             price:86.40,  change: 3.8,  volume:11200000, avgVolume:8800000,  rsi:67, ma20:true,  ma50:true,  ma200:true,  marketCap:109,  sector:'Technology',    setup:'Breakout',  signal:5, atr:2.8 },
  { ticker:'SQ',   name:'Block Inc',               price:68.20,  change:-3.1,  volume:8900000,  avgVolume:7200000,  rsi:31, ma20:false, ma50:false, ma200:false, marketCap:42,   sector:'Financials',    setup:'Oversold',  signal:3, atr:2.6 },
  { ticker:'COIN', name:'Coinbase Global',         price:248.60, change: 4.2,  volume:9400000,  avgVolume:7100000,  rsi:69, ma20:true,  ma50:true,  ma200:true,  marketCap:62,   sector:'Financials',    setup:'Breakout',  signal:5, atr:10.4 },
  { ticker:'MARA', name:'MARA Holdings',           price:18.40,  change: 6.8,  volume:44100000, avgVolume:32000000, rsi:72, ma20:true,  ma50:true,  ma200:false, marketCap:5,    sector:'Technology',    setup:'Momentum',  signal:4, atr:1.2 },
  { ticker:'VST',  name:'Vistra Corp',             price:118.20, change: 2.1,  volume:6800000,  avgVolume:5400000,  rsi:61, ma20:true,  ma50:true,  ma200:true,  marketCap:38,   sector:'Energy',        setup:'Breakout',  signal:4, atr:3.8 },
]

const SECTORS = ['All', 'Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer', 'Industrials']
const SETUPS  = ['All', 'Breakout', 'Momentum', 'Pullback', 'Oversold', 'Reversal']

function fmtVol(v: number) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K'
  return String(v)
}

function fmtMcap(v: number) {
  if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'T'
  return '$' + v.toFixed(0) + 'B'
}

type SortKey = 'change' | 'volume' | 'rsi' | 'marketCap' | 'signal' | 'price'

export default function ScreenerPage() {
  const [sector,  setSector]  = useState('All')
  const [setup,   setSetup]   = useState('All')
  const [rsiFilter, setRsiFilter] = useState('All')
  const [maFilter,  setMaFilter]  = useState('All')
  const [sortKey, setSortKey] = useState<SortKey>('signal')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [search,  setSearch]  = useState('')

  const results = useMemo(() => {
    let filtered = STOCKS.filter(s => {
      if (sector !== 'All' && s.sector !== sector) return false
      if (setup  !== 'All' && s.setup  !== setup)  return false
      if (search && !s.ticker.toUpperCase().includes(search.toUpperCase()) &&
          !s.name.toLowerCase().includes(search.toLowerCase())) return false
      if (rsiFilter === 'Oversold'   && s.rsi >= 35) return false
      if (rsiFilter === 'Neutral'    && (s.rsi < 35 || s.rsi > 65)) return false
      if (rsiFilter === 'Overbought' && s.rsi <= 65) return false
      if (maFilter === 'Above 200MA' && !s.ma200) return false
      if (maFilter === 'Above 50MA'  && !s.ma50)  return false
      if (maFilter === 'Above 20MA'  && !s.ma20)  return false
      if (maFilter === 'Below 20MA'  && s.ma20)   return false
      return true
    })

    filtered.sort((a, b) => {
      const av = a[sortKey] as number
      const bv = b[sortKey] as number
      return sortDir === 'desc' ? bv - av : av - bv
    })

    return filtered
  }, [sector, setup, rsiFilter, maFilter, search, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const setupColor: Record<string, string> = {
    Breakout:  T.gold,
    Momentum:  T.green,
    Pullback:  T.blue,
    Oversold:  '#c97a2a',
    Reversal:  '#9b7fd4',
  }

  const Chip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
      cursor: 'pointer', transition: 'all 0.15s',
      background: active ? T.gold : 'transparent',
      color: active ? '#000' : T.dim,
      border: `1px solid ${active ? T.gold : T.border}`,
    }}>{label}</button>
  )

  const ColHeader = ({ label, sortable, k }: { label: string; sortable?: boolean; k?: SortKey }) => (
    <th onClick={sortable && k ? () => toggleSort(k) : undefined} style={{
      padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.08em', color: (sortKey === k && sortable) ? T.gold : T.dim,
      cursor: sortable ? 'pointer' : 'default', userSelect: 'none',
      borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
    }}>
      {label}{sortable && k && sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'SF Mono', 'Fira Code', monospace" }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.04em', color: T.text }}>Market Screener</div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>Broad market swing trade scanner</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            padding: '4px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700,
            background: 'rgba(201,146,42,0.12)', color: T.goldDim,
            border: `1px solid ${T.goldDim}`, letterSpacing: '0.06em',
          }}>DEMO — CONNECT POLYGON FOR LIVE DATA</div>
          <div style={{ fontSize: 12, color: T.dim }}>{results.length} results</div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '12px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>

        {/* Search */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search ticker or name…"
          style={{
            background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4,
            color: T.text, fontSize: 12, padding: '5px 10px', outline: 'none', width: 180,
          }}
        />

        {/* Setup */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: T.dim, marginRight: 4, letterSpacing: '0.06em' }}>SETUP</span>
          {SETUPS.map(s => <Chip key={s} label={s} active={setup === s} onClick={() => setSetup(s)} />)}
        </div>

        {/* Sector */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: T.dim, marginRight: 4, letterSpacing: '0.06em' }}>SECTOR</span>
          <select value={sector} onChange={e => setSector(e.target.value)} style={{
            background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4,
            color: T.text, fontSize: 11, padding: '4px 8px', outline: 'none', cursor: 'pointer',
          }}>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* RSI */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: T.dim, marginRight: 4, letterSpacing: '0.06em' }}>RSI</span>
          {['All', 'Oversold', 'Neutral', 'Overbought'].map(s => <Chip key={s} label={s} active={rsiFilter === s} onClick={() => setRsiFilter(s)} />)}
        </div>

        {/* MA */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: T.dim, marginRight: 4, letterSpacing: '0.06em' }}>MA</span>
          {['All', 'Above 200MA', 'Above 50MA', 'Above 20MA', 'Below 20MA'].map(s => <Chip key={s} label={s} active={maFilter === s} onClick={() => setMaFilter(s)} />)}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: T.panel }}>
              <ColHeader label="TICKER"    />
              <ColHeader label="PRICE"     sortable k="price"     />
              <ColHeader label="CHANGE"    sortable k="change"    />
              <ColHeader label="VOLUME"    sortable k="volume"    />
              <ColHeader label="RSI"       sortable k="rsi"       />
              <ColHeader label="MA STATUS" />
              <ColHeader label="MKT CAP"   sortable k="marketCap" />
              <ColHeader label="SETUP"     />
              <ColHeader label="SIGNAL"    sortable k="signal"    />
            </tr>
          </thead>
          <tbody>
            {results.map((s, i) => {
              const volRatio = s.volume / s.avgVolume
              const rsiColor = s.rsi < 35 ? T.green : s.rsi > 65 ? T.red : T.text
              return (
                <tr key={s.ticker} style={{
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  borderBottom: `1px solid ${T.border}`,
                  transition: 'background 0.1s',
                }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,146,42,0.05)')}
                   onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)')}>

                  {/* Ticker */}
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{s.ticker}</div>
                    <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>{s.name}</div>
                  </td>

                  {/* Price */}
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: T.text }}>
                    ${s.price.toFixed(2)}
                  </td>

                  {/* Change */}
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: s.change >= 0 ? T.green : T.red,
                    }}>
                      {s.change >= 0 ? '+' : ''}{s.change.toFixed(1)}%
                    </span>
                  </td>

                  {/* Volume */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: T.text }}>{fmtVol(s.volume)}</div>
                    <div style={{ fontSize: 10, color: volRatio >= 1.5 ? T.gold : T.dim, marginTop: 2 }}>
                      {volRatio.toFixed(1)}x avg
                    </div>
                  </td>

                  {/* RSI */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 36, height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          width: `${s.rsi}%`, height: '100%', borderRadius: 2,
                          background: rsiColor, transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: rsiColor, fontWeight: 600 }}>{s.rsi}</span>
                    </div>
                  </td>

                  {/* MA Status */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[{ label:'20', v: s.ma20 }, { label:'50', v: s.ma50 }, { label:'200', v: s.ma200 }].map(m => (
                        <div key={m.label} style={{
                          padding: '2px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700,
                          background: m.v ? 'rgba(0,200,150,0.12)' : 'rgba(224,82,82,0.12)',
                          color: m.v ? T.green : T.red,
                          border: `1px solid ${m.v ? 'rgba(0,200,150,0.3)' : 'rgba(224,82,82,0.3)'}`,
                        }}>{m.label}</div>
                      ))}
                    </div>
                  </td>

                  {/* Market Cap */}
                  <td style={{ padding: '10px 12px', fontSize: 12, color: T.dim }}>
                    {fmtMcap(s.marketCap)}
                  </td>

                  {/* Setup */}
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.05em',
                      background: `${setupColor[s.setup] ?? T.dim}18`,
                      color: setupColor[s.setup] ?? T.dim,
                      border: `1px solid ${setupColor[s.setup] ?? T.dim}40`,
                    }}>{s.setup.toUpperCase()}</span>
                  </td>

                  {/* Signal strength */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[1,2,3,4,5].map(n => (
                        <div key={n} style={{
                          width: 6, height: 14, borderRadius: 2,
                          background: n <= s.signal
                            ? (s.signal >= 4 ? T.gold : s.signal >= 3 ? T.green : T.dim)
                            : T.border,
                        }} />
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {results.length === 0 && (
          <div style={{ padding: 64, textAlign: 'center', color: T.dim, fontSize: 13 }}>
            No stocks match the current filters.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 24px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, color: T.dim }}>
          Demo data — connect Polygon.io to screen 8,000+ live tickers with real-time RSI, MA, and volume signals
        </div>
        <div style={{ fontSize: 10, color: T.dim }}>{results.length} of {STOCKS.length} shown</div>
      </div>
    </div>
  )
}
