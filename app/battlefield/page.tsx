'use client'

// Battlefield — enhanced standalone order book visualizer
//
// One idea, executed clearly:
//   Left  = buyers (bids) stacked at each price
//   Right = sellers (asks) stacked at each price
//   Center = the price spine
//
// When tape prints hit a level the bar flashes and a hit counter increments.
// "HEAVY WALL", "ΓWALL", "LIGHT" labels annotate what each level means.

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const DARK_C = {
  pageBg:'#080808', panelBg:'#0a0a0a', cardBg:'#0e0e0e',
  border:'rgba(232,184,75,0.18)', borderFt:'rgba(232,184,75,0.08)',
  gold:'#e8b84b', goldFt:'rgba(232,184,75,0.12)',
  green:'#4ade80', greenFt:'rgba(74,222,128,0.14)',
  red:'#f87171', redFt:'rgba(248,113,113,0.14)',
  blue:'#93c5fd', purple:'#c084fc',
  text:'#ffffff', text2:'rgba(255,255,255,0.72)',
  text3:'rgba(255,255,255,0.42)', text4:'rgba(255,255,255,0.20)',
}
const LIGHT_C = {
  pageBg:'#f5f4f1', panelBg:'#ffffff', cardBg:'#eeece8',
  border:'rgba(0,0,0,0.14)', borderFt:'rgba(0,0,0,0.07)',
  gold:'#b8750c', goldFt:'rgba(184,117,12,0.10)',
  green:'#16a34a', greenFt:'rgba(22,163,74,0.12)',
  red:'#dc2626', redFt:'rgba(220,38,38,0.12)',
  blue:'#3b82f6', purple:'#9333ea',
  text:'#1a1a1a', text2:'rgba(0,0,0,0.70)',
  text3:'rgba(0,0,0,0.45)', text4:'rgba(0,0,0,0.22)',
}
type CT = typeof DARK_C

// ── Options gamma walls (from demo chain) ────────────────────────────────────
const GAMMA_WALLS = [
  { strike:535, type:'put'  as const, label:'PUT WALL'  },
  { strike:540, type:'put'  as const, label:'PUT WALL'  },
  { strike:545, type:'call' as const, label:'CALL WALL' },
  { strike:550, type:'call' as const, label:'CALL WALL' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtK = (n:number) => n>=1000 ? `${(n/1000).toFixed(0)}K` : String(n)

// ── Mock data ─────────────────────────────────────────────────────────────────
let _tid = 1
function mockTape(lastPrice:number) {
  const price = Math.round((lastPrice+(Math.random()-0.49)*0.10)*100)/100
  const size  = Math.floor(Math.random()*14000)+100
  const side:'buy'|'sell' = Math.random()>0.5 ? 'buy' : 'sell'
  const dark  = Math.random()<0.07
  const large = size>9000
  return { id:_tid++, ts:Date.now(), price, size, side, dark, large }
}

function mockL2(center:number): {price:number; bid:number; ask:number}[] {
  return Array.from({length:18}, (_,i)=>{
    const price = Math.round((center - 0.36 + i*0.04)*100)/100
    const prox  = 1 - Math.abs(i-9)/9
    const base  = 5000 + prox*85000
    // Occasionally spawn a "wall" 3-4× normal size
    const wall  = Math.random()<0.06 ? 3.5 + Math.random()*2 : 1
    return {
      price,
      bid:  price < center  ? Math.floor(base*(0.4+Math.random()*0.6)*wall) : 0,
      ask:  price >= center ? Math.floor(base*(0.4+Math.random()*0.6)*wall) : 0,
    }
  })
}

// ── Level row ─────────────────────────────────────────────────────────────────
interface LevelRowProps {
  price:number; bid:number; ask:number
  maxBid:number; maxAsk:number; maxBar:number
  isPrice:boolean; isGamma:boolean; gammaLabel:string; gammaType:'call'|'put'|''
  hitCount:number; lastHitSide:'buy'|'sell'|null; lastHitSize:number
  C:CT; isDark:boolean
}
function LevelRow({price,bid,ask,maxBid,maxAsk,maxBar,isPrice,isGamma,gammaLabel,gammaType,hitCount,lastHitSide,lastHitSize,C,isDark}:LevelRowProps) {
  const bidPct = bid/maxBar
  const askPct = ask/maxBar
  const isHeavyBid = bid > maxBid*0.55
  const isHeavyAsk = ask > maxAsk*0.55
  const isThinBid  = bid > 0 && bid < maxBid*0.15
  const isThinAsk  = ask > 0 && ask < maxAsk*0.15

  const rowBg = isPrice
    ? (isDark?'rgba(232,184,75,0.07)':'rgba(184,117,12,0.07)')
    : isGamma
    ? (isDark?'rgba(255,255,255,0.025)':'rgba(0,0,0,0.025)')
    : 'transparent'

  return (
    <div style={{
      display:'grid', gridTemplateColumns:'1fr 90px 1fr',
      alignItems:'center', minHeight:40, paddingTop:2, paddingBottom:2,
      borderBottom:`1px solid ${isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)'}`,
      background:rowBg,
      borderLeft:isPrice?`3px solid ${C.gold}`:isGamma?`3px solid ${gammaType==='call'?C.green:C.red}`:'3px solid transparent',
      position:'relative', overflow:'hidden',
    }}>
      {/* Bid side */}
      <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end',padding:'0 10px 0 8px'}}>
        {/* Label */}
        <div style={{fontSize:10,textAlign:'right',lineHeight:1.3,flexShrink:0}}>
          {isHeavyBid && <div style={{color:C.green,fontWeight:700,fontSize:9,letterSpacing:'0.06em'}}>HEAVY WALL</div>}
          {isThinBid  && <div style={{color:C.text4,fontSize:9}}>light</div>}
          {hitCount>0 && lastHitSide==='sell' && <div style={{color:C.red,fontSize:9,fontWeight:700}}>HIT {hitCount}×</div>}
        </div>
        {/* Size number */}
        {bid>0&&<div style={{fontSize:11,fontFamily:'monospace',color:isHeavyBid?C.green:C.text3,fontWeight:isHeavyBid?700:400,minWidth:32,textAlign:'right',flexShrink:0}}>{fmtK(bid)}</div>}
        {/* Bar */}
        <div style={{flex:1,display:'flex',justifyContent:'flex-end',minHeight:20,alignItems:'center'}}>
          {bid>0&&<div style={{
            width:`${Math.min(bidPct*100,100)}%`, height:isHeavyBid?22:14,
            background:isDark?`rgba(74,222,128,${isHeavyBid?0.50:0.22})`:`rgba(22,163,74,${isHeavyBid?0.48:0.20})`,
            borderRight:`3px solid ${C.green}`,
            borderRadius:'2px 0 0 2px',
            transition:'width 0.6s ease, height 0.3s ease',
            boxShadow:isHeavyBid?(isDark?'2px 0 12px rgba(74,222,128,0.35)':'2px 0 8px rgba(22,163,74,0.25)'):undefined,
          }}/>}
        </div>
      </div>

      {/* Price spine */}
      <div style={{textAlign:'center',padding:'0 4px'}}>
        {isGamma && (
          <div style={{
            fontSize:8, fontWeight:700, letterSpacing:'0.08em',
            color:gammaType==='call'?C.green:C.red, marginBottom:1,
            textTransform:'uppercase',
          }}>Γ {gammaLabel}</div>
        )}
        <div style={{
          fontSize:isPrice?13:11, fontWeight:isPrice?700:400,
          fontFamily:'monospace',
          color:isPrice?C.gold:isGamma?C.text2:C.text3,
        }}>
          ${price.toFixed(2)}
        </div>
        {isPrice && (
          <div style={{fontSize:8,color:C.gold,fontWeight:700,letterSpacing:'0.08em',marginTop:1}}>◄ LIVE</div>
        )}
      </div>

      {/* Ask side */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 8px 0 10px'}}>
        {/* Bar */}
        <div style={{flex:1,display:'flex',justifyContent:'flex-start',minHeight:20,alignItems:'center'}}>
          {ask>0&&<div style={{
            width:`${Math.min(askPct*100,100)}%`, height:isHeavyAsk?22:14,
            background:isDark?`rgba(248,113,113,${isHeavyAsk?0.50:0.22})`:`rgba(220,38,38,${isHeavyAsk?0.48:0.20})`,
            borderLeft:`3px solid ${C.red}`,
            borderRadius:'0 2px 2px 0',
            transition:'width 0.6s ease, height 0.3s ease',
            boxShadow:isHeavyAsk?(isDark?'-2px 0 12px rgba(248,113,113,0.35)':'-2px 0 8px rgba(220,38,38,0.25)'):undefined,
          }}/>}
        </div>
        {/* Size number */}
        {ask>0&&<div style={{fontSize:11,fontFamily:'monospace',color:isHeavyAsk?C.red:C.text3,fontWeight:isHeavyAsk?700:400,minWidth:32,flexShrink:0}}>{fmtK(ask)}</div>}
        {/* Label */}
        <div style={{fontSize:10,lineHeight:1.3,flexShrink:0}}>
          {isHeavyAsk && <div style={{color:C.red,fontWeight:700,fontSize:9,letterSpacing:'0.06em'}}>HEAVY WALL</div>}
          {isThinAsk  && <div style={{color:C.text4,fontSize:9}}>light</div>}
          {hitCount>0 && lastHitSide==='buy' && <div style={{color:C.green,fontSize:9,fontWeight:700}}>THRU {hitCount}×</div>}
        </div>
      </div>

      {/* Price battle line spans full row */}
      {isPrice && (
        <div style={{
          position:'absolute',top:'50%',left:0,right:0,height:1,
          background:isDark?'rgba(232,184,75,0.30)':'rgba(184,117,12,0.30)',
          transform:'translateY(-50%)',pointerEvents:'none',
        }}/>
      )}
    </div>
  )
}

// ── Impact animation overlay ──────────────────────────────────────────────────
interface Impact { id:number; price:number; side:'buy'|'sell'; large:boolean; dark:boolean; born:number }

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BattlefieldPage() {
  const router = useRouter()
  const [isDark,setIsDark] = useState(true)
  useEffect(()=>{
    try{ const p=JSON.parse(localStorage.getItem('heymonday_dashboard_prefs_v1')||'{}')
      if(typeof p.isDark==='boolean') setIsDark(p.isDark) }catch{}
  },[])
  const C = isDark ? DARK_C : LIGHT_C

  const [l2,       setL2      ] = useState<{price:number;bid:number;ask:number}[]>([])
  const [price,    setPrice   ] = useState(543.28)
  const [impacts,  setImpacts ] = useState<Impact[]>([])
  const [hitMap,   setHitMap  ] = useState<Map<number,{count:number;side:'buy'|'sell';size:number}>>(new Map())
  const [stats,    setStats   ] = useState({buy:0,sell:0,large:0,dark:0,delta:0})
  const priceRef = useRef(543.28)

  useEffect(()=>{ setL2(mockL2(priceRef.current)) },[])

  useEffect(()=>{
    const l2Iv = setInterval(()=>{
      setL2(mockL2(priceRef.current))
    },800)

    let buyVol=0,sellVol=0,largeCount=0,darkCount=0
    const tapeIv = setInterval(()=>{
      const e = mockTape(priceRef.current)
      priceRef.current = e.price
      setPrice(e.price)
      if(e.side==='buy') buyVol+=e.size; else sellVol+=e.size
      if(e.large) largeCount++
      if(e.dark)  darkCount++
      setStats({buy:buyVol,sell:sellVol,large:largeCount,dark:darkCount,delta:buyVol-sellVol})

      // Track hits per price level (rounded to nearest $0.04)
      const bucket = Math.round(e.price/0.04)*0.04
      setHitMap(prev=>{
        const next = new Map(prev)
        const cur  = next.get(bucket)??{count:0,side:e.side,size:e.size}
        next.set(bucket,{count:cur.count+1,side:e.side,size:e.size})
        return next
      })

      if(e.large||e.dark) {
        const impact:Impact = {id:e.id,price:e.price,side:e.side,large:e.large,dark:e.dark,born:Date.now()}
        setImpacts(prev=>[...prev,impact].slice(-30))
      }
    },160)

    const cleanIv = setInterval(()=>{
      setImpacts(prev=>prev.filter(i=>Date.now()-i.born<1600))
    },100)

    return()=>{ clearInterval(l2Iv); clearInterval(tapeIv); clearInterval(cleanIv) }
  },[])

  function toggleTheme(){
    const n=!isDark; setIsDark(n)
    try{ const p=JSON.parse(localStorage.getItem('heymonday_dashboard_prefs_v1')||'{}')
      localStorage.setItem('heymonday_dashboard_prefs_v1',JSON.stringify({...p,isDark:n})) }catch{}
  }

  const maxBid = Math.max(...l2.map(l=>l.bid),1)
  const maxAsk = Math.max(...l2.map(l=>l.ask),1)
  const maxBar = Math.max(maxBid,maxAsk)
  const totalVol = stats.buy+stats.sell
  const buyPct   = totalVol>0 ? Math.round(stats.buy/totalVol*100) : 50

  return (
    <div style={{height:'100vh',background:C.pageBg,color:C.text,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <style>{`
        @keyframes rippleOut{0%{transform:scale(1);opacity:0.9}100%{transform:scale(5);opacity:0}}
        @keyframes rippleLg {0%{transform:scale(1);opacity:0.85}100%{transform:scale(8);opacity:0}}
      `}</style>

      {/* Header */}
      <div style={{padding:'9px 18px',borderBottom:`1px solid ${C.border}`,background:C.panelBg,display:'flex',alignItems:'center',gap:16,flexShrink:0,flexWrap:'wrap'}}>
        <button onClick={()=>router.push('/dashboard')} style={{background:'none',border:'none',color:C.text3,cursor:'pointer',fontSize:12,padding:0}}>← Monday</button>
        <span style={{fontSize:13,fontWeight:700,color:C.gold,letterSpacing:'0.08em'}}>BATTLEFIELD</span>
        <span style={{fontSize:18,fontWeight:700,fontFamily:'monospace',color:C.text}}>${price.toFixed(2)}</span>
        <div style={{display:'flex',gap:3,alignItems:'center'}}>
          <div style={{width:60,height:7,background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)',borderRadius:4,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${buyPct}%`,background:C.green,borderRadius:4,transition:'width 0.4s'}}/>
          </div>
          <span style={{fontSize:11,color:C.green,fontWeight:600,fontFamily:'monospace'}}>{buyPct}%</span>
          <span style={{fontSize:10,color:C.text4}}>buy</span>
        </div>
        {stats.large>0&&<span style={{fontSize:11,color:C.gold}}>⚡ {stats.large} large print{stats.large!==1?'s':''}</span>}
        {stats.dark >0&&<span style={{fontSize:11,color:isDark?C.purple:C.purple}}>◆ {stats.dark} dark pool</span>}
        <div style={{marginLeft:'auto'}}>
          <button onClick={toggleTheme} style={{background:'transparent',border:`1px solid ${C.border}`,padding:'5px 10px',color:C.text3,fontSize:13,cursor:'pointer'}}>{isDark?'☀':'◑'}</button>
        </div>
      </div>

      {/* How to read strip */}
      <div style={{padding:'6px 18px',background:isDark?'rgba(232,184,75,0.03)':'rgba(184,117,12,0.04)',borderBottom:`1px solid ${C.borderFt}`,display:'flex',gap:20,fontSize:10,color:C.text3,flexWrap:'wrap',flexShrink:0}}>
        <span><span style={{color:C.green,fontWeight:700}}>Green bars</span> = buyers waiting at that price (bids) — thicker = more buyers</span>
        <span><span style={{color:C.red,fontWeight:700}}>Red bars</span> = sellers waiting at that price (asks) — thicker = more sellers</span>
        <span><span style={{color:C.gold,fontWeight:700}}>HEAVY WALL</span> = institutional-size order — price tends to bounce here</span>
        <span><span style={{color:C.text2,fontWeight:600}}>HIT ×</span> = tape prints landing at this level — wall is being tested</span>
      </div>

      {/* Column headers */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 90px 1fr',padding:'6px 18px 4px',background:C.cardBg,borderBottom:`1px solid ${C.borderFt}`,flexShrink:0}}>
        <div style={{textAlign:'right',fontSize:11,color:C.green,fontWeight:700,paddingRight:10}}>← BUYERS (bids)</div>
        <div style={{textAlign:'center',fontSize:10,color:C.text4}}>PRICE</div>
        <div style={{fontSize:11,color:C.red,fontWeight:700,paddingLeft:10}}>SELLERS (asks) →</div>
      </div>

      {/* L2 rows */}
      <div style={{flex:1,overflowY:'auto',position:'relative'}}>
        {/* Impact animations (absolute positioned) */}
        {impacts.map(imp=>{
          const matchedLevel = l2.find(l=>Math.abs(l.price-imp.price)<0.06)
          if(!matchedLevel) return null
          const idx = l2.indexOf(matchedLevel)
          const col = imp.dark?(isDark?'#c084fc':'#9333ea'):imp.side==='buy'?(isDark?'#4ade80':'#16a34a'):(isDark?'#f87171':'#dc2626')
          return (
            <div key={imp.id} style={{
              position:'absolute',
              top:`${(idx/(l2.length||1))*100}%`,
              left:'50%',transform:'translateX(-50%)',
              pointerEvents:'none',zIndex:10,
            }}>
              <div style={{
                width:imp.large?28:18, height:imp.large?28:18,
                borderRadius:'50%',
                border:`2px solid ${col}`,
                animation:`${imp.large?'rippleLg':'rippleOut'} 1.4s ease-out forwards`,
              }}/>
            </div>
          )
        })}

        {l2.sort((a,b)=>b.price-a.price).map(level=>{
          const isPrice   = Math.abs(level.price-price)<0.02
          const gw        = GAMMA_WALLS.find(g=>Math.abs(g.strike-level.price)<0.10)
          const bucket    = Math.round(level.price/0.04)*0.04
          const hitInfo   = hitMap.get(bucket)
          return (
            <LevelRow
              key={level.price}
              price={level.price} bid={level.bid} ask={level.ask}
              maxBid={maxBid} maxAsk={maxAsk} maxBar={maxBar}
              isPrice={isPrice}
              isGamma={!!gw} gammaLabel={gw?.label??''} gammaType={gw?.type??''}
              hitCount={hitInfo?.count??0}
              lastHitSide={hitInfo?.side??null}
              lastHitSize={hitInfo?.size??0}
              C={C} isDark={isDark}
            />
          )
        })}
      </div>

      {/* Status bar */}
      <div style={{padding:'7px 18px',borderTop:`1px solid ${C.borderFt}`,background:C.panelBg,display:'flex',gap:20,fontSize:10,color:C.text4,alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
        <span>Best bid: <span style={{color:C.green,fontFamily:'monospace',fontWeight:600}}>${Math.max(...l2.filter(l=>l.bid>0).map(l=>l.price),0).toFixed(2)}</span></span>
        <span>Best ask: <span style={{color:C.red,  fontFamily:'monospace',fontWeight:600}}>${Math.min(...l2.filter(l=>l.ask>0).map(l=>l.price),999).toFixed(2)}</span></span>
        <span>Total bid: <span style={{color:C.green,fontFamily:'monospace'}}>{fmtK(l2.reduce((s,l)=>s+l.bid,0))}</span></span>
        <span>Total ask: <span style={{color:C.red,  fontFamily:'monospace'}}>{fmtK(l2.reduce((s,l)=>s+l.ask,0))}</span></span>
        <span style={{marginLeft:'auto',color:stats.delta>0?C.green:C.red,fontWeight:600,fontFamily:'monospace'}}>
          Net flow: {stats.delta>0?'+':''}{fmtK(Math.abs(stats.delta))} {stats.delta>0?'buying':'selling'}
        </span>
      </div>
    </div>
  )
}
