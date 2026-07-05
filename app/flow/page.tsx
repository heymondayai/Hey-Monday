'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Tokens ────────────────────────────────────────────────────────────────────
const DARK_C = {
  pageBg:'#080808', panelBg:'#0a0a0a', cardBg:'#0d0d0d',
  border:'rgba(232,184,75,0.18)', borderFt:'rgba(232,184,75,0.09)',
  gold:'#e8b84b', goldFt:'rgba(232,184,75,0.12)', goldFt2:'rgba(232,184,75,0.06)',
  green:'#4ade80', greenFt:'rgba(74,222,128,0.10)',
  red:'#f87171', redFt:'rgba(248,113,113,0.10)',
  blue:'#93c5fd', text:'#ffffff',
  text2:'rgba(255,255,255,0.75)', text3:'rgba(255,255,255,0.45)', text4:'rgba(255,255,255,0.25)',
  rowBorder:'rgba(255,255,255,0.04)',
}
const LIGHT_C = {
  pageBg:'#f8f7f5', panelBg:'#ffffff', cardBg:'#f0eeeb',
  border:'rgba(0,0,0,0.14)', borderFt:'rgba(0,0,0,0.07)',
  gold:'#b8750c', goldFt:'rgba(184,117,12,0.12)', goldFt2:'rgba(184,117,12,0.06)',
  green:'#16a34a', greenFt:'rgba(22,163,74,0.10)',
  red:'#dc2626', redFt:'rgba(220,38,38,0.10)',
  blue:'#3b82f6', text:'#1a1a1a',
  text2:'rgba(0,0,0,0.72)', text3:'rgba(0,0,0,0.50)', text4:'rgba(0,0,0,0.28)',
  rowBorder:'rgba(0,0,0,0.05)',
}
type CT = typeof DARK_C

// ── Types ─────────────────────────────────────────────────────────────────────
interface StrikeData {
  strike:number; callOI:number; putOI:number; callVol:number; putVol:number
  netSentiment:'bullish'|'bearish'|'neutral'; gammaWall:boolean; gammaRatio:number
  calls:{expiry:string;volume:number;openInterest:number;unusual:boolean}[]
  puts:{expiry:string;volume:number;openInterest:number;unusual:boolean}[]
}
interface VolBucket { price:number; vol:number; ratio:number }
interface UnusualFlow { strike:number; type:'call'|'put'; expiry:string; volume:number; openInterest:number; unusual:boolean }
interface FlowData {
  ticker:string; livePrice:number|null; sessionOpen:number|null
  vwap:number|null; hod:number|null; lod:number|null
  strikes:StrikeData[]; volProfile:VolBucket[]; unusualFlow:UnusualFlow[]; updatedAt:string
}
type FlowView = 'heatmap'|'terrain'|'wells'|'grid'|'gauge'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n:number|null, d=2) => n==null ? '—' : n.toFixed(d)
const fmtK = (n:number) => n>=1000 ? `${(n/1000).toFixed(1)}K` : String(n)

function callBarColor(r:number, dark:boolean) {
  const a = Math.min(r,1)
  return dark ? `rgba(74,222,128,${(0.10+a*0.78).toFixed(2)})` : `rgba(22,163,74,${(0.18+a*0.68).toFixed(2)})`
}
function putBarColor(r:number, dark:boolean) {
  const a = Math.min(r,1)
  return dark ? `rgba(248,113,113,${(0.10+a*0.78).toFixed(2)})` : `rgba(220,38,38,${(0.18+a*0.68).toFixed(2)})`
}

// Smooth bezier path through points
function smoothPath(pts:[number,number][]): string {
  if (!pts.length) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i=1;i<pts.length;i++) {
    const [ax,ay]=pts[i-1],[bx,by]=pts[i]
    d+=` C${ax+(bx-ax)*0.5},${ay} ${bx-(bx-ax)*0.5},${by} ${bx},${by}`
  }
  return d
}

// Arc polygon for gauge zones (avoids SVG arc direction confusion)
function arcPoly(cx:number,cy:number,r:number,t1:number,t2:number,steps=24): [number,number][] {
  const pts:[number,number][] = []
  for (let i=0;i<=steps;i++) {
    const t = t1+(t2-t1)*(i/steps)
    const a = Math.PI*(1-t)
    pts.push([cx+r*Math.cos(a), cy-r*Math.sin(a)])
  }
  return pts
}
function ringPath(cx:number,cy:number,outer:number,inner:number,t1:number,t2:number): string {
  const op = arcPoly(cx,cy,outer,t1,t2)
  const ip = arcPoly(cx,cy,inner,t1,t2).reverse()
  return `M${op[0][0]},${op[0][1]} `+op.slice(1).map(p=>`L${p[0]},${p[1]}`).join(' ')+
    ' '+ip.map(p=>`L${p[0]},${p[1]}`).join(' ')+' Z'
}

// ── Demo data ─────────────────────────────────────────────────────────────────
function ms(s:number,cOI:number,pOI:number,cV:number,pV:number,o:{gw?:boolean;cs?:boolean;ps?:boolean}={}):StrikeData {
  return { strike:s, callOI:cOI, putOI:pOI, callVol:cV, putVol:pV,
    netSentiment:cOI>pOI*1.15?'bullish':pOI>cOI*1.15?'bearish':'neutral',
    gammaWall:!!o.gw, gammaRatio:cOI/Math.max(pOI,1),
    calls:[{expiry:'Jul 18',volume:cV,openInterest:cOI,unusual:!!o.cs}],
    puts: [{expiry:'Jul 18',volume:pV,openInterest:pOI,unusual:!!o.ps}] }
}
const DEMO:FlowData = {
  ticker:'SPY', livePrice:543.28, sessionOpen:540.10,
  vwap:542.15, hod:545.82, lod:538.45,
  strikes:[
    ms(531, 7800,38400, 2100,16800), ms(532, 9200,42600, 2800,18400),
    ms(533,11400,46200, 3200,20200), ms(534,14200,54800, 4100,24200),
    ms(535,18600,72400, 5400,31800,{gw:true,ps:true}),
    ms(536,15800,56000, 4800,23600), ms(537,17600,48400, 5600,20400),
    ms(538,22800,54200, 7400,23200), ms(539,29400,62600, 9200,26800),
    ms(540,46800,91200,13600,40200,{gw:true}),
    ms(541,44200,60800,14200,25600), ms(542,56400,42600,17800,17200),
    ms(543,68200,50400,22400,20800),
    ms(544,54600,36200,16200,13800),
    ms(545,82400,26800,52800, 8600,{gw:true,cs:true}),
    ms(546,64800,21200,19600, 6800), ms(547,52400,17400,15800, 5200),
    ms(548,42800,14200,12600, 3800), ms(549,36200,11600,10400, 3000),
    ms(550,88600,16800,62400, 4800,{gw:true,cs:true}),
    ms(551,56200,11800,13800, 3200), ms(552,42400, 9400, 9200, 2200),
    ms(553,34600, 8000, 7200, 1600), ms(554,26400, 6600, 5200, 1200),
    ms(555,36800, 9200,11600, 2000), ms(556,22400, 5800, 4400,  900),
    ms(557,16800, 4600, 3200,  700), ms(558,12400, 3800, 2400,  500),
  ],
  volProfile:[
    {price:531,vol:16200,ratio:0.13},{price:532,vol:21400,ratio:0.18},
    {price:533,vol:28600,ratio:0.24},{price:534,vol:38200,ratio:0.32},
    {price:535,vol:54600,ratio:0.46},{price:536,vol:68800,ratio:0.57},
    {price:537,vol:84200,ratio:0.70},{price:538,vol:94600,ratio:0.79},
    {price:539,vol:108400,ratio:0.90},{price:540,vol:118200,ratio:0.99},
    {price:541,vol:116000,ratio:0.97},{price:542,vol:120000,ratio:1.00},
    {price:543,vol:114800,ratio:0.96},{price:544,vol:98200,ratio:0.82},
    {price:545,vol:86400,ratio:0.72},{price:546,vol:71200,ratio:0.59},
    {price:547,vol:56800,ratio:0.47},{price:548,vol:44200,ratio:0.37},
    {price:549,vol:34800,ratio:0.29},{price:550,vol:50200,ratio:0.42},
    {price:551,vol:27400,ratio:0.23},{price:552,vol:21200,ratio:0.18},
    {price:553,vol:16800,ratio:0.14},{price:554,vol:13200,ratio:0.11},
    {price:555,vol:11800,ratio:0.10},{price:556,vol:9200,ratio:0.08},
    {price:557,vol:7000,ratio:0.06},{price:558,vol:5400,ratio:0.04},
  ],
  unusualFlow:[
    {strike:550,type:'call',expiry:'Jul 18',volume:62400,openInterest:16800,unusual:true},
    {strike:545,type:'call',expiry:'Jun 28',volume:52800,openInterest:26800,unusual:true},
    {strike:535,type:'put', expiry:'Jul 05',volume:31800,openInterest:24400,unusual:true},
    {strike:540,type:'put', expiry:'Jun 28',volume:40200,openInterest:36200,unusual:true},
  ],
  updatedAt:new Date().toISOString(),
}

// ── VIEW: Terrain ─────────────────────────────────────────────────────────────
function TerrainView({data,C,isDark}:{data:FlowData;C:CT;isDark:boolean}) {
  const S=data.strikes, maxOI=Math.max(...S.flatMap(s=>[s.callOI,s.putOI]),1)
  const W=1000,H=480,pL=70,pR=30,pT=45,pB=48
  const cW=W-pL-pR, halfH=(H-pT-pB)/2, midY=pT+halfH
  const xOf=(i:number)=>pL+(i/(S.length-1))*cW
  const callPts:  [number,number][] = S.map((s,i)=>[xOf(i), midY-(s.callOI/maxOI)*halfH*0.9])
  const putPts:   [number,number][] = S.map((s,i)=>[xOf(i), midY+(s.putOI /maxOI)*halfH*0.9])
  const cOutline=smoothPath(callPts), pOutline=smoothPath(putPts)
  const cFill=`${cOutline} L${xOf(S.length-1)},${midY} L${xOf(0)},${midY} Z`
  const pFill=`${pOutline} L${xOf(S.length-1)},${midY} L${xOf(0)},${midY} Z`
  const priceI=data.livePrice ? S.findIndex(s=>s.strike>=data.livePrice!)-1 : Math.floor(S.length/2)
  const priceX=xOf(Math.max(0,priceI))
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',padding:'12px 16px',gap:8,overflow:'hidden'}}>
      <div style={{fontSize:10,color:C.text3,display:'flex',gap:16}}>
        <span style={{color:C.green}}>▲ Calls (above)</span>
        <span style={{color:C.red}}>▼ Puts (below)</span>
        <span style={{color:C.gold}}>● Gamma wall — price anchors</span>
        <span style={{color:C.gold}}>| Current price</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{flex:1,width:'100%'}} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.green} stopOpacity={isDark?'0.55':'0.40'}/>
            <stop offset="100%" stopColor={C.green} stopOpacity="0.02"/>
          </linearGradient>
          <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.red} stopOpacity="0.02"/>
            <stop offset="100%" stopColor={C.red} stopOpacity={isDark?'0.55':'0.40'}/>
          </linearGradient>
        </defs>
        {[0.25,0.5,0.75,1].map(r=>(
          <g key={r}>
            <line x1={pL} y1={midY-r*halfH*0.9} x2={W-pR} y2={midY-r*halfH*0.9} stroke={C.borderFt} strokeWidth="1" strokeDasharray="3,8"/>
            <line x1={pL} y1={midY+r*halfH*0.9} x2={W-pR} y2={midY+r*halfH*0.9} stroke={C.borderFt} strokeWidth="1" strokeDasharray="3,8"/>
          </g>
        ))}
        <path d={cFill} fill="url(#cg)"/>
        <path d={cOutline} fill="none" stroke={C.green} strokeWidth="2"/>
        <path d={pFill} fill="url(#pg)"/>
        <path d={pOutline} fill="none" stroke={C.red} strokeWidth="2"/>
        <line x1={pL} y1={midY} x2={W-pR} y2={midY} stroke={C.border} strokeWidth="1"/>
        {S.filter(s=>s.gammaWall).map(s=>{
          const i=S.indexOf(s)
          return <g key={s.strike}>
            <circle cx={xOf(i)} cy={callPts[i][1]} r="6" fill={C.gold}/>
            <circle cx={xOf(i)} cy={putPts[i][1]}  r="6" fill={C.gold}/>
          </g>
        })}
        <line x1={priceX} y1={pT} x2={priceX} y2={H-pB} stroke={C.gold} strokeWidth="2" strokeDasharray="6,3"/>
        <text x={priceX} y={pT-8} textAnchor="middle" fill={C.gold} fontSize="11" fontFamily="monospace">${data.livePrice?.toFixed(2)}</text>
        {S.filter((_,i)=>i%4===0).map((s,_,__,i=S.indexOf(s))=>(
          <text key={s.strike} x={xOf(i)} y={H-pB+16} textAnchor="middle" fill={C.text4} fontSize="9" fontFamily="monospace">${s.strike}</text>
        ))}
        <text x={pL-8} y={midY-halfH*0.5} textAnchor="end" fill={C.green} fontSize="10" fontWeight="700">CALLS</text>
        <text x={pL-8} y={midY+halfH*0.5+4} textAnchor="end" fill={C.red}   fontSize="10" fontWeight="700">PUTS</text>
      </svg>
    </div>
  )
}

// ── VIEW: Gravity Wells ───────────────────────────────────────────────────────
function GravityWellsView({data,C,isDark}:{data:FlowData;C:CT;isDark:boolean}) {
  const S=data.strikes
  const maxOI=Math.max(...S.flatMap(s=>[s.callOI,s.putOI]),1)
  const W=680,H=560,cx=W/2,maxR=52
  const minP=S[0].strike, maxP=S[S.length-1].strike, pRange=maxP-minP
  const yOf=(p:number)=>30+(1-(p-minP)/pRange)*(H-60)
  const rOf=(oi:number)=>Math.max(4,Math.sqrt(oi/maxOI)*maxR)
  const priceY=data.livePrice ? yOf(data.livePrice) : H/2
  const vwapY=data.vwap ? yOf(data.vwap) : null
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',padding:'12px 16px',gap:8,overflow:'hidden'}}>
      <div style={{fontSize:10,color:C.text3,display:'flex',gap:16}}>
        <span style={{color:C.green}}>● Calls (right) — bigger circle = more OI</span>
        <span style={{color:C.red}}>● Puts (left) — price pulled toward heavy clusters</span>
        <span style={{color:C.gold}}>— Current price</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{flex:1,width:'100%',maxHeight:'92%'}} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {/* Center price axis */}
        <line x1={cx} y1={20} x2={cx} y2={H-20} stroke={C.border} strokeWidth="1"/>
        {/* Put wells (left) */}
        {S.map(s=>{
          const r=rOf(s.putOI), y=yOf(s.strike)
          return <circle key={`p${s.strike}`} cx={cx-r} cy={y} r={r}
            fill={isDark?'rgba(248,113,113,0.18)':'rgba(220,38,38,0.14)'}
            stroke={s.gammaWall?C.gold:C.red} strokeWidth={s.gammaWall?2:1}
            filter={s.gammaWall?'url(#glow)':undefined}/>
        })}
        {/* Call wells (right) */}
        {S.map(s=>{
          const r=rOf(s.callOI), y=yOf(s.strike)
          return <circle key={`c${s.strike}`} cx={cx+r} cy={y} r={r}
            fill={isDark?'rgba(74,222,128,0.18)':'rgba(22,163,74,0.14)'}
            stroke={s.gammaWall?C.gold:C.green} strokeWidth={s.gammaWall?2:1}
            filter={s.gammaWall?'url(#glow)':undefined}/>
        })}
        {/* VWAP line */}
        {vwapY&&<line x1={20} y1={vwapY} x2={W-20} y2={vwapY} stroke={C.blue} strokeWidth="1" strokeDasharray="4,4" opacity="0.7"/>}
        {/* Current price line */}
        <line x1={20} y1={priceY} x2={W-20} y2={priceY} stroke={C.gold} strokeWidth="2.5"/>
        <circle cx={cx} cy={priceY} r="6" fill={C.gold}/>
        <text x={cx+12} y={priceY-8} fill={C.gold} fontSize="12" fontFamily="monospace" fontWeight="700">${data.livePrice?.toFixed(2)}</text>
        {/* Strike labels */}
        {S.filter(s=>s.gammaWall).map(s=>(
          <text key={s.strike} x={cx} y={yOf(s.strike)+4} textAnchor="middle" fill={C.gold} fontSize="9" fontFamily="monospace" fontWeight="700">${s.strike}</text>
        ))}
        {/* Axis labels */}
        <text x={cx-10} y={18} textAnchor="end" fill={C.red}   fontSize="10" fontWeight="700">PUTS</text>
        <text x={cx+10} y={18} textAnchor="start" fill={C.green} fontSize="10" fontWeight="700">CALLS</text>
        <text x={22} y={priceY-6} fill={C.gold} fontSize="9">price</text>
        {vwapY&&<text x={22} y={vwapY-4} fill={C.blue} fontSize="9">vwap</text>}
      </svg>
    </div>
  )
}

// ── VIEW: Time × Strike Grid ──────────────────────────────────────────────────
const EXPIRIES=[
  {label:'Jun 28',dte:0, sf:0.38,spread:2.5},
  {label:'Jul 18',dte:20,sf:0.68,spread:5},
  {label:'Aug 15',dte:48,sf:0.82,spread:9},
  {label:'Sep 19',dte:83,sf:1.00,spread:14},
]
function TimeGridView({data,C,isDark}:{data:FlowData;C:CT;isDark:boolean}) {
  const S=data.strikes, lp=data.livePrice??543
  const grid=EXPIRIES.map(exp=>S.map(s=>{
    const atm=Math.exp(-((s.strike-lp)**2)/(2*exp.spread**2))
    const cOI=Math.round(s.callOI*exp.sf*(0.4+atm*0.6))
    const pOI=Math.round(s.putOI *exp.sf*(0.4+atm*0.6))
    return {strike:s.strike,net:cOI-pOI,gammaWall:s.gammaWall}
  }))
  const maxNet=Math.max(...grid.flat().map(c=>Math.abs(c.net)),1)
  const cellW=Math.floor(1/S.length*100)
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',padding:'12px 16px',gap:10,overflow:'hidden'}}>
      <div style={{fontSize:10,color:C.text3,display:'flex',gap:16}}>
        <span style={{color:C.green}}>■ Green = more calls (bullish positioning)</span>
        <span style={{color:C.red}}>■ Red = more puts (bearish positioning)</span>
        <span style={{color:C.gold}}>■ Gold outline = gamma wall</span>
      </div>
      <div style={{flex:1,overflowX:'auto',overflowY:'hidden'}}>
        <div style={{display:'flex',flexDirection:'column',gap:4,height:'100%'}}>
          {grid.map((row,ei)=>(
            <div key={ei} style={{display:'flex',alignItems:'center',gap:4,flex:1}}>
              <div style={{width:52,flexShrink:0,fontSize:10,color:C.text3,textAlign:'right',paddingRight:6,lineHeight:1.2}}>
                <div style={{fontWeight:700,color:C.text2}}>{EXPIRIES[ei].label}</div>
                <div style={{fontSize:9,color:C.text4}}>{EXPIRIES[ei].dte===0?'exp':EXPIRIES[ei].dte+'d'}</div>
              </div>
              {row.map(cell=>{
                const norm=cell.net/maxNet
                const abs=Math.abs(norm)
                const isAtm=Math.abs(cell.strike-lp)<1
                const bg=norm>0
                  ? (isDark?`rgba(74,222,128,${(0.08+abs*0.72).toFixed(2)})`:`rgba(22,163,74,${(0.10+abs*0.62).toFixed(2)})`)
                  : (isDark?`rgba(248,113,113,${(0.08+abs*0.72).toFixed(2)})`:`rgba(220,38,38,${(0.10+abs*0.62).toFixed(2)})`)
                return (
                  <div key={cell.strike} title={`${cell.strike} | net: ${cell.net>0?'+':''}${fmtK(cell.net)}`}
                    style={{flex:1,height:'100%',minHeight:40,background:bg,
                      border:`1px solid ${cell.gammaWall?C.gold:isAtm?C.gold+'44':'transparent'}`,
                      boxSizing:'border-box' as const,position:'relative',cursor:'default'}}>
                    {isAtm&&<div style={{position:'absolute',bottom:1,left:'50%',transform:'translateX(-50%)',width:2,height:'100%',background:C.gold,opacity:0.5}}/>}
                  </div>
                )
              })}
            </div>
          ))}
          {/* Strike axis labels */}
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <div style={{width:52,flexShrink:0}}/>
            {S.map((s,i)=>(
              <div key={s.strike} style={{flex:1,fontSize:8,color:i%4===0?C.text4:'transparent',textAlign:'center',fontFamily:'monospace',lineHeight:1}}>
                {i%4===0?s.strike:''}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── VIEW: Gamma Gauge ─────────────────────────────────────────────────────────
function GaugeView({data,C,isDark}:{data:FlowData;C:CT;isDark:boolean}) {
  const S=data.strikes, lp=data.livePrice??543
  const bw=lp*0.01
  const netG=S.reduce((s,st)=>{
    const w=Math.exp(-((st.strike-lp)**2)/(2*bw**2))
    return s+(st.callOI-st.putOI)*w
  },0)
  const maxG=S.reduce((s,st)=>{
    const w=Math.exp(-((st.strike-lp)**2)/(2*bw**2))
    return s+Math.max(st.callOI,st.putOI)*w
  },0)
  const ratio=0.5+(netG/Math.max(maxG,1))*0.45 // clamp 0.05–0.95

  const cx=300,cy=260,outerR=200,innerR=130,needleR=210
  const ZONES=[
    {t1:0,   t2:0.18,col:'#ef4444',label:'Strong Short Γ'},
    {t1:0.18,t2:0.35,col:'#f97316',label:'Short Γ'},
    {t1:0.35,t2:0.47,col:'#eab308',label:'Mild Short Γ'},
    {t1:0.47,t2:0.53,col:'#94a3b8',label:'Neutral'},
    {t1:0.53,t2:0.65,col:'#86efac',label:'Mild Long Γ'},
    {t1:0.65,t2:0.82,col:'#4ade80',label:'Long Γ'},
    {t1:0.82,t2:1.0, col:'#22c55e',label:'Strong Long Γ'},
  ]
  const needleAngle=Math.PI*(1-ratio)
  const nx=cx+needleR*Math.cos(needleAngle)
  const ny=cy-needleR*Math.sin(needleAngle)
  const activeZone=ZONES.find(z=>ratio>=z.t1&&ratio<z.t2)??ZONES[3]
  const totalCalls=S.reduce((s,st)=>s+st.callOI,0)
  const totalPuts=S.reduce((s,st)=>s+st.putOI,0)
  const callPct=Math.round(totalCalls/(totalCalls+totalPuts)*100)
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'16px',gap:16}}>
      <div style={{fontSize:10,color:C.text3,textAlign:'center'}}>
        Net gamma exposure — ATM-weighted. Long Γ = market makers dampen moves. Short Γ = market makers amplify moves.
      </div>
      <svg viewBox="0 0 600 320" style={{width:'100%',maxWidth:600,maxHeight:320}}>
        {ZONES.map(z=>(
          <path key={z.t1} d={ringPath(cx,cy,outerR,innerR,z.t1,z.t2)}
            fill={z.col} opacity={isDark?0.85:0.75}/>
        ))}
        {/* Tick marks */}
        {ZONES.map(z=>{
          const a=Math.PI*(1-z.t1)
          return <line key={`t${z.t1}`}
            x1={cx+(outerR+4)*Math.cos(a)} y1={cy-(outerR+4)*Math.sin(a)}
            x2={cx+(outerR+14)*Math.cos(a)} y2={cy-(outerR+14)*Math.sin(a)}
            stroke={C.text4} strokeWidth="1"/>
        })}
        {/* Center cover */}
        <circle cx={cx} cy={cy} r={innerR-4} fill={C.cardBg}/>
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.gold} strokeWidth="3" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r="10" fill={C.gold}/>
        {/* Reading */}
        <text x={cx} y={cy-20} textAnchor="middle" fill={activeZone.col} fontSize="15" fontWeight="700">{activeZone.label}</text>
        <text x={cx} y={cy+2}  textAnchor="middle" fill={C.text2} fontSize="12" fontFamily="monospace">
          {callPct}% calls / {100-callPct}% puts
        </text>
        <text x={cx} y={cy+20} textAnchor="middle" fill={C.text4} fontSize="10">ATM-weighted net gamma</text>
        {/* Labels */}
        <text x={cx-outerR-18} y={cy+8} textAnchor="middle" fill={C.red}   fontSize="10" fontWeight="700">SHORT</text>
        <text x={cx+outerR+18} y={cy+8} textAnchor="middle" fill={C.green} fontSize="10" fontWeight="700">LONG</text>
      </svg>
      {/* Stats strip */}
      <div style={{display:'flex',gap:24,fontSize:11,color:C.text3}}>
        {[
          {label:'Total Call OI',val:fmtK(totalCalls),color:C.green},
          {label:'Total Put OI', val:fmtK(totalPuts), color:C.red},
          {label:'P/C Ratio',    val:(totalPuts/Math.max(totalCalls,1)).toFixed(2), color:C.gold},
          {label:'Gamma Bias',   val:ratio>0.53?'Long':'ratio<0.47?Short:Neutral', color:activeZone.col},
        ].map(m=>(
          <div key={m.label} style={{textAlign:'center'}}>
            <div style={{color:m.color,fontWeight:700,fontSize:14,fontFamily:'monospace'}}>{m.val}</div>
            <div style={{fontSize:9,color:C.text4,letterSpacing:'0.08em',textTransform:'uppercase'}}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── VIEW: Heatmap (original) ──────────────────────────────────────────────────
function StrikeRow({s,maxOI,livePrice,vwap,hod,lod,C,isDark}:{
  s:StrikeData;maxOI:number;livePrice:number|null;vwap:number|null;hod:number|null;lod:number|null;C:CT;isDark:boolean
}) {
  const isAt=livePrice?Math.abs(s.strike-livePrice)/livePrice<0.005:false
  const isVw=vwap?Math.abs(s.strike-vwap)/vwap<0.005:false
  const isHo=hod?Math.abs(s.strike-hod)/hod<0.005:false
  const isLo=lod?Math.abs(s.strike-lod)/lod<0.005:false
  const cR=maxOI>0?s.callOI/maxOI:0, pR=maxOI>0?s.putOI/maxOI:0
  const cSw=s.calls.some(c=>c.unusual), pSw=s.puts.some(p=>p.unusual)
  const rowBg=isAt?C.goldFt:s.gammaWall?(isDark?'rgba(255,255,255,0.025)':'rgba(0,0,0,0.03)'):'transparent'
  return (
    <div style={{display:'grid',gridTemplateColumns:'80px 1fr 90px 1fr 80px',alignItems:'center',
      borderBottom:`1px solid ${C.rowBorder}`,background:rowBg,
      borderLeft:isAt?`2px solid ${C.gold}`:isVw?`2px solid ${C.blue}40`:'2px solid transparent',
      minHeight:30,padding:'2px 0'}}>
      <div style={{display:'flex',alignItems:'center',gap:4,padding:'0 6px',justifyContent:'flex-end'}}>
        {cSw&&<span style={{color:C.green,fontSize:9,fontWeight:700}}>⚡</span>}
        <span style={{color:C.text3,fontSize:10,fontFamily:'monospace'}}>{fmtK(s.callOI)}</span>
      </div>
      <div style={{padding:'0 4px 0 8px',display:'flex',alignItems:'center'}}>
        <div style={{width:`${cR*100}%`,maxWidth:'100%',height:14,background:callBarColor(cR,isDark),borderRadius:2,minWidth:cR>0?2:0,transition:'width 0.4s'}}/>
        {s.callVol>0&&<span style={{marginLeft:4,color:C.text3,fontSize:9,fontFamily:'monospace',flexShrink:0}}>{fmtK(s.callVol)}v</span>}
      </div>
      <div style={{textAlign:'center',fontFamily:'monospace',fontSize:12,fontWeight:s.gammaWall?700:400,color:isAt?C.gold:s.gammaWall?C.text:C.text2}}>
        ${s.strike}
        {s.gammaWall&&<span style={{color:C.gold,fontSize:9,marginLeft:3}}>●</span>}
        {isHo&&<span style={{color:C.green,fontSize:8,marginLeft:3}}>H</span>}
        {isLo&&<span style={{color:C.red,  fontSize:8,marginLeft:3}}>L</span>}
        {isVw&&<span style={{color:C.blue, fontSize:8,marginLeft:3}}>V</span>}
        {isAt&&<span style={{color:C.gold, fontSize:8,marginLeft:3}}>◄</span>}
      </div>
      <div style={{padding:'0 8px 0 4px',display:'flex',alignItems:'center',flexDirection:'row-reverse'}}>
        <div style={{width:`${pR*100}%`,maxWidth:'100%',height:14,background:putBarColor(pR,isDark),borderRadius:2,minWidth:pR>0?2:0,transition:'width 0.4s',marginLeft:4}}/>
        {s.putVol>0&&<span style={{marginRight:4,color:C.text3,fontSize:9,fontFamily:'monospace',flexShrink:0}}>{fmtK(s.putVol)}v</span>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:4,padding:'0 6px'}}>
        <span style={{color:C.text3,fontSize:10,fontFamily:'monospace'}}>{fmtK(s.putOI)}</span>
        {pSw&&<span style={{color:C.red,fontSize:9,fontWeight:700}}>⚡</span>}
      </div>
    </div>
  )
}
function VolProfile({profile,livePrice,C,isDark}:{profile:VolBucket[];livePrice:number|null;C:CT;isDark:boolean}) {
  if (!profile.length) return null
  return (
    <div style={{width:68,flexShrink:0,overflowY:'auto',borderLeft:`1px solid ${C.border}`,display:'flex',flexDirection:'column',background:C.cardBg}}>
      <div style={{padding:'8px 6px 4px',fontSize:9,color:C.text3,fontWeight:700,letterSpacing:'0.06em',textAlign:'center',borderBottom:`1px solid ${C.borderFt}`,textTransform:'uppercase'}}>Vol</div>
      {profile.map(b=>{
        const near=livePrice?Math.abs(b.price-livePrice)/livePrice<0.005:false
        return <div key={b.price} style={{display:'flex',alignItems:'center',gap:3,padding:'1px 6px',minHeight:20,background:near?C.goldFt2:'transparent'}}>
          <div style={{flex:1,height:10,background:isDark?`rgba(147,197,253,${(0.08+b.ratio*0.65).toFixed(2)})`:`rgba(59,130,246,${(0.15+b.ratio*0.60).toFixed(2)})`,borderRadius:1}}/>
        </div>
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const VIEWS:{id:FlowView;label:string;desc:string}[]=[
  {id:'heatmap',label:'Heat Map',   desc:'OI bars by strike — classic bookmap'},
  {id:'terrain',label:'Terrain',    desc:'Mountain range of call vs put OI'},
  {id:'wells',  label:'Gravity Wells',desc:'OI as gravitational wells around price'},
  {id:'grid',   label:'Time × Strike',desc:'OI heatmap across all expiries'},
  {id:'gauge',  label:'Γ Gauge',    desc:'Net gamma pressure — long vs short'},
]

export default function FlowMapPage() {
  const router=useRouter()
  const [isDark,setIsDark]=useState(true)
  useEffect(()=>{
    try { const p=JSON.parse(localStorage.getItem('heymonday_dashboard_prefs_v1')||'{}')
      if (typeof p.isDark==='boolean') setIsDark(p.isDark) } catch {}
  },[])
  const C=isDark?DARK_C:LIGHT_C
  const [view,setView]=useState<FlowView>('heatmap')
  const [ticker,setTicker]=useState('SPY')
  const [input,setInput]=useState('SPY')
  const [data,setData]=useState<FlowData>(DEMO)
  const [isDemo,setIsDemo]=useState(true)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const pollRef=useRef<ReturnType<typeof setInterval>|null>(null)

  const fetchData=useCallback(async(sym:string)=>{
    setLoading(true);setError('')
    try { const res=await fetch(`/api/flow?ticker=${sym}`);if(!res.ok)throw new Error('Failed');setData(await res.json());setIsDemo(false) }
    catch(e:any){setError(e.message)}finally{setLoading(false)}
  },[])

  useEffect(()=>{
    if(pollRef.current)clearInterval(pollRef.current)
    pollRef.current=setInterval(()=>{if(!isDemo)fetchData(ticker)},120_000)
    return()=>{if(pollRef.current)clearInterval(pollRef.current)}
  },[ticker,isDemo,fetchData])

  const maxOI=Math.max(...data.strikes.map(s=>Math.max(s.callOI,s.putOI)),1)
  const pxChange=data.livePrice&&data.sessionOpen?(data.livePrice-data.sessionOpen)/data.sessionOpen*100:null

  function toggleTheme(){const n=!isDark;setIsDark(n);try{const p=JSON.parse(localStorage.getItem('heymonday_dashboard_prefs_v1')||'{}');localStorage.setItem('heymonday_dashboard_prefs_v1',JSON.stringify({...p,isDark:n}))}catch{}}

  return (
    <div style={{height:'100vh',background:C.pageBg,color:C.text,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'10px 18px',borderBottom:`1px solid ${C.border}`,background:C.panelBg,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap',flexShrink:0}}>
        <button onClick={()=>router.push('/dashboard')} style={{background:'none',border:'none',color:C.text3,cursor:'pointer',fontSize:12,padding:0}}>← Monday</button>
        <div style={{fontSize:13,fontWeight:700,color:C.gold,letterSpacing:'0.08em',textTransform:'uppercase'}}>Options Flow</div>
        <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:'monospace'}}>${fmt(data.livePrice)}</div>
        {pxChange!==null&&<div style={{fontSize:13,color:pxChange>=0?C.green:C.red,fontWeight:600}}>{pxChange>=0?'+':''}{pxChange.toFixed(2)}%</div>}
        <div style={{display:'flex',gap:10,fontSize:11,color:C.text3}}>
          {data.vwap&&<span>VWAP <span style={{color:C.blue,fontFamily:'monospace'}}>${fmt(data.vwap)}</span></span>}
          {data.hod &&<span>HOD <span style={{color:C.green,fontFamily:'monospace'}}>${fmt(data.hod)}</span></span>}
          {data.lod &&<span>LOD <span style={{color:C.red,  fontFamily:'monospace'}}>${fmt(data.lod)}</span></span>}
        </div>
        <form onSubmit={e=>{e.preventDefault();const s=input.toUpperCase().trim();if(s){setTicker(s);fetchData(s)}}} style={{marginLeft:'auto',display:'flex',gap:6}}>
          <input value={input} onChange={e=>setInput(e.target.value.toUpperCase())} style={{background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)',border:`1px solid ${C.border}`,padding:'5px 10px',color:C.text,fontSize:12,width:80,outline:'none'}}/>
          <button type="submit" style={{background:C.goldFt,border:`1px solid ${C.border}`,padding:'5px 14px',color:C.gold,fontSize:12,cursor:'pointer',fontWeight:600}}>Load</button>
        </form>
        <button onClick={toggleTheme} style={{background:'transparent',border:`1px solid ${C.border}`,padding:'5px 9px',color:C.text3,fontSize:13,cursor:'pointer'}}>{isDark?'☀':'◑'}</button>
        {loading&&<div style={{fontSize:11,color:C.text3}}>Refreshing…</div>}
      </div>

      {/* Demo banner */}
      {isDemo&&<div style={{padding:'6px 18px',background:C.goldFt2,borderBottom:`1px solid ${C.border}`,fontSize:11,color:C.gold,display:'flex',gap:8,flexShrink:0}}>
        <span style={{fontWeight:700}}>DEMO</span>
        <span style={{color:C.text3}}>Showing sample SPY data. Load a ticker above for live chain.</span>
      </div>}
      {error&&<div style={{padding:'8px 18px',color:C.red,fontSize:12,flexShrink:0}}>{error}</div>}

      {/* View tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,background:C.cardBg,flexShrink:0,overflowX:'auto'}}>
        {VIEWS.map(v=>(
          <button key={v.id} onClick={()=>setView(v.id)} title={v.desc} style={{
            padding:'9px 18px',background:view===v.id?C.goldFt:'transparent',
            border:'none',borderBottom:view===v.id?`2px solid ${C.gold}`:'2px solid transparent',
            color:view===v.id?C.gold:C.text3,cursor:'pointer',fontSize:12,fontWeight:view===v.id?700:400,
            whiteSpace:'nowrap',flexShrink:0,
          }}>{v.label}</button>
        ))}
      </div>

      {/* View content */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {view==='heatmap'&&(
          <div style={{flex:1,display:'flex',overflow:'hidden'}}>
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{display:'grid',gridTemplateColumns:'80px 1fr 90px 1fr 80px',padding:'8px 0',borderBottom:`1px solid ${C.border}`,background:C.cardBg,flexShrink:0}}>
                {[['OI','right',C.green],['CALLS ▲','center',C.green],['STRIKE','center',C.text3],['PUTS ▼','center',C.red],['OI','left',C.red]].map(([t,a,col],i)=>(
                  <div key={i} style={{textAlign:a as any,padding:i===0?'0 6px':i===4?'0 6px':0,fontSize:10,color:col as string,fontWeight:700,letterSpacing:'0.06em'}}>{t}</div>
                ))}
              </div>
              <div style={{flex:1,overflowY:'auto'}}>
                {data.strikes.map(s=><StrikeRow key={s.strike} s={s} maxOI={maxOI} livePrice={data.livePrice} vwap={data.vwap} hod={data.hod} lod={data.lod} C={C} isDark={isDark}/>)}
              </div>
            </div>
            <VolProfile profile={data.volProfile} livePrice={data.livePrice} C={C} isDark={isDark}/>
          </div>
        )}
        {view==='terrain'&&<TerrainView data={data} C={C} isDark={isDark}/>}
        {view==='wells'  &&<GravityWellsView data={data} C={C} isDark={isDark}/>}
        {view==='grid'   &&<TimeGridView data={data} C={C} isDark={isDark}/>}
        {view==='gauge'  &&<GaugeView data={data} C={C} isDark={isDark}/>}
      </div>

      {/* Unusual flow — shown for heatmap and terrain */}
      {(view==='heatmap'||view==='terrain')&&data.unusualFlow?.length?(
        <div style={{borderTop:`1px solid ${C.border}`,background:C.cardBg,padding:'8px 18px',flexShrink:0}}>
          <div style={{fontSize:10,color:C.gold,fontWeight:700,letterSpacing:'0.08em',marginBottom:6,textTransform:'uppercase'}}>⚡ Unusual Activity</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {data.unusualFlow.map((f,i)=>(
              <div key={i} style={{background:f.type==='call'?C.greenFt:C.redFt,border:`1px solid ${f.type==='call'?(isDark?'rgba(74,222,128,0.28)':'rgba(22,163,74,0.30)'):(isDark?'rgba(248,113,113,0.28)':'rgba(220,38,38,0.30)')}`,padding:'4px 10px',fontSize:11,display:'flex',gap:8,alignItems:'center'}}>
                <span style={{color:f.type==='call'?C.green:C.red,fontWeight:700,textTransform:'uppercase'}}>{f.type}</span>
                <span style={{color:C.text,fontFamily:'monospace',fontWeight:600}}>${f.strike}</span>
                <span style={{color:C.text3}}>{f.expiry}</span>
                <span style={{color:C.text2,fontFamily:'monospace'}}>{fmtK(f.volume)}v</span>
              </div>
            ))}
          </div>
        </div>
      ):null}

      {/* Legend */}
      {view==='heatmap'&&(
        <div style={{borderTop:`1px solid ${C.borderFt}`,padding:'6px 18px',display:'flex',gap:16,flexWrap:'wrap',fontSize:10,color:C.text4,background:C.panelBg,flexShrink:0}}>
          <span><span style={{color:C.gold}}>●</span> Gamma wall</span>
          <span><span style={{color:C.gold}}>◄</span> Current price</span>
          <span><span style={{color:C.blue}}>V</span> VWAP</span>
          <span><span style={{color:C.green}}>H</span> HOD</span>
          <span><span style={{color:C.red}}>L</span> LOD</span>
          <span>⚡ Sweep (vol {'>'} OI)</span>
        </div>
      )}
    </div>
  )
}
