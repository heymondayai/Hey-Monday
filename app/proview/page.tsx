'use client'

// Pro View — three clear panels, one thing each
//
//  LEFT PANEL  — Options context: where are the gamma walls and what do they mean
//  CENTER      — Battlefield order book (same concept as /battlefield)
//  RIGHT PANEL — Live tape pulse: what is actually executing right now

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const DARK_C = {
  pageBg:'#080808', panelBg:'#0a0a0a', cardBg:'#0e0e0e',
  border:'rgba(232,184,75,0.18)', borderFt:'rgba(232,184,75,0.07)',
  gold:'#e8b84b', goldFt:'rgba(232,184,75,0.10)',
  green:'#4ade80', greenFt:'rgba(74,222,128,0.12)',
  red:'#f87171',   redFt:'rgba(248,113,113,0.12)',
  blue:'#93c5fd',  purple:'#c084fc',
  text:'#ffffff',  text2:'rgba(255,255,255,0.72)',
  text3:'rgba(255,255,255,0.42)', text4:'rgba(255,255,255,0.20)',
}
const LIGHT_C = {
  pageBg:'#f5f4f1', panelBg:'#ffffff', cardBg:'#eeece8',
  border:'rgba(0,0,0,0.14)', borderFt:'rgba(0,0,0,0.07)',
  gold:'#b8750c', goldFt:'rgba(184,117,12,0.10)',
  green:'#16a34a', greenFt:'rgba(22,163,74,0.10)',
  red:'#dc2626',   redFt:'rgba(220,38,38,0.10)',
  blue:'#3b82f6',  purple:'#9333ea',
  text:'#1a1a1a',  text2:'rgba(0,0,0,0.70)',
  text3:'rgba(0,0,0,0.45)', text4:'rgba(0,0,0,0.22)',
}
type CT = typeof DARK_C

const fmtK = (n:number) => n>=1000000 ? `${(n/1000000).toFixed(1)}M` : n>=1000 ? `${(n/1000).toFixed(0)}K` : String(n)

// ── Options chain data (demo) ─────────────────────────────────────────────────
const STRIKES = [
  {strike:531,callOI:7800, putOI:38400,gammaWall:false},
  {strike:532,callOI:9200, putOI:42600,gammaWall:false},
  {strike:533,callOI:11400,putOI:46200,gammaWall:false},
  {strike:534,callOI:14200,putOI:54800,gammaWall:false},
  {strike:535,callOI:18600,putOI:72400,gammaWall:true },
  {strike:536,callOI:15800,putOI:56000,gammaWall:false},
  {strike:537,callOI:17600,putOI:48400,gammaWall:false},
  {strike:538,callOI:22800,putOI:54200,gammaWall:false},
  {strike:539,callOI:29400,putOI:62600,gammaWall:false},
  {strike:540,callOI:46800,putOI:91200,gammaWall:true },
  {strike:541,callOI:44200,putOI:60800,gammaWall:false},
  {strike:542,callOI:56400,putOI:42600,gammaWall:false},
  {strike:543,callOI:68200,putOI:50400,gammaWall:false},
  {strike:544,callOI:54600,putOI:36200,gammaWall:false},
  {strike:545,callOI:82400,putOI:26800,gammaWall:true },
  {strike:546,callOI:64800,putOI:21200,gammaWall:false},
  {strike:547,callOI:52400,putOI:17400,gammaWall:false},
  {strike:548,callOI:42800,putOI:14200,gammaWall:false},
  {strike:549,callOI:36200,putOI:11600,gammaWall:false},
  {strike:550,callOI:88600,putOI:16800,gammaWall:true },
]
const DEMO_PRICE = 543.28

// ── Generators ────────────────────────────────────────────────────────────────
let _tid = 1
function mockTape(lastPrice:number) {
  const price = Math.round((lastPrice+(Math.random()-0.49)*0.10)*100)/100
  const size  = Math.floor(Math.random()*14000)+100
  const side:'buy'|'sell' = Math.random()>0.5 ? 'buy' : 'sell'
  const dark  = Math.random()<0.07
  const large = size>9000
  return {id:_tid++,ts:Date.now(),price,size,side,dark,large}
}

function mockL2(center:number) {
  return Array.from({length:16},(_,i)=>{
    const price = Math.round((center-0.32+i*0.04)*100)/100
    const prox  = 1-Math.abs(i-8)/8
    const base  = 5000+prox*85000
    const wall  = Math.random()<0.06 ? 3.5+Math.random()*2 : 1
    return {
      price,
      bid:  price<center  ? Math.floor(base*(0.4+Math.random()*0.6)*wall) : 0,
      ask:  price>=center ? Math.floor(base*(0.4+Math.random()*0.6)*wall) : 0,
    }
  })
}

// ── LEFT PANEL: Options context ───────────────────────────────────────────────
function OptionsPanel({price,C,isDark}:{price:number;C:CT;isDark:boolean}) {
  const walls = STRIKES.filter(s=>s.gammaWall).map(s=>({
    ...s,
    net:s.callOI-s.putOI,
    dist:Math.abs(s.strike-price),
    above:s.strike>price,
  })).sort((a,b)=>a.dist-b.dist)

  const pcRatio = STRIKES.reduce((s,st)=>s+st.putOI,0)/Math.max(STRIKES.reduce((s,st)=>s+st.callOI,0),1)
  const bias    = pcRatio>1.1?'bearish':pcRatio<0.9?'bullish':'neutral'

  const nearestCallWall = walls.find(w=>w.above&&w.net>0)
  const nearestPutWall  = walls.find(w=>!w.above&&w.net<0)

  return (
    <div style={{width:210,flexShrink:0,borderRight:`1px solid ${C.border}`,background:C.cardBg,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'10px 14px 8px',borderBottom:`1px solid ${C.borderFt}`,flexShrink:0}}>
        <div style={{fontSize:10,fontWeight:700,color:C.gold,letterSpacing:'0.10em',textTransform:'uppercase',marginBottom:8}}>Options Context</div>
        {/* P/C ratio */}
        <div style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:10,color:C.text3}}>Put/Call ratio</span>
            <span style={{fontSize:11,fontFamily:'monospace',fontWeight:700,color:pcRatio>1.1?C.red:pcRatio<0.9?C.green:C.text2}}>{pcRatio.toFixed(2)}</span>
          </div>
          <div style={{height:5,background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)',borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${Math.min(pcRatio/2*100,100)}%`,background:pcRatio>1.1?C.red:pcRatio<0.9?C.green:C.gold,borderRadius:3,transition:'width 0.4s'}}/>
          </div>
          <div style={{fontSize:10,color:pcRatio>1.1?C.red:pcRatio<0.9?C.green:C.text3,fontWeight:600,marginTop:4}}>
            {bias==='bearish'?'↓ Market positioned bearish':bias==='bullish'?'↑ Market positioned bullish':'→ Neutral positioning'}
          </div>
        </div>
        {/* Nearest walls */}
        {nearestCallWall&&(
          <div style={{marginBottom:6,padding:'7px 10px',background:isDark?'rgba(74,222,128,0.07)':'rgba(22,163,74,0.07)',border:`1px solid ${isDark?'rgba(74,222,128,0.20)':'rgba(22,163,74,0.20)'}`,borderRadius:4}}>
            <div style={{fontSize:9,color:C.green,fontWeight:700,letterSpacing:'0.08em',marginBottom:2}}>CALL WALL ABOVE ↑</div>
            <div style={{fontSize:14,fontFamily:'monospace',fontWeight:700,color:C.green}}>${nearestCallWall.strike}</div>
            <div style={{fontSize:10,color:C.text3,marginTop:2}}>+${(nearestCallWall.strike-price).toFixed(2)} away · {fmtK(nearestCallWall.callOI)} calls</div>
            <div style={{fontSize:9,color:C.text4,marginTop:3,lineHeight:1.4}}>Market makers sell calls here → they must short stock as price rises → natural ceiling</div>
          </div>
        )}
        {nearestPutWall&&(
          <div style={{marginBottom:6,padding:'7px 10px',background:isDark?'rgba(248,113,113,0.07)':'rgba(220,38,38,0.07)',border:`1px solid ${isDark?'rgba(248,113,113,0.20)':'rgba(220,38,38,0.20)'}`,borderRadius:4}}>
            <div style={{fontSize:9,color:C.red,fontWeight:700,letterSpacing:'0.08em',marginBottom:2}}>PUT WALL BELOW ↓</div>
            <div style={{fontSize:14,fontFamily:'monospace',fontWeight:700,color:C.red}}>${nearestPutWall.strike}</div>
            <div style={{fontSize:10,color:C.text3,marginTop:2}}>${(price-nearestPutWall.strike).toFixed(2)} below · {fmtK(nearestPutWall.putOI)} puts</div>
            <div style={{fontSize:9,color:C.text4,marginTop:3,lineHeight:1.4}}>Market makers sell puts here → they must buy stock as price falls → natural floor</div>
          </div>
        )}
      </div>
      {/* All gamma walls list */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 14px'}}>
        <div style={{fontSize:9,fontWeight:700,color:C.text4,letterSpacing:'0.10em',textTransform:'uppercase',marginBottom:6}}>All Gamma Walls</div>
        {walls.map(w=>{
          const isCall=w.net>0
          return (
            <div key={w.strike} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:`1px solid ${C.borderFt}`}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:isCall?C.green:C.red,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                  <span style={{fontFamily:'monospace',fontSize:12,fontWeight:600,color:w.dist<1?C.text:C.text3}}>${w.strike}</span>
                  <span style={{fontSize:9,color:isCall?C.green:C.red,fontWeight:700}}>{isCall?'CALL':'PUT'}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:1}}>
                  <span style={{fontSize:9,color:C.text4}}>{w.above?'↑':'↓'} {w.dist.toFixed(2)} away</span>
                  <span style={{fontSize:9,color:C.text4,fontFamily:'monospace'}}>{fmtK(Math.max(w.callOI,w.putOI))}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {/* Confluence alert */}
      <div style={{padding:'8px 14px',borderTop:`1px solid ${C.borderFt}`,flexShrink:0}}>
        <div style={{fontSize:9,color:C.gold,fontWeight:700,letterSpacing:'0.06em',marginBottom:4}}>★ CONFLUENCE TIP</div>
        <div style={{fontSize:9,color:C.text3,lineHeight:1.5}}>
          When a HEAVY WALL in the order book (center) lines up with a gamma wall (this panel), that price level is defended by <i>both</i> institutional orders AND market-maker hedging. Highest probability trade.
        </div>
      </div>
    </div>
  )
}

// ── CENTER: Battlefield order book ────────────────────────────────────────────
function BattlefieldCenter({
  l2, price, impacts, hitMap, C, isDark
}: {
  l2:{price:number;bid:number;ask:number}[]
  price:number
  impacts:{id:number;price:number;side:'buy'|'sell';large:boolean;dark:boolean;born:number}[]
  hitMap:Map<number,{count:number;side:'buy'|'sell';size:number}>
  C:CT; isDark:boolean
}) {
  const maxBid  = Math.max(...l2.map(l=>l.bid),1)
  const maxAsk  = Math.max(...l2.map(l=>l.ask),1)
  const maxBar  = Math.max(maxBid,maxAsk)
  const gammaWalls = STRIKES.filter(s=>s.gammaWall)

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
      <div style={{padding:'6px 14px 4px',background:C.cardBg,borderBottom:`1px solid ${C.borderFt}`,display:'grid',gridTemplateColumns:'1fr 90px 1fr',flexShrink:0}}>
        <div style={{textAlign:'right',fontSize:11,color:C.green,fontWeight:700,paddingRight:10}}>← BUYERS (bids)</div>
        <div style={{textAlign:'center',fontSize:10,color:C.text4}}>PRICE</div>
        <div style={{fontSize:11,color:C.red,fontWeight:700,paddingLeft:10}}>SELLERS (asks) →</div>
      </div>
      <div style={{flex:1,overflowY:'auto',position:'relative'}}>
        {/* Impact animations */}
        {impacts.map(imp=>{
          const idx=l2.findIndex(l=>Math.abs(l.price-imp.price)<0.06)
          if(idx<0) return null
          const col=imp.dark?(isDark?'#c084fc':'#9333ea'):imp.side==='buy'?(isDark?'#4ade80':'#16a34a'):(isDark?'#f87171':'#dc2626')
          return (
            <div key={imp.id} style={{position:'absolute',top:`${(idx/l2.length)*100}%`,left:'50%',transform:'translateX(-50%)',pointerEvents:'none',zIndex:10}}>
              <div style={{width:imp.large?32:20,height:imp.large?32:20,borderRadius:'50%',border:`2px solid ${col}`,animation:`${imp.large?'rippleLg':'rippleOut'} 1.4s ease-out forwards`}}/>
            </div>
          )
        })}

        {l2.sort((a,b)=>b.price-a.price).map(level=>{
          const isPrice   = Math.abs(level.price-price)<0.02
          const gw        = gammaWalls.find(g=>Math.abs(g.strike-level.price)<0.15)
          const isHeavyBid= level.bid>maxBid*0.55
          const isHeavyAsk= level.ask>maxAsk*0.55
          const isThinBid = level.bid>0&&level.bid<maxBid*0.15
          const isThinAsk = level.ask>0&&level.ask<maxAsk*0.15
          const bucket    = Math.round(level.price/0.04)*0.04
          const hitInfo   = hitMap.get(bucket)
          const isCall    = gw?(gw.callOI>gw.putOI):false

          const rowBg = isPrice
            ? (isDark?'rgba(232,184,75,0.07)':'rgba(184,117,12,0.06)')
            : gw ? (isDark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.02)')
            : 'transparent'

          return (
            <div key={level.price} style={{
              display:'grid',gridTemplateColumns:'1fr 90px 1fr',
              alignItems:'center',minHeight:38,padding:'2px 0',
              borderBottom:`1px solid ${isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)'}`,
              background:rowBg,
              borderLeft:isPrice?`3px solid ${C.gold}`:gw?`3px solid ${isCall?C.green:C.red}`:'3px solid transparent',
            }}>
              {/* Bid side */}
              <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end',padding:'0 10px 0 6px'}}>
                <div style={{fontSize:10,textAlign:'right',flexShrink:0,lineHeight:1.25}}>
                  {isHeavyBid&&<div style={{color:C.green,fontWeight:700,fontSize:9,letterSpacing:'0.05em'}}>HEAVY WALL</div>}
                  {isThinBid&&<div style={{color:C.text4,fontSize:9}}>light</div>}
                  {hitInfo&&hitInfo.side==='sell'&&hitInfo.count>=2&&<div style={{color:C.red,fontSize:9,fontWeight:700}}>HIT {hitInfo.count}×</div>}
                </div>
                {level.bid>0&&<span style={{fontSize:11,fontFamily:'monospace',color:isHeavyBid?C.green:C.text3,fontWeight:isHeavyBid?700:400,minWidth:30,textAlign:'right',flexShrink:0}}>{fmtK(level.bid)}</span>}
                <div style={{flex:1,display:'flex',justifyContent:'flex-end',alignItems:'center',minHeight:18}}>
                  {level.bid>0&&<div style={{width:`${Math.min(level.bid/maxBar*100,100)}%`,height:isHeavyBid?20:13,background:isDark?`rgba(74,222,128,${isHeavyBid?0.48:0.20})`:`rgba(22,163,74,${isHeavyBid?0.45:0.18})`,borderRight:`3px solid ${C.green}`,borderRadius:'2px 0 0 2px',transition:'width 0.6s ease',boxShadow:isHeavyBid?(isDark?'2px 0 14px rgba(74,222,128,0.30)':'2px 0 8px rgba(22,163,74,0.22)'):undefined}}/>}
                </div>
              </div>

              {/* Price */}
              <div style={{textAlign:'center',padding:'0 2px'}}>
                {gw&&<div style={{fontSize:8,fontWeight:700,letterSpacing:'0.06em',color:isCall?C.green:C.red,marginBottom:1}}>Γ {isCall?'CALL':'PUT'} WALL</div>}
                <div style={{fontSize:isPrice?13:11,fontWeight:isPrice?700:500,fontFamily:'monospace',color:isPrice?C.gold:gw?C.text2:C.text3}}>
                  ${level.price.toFixed(2)}
                </div>
                {isPrice&&<div style={{fontSize:8,color:C.gold,fontWeight:700,letterSpacing:'0.08em',marginTop:1}}>◄ LIVE PRICE</div>}
              </div>

              {/* Ask side */}
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 6px 0 10px'}}>
                <div style={{flex:1,display:'flex',justifyContent:'flex-start',alignItems:'center',minHeight:18}}>
                  {level.ask>0&&<div style={{width:`${Math.min(level.ask/maxBar*100,100)}%`,height:isHeavyAsk?20:13,background:isDark?`rgba(248,113,113,${isHeavyAsk?0.48:0.20})`:`rgba(220,38,38,${isHeavyAsk?0.45:0.18})`,borderLeft:`3px solid ${C.red}`,borderRadius:'0 2px 2px 0',transition:'width 0.6s ease',boxShadow:isHeavyAsk?(isDark?'-2px 0 14px rgba(248,113,113,0.30)':'-2px 0 8px rgba(220,38,38,0.22)'):undefined}}/>}
                </div>
                {level.ask>0&&<span style={{fontSize:11,fontFamily:'monospace',color:isHeavyAsk?C.red:C.text3,fontWeight:isHeavyAsk?700:400,minWidth:30,flexShrink:0}}>{fmtK(level.ask)}</span>}
                <div style={{fontSize:10,flexShrink:0,lineHeight:1.25}}>
                  {isHeavyAsk&&<div style={{color:C.red,fontWeight:700,fontSize:9,letterSpacing:'0.05em'}}>HEAVY WALL</div>}
                  {isThinAsk&&<div style={{color:C.text4,fontSize:9}}>light</div>}
                  {hitInfo&&hitInfo.side==='buy'&&hitInfo.count>=2&&<div style={{color:C.green,fontSize:9,fontWeight:700}}>THRU {hitInfo.count}×</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── RIGHT PANEL: Tape pulse ───────────────────────────────────────────────────
function TapePanel({tape,price,C,isDark}:{
  tape:{id:number;ts:number;price:number;size:number;side:'buy'|'sell';dark:boolean;large:boolean}[]
  price:number; C:CT; isDark:boolean
}) {
  const recent60 = tape.filter(e=>Date.now()-e.ts<60000)
  const buyVol   = recent60.filter(e=>e.side==='buy').reduce((s,e)=>s+e.size,0)
  const sellVol  = recent60.filter(e=>e.side==='sell').reduce((s,e)=>s+e.size,0)
  const totalVol = Math.max(buyVol+sellVol,1)
  const buyPct   = Math.round(buyVol/totalVol*100)
  const largeList= tape.filter(e=>e.large).slice(0,8)
  const darkList = tape.filter(e=>e.dark).slice(0,5)
  const dominant = buyPct>55?'BUYERS':'sellers dominant'
  const domColor = buyPct>55?C.green:buyPct<45?C.red:C.gold

  return (
    <div style={{width:200,flexShrink:0,borderLeft:`1px solid ${C.border}`,background:C.cardBg,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'10px 14px 8px',borderBottom:`1px solid ${C.borderFt}`,flexShrink:0}}>
        <div style={{fontSize:10,fontWeight:700,color:C.gold,letterSpacing:'0.10em',textTransform:'uppercase',marginBottom:8}}>Live Tape Pulse</div>

        {/* Buy/sell pressure */}
        <div style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
            <span style={{fontSize:10,color:C.text3}}>Last 60 seconds</span>
            <span style={{fontSize:11,fontWeight:700,color:domColor,fontFamily:'monospace'}}>{buyPct}% buy</span>
          </div>
          <div style={{height:8,background:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.07)',borderRadius:4,overflow:'hidden',display:'flex'}}>
            <div style={{width:`${buyPct}%`,background:C.green,borderRadius:'4px 0 0 4px',transition:'width 0.5s'}}/>
            <div style={{flex:1,background:C.red,borderRadius:'0 4px 4px 0'}}/>
          </div>
          <div style={{fontSize:11,color:domColor,fontWeight:700,marginTop:5}}>
            {buyPct>55?'↑ BUYERS IN CONTROL':buyPct<45?'↓ SELLERS IN CONTROL':'→ BALANCED — wait for signal'}
          </div>
        </div>

        {/* Volume stats */}
        <div style={{display:'flex',gap:4,marginBottom:8}}>
          <div style={{flex:1,padding:'6px 8px',background:isDark?'rgba(74,222,128,0.07)':'rgba(22,163,74,0.07)',border:`1px solid ${isDark?'rgba(74,222,128,0.15)':'rgba(22,163,74,0.15)'}`,borderRadius:4}}>
            <div style={{fontSize:9,color:C.green,fontWeight:700,marginBottom:2}}>BUY VOL</div>
            <div style={{fontSize:13,fontFamily:'monospace',fontWeight:700,color:C.green}}>{fmtK(buyVol)}</div>
          </div>
          <div style={{flex:1,padding:'6px 8px',background:isDark?'rgba(248,113,113,0.07)':'rgba(220,38,38,0.07)',border:`1px solid ${isDark?'rgba(248,113,113,0.15)':'rgba(220,38,38,0.15)'}`,borderRadius:4}}>
            <div style={{fontSize:9,color:C.red,fontWeight:700,marginBottom:2}}>SELL VOL</div>
            <div style={{fontSize:13,fontFamily:'monospace',fontWeight:700,color:C.red}}>{fmtK(sellVol)}</div>
          </div>
        </div>

        {/* Net delta */}
        <div style={{padding:'6px 10px',background:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)',borderRadius:4,marginBottom:4}}>
          <div style={{fontSize:9,color:C.text4,marginBottom:2}}>NET DELTA (buy − sell)</div>
          <div style={{fontSize:14,fontFamily:'monospace',fontWeight:700,color:buyVol>sellVol?C.green:C.red}}>
            {buyVol>=sellVol?'+':'-'}{fmtK(Math.abs(buyVol-sellVol))}
          </div>
        </div>
      </div>

      {/* Large prints */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 14px'}}>
        {largeList.length>0&&<>
          <div style={{fontSize:9,fontWeight:700,color:C.text4,letterSpacing:'0.10em',textTransform:'uppercase',marginBottom:6}}>Large Prints (10K+)</div>
          {largeList.map(e=>(
            <div key={e.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderBottom:`1px solid ${C.borderFt}`}}>
              <div style={{width:4,height:4,borderRadius:'50%',background:e.side==='buy'?C.green:C.red,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                  <span style={{fontFamily:'monospace',fontSize:11,fontWeight:700,color:e.side==='buy'?C.green:C.red}}>{fmtK(e.size)}</span>
                  <span style={{fontSize:9,color:C.text4}}>{e.side.toUpperCase()}</span>
                </div>
                <div style={{fontSize:9,color:C.text4,fontFamily:'monospace'}}>${e.price.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </>}

        {darkList.length>0&&<>
          <div style={{fontSize:9,fontWeight:700,color:C.text4,letterSpacing:'0.10em',textTransform:'uppercase',marginTop:10,marginBottom:6}}>Dark Pool Prints</div>
          {darkList.map(e=>(
            <div key={e.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderBottom:`1px solid ${C.borderFt}`}}>
              <div style={{width:4,height:4,borderRadius:'50%',background:isDark?C.purple:C.purple,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                  <span style={{fontFamily:'monospace',fontSize:11,fontWeight:700,color:isDark?C.purple:C.purple}}>{fmtK(e.size)}</span>
                  <span style={{fontSize:9,color:C.text4}}>DARK</span>
                </div>
                <div style={{fontSize:9,color:C.text4,fontFamily:'monospace'}}>${e.price.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </>}

        {largeList.length===0&&darkList.length===0&&(
          <div style={{fontSize:11,color:C.text4,marginTop:8,lineHeight:1.6}}>Large prints and dark pool activity will appear here as they hit the tape.</div>
        )}
      </div>

      {/* Confluence tip (dynamic) */}
      <div style={{padding:'8px 14px',borderTop:`1px solid ${C.borderFt}`,flexShrink:0}}>
        <div style={{fontSize:9,color:C.text4,lineHeight:1.5}}>
          {buyPct>60?(<><b style={{color:C.green}}>↑ Buyers aggressive.</b> Look for a heavy bid wall in the order book as an entry — buyers are trying to push it up.</>)
          :buyPct<40?(<><b style={{color:C.red}}>↓ Sellers aggressive.</b> Look for a heavy ask wall in the order book as an entry — sellers are trying to push it down.</>)
          :(<><b style={{color:C.gold}}>→ Balanced.</b> No edge yet. Wait for the buy/sell pressure to break clearly above 60% or below 40%.</>)}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProViewPage() {
  const router = useRouter()
  const [isDark,setIsDark] = useState(true)
  useEffect(()=>{
    try{ const p=JSON.parse(localStorage.getItem('heymonday_dashboard_prefs_v1')||'{}')
      if(typeof p.isDark==='boolean') setIsDark(p.isDark) }catch{}
  },[])
  const C = isDark ? DARK_C : LIGHT_C

  const [l2,      setL2     ] = useState<{price:number;bid:number;ask:number}[]>([])
  const [price,   setPrice  ] = useState(DEMO_PRICE)
  const [tape,    setTape   ] = useState<{id:number;ts:number;price:number;size:number;side:'buy'|'sell';dark:boolean;large:boolean}[]>([])
  const [impacts, setImpacts] = useState<{id:number;price:number;side:'buy'|'sell';large:boolean;dark:boolean;born:number}[]>([])
  const [hitMap,  setHitMap ] = useState<Map<number,{count:number;side:'buy'|'sell';size:number}>>(new Map())
  const priceRef = useRef(DEMO_PRICE)

  useEffect(()=>{ setL2(mockL2(priceRef.current)) },[])

  useEffect(()=>{
    const l2Iv=setInterval(()=>setL2(mockL2(priceRef.current)),900)
    const tapeIv=setInterval(()=>{
      const e=mockTape(priceRef.current)
      priceRef.current=e.price
      setPrice(e.price)
      setTape(prev=>[e,...prev].slice(0,400))
      const bucket=Math.round(e.price/0.04)*0.04
      setHitMap(prev=>{const m=new Map(prev);const c=m.get(bucket)??{count:0,side:e.side,size:e.size};m.set(bucket,{count:c.count+1,side:e.side,size:e.size});return m})
      if(e.large||e.dark) setImpacts(prev=>[...prev,{id:e.id,price:e.price,side:e.side,large:e.large,dark:e.dark,born:Date.now()}].slice(-30))
    },160)
    const cleanIv=setInterval(()=>setImpacts(prev=>prev.filter(i=>Date.now()-i.born<1600)),100)
    return()=>{ clearInterval(l2Iv); clearInterval(tapeIv); clearInterval(cleanIv) }
  },[])

  function toggleTheme(){
    const n=!isDark; setIsDark(n)
    try{ const p=JSON.parse(localStorage.getItem('heymonday_dashboard_prefs_v1')||'{}')
      localStorage.setItem('heymonday_dashboard_prefs_v1',JSON.stringify({...p,isDark:n})) }catch{}
  }

  const recentTape=tape.filter(e=>Date.now()-e.ts<60000)
  const buyPct=recentTape.length>0?Math.round(recentTape.filter(e=>e.side==='buy').length/recentTape.length*100):50

  return (
    <div style={{height:'100vh',background:C.pageBg,color:C.text,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <style>{`
        @keyframes rippleOut{0%{transform:scale(1);opacity:0.9}100%{transform:scale(5);opacity:0}}
        @keyframes rippleLg {0%{transform:scale(1);opacity:0.85}100%{transform:scale(8);opacity:0}}
      `}</style>
      {/* Header */}
      <div style={{padding:'9px 18px',borderBottom:`1px solid ${C.border}`,background:C.panelBg,display:'flex',alignItems:'center',gap:16,flexShrink:0,flexWrap:'wrap'}}>
        <button onClick={()=>router.push('/dashboard')} style={{background:'none',border:'none',color:C.text3,cursor:'pointer',fontSize:12,padding:0}}>← Monday</button>
        <span style={{fontSize:13,fontWeight:700,color:C.gold,letterSpacing:'0.08em'}}>PRO VIEW</span>
        <div style={{height:14,width:1,background:C.border}}/>
        <span style={{fontSize:11,color:C.text3}}>Options Context</span>
        <span style={{fontSize:10,color:C.text4}}>+</span>
        <span style={{fontSize:11,color:C.text3}}>Order Book</span>
        <span style={{fontSize:10,color:C.text4}}>+</span>
        <span style={{fontSize:11,color:C.text3}}>Live Tape</span>
        <span style={{fontSize:18,fontWeight:700,fontFamily:'monospace',color:C.text,marginLeft:8}}>${price.toFixed(2)}</span>
        <div style={{display:'flex',gap:4,alignItems:'center',marginLeft:4}}>
          <div style={{width:52,height:6,background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)',borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${buyPct}%`,background:C.green,borderRadius:3,transition:'width 0.4s'}}/>
          </div>
          <span style={{fontSize:10,color:buyPct>55?C.green:buyPct<45?C.red:C.gold,fontWeight:600}}>{buyPct}% buy</span>
        </div>
        <div style={{marginLeft:'auto'}}>
          <button onClick={toggleTheme} style={{background:'transparent',border:`1px solid ${C.border}`,padding:'5px 10px',color:C.text3,fontSize:13,cursor:'pointer'}}>{isDark?'☀':'◑'}</button>
        </div>
      </div>

      {/* Three-panel body */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        <OptionsPanel  price={price} C={C} isDark={isDark}/>
        <BattlefieldCenter l2={l2} price={price} impacts={impacts} hitMap={hitMap} C={C} isDark={isDark}/>
        <TapePanel tape={tape} price={price} C={C} isDark={isDark}/>
      </div>
    </div>
  )
}
