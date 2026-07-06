'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK_C = {
  pageBg:'#080808', panelBg:'#0a0a0a', cardBg:'#0d0d0d',
  border:'rgba(232,184,75,0.18)', borderFt:'rgba(232,184,75,0.09)',
  gold:'#e8b84b', goldFt:'rgba(232,184,75,0.08)',
  green:'#4ade80', greenFt:'rgba(74,222,128,0.09)',
  red:'#f87171',  redFt:'rgba(248,113,113,0.09)',
  blue:'#93c5fd', blueFt:'rgba(147,197,253,0.06)',
  purple:'#c084fc',
  text:'#ffffff', text2:'rgba(255,255,255,0.75)',
  text3:'rgba(255,255,255,0.45)', text4:'rgba(255,255,255,0.25)',
  rowBorder:'rgba(255,255,255,0.03)', darkPoolBg:'rgba(147,197,253,0.05)',
  narrationBg:'rgba(255,255,255,0.04)', inputBg:'rgba(255,255,255,0.06)',
  pausedBg:'rgba(232,184,75,0.15)', unpausedBg:'rgba(255,255,255,0.05)',
}
const LIGHT_C = {
  pageBg:'#f8f7f5', panelBg:'#ffffff', cardBg:'#f0eeeb',
  border:'rgba(0,0,0,0.14)', borderFt:'rgba(0,0,0,0.07)',
  gold:'#b8750c', goldFt:'rgba(184,117,12,0.09)',
  green:'#16a34a', greenFt:'rgba(22,163,74,0.09)',
  red:'#dc2626',  redFt:'rgba(220,38,38,0.09)',
  blue:'#3b82f6', blueFt:'rgba(59,130,246,0.07)',
  purple:'#9333ea',
  text:'#1a1a1a', text2:'rgba(0,0,0,0.72)',
  text3:'rgba(0,0,0,0.50)', text4:'rgba(0,0,0,0.28)',
  rowBorder:'rgba(0,0,0,0.05)', darkPoolBg:'rgba(59,130,246,0.06)',
  narrationBg:'rgba(0,0,0,0.03)', inputBg:'rgba(0,0,0,0.05)',
  pausedBg:'rgba(184,117,12,0.12)', unpausedBg:'rgba(0,0,0,0.04)',
}
type CT = typeof DARK_C

// ── Types ─────────────────────────────────────────────────────────────────────
interface TapeEntry {
  id:number; time:string; ts:number; price:number; size:number
  side:'buy'|'sell'|'unknown'; exchange:string; condition:string
  large:boolean; dark:boolean; narrative:string
}
interface L2Level { price:number; bidSize:number; askSize:number }
type TapeView = 'table'|'ekg'|'particles'|'clusters'|'timeline'|'battlefield'|'seismic'

// ── Mock data ─────────────────────────────────────────────────────────────────
let mockId=1
function generateMockEntry(lastPrice:number):TapeEntry {
  const price=Math.round((lastPrice+(Math.random()-0.49)*0.15)*100)/100
  const size=Math.floor(Math.random()*15000)+100
  const side:'buy'|'sell'=Math.random()>0.5?'buy':'sell'
  const large=size>10000
  const dark=Math.random()<0.08
  let narrative=''
  if(large&&side==='buy') narrative=`Large ${size.toLocaleString()} bid lift at $${price} — institutional buying`
  else if(large)          narrative=`${size.toLocaleString()} shares hitting bid at $${price} — institutional distribution`
  else if(dark)           narrative=`Dark pool print: ${size.toLocaleString()} @ $${price}`
  const now=new Date()
  const time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
  return {id:mockId++,time,ts:Date.now(),price,size,side,exchange:dark?'D':'N',condition:'@',large,dark,narrative}
}
function generateMockL2(center:number):L2Level[] {
  return Array.from({length:6},(_,i)=>({
    price:Math.round((center-0.10+i*0.04)*100)/100,
    bidSize:Math.floor(Math.random()*50000)+500,
    askSize:Math.floor(Math.random()*50000)+500,
  }))
}

// ── VIEW: EKG Heartbeat ───────────────────────────────────────────────────────
function EKGView({tape,C,isDark}:{tape:TapeEntry[];C:CT;isDark:boolean}) {
  const entries=tape.slice(0,200)
  if(!entries.length) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:C.text4,fontSize:12}}>Waiting for prints…</div>
  const W=1200,H=360,pT=24,pB=28,pL=6,pR=6
  const cH=(H-pT-pB)/2
  const midY=pT+cH
  const xOf=(i:number)=>pR+(i/(entries.length-1||1))*(W-pL-pR)
  const maxS=Math.max(...entries.map(e=>e.size))
  const heightOf=(e:TapeEntry)=>{
    const base=Math.log10(Math.max(e.size,100))/Math.log10(maxS)
    return Math.max(4,base*cH*0.9)
  }
  return (
    <div style={{flex:1,overflow:'hidden',padding:'8px 12px',display:'flex',flexDirection:'column',gap:6}}>
      <div style={{fontSize:10,color:C.text3,display:'flex',gap:16}}>
        <span style={{color:C.green}}>↑ Buy print</span>
        <span style={{color:C.red}}>↓ Sell print</span>
        <span style={{color:C.purple}}>◆ Dark pool</span>
        <span style={{color:C.text4}}>Height = log(size) — wider spike = larger print</span>
      </div>
      <div style={{flex:1,overflowX:'auto',overflowY:'hidden'}}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'100%',minWidth:600}} preserveAspectRatio="xMidYMid meet">
          <line x1={pL} y1={midY} x2={W-pR} y2={midY} stroke={C.border} strokeWidth="1"/>
          {[0.25,0.5,0.75,1.0].map(r=><line key={r}
            x1={pL} y1={midY-r*cH*0.9} x2={W-pR} y2={midY-r*cH*0.9}
            stroke={C.borderFt} strokeWidth="1" strokeDasharray="2,8"/>)}
          {entries.map((e,i)=>{
            const x=xOf(entries.length-1-i)
            const h=heightOf(e)
            const opacity=Math.max(0.10,1-(i/entries.length)*0.85)
            const col=e.dark?C.purple:e.side==='buy'?C.green:C.red
            const up=e.side==='buy'||e.dark
            return <g key={e.id}>
              <rect x={x-1} y={up?midY-h:midY} width={e.large?3:1.5} height={h}
                fill={col} opacity={opacity}/>
              {e.large&&<circle cx={x} cy={up?midY-h-4:midY+h+4} r="3" fill={col} opacity={opacity}/>}
            </g>
          })}
          <text x={W-pR-2} y={midY-6} textAnchor="end" fill={C.green} fontSize="9">BUY ↑</text>
          <text x={W-pR-2} y={midY+14} textAnchor="end" fill={C.red}   fontSize="9">SELL ↓</text>
        </svg>
      </div>
    </div>
  )
}

// ── VIEW: Particle Stream ─────────────────────────────────────────────────────
interface Particle {
  x:number; y:number; vx:number; vy:number; life:number; maxLife:number
  col:string; r:number; large:boolean
}
function ParticleView({tape,C,isDark}:{tape:TapeEntry[];C:CT;isDark:boolean}) {
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const stateRef=useRef<Particle[]>([])
  const lastIdRef=useRef(0)
  const rafRef=useRef<number>(0)

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext('2d');if(!ctx)return
    let running=true
    const FADE_MS=2200
    const tick=()=>{
      if(!running)return
      const W=canvas.width,H=canvas.height
      // spawn new particles from new tape entries
      const newEntries=tape.filter(e=>e.id>lastIdRef.current)
      newEntries.slice(-12).forEach(e=>{
        const count=e.dark?8:e.large?5:2
        const col=e.dark?C.purple:e.side==='buy'?C.green:C.red
        for(let j=0;j<count;j++){
          const r=e.large?4+Math.random()*3:e.dark?3:1.5+Math.random()*1.5
          stateRef.current.push({
            x:W*0.4+Math.random()*W*0.2,
            y:H/2+(Math.random()-0.5)*60,
            vx:(Math.random()-0.5)*1.2,
            vy:e.side==='buy'?(-1.2-Math.random()*1.5):(1.2+Math.random()*1.5),
            life:FADE_MS, maxLife:FADE_MS,
            col, r, large:e.large||e.dark,
          })
        }
      })
      if(newEntries.length) lastIdRef.current=tape[0]?.id??0

      ctx.fillStyle=isDark?'rgba(8,8,8,0.22)':'rgba(248,247,245,0.22)'
      ctx.fillRect(0,0,W,H)
      const alive:Particle[]=[]
      stateRef.current.forEach(p=>{
        p.life-=16;p.x+=p.vx;p.y+=p.vy
        p.vy*=0.98;p.vx*=0.99
        if(p.life<=0)return
        alive.push(p)
        const alpha=(p.life/p.maxLife)*0.9
        ctx.globalAlpha=alpha
        ctx.beginPath()
        ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
        ctx.fillStyle=p.col
        ctx.fill()
        if(p.large){
          ctx.globalAlpha=alpha*0.3
          ctx.beginPath()
          ctx.arc(p.x,p.y,p.r*2.5,0,Math.PI*2)
          ctx.fillStyle=p.col
          ctx.fill()
        }
      })
      stateRef.current=alive
      ctx.globalAlpha=1
      // labels
      ctx.fillStyle=C.text4;ctx.font='10px monospace'
      ctx.fillText('BUY particles drift up   SELL drift down   Dark pool = purple burst',12,20)
      rafRef.current=requestAnimationFrame(tick)
    }
    rafRef.current=requestAnimationFrame(tick)
    return ()=>{running=false;cancelAnimationFrame(rafRef.current)}
  },[tape,C,isDark])

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ro=new ResizeObserver(()=>{
      canvas.width=canvas.offsetWidth
      canvas.height=canvas.offsetHeight
    })
    ro.observe(canvas)
    canvas.width=canvas.offsetWidth
    canvas.height=canvas.offsetHeight
    return()=>ro.disconnect()
  },[])

  return <canvas ref={canvasRef} style={{flex:1,width:'100%',display:'block',background:isDark?'#080808':'#f8f7f5'}}/>
}

// ── VIEW: Cluster Detector ────────────────────────────────────────────────────
function ClusterView({tape,C,isDark}:{tape:TapeEntry[];C:CT;isDark:boolean}) {
  const entries=tape.slice(0,200)
  if(entries.length<5) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:C.text4,fontSize:12}}>Waiting for prints…</div>
  // Group by price bucket $0.25 and sequential groups of 8
  interface Cluster{px:number;ty:number;vol:number;net:number;dark:number;count:number}
  const clusters:Cluster[]=[]
  const bucketSize=0.25,groupSize=8
  for(let gi=0;gi<entries.length;gi+=groupSize){
    const group=entries.slice(gi,gi+groupSize)
    const map=new Map<number,Cluster>()
    group.forEach(e=>{
      const pb=Math.round(e.price/bucketSize)*bucketSize
      const prev=map.get(pb)??{px:pb,ty:gi,vol:0,net:0,dark:0,count:0}
      prev.vol+=e.size
      prev.net+=e.side==='buy'?e.size:-e.size
      prev.dark+=e.dark?e.size:0
      prev.count++
      map.set(pb,prev)
    })
    map.forEach(c=>clusters.push(c))
  }
  const maxV=Math.max(...clusters.map(c=>c.vol),1)
  const allPrices=clusters.map(c=>c.px)
  const minP=Math.min(...allPrices),maxP=Math.max(...allPrices)
  const pRange=Math.max(maxP-minP,0.5)
  const timeGroups=Math.ceil(entries.length/groupSize)
  const W=900,H=420,pL=48,pR=16,pT=20,pB=28
  const xOf=(ty:number)=>pL+(ty/groupSize/(timeGroups||1))*(W-pL-pR)
  const yOf=(px:number)=>pT+(1-(px-minP)/pRange)*(H-pT-pB)
  const rOf=(vol:number)=>Math.max(5,Math.sqrt(vol/maxV)*38)
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',padding:'8px 12px',gap:6,overflow:'hidden'}}>
      <div style={{fontSize:10,color:C.text3,display:'flex',gap:16}}>
        <span style={{color:C.green}}>● More buying than selling</span>
        <span style={{color:C.red}}>● More selling than buying</span>
        <span style={{color:C.gold}}>● Neutral cluster</span>
        <span style={{color:C.purple}}>· Blue dot = dark pool inside</span>
        <span style={{color:C.text4}}>Size = total volume</span>
      </div>
      <div style={{flex:1,overflow:'hidden'}}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'100%'}} preserveAspectRatio="xMidYMid meet">
          {/* Grid */}
          {[0,.25,.5,.75,1].map(r=>{
            const y=pT+r*(H-pT-pB)
            const p=maxP-r*pRange
            return <g key={r}>
              <line x1={pL} y1={y} x2={W-pR} y2={y} stroke={C.borderFt} strokeWidth="1" strokeDasharray="3,10"/>
              <text x={pL-4} y={y+4} textAnchor="end" fill={C.text4} fontSize="9" fontFamily="monospace">${p.toFixed(2)}</text>
            </g>
          })}
          {/* Clusters */}
          {clusters.map((c,i)=>{
            const x=xOf(c.ty),y=yOf(c.px),r=rOf(c.vol)
            const norm=c.net/(c.vol||1)
            const col=norm>0.15?C.green:norm<-0.15?C.red:C.gold
            const fill=norm>0.15?(isDark?'rgba(74,222,128,0.18)':'rgba(22,163,74,0.15)'):norm<-0.15?(isDark?'rgba(248,113,113,0.18)':'rgba(220,38,38,0.15)'):(isDark?'rgba(232,184,75,0.12)':'rgba(184,117,12,0.12)')
            return <g key={i}>
              <circle cx={x} cy={y} r={r} fill={fill} stroke={col} strokeWidth="1.5" opacity="0.85"/>
              {c.dark>0&&<circle cx={x} cy={y} r={Math.min(r*0.35,8)} fill={C.blue} opacity="0.7"/>}
            </g>
          })}
          {/* Axes */}
          <line x1={pL} y1={pT} x2={pL} y2={H-pB} stroke={C.border} strokeWidth="1"/>
          <text x={W/2} y={H-pB+18} textAnchor="middle" fill={C.text4} fontSize="9">← older  time  newer →</text>
          <text x={pL-32} y={pT+4}   textAnchor="middle" fill={C.text4} fontSize="9">price</text>
        </svg>
      </div>
    </div>
  )
}

// ── VIEW: 60-Second Timeline ──────────────────────────────────────────────────
function TimelineView({tape,C,isDark}:{tape:TapeEntry[];C:CT;isDark:boolean}) {
  const BUCKETS=60
  const now=Date.now()
  const bucketMs=1000
  type Bucket={buy:number;sell:number;dark:number;count:number}
  const buckets:Bucket[]=Array.from({length:BUCKETS},()=>({buy:0,sell:0,dark:0,count:0}))
  tape.forEach(e=>{
    const age=Math.floor((now-e.ts)/bucketMs)
    if(age>=0&&age<BUCKETS){
      const b=buckets[BUCKETS-1-age]
      b.buy+=e.side==='buy'?e.size:0
      b.sell+=e.side==='sell'?e.size:0
      b.dark+=e.dark?e.size:0
      b.count++
    }
  })
  const maxV=Math.max(...buckets.map(b=>b.buy+b.sell),1)
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',padding:'8px 12px',gap:10,overflow:'hidden'}}>
      <div style={{fontSize:10,color:C.text3,display:'flex',gap:16}}>
        <span style={{color:C.green}}>■ Buy volume</span>
        <span style={{color:C.red}}>■ Sell volume</span>
        <span style={{color:C.purple}}>■ Dark pool</span>
        <span style={{color:C.text4}}>Each column = 1 second, last 60 seconds</span>
      </div>
      {/* Heatmap bar */}
      <div style={{height:100,display:'flex',gap:1,alignItems:'flex-end',flexShrink:0}}>
        {buckets.map((b,i)=>{
          const total=b.buy+b.sell
          const norm=total/maxV
          const netBuy=(b.buy-b.sell)/Math.max(total,1)
          const col=b.dark>total*0.3?C.purple:netBuy>0.1?C.green:netBuy<-0.1?C.red:C.gold
          return <div key={i} title={`${i}s ago | buy:${b.buy} sell:${b.sell} dark:${b.dark}`}
            style={{flex:1,background:col,height:`${Math.max(3,norm*100)}%`,opacity:0.7+norm*0.3,borderRadius:'1px 1px 0 0'}}/>
        })}
      </div>
      {/* Tick labels */}
      <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:C.text4,marginTop:-6}}>
        <span>60s ago</span><span>45s</span><span>30s</span><span>15s</span><span>now</span>
      </div>
      {/* Big buy/sell volume bars beneath */}
      <div style={{flex:1,display:'flex',gap:12,overflow:'hidden'}}>
        {(['buy','sell'] as const).map(side=>{
          const vol=buckets.reduce((s,b)=>s+b[side],0)
          const maxSide=Math.max(...buckets.map(b=>b[side]),1)
          const col=side==='buy'?C.green:C.red
          return (
            <div key={side} style={{flex:1,display:'flex',flexDirection:'column',gap:4}}>
              <div style={{fontSize:10,color:col,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>
                {side} — {(vol/1000).toFixed(0)}K shares
              </div>
              <div style={{flex:1,display:'flex',gap:1,alignItems:'flex-end'}}>
                {buckets.map((b,i)=>{
                  const h=b[side]/maxSide
                  return <div key={i} style={{flex:1,background:col,height:`${Math.max(2,h*100)}%`,opacity:0.4+h*0.5,borderRadius:'1px 1px 0 0'}}/>
                })}
              </div>
            </div>
          )
        })}
        {/* Imbalance meter */}
        <div style={{width:120,flexShrink:0,display:'flex',flexDirection:'column',gap:4}}>
          <div style={{fontSize:10,color:C.text3,fontWeight:700,letterSpacing:'0.06em'}}>60s IMBALANCE</div>
          {(()=>{
            const buyV=buckets.reduce((s,b)=>s+b.buy,0)
            const sellV=buckets.reduce((s,b)=>s+b.sell,0)
            const total=Math.max(buyV+sellV,1)
            const buyPct=buyV/total
            return <div style={{flex:1,display:'flex',flexDirection:'column',gap:6,justifyContent:'center'}}>
              <div style={{fontSize:28,fontWeight:700,color:buyPct>0.55?C.green:buyPct<0.45?C.red:C.gold,fontFamily:'monospace',textAlign:'center'}}>
                {Math.round(buyPct*100)}%
              </div>
              <div style={{fontSize:10,color:C.text4,textAlign:'center'}}>
                {buyPct>0.55?'buy dominant':buyPct<0.45?'sell dominant':'neutral'}
              </div>
              <div style={{height:6,background:C.border,borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${buyPct*100}%`,background:buyPct>0.55?C.green:buyPct<0.45?C.red:C.gold,borderRadius:3,transition:'width 0.3s'}}/>
              </div>
            </div>
          })()}
        </div>
      </div>
    </div>
  )
}

// ── VIEW: Battlefield ────────────────────────────────────────────────────────
interface Impact{id:number;price:number;side:'buy'|'sell'|'unknown';large:boolean;dark:boolean;born:number}
function BattlefieldView({tape,l2,price,C,isDark}:{tape:TapeEntry[];l2:L2Level[];price:number;C:CT;isDark:boolean}) {
  const [impacts,setImpacts]=useState<Impact[]>([])
  const lastIdRef=useRef(0)

  useEffect(()=>{
    const newE=tape.filter(e=>e.id>lastIdRef.current)
    if(newE.length){
      lastIdRef.current=tape[0]?.id??0
      setImpacts(prev=>[...prev,...newE.slice(0,6).map(e=>({id:e.id,price:e.price,side:e.side,large:e.large,dark:e.dark,born:Date.now()}))].slice(-60))
    }
  },[tape])

  useEffect(()=>{
    const iv=setInterval(()=>setImpacts(p=>p.filter(i=>Date.now()-i.born<1800)),80)
    return()=>clearInterval(iv)
  },[])

  const maxSize=Math.max(...l2.flatMap(l=>[l.bidSize,l.askSize]),1)
  const allPrices=[...new Set(l2.map(l=>l.price))].sort((a,b)=>b-a)
  const minP=allPrices[allPrices.length-1]??price-0.40
  const maxP=allPrices[0]??price+0.40
  const pRange=Math.max(maxP-minP,0.2)
  const W=560,H=500,cx=W/2,pL=56,pR=56,pT=30,pB=30
  const plotH=H-pT-pB,maxBarW=(cx-pL)*0.92
  const yOf=(p:number)=>pT+(1-(p-minP)/pRange)*plotH

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',padding:'8px 16px',gap:8,overflow:'hidden'}}>
      <div style={{fontSize:10,color:C.text3,display:'flex',gap:16}}>
        <span style={{color:C.green}}>■ Bids (defending, left)</span>
        <span style={{color:C.red}}>■ Asks (attacking, right)</span>
        <span style={{color:C.gold}}>— Current price battle line</span>
        <span style={{color:C.text4}}>Ripples = live tape prints hitting the book</span>
      </div>
      <div style={{flex:1,overflow:'hidden',position:'relative'}}>
        <style>{`
          @keyframes ripple{0%{r:4;opacity:0.9}100%{r:28;opacity:0}}
          @keyframes bigRipple{0%{r:8;opacity:0.85}100%{r:50;opacity:0}}
          @keyframes darkRipple{0%{r:6;opacity:1}100%{r:36;opacity:0}}
        `}</style>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'100%'}} preserveAspectRatio="xMidYMid meet">
          {/* Background grid */}
          {allPrices.filter((_,i)=>i%2===0).map(p=>(
            <line key={p} x1={pL} y1={yOf(p)} x2={W-pR} y2={yOf(p)} stroke={C.borderFt} strokeWidth="1"/>
          ))}
          {/* Center axis */}
          <line x1={cx} y1={pT} x2={cx} y2={H-pB} stroke={C.border} strokeWidth="1.5"/>

          {/* Bid bars (left) */}
          {l2.map(l=>{
            const y=yOf(l.price),barW=(l.bidSize/maxSize)*maxBarW
            return <g key={`b${l.price}`}>
              <rect x={cx-barW} y={y-7} width={barW} height={14}
                fill={isDark?'rgba(74,222,128,0.18)':'rgba(22,163,74,0.14)'} rx="1"/>
              <rect x={cx-barW} y={y-7} width={3} height={14}
                fill={C.green} rx="1"/>
              <text x={cx-barW-4} y={y+4} textAnchor="end" fill={C.text4} fontSize="9" fontFamily="monospace">
                {(l.bidSize/1000).toFixed(0)}K
              </text>
            </g>
          })}
          {/* Ask bars (right) */}
          {l2.map(l=>{
            const y=yOf(l.price),barW=(l.askSize/maxSize)*maxBarW
            return <g key={`a${l.price}`}>
              <rect x={cx} y={y-7} width={barW} height={14}
                fill={isDark?'rgba(248,113,113,0.18)':'rgba(220,38,38,0.14)'} rx="1"/>
              <rect x={cx+barW-3} y={y-7} width={3} height={14}
                fill={C.red} rx="1"/>
              <text x={cx+barW+4} y={y+4} textAnchor="start" fill={C.text4} fontSize="9" fontFamily="monospace">
                {(l.askSize/1000).toFixed(0)}K
              </text>
            </g>
          })}

          {/* Price labels */}
          {allPrices.map(p=>(
            <text key={p} x={cx} y={yOf(p)-10} textAnchor="middle" fill={Math.abs(p-price)<0.01?C.gold:C.text4} fontSize="9" fontFamily="monospace">
              ${p.toFixed(2)}
            </text>
          ))}

          {/* Impact ripples */}
          {impacts.map(imp=>{
            const y=price+(imp.price-price)/(pRange/plotH)*0 || yOf(Math.max(minP,Math.min(maxP,imp.price)))
            if(y<pT||y>H-pB)return null
            const x=imp.side==='buy'?cx-30:cx+30
            const anim=imp.dark?'darkRipple':imp.large?'bigRipple':'ripple'
            const col=imp.dark?C.purple:imp.side==='buy'?C.green:C.red
            const dur=imp.dark?'1.4s':imp.large?'1.6s':'1.0s'
            return <circle key={imp.id} cx={x} cy={y} r="4" fill="none"
              stroke={col} strokeWidth={imp.large?2.5:1.5}
              style={{animation:`${anim} ${dur} ease-out forwards`}}/>
          })}

          {/* Current price battle line */}
          {(()=>{
            const y=yOf(Math.max(minP,Math.min(maxP,price)))
            return <>
              <line x1={pL} y1={y} x2={W-pR} y2={y} stroke={C.gold} strokeWidth="2.5"/>
              <text x={W-pR+2} y={y+4} fill={C.gold} fontSize="11" fontFamily="monospace" fontWeight="700">${price.toFixed(2)}</text>
              <text x={pL-2} y={y+4} textAnchor="end" fill={C.gold} fontSize="11" fontFamily="monospace" fontWeight="700">${price.toFixed(2)}</text>
            </>
          })()}

          {/* Axis labels */}
          <text x={cx/2} y={pT-10} textAnchor="middle" fill={C.green} fontSize="10" fontWeight="700">← BIDS (buyers defending)</text>
          <text x={cx+cx/2} y={pT-10} textAnchor="middle" fill={C.red}   fontSize="10" fontWeight="700">(sellers attacking) ASKS →</text>
        </svg>
      </div>
    </div>
  )
}

// ── VIEW: Seismic Monitor ─────────────────────────────────────────────────────
function SeismicView({tape,price,C,isDark}:{tape:TapeEntry[];price:number;C:CT;isDark:boolean}) {
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const dataRef=useRef<{
    imbalance:number[]; prints:number[]; velocity:number[]
    lastPrice:number; lastPriceAt:number; lastTapeId:number
  }>({imbalance:[],prints:[],velocity:[],lastPrice:price,lastPriceAt:Date.now(),lastTapeId:0})
  const rafRef=useRef<number>(0)

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext('2d');if(!ctx)return
    const MAX=300
    // Seed initial silence
    const d=dataRef.current
    if(!d.imbalance.length){for(let i=0;i<MAX;i++){d.imbalance.push(0);d.prints.push(0);d.velocity.push(0)}}

    // Data sampler: push new values every 200ms
    const sampleIv=setInterval(()=>{
      const now=Date.now()
      const recentTape=tape.filter(e=>e.id>d.lastTapeId&&Date.now()-e.ts<300)
      if(tape[0])d.lastTapeId=tape[0].id
      // channel 1: buy/sell imbalance (±1)
      const buyV=recentTape.filter(e=>e.side==='buy').reduce((s,e)=>s+e.size,0)
      const sellV=recentTape.filter(e=>e.side==='sell').reduce((s,e)=>s+e.size,0)
      const totalV=buyV+sellV
      d.imbalance.push(totalV?((buyV-sellV)/totalV):0)
      if(d.imbalance.length>MAX)d.imbalance.shift()
      // channel 2: print intensity (0–1, log-weighted)
      const maxSz=recentTape.reduce((m,e)=>Math.max(m,e.size),0)
      const intensity=maxSz>0?Math.min(Math.log10(maxSz)/Math.log10(15000),1):0
      const darkBoost=recentTape.some(e=>e.dark)?0.3:0
      d.prints.push(Math.min(intensity+darkBoost,1))
      if(d.prints.length>MAX)d.prints.shift()
      // channel 3: price velocity
      const elapsed=(now-d.lastPriceAt)/1000
      const vel=elapsed>0?(price-d.lastPrice)/elapsed:0
      d.velocity.push(Math.max(-1,Math.min(1,vel/0.15)))
      if(d.velocity.length>MAX)d.velocity.shift()
      d.lastPrice=price;d.lastPriceAt=now
    },200)

    const ro=new ResizeObserver(()=>{canvas.width=canvas.offsetWidth;canvas.height=canvas.offsetHeight})
    ro.observe(canvas);canvas.width=canvas.offsetWidth;canvas.height=canvas.offsetHeight

    const CHANNELS=[
      {key:'imbalance' as const,label:'Buy/Sell Imbalance',bipolar:true,posCol:isDark?'#4ade80':'#16a34a',negCol:isDark?'#f87171':'#dc2626'},
      {key:'prints'    as const,label:'Print Intensity (size × dark pool)',bipolar:false,posCol:isDark?'#e8b84b':'#b8750c',negCol:''},
      {key:'velocity'  as const,label:'Price Velocity',bipolar:true,posCol:isDark?'#93c5fd':'#3b82f6',negCol:isDark?'#f87171':'#dc2626'},
    ]

    const render=()=>{
      const W=canvas.width,H=canvas.height;if(!W||!H){rafRef.current=requestAnimationFrame(render);return}
      ctx.fillStyle=isDark?'#080808':'#f8f7f5';ctx.fillRect(0,0,W,H)

      const pL=8,pR=8,gapY=28,labelH=16
      const chH=Math.floor((H-gapY*(CHANNELS.length-1)-labelH*CHANNELS.length)/CHANNELS.length)

      CHANNELS.forEach((ch,ci)=>{
        const yTop=ci*(chH+gapY+labelH)+labelH
        const vals=d[ch.key]
        const cW=Math.max(1,(W-pL-pR)/Math.max(vals.length,1))

        // label
        ctx.fillStyle=ch.posCol;ctx.font='bold 10px monospace';ctx.textAlign='left'
        ctx.fillText(`CH${ci+1}: ${ch.label}`,pL,yTop-3)

        // bg panel
        ctx.fillStyle=isDark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.02)'
        ctx.fillRect(pL,yTop,W-pL-pR,chH)
        // center or zero line
        const midY=ch.bipolar?yTop+chH/2:yTop+chH
        ctx.strokeStyle=isDark?'rgba(255,255,255,0.10)':'rgba(0,0,0,0.10)'
        ctx.lineWidth=1;ctx.setLineDash([])
        ctx.beginPath();ctx.moveTo(pL,midY);ctx.lineTo(W-pR,midY);ctx.stroke()

        // bars
        vals.forEach((v,i)=>{
          const x=pL+i*cW
          const half=chH/2
          const col=v>=0?ch.posCol:ch.negCol||ch.posCol
          const barH=ch.bipolar?Math.abs(v)*half*0.9:(Math.abs(v)*chH*0.9)
          const barY=ch.bipolar?(v>=0?midY-barH:midY):yTop+chH-barH
          ctx.fillStyle=col
          ctx.globalAlpha=0.35+Math.abs(v)*0.55
          ctx.fillRect(x,barY,Math.max(cW-0.5,1),barH)
        })
        ctx.globalAlpha=1

        // glow on latest value
        const latest=vals[vals.length-1]??0
        if(Math.abs(latest)>0.05){
          const x=pL+(vals.length-1)*cW
          const col=latest>=0?ch.posCol:ch.negCol||ch.posCol
          const half=chH/2
          const barH=ch.bipolar?Math.abs(latest)*half*0.9:(Math.abs(latest)*chH*0.9)
          const barY=ch.bipolar?(latest>=0?midY-barH:midY):yTop+chH-barH
          ctx.shadowColor=col;ctx.shadowBlur=8
          ctx.fillStyle=col;ctx.globalAlpha=0.9
          ctx.fillRect(x,barY,Math.max(cW-0.5,1),barH)
          ctx.shadowBlur=0;ctx.globalAlpha=1
        }

        // value readout
        ctx.fillStyle=isDark?'rgba(255,255,255,0.50)':'rgba(0,0,0,0.45)'
        ctx.font='9px monospace';ctx.textAlign='right'
        ctx.fillText((latest*100).toFixed(0)+'%',W-pR-2,yTop+chH-4)
      })

      // time axis
      ctx.fillStyle=isDark?'rgba(255,255,255,0.18)':'rgba(0,0,0,0.25)'
      ctx.font='9px monospace';ctx.textAlign='left'
      ctx.fillText('← 60s ago',pL,H-4)
      ctx.textAlign='right'
      ctx.fillText('now →',W-pR,H-4)

      rafRef.current=requestAnimationFrame(render)
    }
    rafRef.current=requestAnimationFrame(render)
    return()=>{clearInterval(sampleIv);cancelAnimationFrame(rafRef.current);ro.disconnect()}
  },[isDark,price,tape])

  return <canvas ref={canvasRef} style={{flex:1,width:'100%',display:'block'}}/>
}

// ── Original table sub-components ─────────────────────────────────────────────
function TapeRow({entry,C}:{entry:TapeEntry;C:CT}) {
  const color=entry.side==='buy'?C.green:entry.side==='sell'?C.red:C.text3
  const bg=entry.large?(entry.side==='buy'?C.greenFt:C.redFt):entry.dark?C.darkPoolBg:'transparent'
  return (
    <div style={{display:'grid',gridTemplateColumns:'70px 70px 80px 60px 24px 24px',
      gap:4,padding:'3px 10px',borderBottom:`1px solid ${C.rowBorder}`,
      background:bg,alignItems:'center',fontSize:11,fontFamily:'monospace',
      borderLeft:entry.large?`2px solid ${color}`:'2px solid transparent',
      animation:'fadeIn 0.15s ease'}}>
      <span style={{color:C.text3}}>{entry.time}</span>
      <span style={{color,fontWeight:entry.large?700:400}}>${entry.price.toFixed(2)}</span>
      <span style={{color:entry.large?color:C.text2,fontWeight:entry.large?700:400}}>{entry.size.toLocaleString()}</span>
      <span style={{color}}>{entry.side.toUpperCase()}</span>
      <span style={{color:entry.dark?C.blue:C.text4,fontSize:9}}>{entry.exchange}</span>
      {entry.large&&<span style={{color,fontSize:9}}>LRGE</span>}
    </div>
  )
}
function L2Panel({levels,livePrice,C,isDark}:{levels:L2Level[];livePrice:number;C:CT;isDark:boolean}) {
  const maxSize=Math.max(...levels.flatMap(l=>[l.bidSize,l.askSize]),1)
  const bids=[...levels].filter(l=>l.price<livePrice).sort((a,b)=>b.price-a.price).slice(0,5)
  const asks=[...levels].filter(l=>l.price>=livePrice).sort((a,b)=>a.price-b.price).slice(0,5)
  return (
    <div style={{background:C.cardBg,borderLeft:`1px solid ${C.border}`,width:200,display:'flex',flexDirection:'column',flexShrink:0}}>
      <div style={{padding:'8px 10px 6px',fontSize:10,color:C.text3,fontWeight:700,letterSpacing:'0.07em',borderBottom:`1px solid ${C.borderFt}`,textTransform:'uppercase'}}>Level 2</div>
      {asks.reverse().map(l=>(
        <div key={l.price} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 10px',position:'relative'}}>
          <div style={{position:'absolute',right:0,top:0,bottom:0,width:`${l.askSize/maxSize*60}%`,background:isDark?'rgba(248,113,113,0.08)':'rgba(220,38,38,0.08)'}}/>
          <span style={{fontFamily:'monospace',fontSize:11,color:C.red,zIndex:1}}>${l.price.toFixed(2)}</span>
          <span style={{marginLeft:'auto',fontFamily:'monospace',fontSize:10,color:C.text3,zIndex:1}}>{(l.askSize/100).toFixed(0)}L</span>
        </div>
      ))}
      <div style={{borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,padding:'4px 10px',fontSize:12,fontWeight:700,color:C.gold,fontFamily:'monospace',textAlign:'center'}}>
        ${livePrice.toFixed(2)}
      </div>
      {bids.map(l=>(
        <div key={l.price} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 10px',position:'relative'}}>
          <div style={{position:'absolute',right:0,top:0,bottom:0,width:`${l.bidSize/maxSize*60}%`,background:isDark?'rgba(74,222,128,0.08)':'rgba(22,163,74,0.09)'}}/>
          <span style={{fontFamily:'monospace',fontSize:11,color:C.green,zIndex:1}}>${l.price.toFixed(2)}</span>
          <span style={{marginLeft:'auto',fontFamily:'monospace',fontSize:10,color:C.text3,zIndex:1}}>{(l.bidSize/100).toFixed(0)}L</span>
        </div>
      ))}
    </div>
  )
}

// ── Views config ──────────────────────────────────────────────────────────────
const TAPE_VIEWS:{id:TapeView;label:string;desc:string}[]=[
  {id:'table',    label:'Table',          desc:'Classic time & sales scrolling tape'},
  {id:'ekg',      label:'EKG',            desc:'Heartbeat spikes — buy up, sell down, height = log(size)'},
  {id:'particles',label:'Particles',      desc:'Animated particles drift up (buy) or down (sell)'},
  {id:'clusters', label:'Clusters',       desc:'Bubble chart — price × time, size = volume'},
  {id:'timeline',    label:'60s Timeline',  desc:'Per-second buy/sell heatmap + imbalance meter'},
  {id:'battlefield', label:'Battlefield',   desc:'L2 depth as opposing forces — bid/ask troops, tape impacts'},
  {id:'seismic',     label:'Seismic',       desc:'3-channel scrolling monitor: imbalance, print intensity, price velocity'},
]

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TapeReaderPage() {
  const router=useRouter()
  const [isDark,setIsDark]=useState(true)
  useEffect(()=>{
    try{const p=JSON.parse(localStorage.getItem('heymonday_dashboard_prefs_v1')||'{}')
      if(typeof p.isDark==='boolean')setIsDark(p.isDark)}catch{}
  },[])
  const C=isDark?DARK_C:LIGHT_C
  const [view,setView]=useState<TapeView>('table')
  const [ticker,setTicker]=useState('SPY')
  const [input,setInput]=useState('SPY')
  const [tape,setTape]=useState<TapeEntry[]>([])
  const [l2,setL2]=useState<L2Level[]>([])
  const [price,setPrice]=useState(595.00)
  const [paused,setPaused]=useState(false)
  const [filter,setFilter]=useState<'all'|'large'|'dark'>('all')
  const [narrations,setNarrations]=useState<string[]>([])
  const pausedRef=useRef(false)
  pausedRef.current=paused

  useEffect(()=>{
    let localPrice=price
    const iv=setInterval(()=>{
      if(pausedRef.current)return
      const entry=generateMockEntry(localPrice)
      localPrice=entry.price
      setPrice(localPrice)
      setTape(prev=>[entry,...prev].slice(0,400))
      if(entry.narrative)setNarrations(prev=>[entry.narrative,...prev].slice(0,20))
      if(Math.random()<0.1)setL2(generateMockL2(localPrice))
    },180)
    setL2(generateMockL2(localPrice))
    return()=>clearInterval(iv)
  },[ticker])

  const visibleTape=tape.filter(e=>filter==='all'?true:filter==='large'?e.large:e.dark)
  const buyPressure=tape.slice(0,50).filter(e=>e.side==='buy').length/Math.max(tape.slice(0,50).length,1)
  const recentLargeCount=tape.slice(0,20).filter(e=>e.large).length

  function toggleTheme(){
    const n=!isDark;setIsDark(n)
    try{const p=JSON.parse(localStorage.getItem('heymonday_dashboard_prefs_v1')||'{}')
      localStorage.setItem('heymonday_dashboard_prefs_v1',JSON.stringify({...p,isDark:n}))}catch{}
  }

  return (
    <div style={{height:'100vh',background:C.pageBg,color:C.text,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`}</style>

      {/* Header */}
      <div style={{padding:'10px 16px',borderBottom:`1px solid ${C.border}`,background:C.panelBg,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap',flexShrink:0}}>
        <button onClick={()=>router.push('/dashboard')} style={{background:'none',border:'none',color:C.text3,cursor:'pointer',fontSize:12,padding:0}}>← Monday</button>
        <span style={{fontSize:13,fontWeight:700,color:C.gold,letterSpacing:'0.08em',textTransform:'uppercase'}}>Tape Reader</span>
        <span style={{fontSize:18,fontWeight:700,color:C.text}}>{ticker}</span>
        <span style={{fontSize:20,fontWeight:700,color:C.gold,fontFamily:'monospace'}}>${price.toFixed(2)}</span>
        <div style={{display:'flex',gap:12,fontSize:11,color:C.text3}}>
          <span>Buy pressure: <span style={{color:buyPressure>0.55?C.green:buyPressure<0.45?C.red:C.text2,fontWeight:600}}>{Math.round(buyPressure*100)}%</span></span>
          <span>Large prints: <span style={{color:recentLargeCount>3?C.gold:C.text2,fontWeight:600}}>{recentLargeCount}</span></span>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          <form onSubmit={e=>{e.preventDefault();setTicker(input.toUpperCase())}} style={{display:'flex',gap:6}}>
            <input value={input} onChange={e=>setInput(e.target.value.toUpperCase())}
              style={{background:C.inputBg,border:`1px solid ${C.border}`,padding:'5px 10px',color:C.text,fontSize:12,width:70,outline:'none'}}/>
            <button type="submit" style={{background:C.goldFt,border:`1px solid ${C.border}`,padding:'5px 12px',color:C.gold,fontSize:12,cursor:'pointer'}}>Load</button>
          </form>
          <button onClick={()=>setPaused(p=>!p)} style={{background:paused?C.pausedBg:C.unpausedBg,border:`1px solid ${C.border}`,padding:'5px 12px',color:paused?C.gold:C.text3,fontSize:12,cursor:'pointer'}}>
            {paused?'▶ Resume':'⏸ Pause'}
          </button>
          <button onClick={toggleTheme} style={{background:C.inputBg,border:`1px solid ${C.border}`,padding:'5px 10px',color:C.text3,fontSize:13,cursor:'pointer'}}>{isDark?'☀':'◑'}</button>
        </div>
      </div>

      {/* Simulated notice */}
      <div style={{padding:'6px 16px',background:C.blueFt,borderBottom:`1px solid ${isDark?'rgba(147,197,253,0.14)':'rgba(59,130,246,0.18)'}`,fontSize:11,color:isDark?'rgba(147,197,253,0.75)':C.blue,display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
        <span>⚡</span><span>Simulated tape — live data requires Polygon.io websocket.</span>
      </div>

      {/* View tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,background:C.cardBg,flexShrink:0,overflowX:'auto'}}>
        {TAPE_VIEWS.map(v=>(
          <button key={v.id} onClick={()=>setView(v.id)} title={v.desc} style={{
            padding:'9px 18px',background:view===v.id?C.goldFt:'transparent',
            border:'none',borderBottom:view===v.id?`2px solid ${C.gold}`:'2px solid transparent',
            color:view===v.id?C.gold:C.text3,cursor:'pointer',fontSize:12,fontWeight:view===v.id?700:400,
            whiteSpace:'nowrap',flexShrink:0,
          }}>{v.label}</button>
        ))}
      </div>

      {/* Main body */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {view==='table'&&(
          <div style={{flex:1,display:'flex',overflow:'hidden'}}>
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{display:'grid',gridTemplateColumns:'70px 70px 80px 60px 24px 24px',gap:4,padding:'6px 10px',borderBottom:`1px solid ${C.border}`,background:C.cardBg,flexShrink:0}}>
                {['TIME','PRICE','SIZE','SIDE','EX',''].map((h,i)=>(
                  <span key={i} style={{fontSize:9,color:C.text4,fontWeight:700,letterSpacing:'0.06em'}}>{h}</span>
                ))}
              </div>
              <div style={{display:'flex',gap:1,padding:'6px 10px',borderBottom:`1px solid ${C.borderFt}`,background:C.panelBg,flexShrink:0}}>
                {(['all','large','dark'] as const).map(f=>(
                  <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?C.goldFt:'transparent',border:`1px solid ${filter===f?C.border:'transparent'}`,padding:'3px 10px',color:filter===f?C.gold:C.text3,fontSize:11,cursor:'pointer',textTransform:'capitalize'}}>
                    {f==='all'?'All prints':f==='large'?'10k+ shares':'Dark pool'}
                  </button>
                ))}
              </div>
              <div style={{flex:1,overflowY:'auto'}}>
                {visibleTape.map(e=><TapeRow key={e.id} entry={e} C={C}/>)}
              </div>
            </div>
            <L2Panel levels={l2} livePrice={price} C={C} isDark={isDark}/>
            <div style={{width:260,borderLeft:`1px solid ${C.border}`,background:C.cardBg,display:'flex',flexDirection:'column',flexShrink:0}}>
              <div style={{padding:'8px 12px 6px',fontSize:10,color:C.gold,fontWeight:700,letterSpacing:'0.07em',borderBottom:`1px solid ${C.borderFt}`,textTransform:'uppercase'}}>Monday Reads the Tape</div>
              <div style={{flex:1,overflowY:'auto',padding:'8px 12px',display:'flex',flexDirection:'column',gap:8}}>
                {!narrations.length&&<div style={{fontSize:11,color:C.text4,marginTop:12}}>Large prints and dark pool activity will be narrated here in real time.</div>}
                {narrations.map((n,i)=>(
                  <div key={i} style={{fontSize:11,color:i===0?C.text2:C.text3,lineHeight:1.5,padding:'6px 8px',background:i===0?C.narrationBg:'transparent',borderLeft:`2px solid ${i===0?C.gold:'transparent'}`,animation:i===0?'fadeIn 0.3s ease':'none'}}>{n}</div>
                ))}
              </div>
              <div style={{padding:'8px 12px',borderTop:`1px solid ${C.borderFt}`,fontSize:10,color:C.text4}}>Live AI narration of large prints &amp; sweeps.</div>
            </div>
          </div>
        )}
        {view==='ekg'       &&<EKGView      tape={tape} C={C} isDark={isDark}/>}
        {view==='particles' &&<ParticleView tape={tape} C={C} isDark={isDark}/>}
        {view==='clusters'  &&<ClusterView  tape={tape} C={C} isDark={isDark}/>}
        {view==='timeline'    &&<TimelineView  tape={tape} C={C} isDark={isDark}/>}
        {view==='battlefield' &&<BattlefieldView tape={tape} l2={l2} price={price} C={C} isDark={isDark}/>}
        {view==='seismic'     &&<SeismicView tape={tape} price={price} C={C} isDark={isDark}/>}
      </div>

      {/* Status bar */}
      <div style={{padding:'5px 16px',borderTop:`1px solid ${C.borderFt}`,background:C.panelBg,display:'flex',gap:20,fontSize:10,color:C.text4,alignItems:'center',flexShrink:0}}>
        <span>{tape.length} prints buffered</span>
        <span>{tape.filter(e=>e.large).length} large</span>
        <span>{tape.filter(e=>e.dark).length} dark pool</span>
        <span style={{marginLeft:'auto',color:paused?C.gold:C.green}}>{paused?'⏸ Paused':'● Live (simulated)'}</span>
      </div>
    </div>
  )
}
