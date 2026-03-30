'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useTheme } from '@/app/context/theme-context'

const TICKERS = [
  { sym: 'AAPL',  price: '249.94', chg: '-1.69%', up: false },
  { sym: 'TSLA',  price: '392.78', chg: '-1.63%', up: false },
  { sym: 'META',  price: '615.68', chg: '-1.12%', up: false },
  { sym: 'AMD',   price: '199.46', chg: '+1.60%', up: true  },
  { sym: 'SPY',   price: '661.43', chg: '-1.40%', up: false },
  { sym: 'GLD',   price: '444.74', chg: '-3.16%', up: false },
  { sym: 'NVDA',  price: '180.40', chg: '-0.84%', up: false },
  { sym: '/ES',   price: '5,621',  chg: '-0.92%', up: false },
  { sym: 'BTC',   price: '84,120', chg: '+1.22%', up: true  },
  { sym: 'MSFT',  price: '388.50', chg: '-0.54%', up: false },
]

const NAV_SECTIONS = [
  { id: 'features',     label: 'Features'     },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'pricing',      label: 'Pricing'      },
  { id: 'faq',          label: 'FAQ'          },
]

const FEATURES = [
  { icon: '◈', title: 'AI Voice Assistant',       tag: 'CORE',  desc: 'Say "Hey Monday" — get an instant spoken, institutional-grade analysis of any asset, event, or market structure. No typing. No searching.' },
  { icon: '⊟', title: 'Live Prices — All Assets',  tag: 'LIVE',  desc: 'Stocks, ETFs, futures, commodities, crypto. Your watchlist refreshes every 30 seconds with real data. Completely customizable.' },
  { icon: '◐', title: 'High-Impact Calendar',     tag: 'MACRO', desc: 'CPI, FOMC, NFP, earnings — every event that moves markets. Actuals populate the second data drops, and Monday immediately explains the impact.' },
  { icon: '▦', title: 'Level 2 Order Flow',       tag: 'EDGE',  desc: 'Monday reads the order book and describes what institutions are doing — block buys, sweeps, unusual size — in plain spoken English.' },
  { icon: '◫', title: 'Intelligent News Feed',    tag: 'NEWS',  desc: 'Every headline scored for market impact and sentiment. Monday connects news events directly to expected price movement on your watchlist.' },
  { icon: '◉', title: 'Daily Briefings',          tag: 'DAILY', desc: 'A spoken morning briefing before the open, midday pulse, power hour summary, and end-of-day wrap. Delivered like a personal analyst.' },
]

const DEMO_CHAT = [
  { role: 'user',   text: "Hey Monday, what's happening with NVDA right now?" },
  { role: 'monday', text: "NVDA is down 0.84% at $180.40 on moderate volume. The broader semis are mixed — AMD is the outlier at +1.60%. Key watch: Blackwell supply data out of Taiwan this week." },
  { role: 'user',   text: "How does today's macro backdrop affect my tech positions?" },
  { role: 'monday', text: "The 10Y Treasury Yield sits at 4.21% — elevated rates are pressuring growth multiples across your watchlist. AAPL, TSLA, META are all red. GLD at -3.16% may signal broader risk-off rotation." },
]

const STEPS = [
  { n: '01', title: 'Build your watchlist',      sub: 'Any stock, ETF, future, commodity, or crypto. Monday tracks them all, refreshing every 30 seconds.' },
  { n: '02', title: 'Say "Hey Monday"',           sub: 'Wake word always listening. Or type — your choice. No clicking through menus, no searching.' },
  { n: '03', title: 'Monday pulls live data',     sub: 'Every API fires on your question: prices, news, order flow, macro calendar — all simultaneously.' },
  { n: '04', title: 'Get a spoken answer',        sub: 'Claude AI synthesizes the data. ElevenLabs voices it. You hear a real analyst, not a robot, in under 4 seconds.' },
  { n: '05', title: 'Stay briefed, hands-free',   sub: 'Automatic morning, midday, and EOD spoken briefings. Event-triggered alerts when CPI or FOMC drops.' },
]

const FAQ_ITEMS = [
  { q: "What exactly is included in the 5-day trial?", a: "The 5-day trial includes access to Monday's core features — live prices, calendar, news, and briefings — with a limited number of AI voice replies and chat messages per day. Upgrade anytime to unlock unlimited usage." },
  { q: "How does the voice actually work?", a: "When you say \"Hey Monday,\" it pulls live data from every connected API simultaneously, synthesizes it using Claude AI, and delivers a spoken response via ElevenLabs natural voice. It sounds like a real analyst — context, nuance, and judgment included — not a dashboard reading numbers." },
  { q: "What assets does Monday cover?", a: "US stocks, ETFs, futures (/ES, /NQ, /CL, /GC), commodities, crypto (BTC, ETH, SOL and more), and forex pairs. If it trades on a major exchange, Monday knows about it in real time." },
  { q: "How is this different from Bloomberg or Trade Ideas?", a: "Bloomberg costs $25,000/year and is data-first. Trade Ideas is chart pattern alerts. Monday is intelligence-first — it explains data in real-time spoken English. It's closer to having a senior analyst on call 24/7 than a terminal." },
  { q: "Can I cancel anytime?", a: "Yes, always. No contracts, no cancellation fees, no friction. If you cancel, you keep access until the end of your billing period. We earn your subscription every month." },
  { q: "What happens when a major event drops — like CPI or FOMC?", a: "Within seconds of the actual number hitting the wire, Monday detects it, updates the calendar, scores it against the forecast, and automatically delivers a spoken briefing explaining the impact on your specific watchlist. You never have to ask." },
]

const COMPARISONS = [
  { name: 'Monday',       monthly: '$79.99', annual: '$66.66', highlight: true,  note: 'Voice AI + live intel' },
  { name: 'Bloomberg',    monthly: '$2,665', annual: '$2,083', highlight: false, note: 'Data terminal, no AI' },
  { name: 'Benzinga Pro', monthly: '$197',   annual: '$99',    highlight: false, note: 'News only, no voice' },
  { name: 'Trade Ideas',  monthly: '$254',   annual: '$167',   highlight: false, note: 'Charts, no macro AI' },
]

const DARK = {
  pageBg:'#0a0a08', bg2:'#120f07', bg3:'#181208', bg4:'#1c1608',
  tickerBg:'#080806', navBg:'rgba(10,10,8,0.97)',
  border:'#2a2618', border2:'#3a3420',
  gold:'#c9922a', goldLight:'#e8b84b', goldDim:'#8a6420',
  red:'#c94242', amber:'#b8860b',
  text:'#d4c5a0', text2:'#a08040', text3:'#6a6050',
  heading:'#e8d5a0',
  chatBg:'#000000', chatToolbar:'#0d0b07',
  chatUser:'#1c1608', chatUserBorder:'#3a3420',
  chatMonday:'rgba(201,146,42,.05)', chatMondayBorder:'rgba(201,146,42,.15)',
  featBg:'#120f07', featHover:'#181208',
  gridLine:'rgba(201,146,42,.04)',
  glow:'rgba(201,146,42,.06)', glow2:'rgba(201,146,42,.07)',
  scanline:'rgba(201,146,42,.15)',
  stepActive:'#0a0a08', stepInactive:'#120f07',
  pricingBg:'#120f07', pricingBorder:'rgba(201,146,42,.3)',
  pricingShadow:'0 0 50px rgba(201,146,42,.06)',
  compBg:'#120f07',
  faqOpen:'#0a0a08',
  testimonialBg:'#0a0a08',
  footerBg:'#080806', footerBorder:'rgba(201,146,42,.06)',
  calendarBg:'#120f07',
  badgeBg:'rgba(201,146,42,.08)', badgeBorder:'rgba(201,146,42,.2)',
  dataRowBg:'rgba(201,146,42,.04)', dataRowBorder:'rgba(201,146,42,.15)',
  toggleBg:'#1c1608', toggleBorder:'#3a3420',
  btnText:'#0a0a08',
  footerText:'#a08040', footerMuted:'#6a6050', footerPowered:'#4a4438',
}

const LIGHT = {
  pageBg:'#f5f0e8', bg2:'#ede6d6', bg3:'#e5dcc8', bg4:'#ddd3ba',
  tickerBg:'#1a1408', navBg:'rgba(245,240,232,0.97)',
  border:'#c8b898', border2:'#b8a47e',
  gold:'#a06818', goldLight:'#c98020', goldDim:'#7a5010',
  red:'#b83232', amber:'#8a5c10',
  text:'#2a1f0e', text2:'#6b4c20', text3:'#8a7050',
  heading:'#1a1008',
  chatBg:'#faf7f0', chatToolbar:'#ede6d6',
  chatUser:'#e8dfc8', chatUserBorder:'#b8a47e',
  chatMonday:'rgba(160,104,24,.06)', chatMondayBorder:'rgba(160,104,24,.2)',
  featBg:'#ede6d6', featHover:'#e5dcc8',
  gridLine:'rgba(160,104,24,.055)',
  glow:'rgba(160,104,24,.08)', glow2:'rgba(160,104,24,.1)',
  scanline:'rgba(160,104,24,.12)',
  stepActive:'#f5f0e8', stepInactive:'#ede6d6',
  pricingBg:'#faf7f0', pricingBorder:'rgba(160,104,24,.4)',
  pricingShadow:'0 8px 40px rgba(160,104,24,.12)',
  compBg:'#ede6d6',
  faqOpen:'#f5f0e8',
  testimonialBg:'#f5f0e8',
  footerBg:'#1a1408', footerBorder:'rgba(160,104,24,.1)',
  calendarBg:'#ede6d6',
  badgeBg:'rgba(160,104,24,.08)', badgeBorder:'rgba(160,104,24,.25)',
  dataRowBg:'rgba(160,104,24,.05)', dataRowBorder:'rgba(160,104,24,.18)',
  toggleBg:'#e5dcc8', toggleBorder:'#b8a47e',
  btnText:'#f5f0e8',
  footerText:'#c0a060', footerMuted:'#8a7050', footerPowered:'#8a7050',
}

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

const LogoSvg = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 340 340" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(224,178)">
      <rect x="-162" y="-12" width="20" height="50" rx="10" fill="#c9922a" opacity="0.20"/>
      <rect x="-134" y="-46" width="20" height="110" rx="10" fill="#c9922a" opacity="0.38"/>
      <rect x="-106" y="-80" width="20" height="172" rx="10" fill="#c9922a" opacity="0.60"/>
      <rect x="-78" y="-58" width="20" height="116" rx="10" fill="#c9922a" opacity="0.68"/>
      <rect x="-50" y="-100" width="20" height="210" rx="10" fill="#c9922a"/>
      <rect x="-22" y="-72" width="20" height="148" rx="10" fill="#c9922a" opacity="0.72"/>
      <rect x="6" y="-56" width="20" height="118" rx="10" fill="#c9922a" opacity="0.55"/>
      <rect x="34" y="-28" width="20" height="68" rx="10" fill="#c9922a" opacity="0.35"/>
    </g>
  </svg>
)

export default function MarketingPage() {
  const { isDark, toggle } = useTheme()
  const T = isDark ? DARK : LIGHT

  const [activeNav, setActiveNav]           = useState('')
  const [chatStep, setChatStep]             = useState(1)
  const [openFaq, setOpenFaq]               = useState<number | null>(null)
  const [billing, setBilling]               = useState<'monthly'|'annual'>('monthly')
  const [activeStep, setActiveStep]         = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const sectionRefs   = useRef<Record<string, HTMLElement | null>>({})
  const hiwContentRef = useRef<HTMLDivElement | null>(null)
  const hiwStepTabsRef = useRef<HTMLDivElement | null>(null)
  const stepTabRefs   = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0)
    })
  })
}, [])

  useEffect(() => {
    const t = setInterval(() => setChatStep(s => s < DEMO_CHAT.length ? s + 1 : s), 2800)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const handler = () => {
      const scrollY = window.scrollY + 80
      let current = ''
      for (const { id } of NAV_SECTIONS) {
        const el = sectionRefs.current[id]
        if (el && el.offsetTop <= scrollY) current = id
      }
      setActiveNav(current)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Auto-scroll HIW on step change
  useEffect(() => {
  // Scroll the active step tab into view horizontally only — no vertical movement
  const activeTab = stepTabRefs.current[activeStep]
  if (activeTab) {
    activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }
}, [activeStep])

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false)
    const el = sectionRefs.current[id]
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 70
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  const price = billing === 'monthly' ? '79.99' : '66.66'

  return (
    <div style={{ background:T.pageBg, color:T.text, fontFamily:"'JetBrains Mono', monospace", minHeight:'100vh', transition:'background 0.3s ease, color 0.3s ease' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        @keyframes tickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(201,146,42,.4)}50%{opacity:.8;box-shadow:0 0 0 5px rgba(201,146,42,0)}}
        @keyframes gpulse{0%,100%{opacity:1;filter:brightness(1)}50%{opacity:.85;filter:brightness(1.3)}}
        @keyframes waveAnim{0%,100%{height:4px}50%{height:20px}}
        @keyframes scanline{0%{top:-5%}100%{top:105%}}
        @keyframes msgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toggleSpin{from{transform:rotate(-30deg);opacity:0}to{transform:rotate(0deg);opacity:1}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .ticker-inner{display:flex;animation:tickerScroll 45s linear infinite;white-space:nowrap;align-items:center;height:30px}
        .wb{width:3px;border-radius:2px;opacity:.65;animation:waveAnim 1.1s ease-in-out infinite}
        .wb:nth-child(1){animation-delay:.00s}.wb:nth-child(2){animation-delay:.08s}.wb:nth-child(3){animation-delay:.16s}
        .wb:nth-child(4){animation-delay:.12s}.wb:nth-child(5){animation-delay:.04s}.wb:nth-child(6){animation-delay:.20s}
        .wb:nth-child(7){animation-delay:.10s}.wb:nth-child(8){animation-delay:.18s}.wb:nth-child(9){animation-delay:.06s}
        .msg-in{animation:msgIn .35s ease both}
        .toggle-icon{animation:toggleSpin 0.3s ease both}
        .mobile-menu-anim{animation:slideDown 0.2s ease both}
        ::-webkit-scrollbar{width:3px}
        html{scroll-behavior:smooth}

        /* ── MOBILE RESPONSIVE ── */
        @media(max-width:760px){
          .nav-links{display:none!important}
          .nav-login{display:none!important}
          .hamburger{display:flex!important}
          .hero-section{padding:52px 18px 48px!important}
          .hero-buttons{flex-direction:column!important;align-items:stretch!important}
          .hero-buttons a,.hero-buttons div{text-align:center!important;justify-content:center!important}
          .demo-window{margin:0 -2px!important}
          .asset-bar-inner{justify-content:flex-start!important;overflow-x:auto!important;flex-wrap:nowrap!important;padding-bottom:4px!important}
          .features-grid{grid-template-columns:1fr!important}
          .hiw-grid{grid-template-columns:1fr!important}
          .hiw-steps-col{display:flex!important;flex-direction:row!important;overflow-x:auto!important;gap:0!important;border-right:none!important;border-bottom:1px solid var(--border)!important}
          .hiw-step-item{min-width:160px!important;flex-shrink:0!important;border-bottom:none!important;border-right:1px solid var(--border)!important}
          .hiw-content-col{padding:20px 16px!important}
          .calendar-event{flex-wrap:wrap!important;gap:6px!important}
          .calendar-event-time{width:auto!important}
          .testimonials-grid{grid-template-columns:1fr!important}
          .price-inner{flex-direction:column!important}
          .price-features-col{display:block!important;min-width:unset!important}
          .comp-grid{grid-template-columns:1fr 1fr!important}
          .billing-toggle{flex-wrap:wrap!important}
          .faq-q{font-size:13px!important}
          .footer-grid{grid-template-columns:1fr 1fr!important;gap:28px!important}
          .footer-brand{grid-column:1/-1!important}
          .footer-bottom{flex-direction:column!important;gap:6px!important;text-align:center!important}
          .section-pad{padding:60px 18px!important}
          .section-pad-sm{padding:48px 18px!important}
          .comp-grid-wrap{overflow-x:auto!important}
        }
        @media(max-width:480px){
          .comp-grid{grid-template-columns:1fr 1fr!important}
          .features-grid{grid-template-columns:1fr!important}
          .demo-chat-msg{max-width:95%!important}
        }
      `}</style>

      {/* ── TICKER ── */}
      <div style={{ background:T.tickerBg, borderBottom:`1px solid ${isDark?T.border:'#3a2808'}`, height:30, overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:40, background:`linear-gradient(90deg,${T.tickerBg},transparent)`, zIndex:2 }} />
        <div style={{ position:'absolute', right:0, top:0, bottom:0, width:40, background:`linear-gradient(-90deg,${T.tickerBg},transparent)`, zIndex:2 }} />
        <div className="ticker-inner">
          {[...TICKERS,...TICKERS].map((tk,i) => (
            <div key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'0 14px', borderRight:`1px solid ${isDark?T.border:'#3a2808'}`, height:30, fontSize:11 }}>
              <span style={{ color:isDark?'#d4c5a0':'#f0e8d0', fontWeight:600 }}>{tk.sym}</span>
              <span style={{ color:isDark?'#a08040':'#c8a060' }}>{tk.price}</span>
              <span style={{ color:tk.up?(isDark?'#b8860b':'#c89020'):(isDark?'#c94242':'#c03030') }}>{tk.chg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── NAVBAR ── */}
      <nav style={{ position:'sticky', top:0, zIndex:100, background:T.navBg, backdropFilter:'blur(16px)', borderBottom:`1px solid ${T.border}`, transition:'background 0.3s ease' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 18px', height:54, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ marginRight:24, flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }} onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>
            <LogoSvg size={20} />
            <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontStyle:'italic', color:T.heading, fontWeight:600 }}>Hey </span>
            <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontStyle:'italic', color:T.gold, fontWeight:700 }}>Monday</span>
          </div>
          <div className="nav-links" style={{ display:'flex', gap:24, marginRight:'auto' }}>
            {NAV_SECTIONS.map(s=>(
              <span key={s.id} onClick={()=>scrollTo(s.id)}
                style={{ fontSize:11, fontWeight:500, color:activeNav===s.id?T.gold:T.text2, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', transition:'color 0.15s' }}>
                {s.label}
              </span>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginLeft:'auto' }}>
            <button onClick={toggle} style={{ background:T.toggleBg, border:`1px solid ${T.toggleBorder}`, borderRadius:24, padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:5, color:T.text2, transition:'all 0.3s ease', flexShrink:0 }}>
              <span key={String(isDark)} className="toggle-icon">
                {isDark ? <SunIcon color={T.text2} /> : <MoonIcon color={T.text2} />}
              </span>
            </button>
            <Link href="/login" className="nav-login" style={{ textDecoration:'none' }}>
              <div style={{ fontSize:10, fontWeight:600, color:T.text2, padding:'7px 14px', border:`1px solid ${T.border2}`, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>Log In</div>
            </Link>
            <Link href="/signup" style={{ textDecoration:'none' }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.btnText, background:T.gold, padding:'8px 14px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', whiteSpace:'nowrap' }}>Free Trial →</div>
            </Link>
            <button className="hamburger" onClick={()=>setMobileMenuOpen(v=>!v)}
              style={{ display:'none', flexDirection:'column', gap:5, padding:'6px', background:'transparent', border:`1px solid ${T.border2}`, cursor:'pointer', flexShrink:0 }}>
              <div style={{ width:16, height:1.5, background:T.gold }} />
              <div style={{ width:16, height:1.5, background:T.gold }} />
              <div style={{ width:16, height:1.5, background:T.gold }} />
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="mobile-menu-anim" style={{ borderTop:`1px solid ${T.border}`, background:T.navBg, padding:'12px 18px 16px' }}>
            {NAV_SECTIONS.map(s=>(
              <div key={s.id} onClick={()=>scrollTo(s.id)} style={{ fontSize:12, fontWeight:600, color:activeNav===s.id?T.gold:T.text2, letterSpacing:'0.12em', textTransform:'uppercase', padding:'11px 0', borderBottom:`1px solid ${T.border}`, cursor:'pointer' }}>
                {s.label}
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <Link href="/login" style={{ flex:1, textDecoration:'none' }}>
                <div style={{ fontSize:11, fontWeight:600, color:T.text2, padding:'10px', border:`1px solid ${T.border2}`, letterSpacing:'0.08em', textTransform:'uppercase', textAlign:'center' }}>Log In</div>
              </Link>
              <Link href="/signup" style={{ flex:1, textDecoration:'none' }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.btnText, background:T.gold, padding:'10px', letterSpacing:'0.08em', textTransform:'uppercase', textAlign:'center' }}>Free Trial →</div>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="hero-section" style={{ padding:'80px 24px 72px', textAlign:'center', position:'relative', overflow:'hidden', backgroundImage:`linear-gradient(${T.gridLine} 1px,transparent 1px),linear-gradient(90deg,${T.gridLine} 1px,transparent 1px)`, backgroundSize:'52px 52px', transition:'background 0.3s ease' }}>
        <div style={{ position:'absolute', top:'45%', left:'50%', transform:'translate(-50%,-50%)', width:'min(700px,90vw)', height:400, background:`radial-gradient(ellipse,${T.glow} 0%,transparent 65%)`, pointerEvents:'none' }} />
        <div style={{ display:'inline-flex', alignItems:'center', gap:7, background:T.badgeBg, border:`1px solid ${T.badgeBorder}`, padding:'5px 14px', marginBottom:28, fontSize:10, letterSpacing:'0.2em', color:T.gold, textTransform:'uppercase' }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:T.amber, display:'inline-block', animation:'gpulse 2s ease infinite' }} />
          Market Intelligence · Always On
        </div>
        <h1 style={{ marginBottom:20, lineHeight:1.08 }}>
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(44px,10vw,98px)', fontStyle:'italic', fontWeight:600, color:T.heading, display:'block' }}>
            Hey <span style={{ color:T.gold }}>Monday</span>,
          </span>
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(20px,5vw,50px)', fontStyle:'italic', fontWeight:400, color:T.text2, display:'block', marginTop:4 }}>
            what's the market doing right now?
          </span>
        </h1>
        <p style={{ fontSize:'clamp(12px,3vw,14px)', color:T.text2, maxWidth:520, margin:'0 auto 36px', lineHeight:1.8, letterSpacing:'0.02em' }}>
          Monday is your AI voice analyst. Ask anything about any asset — stocks, futures, crypto, macro — and get a spoken, institutional-grade answer in seconds.
        </p>
        <div className="hero-buttons" style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', marginBottom:52 }}>
          <Link href="/signup" style={{ textDecoration:'none', width:'auto' }}>
            <div style={{ background:T.gold, color:T.btnText, padding:'14px 32px', fontWeight:700, fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', display:'block', cursor:'pointer' }}>
              Start 5-Day Free Trial →
            </div>
          </Link>
          <div onClick={()=>scrollTo('how-it-works')} style={{ border:`1px solid ${T.border2}`, color:T.text2, padding:'14px 24px', fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
            See How It Works
          </div>
        </div>
        <div className="demo-window" style={{ maxWidth:680, margin:'0 auto', background:T.chatBg, border:`1px solid ${T.border2}`, position:'relative', overflow:'hidden', boxShadow:T.pricingShadow }}>
          <div style={{ position:'absolute', left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${T.scanline},transparent)`, animation:'scanline 9s linear infinite', pointerEvents:'none', zIndex:2 }} />
          <div style={{ padding:'9px 14px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8, background:T.chatToolbar }}>
            <div style={{ display:'flex', gap:4 }}>
              {['#ff5f57','#febc2e','#28c840'].map((c,i)=><div key={i} style={{ width:8, height:8, borderRadius:'50%', background:c, opacity:.7 }} />)}
            </div>
            <div style={{ flex:1, textAlign:'center', fontSize:9, letterSpacing:'0.15em', color:T.text3, textTransform:'uppercase' }}>Monday — AI Market Intelligence</div>
            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:T.amber, letterSpacing:'0.1em' }}>
              <span style={{ width:4, height:4, borderRadius:'50%', background:T.amber, display:'inline-block', animation:'gpulse 2s ease infinite' }} />
              Listening
            </div>
          </div>
          <div style={{ padding:'14px 16px 8px', display:'flex', flexDirection:'column', gap:10, minHeight:220, background:T.chatBg }}>
            {DEMO_CHAT.slice(0,chatStep).map((msg,i)=>(
              <div key={i} className="msg-in" style={{ display:'flex', flexDirection:'column', alignItems:msg.role==='user'?'flex-end':'flex-start', gap:3 }}>
                <div className="demo-chat-msg" style={{ maxWidth:'88%', padding:'9px 12px', fontSize:'clamp(11px,2.5vw,12px)', lineHeight:1.65, background:msg.role==='user'?T.chatUser:T.chatMonday, border:msg.role==='user'?`1px solid ${T.chatUserBorder}`:`1px solid ${T.chatMondayBorder}`, color:T.text, textAlign:'left' }}>
                  {msg.text}
                </div>
                <div style={{ fontSize:9, letterSpacing:'0.1em', color:T.text3 }}>{msg.role==='monday'?'Monday · just now':'You'}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:'8px 12px 10px', borderTop:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8, background:T.chatToolbar }}>
            <div style={{ width:26, height:26, borderRadius:'50%', background:T.gold, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:T.btnText, flexShrink:0 }}>🎙</div>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:2, height:20 }}>
              {Array.from({length:18},(_,i)=><div key={i} className="wb" style={{ background:T.gold, animationDelay:`${(i%9)*.06}s` }} />)}
            </div>
            <div style={{ fontSize:9, letterSpacing:'0.12em', color:T.gold, textTransform:'uppercase' }}>Listening</div>
          </div>
        </div>
        <p style={{ marginTop:14, fontSize:9, color:T.text3, letterSpacing:'0.15em' }}>CANCEL ANYTIME · 5-DAY FREE TRIAL</p>
      </section>

      {/* ── ASSET CLASSES BAR ── */}
      <div style={{ borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, background:T.bg2, padding:'14px 18px' }}>
        <div className="asset-bar-inner" style={{ maxWidth:900, margin:'0 auto', display:'flex', flexWrap:'wrap', gap:7, justifyContent:'center', alignItems:'center' }}>
          <span style={{ fontSize:9, letterSpacing:'0.2em', color:T.text3, textTransform:'uppercase', marginRight:4, flexShrink:0 }}>Covers →</span>
          {['US Stocks','ETFs','Futures /ES /NQ /CL','Gold & Commodities','Crypto','Forex'].map((a,i)=>(
            <div key={i} style={{ fontSize:10, letterSpacing:'0.06em', color:T.text2, background:T.bg3, border:`1px solid ${T.border2}`, padding:'5px 10px', flexShrink:0 }}>{a}</div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section id="features" ref={el=>{sectionRefs.current['features']=el}} className="section-pad" style={{ padding:'88px 24px' }}>
        <div style={{ maxWidth:1060, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <div style={{ fontSize:9, letterSpacing:'0.25em', color:T.goldDim, marginBottom:14, textTransform:'uppercase' }}>What Monday can do</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(26px,5vw,52px)', fontStyle:'italic', fontWeight:600, color:T.heading, lineHeight:1.15 }}>
              Institutional-grade intelligence.<br />
              <span style={{ color:T.gold, fontWeight:400 }}>Built for real traders.</span>
            </h2>
          </div>
          <div className="features-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:T.border }}>
            {FEATURES.map((f,i)=>(
              <div key={i} style={{ background:T.featBg, border:'1px solid transparent', padding:'22px 20px', transition:'all 0.2s ease', cursor:'default' }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background=T.featHover;el.style.borderColor=isDark?'rgba(201,146,42,.3)':'rgba(160,104,24,.3)'}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background=T.featBg;el.style.borderColor='transparent'}}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                  <span style={{ fontSize:20, color:T.gold }}>{f.icon}</span>
                  <span style={{ fontSize:8, letterSpacing:'0.15em', padding:'2px 6px', border:`1px solid ${T.border2}`, color:T.text3, textTransform:'uppercase' }}>{f.tag}</span>
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:T.heading, marginBottom:8 }}>{f.title}</div>
                <div style={{ fontSize:12, color:T.text2, lineHeight:1.7 }}>{f.desc}</div>
                <div style={{ marginTop:16, height:1, width:24, background:T.gold, opacity:.4 }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" ref={el=>{sectionRefs.current['how-it-works']=el}} className="section-pad" style={{ padding:'88px 24px', background:T.bg2, borderTop:`1px solid ${T.border}` }}>
        <div style={{ maxWidth:1020, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <div style={{ fontSize:9, letterSpacing:'0.25em', color:T.goldDim, marginBottom:14, textTransform:'uppercase' }}>How it works</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(24px,4.5vw,50px)', fontStyle:'italic', fontWeight:600, color:T.heading, lineHeight:1.15 }}>
              Five steps.<br /><span style={{ color:T.gold, fontWeight:400 }}>Infinite market intelligence.</span>
            </h2>
          </div>
          <div className="hiw-grid" style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:1, background:T.border }}>

            {/* Steps column / horizontal tab bar on mobile */}
            <div ref={hiwStepTabsRef} className="hiw-steps-col" style={{ display:'flex', flexDirection:'column' }}>
              {STEPS.map((s,i)=>(
                <div
                  key={i}
                  ref={el => { stepTabRefs.current[i] = el }}
                  className="hiw-step-item"
                  onClick={()=>setActiveStep(i)}
                  style={{ background:activeStep===i?T.stepActive:T.stepInactive, borderLeft:activeStep===i?`3px solid ${T.gold}`:'3px solid transparent', padding:'16px 14px', cursor:'pointer', transition:'all .15s', borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16, fontStyle:'italic', color:activeStep===i?T.gold:`${T.gold}33`, fontWeight:700, lineHeight:1, flexShrink:0, width:24 }}>{s.n}</div>
                    <div style={{ fontSize:11, fontWeight:600, color:activeStep===i?T.heading:T.text3 }}>{s.title}</div>
                  </div>
                  <div style={{ fontSize:10, color:activeStep===i?T.text2:T.text3, lineHeight:1.5, marginTop:4, marginLeft:32 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Content panel */}
            <div ref={hiwContentRef} className="hiw-content-col" style={{ background:T.pageBg, padding:'24px', minHeight:280 }}>
              <div style={{ height:2, background:`linear-gradient(90deg,${T.gold},transparent)`, marginBottom:20, width:['20%','40%','60%','80%','100%'][activeStep], transition:'width .4s ease' }} />

              {activeStep === 0 && (
                <div>
                  <div style={{ fontSize:9, letterSpacing:'0.2em', color:T.goldDim, marginBottom:14, textTransform:'uppercase' }}>Your Watchlist — Live</div>
                  <div style={{ border:`1px solid ${T.border2}`, background:T.bg2 }}>
                    {[{sym:'NVDA',price:'$180.40',chg:'-0.84%',up:false},{sym:'AAPL',price:'$249.94',chg:'-1.69%',up:false},{sym:'AMD',price:'$199.46',chg:'+1.60%',up:true},{sym:'BTC',price:'$84,120',chg:'+1.22%',up:true}].map((tk,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'center', padding:'8px 12px', borderBottom:i<3?`1px solid ${T.border}`:'none', gap:10 }}>
                        <div style={{ fontWeight:700, fontSize:12, width:40, color:tk.up?T.gold:T.red }}>{tk.sym}</div>
                        <div style={{ flex:1, display:'flex', alignItems:'flex-end', gap:1, height:16 }}>
                          {Array.from({length:14},(_,j)=><div key={j} style={{ flex:1, height:`${30+Math.sin(j+i*1.3)*20}%`, background:tk.up?T.gold:T.red, opacity:.35, minHeight:2 }} />)}
                        </div>
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:T.text, width:52, textAlign:'right' }}>{tk.price}</div>
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:tk.up?T.gold:T.red, width:50, textAlign:'right' }}>{tk.chg}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:10, fontSize:9, color:T.text3, letterSpacing:'0.08em' }}>Refreshes every 30 seconds</div>
                </div>
              )}

              {activeStep === 1 && (
                <div>
                  <div style={{ fontSize:9, letterSpacing:'0.2em', color:T.goldDim, marginBottom:14, textTransform:'uppercase' }}>Wake Word Detection</div>
                  <div style={{ border:`1px solid ${T.border2}`, background:T.bg2, padding:'16px' }}>
                    <div style={{ background:T.badgeBg, border:`1px solid ${T.badgeBorder}`, padding:'10px 12px', fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:T.gold, marginBottom:12 }}>
                      "Hey Monday" → wake word detected ✓
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, background:T.bg3, border:`1px solid ${T.border2}`, padding:'9px 12px' }}>
                      <div style={{ width:22, height:22, borderRadius:'50%', background:T.gold, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:T.btnText, flexShrink:0 }}>🎙</div>
                      <div style={{ flex:1, display:'flex', alignItems:'center', gap:2, height:16 }}>
                        {Array.from({length:18},(_,i)=><div key={i} className="wb" style={{ background:T.gold, animationDelay:`${(i%9)*.06}s` }} />)}
                      </div>
                      <div style={{ fontSize:9, color:T.gold, letterSpacing:'0.1em' }}>LISTENING…</div>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div>
                  <div style={{ fontSize:9, letterSpacing:'0.2em', color:T.goldDim, marginBottom:14, textTransform:'uppercase' }}>Live Data — All Sources Fire</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
                    {[{icon:'⊟',label:'Live Prices',detail:'Stocks, ETFs, futures, crypto'},{icon:'◫',label:'News Feed',detail:'Scored for impact & sentiment'},{icon:'◐',label:'Macro Calendar',detail:'CPI, FOMC, NFP, earnings'},{icon:'▦',label:'Order Flow',detail:'Level 2 — block trades, sweeps'}].map((src,i)=>(
                      <div key={i} style={{ background:T.bg2, border:`1px solid ${T.border2}`, padding:'10px', display:'flex', alignItems:'flex-start', gap:7 }}>
                        <div style={{ fontSize:14, color:T.gold, flexShrink:0 }}>{src.icon}</div>
                        <div>
                          <div style={{ fontSize:11, fontWeight:600, color:T.heading, marginBottom:2 }}>{src.label}</div>
                          <div style={{ fontSize:9, color:T.text3 }}>{src.detail}</div>
                        </div>
                        <div style={{ marginLeft:'auto', width:5, height:5, borderRadius:'50%', background:T.gold, animation:'pulse 2s ease infinite', flexShrink:0, marginTop:2 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeStep === 3 && (
                <div>
                  <div style={{ fontSize:9, letterSpacing:'0.2em', color:T.goldDim, marginBottom:14, textTransform:'uppercase' }}>Monday's Response</div>
                  <div style={{ border:`1px solid ${T.border2}`, background:T.bg2, padding:'14px' }}>
                    <div style={{ background:T.chatMonday, border:`1px solid ${T.chatMondayBorder}`, padding:'11px 12px', fontSize:'clamp(11px,2.5vw,12px)', color:T.text, lineHeight:1.7, fontStyle:'italic', fontFamily:"'Cormorant Garamond',serif", marginBottom:10 }}>
                      "NVDA is down 0.84% on moderate volume. AMD is outperforming at +1.60%. 10Y yields at 4.21% are compressing growth multiples across your watchlist."
                    </div>
                    <div style={{ fontSize:9, color:T.text3, letterSpacing:'0.08em' }}>Claude AI · ElevenLabs voice · ~3 seconds end-to-end</div>
                  </div>
                </div>
              )}

              {activeStep === 4 && (
                <div>
                  <div style={{ fontSize:9, letterSpacing:'0.2em', color:T.goldDim, marginBottom:14, textTransform:'uppercase' }}>Scheduled Briefings — Today</div>
                  <div style={{ border:`1px solid ${T.border2}`, background:T.bg2 }}>
                    {[{time:'7:00 AM',label:'Pre-Market Briefing',status:'ready'},{time:'9:35 AM',label:'Open Pulse',status:'ready'},{time:'12:00 PM',label:'Midday Summary',status:'upcoming'},{time:'Auto',label:'CPI Alert',status:'live'},{time:'4:15 PM',label:'End of Day',status:'upcoming'}].map((b,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderBottom:i<4?`1px solid ${T.border}`:'none' }}>
                        <div style={{ width:2, alignSelf:'stretch', background:b.status==='live'?T.red:b.status==='ready'?T.gold:T.goldDim, borderRadius:1, flexShrink:0 }} />
                        <div style={{ fontSize:9, color:T.text3, width:52, flexShrink:0 }}>{b.time}</div>
                        <div style={{ fontSize:12, fontWeight:500, color:T.heading, flex:1 }}>{b.label}</div>
                        <div style={{ fontSize:8, padding:'2px 6px', color:b.status==='live'?T.red:b.status==='ready'?T.gold:T.text3, border:`1px solid ${b.status==='live'?'rgba(201,66,66,.25)':b.status==='ready'?T.badgeBorder:T.border2}`, letterSpacing:'0.08em' }}>
                          {b.status==='ready'?'▶ READY':b.status==='live'?'● LIVE':'⏳'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display:'flex', justifyContent:'space-between', marginTop:18, paddingTop:14, borderTop:`1px solid ${T.border}`, alignItems:'center' }}>
                <button onClick={()=>setActiveStep(Math.max(0,activeStep-1))} disabled={activeStep===0} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, padding:'6px 12px', background:'transparent', border:`1px solid ${T.border2}`, color:activeStep===0?T.border2:T.text2, cursor:activeStep===0?'default':'pointer', letterSpacing:'0.08em' }}>← Prev</button>
                <div style={{ display:'flex', gap:5 }}>
                  {STEPS.map((_,i)=><div key={i} onClick={()=>setActiveStep(i)} style={{ width:i===activeStep?16:5, height:5, background:i===activeStep?T.gold:T.border2, cursor:'pointer', transition:'all .2s', borderRadius:2 }} />)}
                </div>
                <button onClick={()=>setActiveStep(Math.min(4,activeStep+1))} disabled={activeStep===4} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, padding:'6px 12px', background:'transparent', border:`1px solid ${T.border2}`, color:activeStep===4?T.border2:T.text2, cursor:activeStep===4?'default':'pointer', letterSpacing:'0.08em' }}>Next →</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CALENDAR PREVIEW ── */}
      <section className="section-pad-sm" style={{ padding:'72px 24px', borderTop:`1px solid ${T.border}` }}>
        <div style={{ maxWidth:820, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div style={{ fontSize:9, letterSpacing:'0.25em', color:T.goldDim, marginBottom:12, textTransform:'uppercase' }}>High-impact calendar</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(22px,4vw,42px)', fontStyle:'italic', fontWeight:600, color:T.heading }}>
              Know what's coming before it moves markets.
            </h2>
          </div>
          <div style={{ border:`1px solid ${T.border2}`, background:T.calendarBg }}>
            <div style={{ padding:'9px 16px', borderBottom:`1px solid ${T.border}`, fontSize:9, letterSpacing:'0.18em', color:T.text3, textTransform:'uppercase', display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:T.gold, display:'inline-block' }} />
              Today's Events
            </div>
            {[
              { time:'8:30 AM', name:'Initial Jobless Claims',   tag:'JOBS · HIGH',   pip:T.red,     est:'225K', actual:'213K', beat:true  },
              { time:'8:30 AM', name:'Philly Fed Manufacturing', tag:'FED · HIGH',    pip:T.red,     est:'8.5',  actual:null,   countdown:'5h 42m' },
              { time:'8:30 AM', name:'Philly Fed Employment',    tag:'FED · MEDIUM',  pip:T.goldDim, est:'—',    actual:null,   countdown:'5h 42m' },
              { time:'4:30 PM', name:"Fed's Balance Sheet",      tag:'FED · MEDIUM',  pip:T.goldDim, est:'—',    actual:null,   countdown:'13h 42m' },
            ].map((ev,i)=>(
              <div key={i} className="calendar-event" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:i<3?`1px solid ${T.border}`:'none', flexWrap:'wrap' }}>
                <div style={{ width:2, alignSelf:'stretch', background:ev.pip, borderRadius:1, flexShrink:0 }} />
                <div className="calendar-event-time" style={{ fontSize:10, color:T.text3, width:54, flexShrink:0 }}>{ev.time}</div>
                <div style={{ flex:1, minWidth:140 }}>
                  <div style={{ fontSize:'clamp(12px,3vw,13px)', color:T.heading, fontWeight:500 }}>{ev.name}</div>
                  <div style={{ fontSize:9, color:T.text3, letterSpacing:'0.1em', marginTop:2 }}>{ev.tag}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:10, color:T.text3 }}>Est: {ev.est}</div>
                  {ev.actual
                    ? <div style={{ fontSize:11, fontWeight:600, color:ev.beat?T.amber:T.red, marginTop:2 }}>{ev.actual} {ev.beat?'↑ BEAT':'↑ MISS'}</div>
                    : <div style={{ fontSize:10, color:T.goldDim, marginTop:2 }}>⏳ {(ev as any).countdown}</div>
                  }
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign:'center', marginTop:10, fontSize:9, color:T.text3, letterSpacing:'0.1em' }}>
            Actuals populate the moment data drops. Monday speaks the impact immediately.
          </p>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="section-pad-sm" style={{ padding:'72px 24px', background:T.bg2, borderTop:`1px solid ${T.border}` }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:44 }}>
            <div style={{ fontSize:9, letterSpacing:'0.25em', color:T.goldDim, marginBottom:12, textTransform:'uppercase' }}>From traders like you</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(22px,4vw,42px)', fontStyle:'italic', fontWeight:600, color:T.heading }}>They never trade without it.</h2>
          </div>
          <div className="testimonials-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:T.border }}>
            {[
              { name:'Marcus T.', role:'Day Trader, 9 years', hi:'3-minute briefing', text:"I used to spend 45 minutes every morning reading headlines. Monday condenses all of it into a 3-minute briefing. It's like having a Bloomberg terminal that actually talks back." },
              { name:'Sarah K.',  role:'Options Trader',      hi:'real time',         text:'The second CPI dropped, Monday had the actual vs forecast, explained the impact on my positions, and told me which sector was rotating. In real time. Before I opened a chart.' },
              { name:'James L.',  role:'Retail Investor',     hi:'like a friend',     text:"I'm not a professional. I just wanted to understand what was happening to my portfolio. Monday explains it like a friend who happens to know everything about markets." },
            ].map((tst,i)=>(
              <div key={i} style={{ background:T.testimonialBg, padding:'22px 18px' }}>
                <div style={{ fontSize:'clamp(11px,2.5vw,12px)', color:T.text2, lineHeight:1.8, marginBottom:16 }}>
                  "{tst.text.split(tst.hi)[0]}<span style={{ color:T.gold, fontStyle:'italic', fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(13px,3vw,14px)' }}>{tst.hi}</span>{tst.text.split(tst.hi)[1]}"
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:T.bg4, border:`1px solid ${T.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond',serif", fontSize:13, fontStyle:'italic', color:T.gold, flexShrink:0 }}>{tst.name[0]}</div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:T.heading }}>{tst.name}</div>
                    <div style={{ fontSize:9, color:T.text3, letterSpacing:'0.1em', marginTop:1 }}>{tst.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" ref={el=>{sectionRefs.current['pricing']=el}} className="section-pad" style={{ padding:'88px 24px', borderTop:`1px solid ${T.border}` }}>
        <div style={{ maxWidth:840, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:44 }}>
            <div style={{ fontSize:9, letterSpacing:'0.25em', color:T.goldDim, marginBottom:12, textTransform:'uppercase' }}>Pricing</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(24px,4.5vw,48px)', fontStyle:'italic', fontWeight:600, color:T.heading, marginBottom:8 }}>One plan. Everything included.</h2>
            <p style={{ fontSize:12, color:T.text2 }}>No tiers. No feature gates. No gotchas.</p>
          </div>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:32 }}>
            <div className="billing-toggle" style={{ display:'inline-flex', background:T.bg2, border:`1px solid ${T.border2}`, padding:3, gap:3 }}>
              {(['monthly','annual'] as const).map(b=>(
                <div key={b} onClick={()=>setBilling(b)} style={{ padding:'8px 18px', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:600, cursor:'pointer', background:billing===b?T.bg4:'transparent', color:billing===b?T.heading:T.text3, border:billing===b?`1px solid ${T.border2}`:'1px solid transparent', transition:'all .15s', display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap' }}>
                  {b}
                  {b==='annual' && <span style={{ fontSize:8, padding:'1px 5px', background:T.badgeBg, border:`1px solid ${T.badgeBorder}`, color:T.gold }}>2 MO FREE</span>}
                </div>
              ))}
            </div>
          </div>
          <div style={{ background:T.pricingBg, border:`1px solid ${T.pricingBorder}`, position:'relative', overflow:'hidden', boxShadow:T.pricingShadow }}>
            <div style={{ height:2, background:`linear-gradient(90deg,transparent,${T.gold},transparent)` }} />
            <div className="price-inner" style={{ padding:'28px 24px', display:'flex', alignItems:'flex-start', gap:32 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:8, letterSpacing:'0.2em', color:T.gold, background:T.badgeBg, border:`1px solid ${T.badgeBorder}`, padding:'3px 10px', marginBottom:16, textTransform:'uppercase' }}>
                  <span style={{ width:4, height:4, borderRadius:'50%', background:T.gold, display:'inline-block', animation:'pulse 2s ease infinite' }} />
                  Pro Plan · Full Access
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:6 }}>
                  <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(52px,12vw,70px)', fontWeight:700, color:T.gold, lineHeight:1 }}>${price.split('.')[0]}</span>
                  <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(18px,4vw,26px)', color:T.goldDim, fontWeight:500 }}>.{price.split('.')[1]}</span>
                  <span style={{ fontSize:10, color:T.text3 }}>/ mo{billing==='annual'?', billed annually':''}</span>
                </div>
                {billing==='annual' && <div style={{ fontSize:11, color:T.gold, marginBottom:8 }}>You save $159.96/year</div>}
                <p style={{ fontSize:12, color:T.text2, lineHeight:1.65, marginBottom:22, maxWidth:340 }}>
                  Full Monday access — live prices, AI voice, calendar, news, Level 2, briefings, alerts. No limits.
                </p>
                <Link href="/signup" style={{ textDecoration:'none' }}>
                  <div style={{ background:T.gold, color:T.btnText, padding:'13px 28px', fontWeight:700, fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', display:'inline-block', cursor:'pointer' }}>
                    Start 5-Day Free Trial →
                  </div>
                </Link>
                <div style={{ marginTop:10, fontSize:9, color:T.text3 }}>✓ Cancel anytime</div>
              </div>
              <div className="price-features-col" style={{ flexShrink:0, minWidth:220 }}>
                <div style={{ fontSize:9, letterSpacing:'0.18em', color:T.text3, marginBottom:10, textTransform:'uppercase' }}>Everything included</div>
                {['Live prices — all asset classes','AI voice "Hey Monday" wake word','High-impact economic calendar','News feed with sentiment scoring','Level 2 / order flow descriptions','Morning & EOD spoken briefings','Price + macro event alerts','Watchlist (unlimited assets)','All APIs called per question','Conversation history + audio replay'].map((f,i)=>(
                  <div key={i} style={{ display:'flex', gap:7, padding:'5px 0', borderBottom:i<9?`1px solid ${T.footerBorder}`:'none' }}>
                    <span style={{ color:T.gold, fontSize:11, flexShrink:0 }}>✓</span>
                    <span style={{ fontSize:11, color:T.text2 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="comp-grid-wrap" style={{ marginTop:14 }}>
            <div className="comp-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:T.border, minWidth:320 }}>
              {COMPARISONS.map((c,i)=>(
                <div key={i} style={{ background:c.highlight?T.dataRowBg:T.compBg, padding:'12px 10px', textAlign:'center', borderTop:c.highlight?`2px solid ${T.gold}`:'2px solid transparent' }}>
                  <div style={{ fontSize:9, letterSpacing:'0.08em', color:c.highlight?T.gold:T.text3, marginBottom:4, textTransform:'uppercase' }}>{c.name}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(14px,3vw,18px)', fontStyle:'italic', fontWeight:700, color:c.highlight?T.gold:T.text3, marginBottom:3, textDecoration:c.highlight?'none':'line-through' }}>
                    {billing==='annual'?c.annual:c.monthly}<span style={{ fontSize:10, fontStyle:'normal', fontWeight:400 }}>/mo</span>
                  </div>
                  <div style={{ fontSize:9, color:T.text3 }}>{c.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" ref={el=>{sectionRefs.current['faq']=el}} className="section-pad" style={{ padding:'88px 24px', background:T.bg2, borderTop:`1px solid ${T.border}` }}>
        <div style={{ maxWidth:700, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:44 }}>
            <div style={{ fontSize:9, letterSpacing:'0.25em', color:T.goldDim, marginBottom:12, textTransform:'uppercase' }}>Common questions</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(22px,4vw,42px)', fontStyle:'italic', fontWeight:600, color:T.heading }}>Everything you need to know.</h2>
          </div>
          <div style={{ border:`1px solid ${T.border2}` }}>
            {FAQ_ITEMS.map((item,i)=>(
              <div key={i} onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{ borderBottom:i<FAQ_ITEMS.length-1?`1px solid ${T.border}`:'none', background:openFaq===i?T.faqOpen:'transparent', cursor:'pointer', transition:'background 0.15s' }}>
                <div style={{ padding:'16px 18px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:14 }}>
                  <div className="faq-q" style={{ fontSize:'clamp(12px,3vw,13px)', fontWeight:500, color:openFaq===i?T.gold:T.heading, lineHeight:1.5 }}>{item.q}</div>
                  <div style={{ fontSize:18, color:T.text3, flexShrink:0, transition:'transform .2s', transform:openFaq===i?'rotate(45deg)':'none' }}>+</div>
                </div>
                {openFaq===i && <div style={{ padding:'0 18px 14px', fontSize:'clamp(11px,2.5vw,12px)', color:T.text2, lineHeight:1.8 }}>{item.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="section-pad" style={{ padding:'88px 24px', borderTop:`1px solid ${T.border}`, textAlign:'center', position:'relative', overflow:'hidden', backgroundImage:`linear-gradient(${T.gridLine} 1px,transparent 1px),linear-gradient(90deg,${T.gridLine} 1px,transparent 1px)`, backgroundSize:'52px 52px' }}>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'min(600px,90vw)', height:400, background:`radial-gradient(ellipse,${T.glow2} 0%,transparent 65%)`, pointerEvents:'none' }} />
        <div style={{ maxWidth:540, margin:'0 auto', position:'relative' }}>
          <div style={{ fontSize:9, letterSpacing:'0.25em', color:T.goldDim, marginBottom:18, textTransform:'uppercase' }}>Ready to start?</div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(28px,6vw,60px)', fontStyle:'italic', fontWeight:600, lineHeight:1.12, marginBottom:18 }}>
            <span style={{ color:T.heading }}>The market doesn't sleep.</span><br />
            <span style={{ color:T.gold }}>Neither does Monday.</span>
          </h2>
          <p style={{ fontSize:'clamp(12px,3vw,13px)', color:T.text2, marginBottom:30, lineHeight:1.75, letterSpacing:'0.02em' }}>
            $79.99/month. No contracts. Cancel anytime.<br />5-day free trial included.
          </p>
          <div className="hero-buttons" style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <Link href="/signup" style={{ textDecoration:'none' }}>
              <div style={{ background:T.gold, color:T.btnText, padding:'14px 32px', fontWeight:700, fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer' }}>
                Start 5-Day Free Trial →
              </div>
            </Link>
            <div onClick={()=>scrollTo('pricing')} style={{ border:`1px solid ${T.border2}`, color:T.text2, padding:'14px 22px', fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
              View Pricing
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background:T.footerBg, borderTop:`1px solid ${isDark?T.border:'#3a2808'}` }}>
        <div className="footer-grid" style={{ maxWidth:1100, margin:'0 auto', padding:'44px 18px 32px', display:'grid', gridTemplateColumns:'1.6fr 1fr 1fr 1fr', gap:36 }}>
          <div className="footer-brand">
            <div style={{ marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <LogoSvg size={18} />
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontStyle:'italic', color:isDark?'#e8d5a0':'#f0e8d0', fontWeight:600 }}>Hey </span>
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontStyle:'italic', color:isDark?'#c9922a':'#d4a030', fontWeight:700 }}>Monday</span>
            </div>
            <p style={{ fontSize:12, color:T.footerText, lineHeight:1.7, maxWidth:260, marginBottom:14 }}>
              Your AI voice market analyst. Live prices, real-time intelligence, and spoken briefings — for every trader.
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:9, letterSpacing:'0.15em', color:isDark?'#b8860b':'#d4a030', textTransform:'uppercase' }}>
              <span style={{ width:4, height:4, borderRadius:'50%', background:isDark?'#b8860b':'#d4a030', display:'inline-block', animation:'gpulse 2s ease infinite' }} />
              Market intelligence, always on
            </div>
          </div>
          <div>
            <div style={{ fontSize:8, letterSpacing:'0.22em', color:T.footerMuted, marginBottom:12, textTransform:'uppercase' }}>Navigate</div>
            {NAV_SECTIONS.map((s,i)=>(
              <div key={i} onClick={()=>scrollTo(s.id)} style={{ fontSize:12, color:T.footerText, marginBottom:9, cursor:'pointer' }}
                onMouseEnter={e=>(e.currentTarget.style.color=isDark?'#c9922a':'#d4a030')}
                onMouseLeave={e=>(e.currentTarget.style.color=T.footerText)}>{s.label}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize:8, letterSpacing:'0.22em', color:T.footerMuted, marginBottom:12, textTransform:'uppercase' }}>Features</div>
            {['AI Voice Assistant','Live Watchlist','Economic Calendar','News Feed','Level 2 / Order Flow','Daily Briefings'].map((l,i)=>(
              <div key={i} style={{ fontSize:12, color:T.footerText, marginBottom:9 }}>{l}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize:8, letterSpacing:'0.22em', color:T.footerMuted, marginBottom:12, textTransform:'uppercase' }}>Company</div>
            {[{label:'Dashboard',href:'/dashboard'},{label:'Privacy Policy',href:'/privacy'},{label:'Terms of Service',href:'/terms'},{label:'Contact',href:'mailto:legal@heymonday.store'}].map((l,i)=>(
              <Link key={i} href={l.href} style={{ display:'block', fontSize:12, color:T.footerText, marginBottom:9, textDecoration:'none' }}
                onMouseEnter={e=>((e.target as HTMLElement).style.color=isDark?'#c9922a':'#d4a030')}
                onMouseLeave={e=>((e.target as HTMLElement).style.color=T.footerText)}>{l.label}</Link>
            ))}
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:8, letterSpacing:'0.18em', color:T.footerMuted, marginBottom:7, textTransform:'uppercase' }}>Powered by</div>
              {['Claude AI','ElevenLabs','Finnhub','FRED'].map((pw,i)=><div key={i} style={{ fontSize:10, color:T.footerPowered, marginBottom:3 }}>{pw}</div>)}
            </div>
          </div>
        </div>
        <div className="footer-bottom" style={{ borderTop:`1px solid ${isDark?'#2a2618':'#3a2808'}`, padding:'14px 18px', maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
          <div style={{ fontSize:9, color:T.footerMuted, letterSpacing:'0.1em' }}>© 2026 Expedition Way Ventures LLC. All rights reserved.</div>
          <div style={{ fontSize:9, color:T.footerMuted, letterSpacing:'0.08em' }}>Not financial advice. · Past performance does not guarantee future results.</div>
        </div>
      </footer>
    </div>
  )
}