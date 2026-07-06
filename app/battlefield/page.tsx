'use client'

// Battlefield — Bookmap-style time-scrolling L2 order book
// Y axis = price  |  X axis = time scrolling right-to-left
// Green cells = bid liquidity at that price × time
// Red cells   = ask liquidity
// Gold line   = price trace
// Dots        = tape prints
// Rings       = absorption events
// Delta bar   = cumulative buy - sell pressure

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const DARK_C = {
  pageBg:'#080808', panelBg:'#0a0a0a', cardBg:'#0d0d0d',
  border:'rgba(232,184,75,0.18)', borderFt:'rgba(232,184,75,0.09)',
  gold:'#e8b84b', goldFt:'rgba(232,184,75,0.10)',
  green:'#4ade80', greenBg:'rgba(74,222,128,0.08)',
  red:'#f87171',   redBg:'rgba(248,113,113,0.08)',
  blue:'#93c5fd',  purple:'#c084fc',
  text:'#ffffff', text2:'rgba(255,255,255,0.75)',
  text3:'rgba(255,255,255,0.45)', text4:'rgba(255,255,255,0.20)',
}
const LIGHT_C = {
  pageBg:'#f5f4f1', panelBg:'#ffffff', cardBg:'#eeece8',
  border:'rgba(0,0,0,0.14)', borderFt:'rgba(0,0,0,0.07)',
  gold:'#b8750c', goldFt:'rgba(184,117,12,0.10)',
  green:'#16a34a', greenBg:'rgba(22,163,74,0.07)',
  red:'#dc2626',   redBg:'rgba(220,38,38,0.07)',
  blue:'#3b82f6',  purple:'#9333ea',
  text:'#1a1a1a', text2:'rgba(0,0,0,0.72)',
  text3:'rgba(0,0,0,0.48)', text4:'rgba(0,0,0,0.20)',
}
type CT = typeof DARK_C

// ── Demo options data (gamma walls only) ─────────────────────────────────────
const GAMMA_WALLS = [
  {strike:535, net:-53800, label:'Put Wall'},
  {strike:540, net:-44400, label:'Put Wall'},
  {strike:545, net:+55600, label:'Call Wall'},
  {strike:550, net:+71800, label:'Call Wall'},
]

// ── Generators ────────────────────────────────────────────────────────────────
let _tid=1
function mockTape(lastPrice:number) {
  const price=Math.round((lastPrice+(Math.random()-0.49)*0.10)*100)/100
  const size =Math.floor(Math.random()*14000)+100
  const side:'buy'|'sell'=Math.random()>0.5?'buy':'sell'
  const dark =Math.random()<0.08
  const large=size>9000
  return {id:_tid++,ts:Date.now(),price,size,side,dark,large}
}
function mockL2(center:number) {
  return Array.from({length:24},(_,i)=>{
    const price=Math.round((center-0.48+i*0.04)*100)/100
    const prox =1-Math.abs(i-12)/12
    const base =6000+prox*80000
    // Small random wall events
    const wallMulti=(Math.random()<0.05)?3.5:(Math.random()<0.08)?0.1:1
    return {
      price,
      bid:price<center?Math.floor(base*(0.5+Math.random()*0.5)*wallMulti):0,
      ask:price>=center?Math.floor(base*(0.5+Math.random()*0.5)*wallMulti):0,
    }
  })
}

// ── Absorption detector ───────────────────────────────────────────────────────
// Track for each price level: how many consecutive tape hits without the wall shrinking
interface AbsorptionEvent { price:number; side:'bid'|'ask'; ts:number; count:number }

export default function BattlefieldPage() {
  const router  = useRouter()
  const [isDark,setIsDark] = useState(true)
  useEffect(()=>{
    try{ const p=JSON.parse(localStorage.getItem('heymonday_dashboard_prefs_v1')||'{}')
      if(typeof p.isDark==='boolean') setIsDark(p.isDark) }catch{}
  },[])
  const C = isDark ? DARK_C : LIGHT_C

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Snapshot: price, timestamp, L2 levels
  interface Snap { ts:number; price:number; levels:{price:number;bid:number;ask:number}[] }
  const stRef = useRef<{
    snaps:Snap[]
    tape:{id:number;ts:number;price:number;size:number;side:'buy'|'sell';dark:boolean;large:boolean}[]
    price:number
    delta:number      // cumulative buy - sell size (last 60s)
    deltaHistory:number[]
    absorptions:AbsorptionEvent[]
    prevL2:Map<number,{bid:number;ask:number}>
    hitCount:Map<number,number>
    nid:number
  }>({snaps:[],tape:[],price:543.28,delta:0,deltaHistory:[],absorptions:[],prevL2:new Map(),hitCount:new Map(),nid:50000})

  const rafRef = useRef<number>(0)

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext('2d');if(!ctx)return
    const st=stRef.current
    st.snaps=[]

    const snapIv=setInterval(()=>{
      const levels=mockL2(st.price)
      // Absorption detection: check if any previously hit levels are holding
      levels.forEach(l=>{
        const prev=st.prevL2.get(l.price)
        if(prev){
          const bidDelta=l.bid-prev.bid, askDelta=l.ask-prev.ask
          // If bid side had prints but wall didn't shrink much: absorption
          const bidAbsorbing=l.bid>0&&prev.bid>0&&bidDelta>-prev.bid*0.12
          const askAbsorbing=l.ask>0&&prev.ask>0&&askDelta>-prev.ask*0.12
          if(bidAbsorbing||askAbsorbing){
            const key=l.price
            st.hitCount.set(key,(st.hitCount.get(key)??0)+1)
            if((st.hitCount.get(key)??0)>=3){
              const exists=st.absorptions.find(a=>Math.abs(a.price-l.price)<0.01)
              if(!exists){
                st.absorptions.push({price:l.price,side:bidAbsorbing?'bid':'ask',ts:Date.now(),count:st.hitCount.get(key)??3})
                if(st.absorptions.length>20) st.absorptions.shift()
              } else { exists.ts=Date.now(); exists.count++ }
            }
          } else { st.hitCount.set(l.price,0) }
        }
      })
      st.prevL2=new Map(levels.map(l=>[l.price,{bid:l.bid,ask:l.ask}]))
      st.snaps.push({ts:Date.now(),price:st.price,levels})
      if(st.snaps.length>300) st.snaps.shift()
      // Clean expired absorptions (>8s old)
      st.absorptions=st.absorptions.filter(a=>Date.now()-a.ts<8000)
    },300)

    const tapeIv=setInterval(()=>{
      const e=mockTape(st.price)
      st.price=e.price
      const vol=e.size*(e.side==='buy'?1:-1)
      st.delta+=vol
      st.tape.unshift(e)
      if(st.tape.length>600) st.tape.pop()
    },160)

    const deltaIv=setInterval(()=>{
      // rolling 60s delta normalized
      const cutoff=Date.now()-60000
      const recent=st.tape.filter(e=>e.ts>cutoff)
      const buyV =recent.filter(e=>e.side==='buy').reduce((s,e)=>s+e.size,0)
      const sellV=recent.filter(e=>e.side==='sell').reduce((s,e)=>s+e.size,0)
      const total=Math.max(buyV+sellV,1)
      st.deltaHistory.push((buyV-sellV)/total)
      if(st.deltaHistory.length>60) st.deltaHistory.shift()
    },1000)

    const ro=new ResizeObserver(()=>{canvas.width=canvas.offsetWidth;canvas.height=canvas.offsetHeight})
    ro.observe(canvas);canvas.width=canvas.offsetWidth;canvas.height=canvas.offsetHeight

    const render=()=>{
      const W=canvas.width,H=canvas.height
      if(!W||!H){rafRef.current=requestAnimationFrame(render);return}
      const st2=stRef.current
      const cur=st2.price
      const PRICE_RANGE=0.72 // ±$0.36 from current price
      const dMin=cur-PRICE_RANGE/2, dMax=cur+PRICE_RANGE/2
      const pL=56, pR=20, pT=20, pB=28
      const DELTA_W=26, VPOC_W=0
      const plotW=W-pL-pR-DELTA_W-VPOC_W
      const plotH=H-pT-pB
      const py=(p:number)=>pT+(1-(p-dMin)/PRICE_RANGE)*plotH

      ctx.fillStyle=isDark?'#080808':'#f5f4f1'
      ctx.fillRect(0,0,W,H)

      // ── L2 heatmap (main area) ──────────────────────────────────────────────
      const snaps=st2.snaps
      if(snaps.length){
        const maxBid=Math.max(...snaps.flatMap(s=>s.levels.map(l=>l.bid)),1)
        const maxAsk=Math.max(...snaps.flatMap(s=>s.levels.map(l=>l.ask)),1)
        const cW=Math.max(1,plotW/snaps.length)
        const LEVEL_H=plotH/(PRICE_RANGE/0.04)

        snaps.forEach((snap,si)=>{
          const x=pL+si*cW
          const tAge=si/snaps.length   // 0=oldest → 1=newest
          const fade=0.12+tAge*0.88

          snap.levels.forEach(l=>{
            if(l.price<dMin-0.04||l.price>dMax+0.04) return
            const y=py(l.price)
            if(l.bid>0){
              const a=Math.min((l.bid/maxBid)*fade,0.75)
              if(a>0.015){
                ctx.fillStyle=isDark?`rgba(74,222,128,${a.toFixed(2)})`:`rgba(22,163,74,${a.toFixed(2)})`
                ctx.fillRect(x,y-LEVEL_H*0.5,cW+0.5,LEVEL_H+0.5)
              }
            }
            if(l.ask>0){
              const a=Math.min((l.ask/maxAsk)*fade,0.75)
              if(a>0.015){
                ctx.fillStyle=isDark?`rgba(248,113,113,${a.toFixed(2)})`:`rgba(220,38,38,${a.toFixed(2)})`
                ctx.fillRect(x,y-LEVEL_H*0.5,cW+0.5,LEVEL_H+0.5)
              }
            }
          })
        })
      }

      // ── Grid lines + price labels ───────────────────────────────────────────
      const GRID_STEP=0.08
      for(let p=Math.ceil(dMin/GRID_STEP)*GRID_STEP; p<=dMax; p+=GRID_STEP) {
        const y=py(p)
        ctx.strokeStyle=isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)'
        ctx.lineWidth=1; ctx.setLineDash([])
        ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(pL+plotW,y); ctx.stroke()
        const label=`$${p.toFixed(2)}`
        ctx.fillStyle=isDark?'rgba(255,255,255,0.35)':'rgba(0,0,0,0.38)'
        ctx.font='9px monospace'; ctx.textAlign='right'
        ctx.fillText(label,pL-3,y+3)
      }

      // ── Gamma wall lines ────────────────────────────────────────────────────
      GAMMA_WALLS.filter(g=>g.strike>=dMin&&g.strike<=dMax).forEach(g=>{
        const y=py(g.strike)
        ctx.strokeStyle=isDark?'rgba(232,184,75,0.60)':'rgba(184,117,12,0.60)'
        ctx.lineWidth=2; ctx.setLineDash([7,5])
        ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(pL+plotW,y); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle=isDark?'rgba(232,184,75,0.90)':'rgba(184,117,12,0.90)'
        ctx.font='bold 10px monospace'; ctx.textAlign='right'
        ctx.fillText(`Γ ${g.label} $${g.strike}`,pL-3,y-4)
      })

      // ── Price trace ─────────────────────────────────────────────────────────
      if(snaps.length>1){
        const cW=plotW/snaps.length
        ctx.strokeStyle=isDark?'#e8b84b':'#b8750c'
        ctx.lineWidth=2.5; ctx.setLineDash([])
        ctx.lineJoin='round'
        ctx.beginPath()
        snaps.forEach((s,si)=>{
          const x=pL+si*cW+cW/2
          const y=py(Math.max(dMin,Math.min(dMax,s.price)))
          si===0?ctx.moveTo(x,y):ctx.lineTo(x,y)
        })
        ctx.stroke()
        // Current price label
        const lastSnap=snaps[snaps.length-1]
        const lx=pL+plotW-2, ly=py(Math.max(dMin,Math.min(dMax,lastSnap.price)))
        ctx.fillStyle=isDark?'#e8b84b':'#b8750c'
        ctx.font='bold 11px monospace'; ctx.textAlign='right'
        ctx.fillText(`$${cur.toFixed(2)}`,pL-3,ly+3)
      }

      // ── Tape print dots ─────────────────────────────────────────────────────
      const now=Date.now(), tWindow=snaps.length*300
      st2.tape.forEach(e=>{
        const age=now-e.ts; if(age>tWindow) return
        if(e.price<dMin||e.price>dMax) return
        const x=pL+plotW*(1-age/tWindow)
        const y=py(e.price)
        const r=e.large?8:e.dark?6:3.5
        const alpha=Math.max(0.20,1-age/tWindow*0.68)
        const col=e.dark?(isDark?'#c084fc':'#9333ea'):e.side==='buy'?(isDark?'#4ade80':'#16a34a'):(isDark?'#f87171':'#dc2626')
        ctx.globalAlpha=alpha
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2)
        ctx.fillStyle=col; ctx.fill()
        if(e.large||e.dark){
          ctx.globalAlpha=alpha*0.25
          ctx.beginPath(); ctx.arc(x,y,r*2.8,0,Math.PI*2)
          ctx.fillStyle=col; ctx.fill()
        }
      })
      ctx.globalAlpha=1

      // ── Absorption rings ────────────────────────────────────────────────────
      st2.absorptions.forEach(a=>{
        if(a.price<dMin||a.price>dMax) return
        const y=py(a.price)
        const age=(Date.now()-a.ts)/8000
        const r=12+age*8, alpha=Math.max(0,0.9-age)
        ctx.globalAlpha=alpha
        ctx.strokeStyle=isDark?'#e8b84b':'#b8750c'
        ctx.lineWidth=2; ctx.setLineDash([])
        ctx.beginPath(); ctx.arc(pL+plotW-40,y,r,0,Math.PI*2); ctx.stroke()
        if(alpha>0.4){
          ctx.fillStyle=isDark?'#e8b84b':'#b8750c'
          ctx.font='bold 9px monospace'; ctx.textAlign='right'; ctx.globalAlpha=alpha*0.9
          ctx.fillText(`ABSORB ${a.count}×`,pL+plotW-56,y+3)
        }
      })
      ctx.globalAlpha=1; ctx.setLineDash([])

      // ── Delta bar (far right) ───────────────────────────────────────────────
      const dBx=pL+plotW+pR
      ctx.fillStyle=isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)'
      ctx.fillRect(dBx,pT,DELTA_W,plotH)
      ctx.strokeStyle=isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)'
      ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(dBx,pT); ctx.lineTo(dBx,H-pB); ctx.stroke()

      const dHistory=st2.deltaHistory
      if(dHistory.length){
        const barH=plotH/dHistory.length
        dHistory.forEach((d,i)=>{
          const y=pT+i*barH
          const col=d>0?(isDark?`rgba(74,222,128,${(0.2+Math.abs(d)*0.7).toFixed(2)})`:`rgba(22,163,74,${(0.2+Math.abs(d)*0.7).toFixed(2)})`)
                     :(isDark?`rgba(248,113,113,${(0.2+Math.abs(d)*0.7).toFixed(2)})`:`rgba(220,38,38,${(0.2+Math.abs(d)*0.7).toFixed(2)})`)
          ctx.fillStyle=col
          ctx.fillRect(dBx+1, y, DELTA_W-2, barH+0.5)
        })
      }
      ctx.fillStyle=isDark?'rgba(255,255,255,0.25)':'rgba(0,0,0,0.28)'
      ctx.font='8px monospace'; ctx.textAlign='center'
      ctx.fillText('Δ',dBx+DELTA_W/2,pT-6)

      // latest delta readout
      const latestD=dHistory[dHistory.length-1]??0
      ctx.fillStyle=latestD>0?(isDark?'#4ade80':'#16a34a'):(isDark?'#f87171':'#dc2626')
      ctx.font='bold 9px monospace'; ctx.textAlign='center'
      ctx.fillText(`${latestD>0?'+':''}${(latestD*100).toFixed(0)}%`,dBx+DELTA_W/2,H-14)

      // ── Time labels ──────────────────────────────────────────────────────────
      ctx.fillStyle=isDark?'rgba(255,255,255,0.18)':'rgba(0,0,0,0.22)'
      ctx.font='9px monospace'
      const secondsShown=Math.round(snaps.length*0.3)
      ctx.textAlign='left'; ctx.fillText(`${secondsShown}s ago`,pL+2,H-10)
      ctx.textAlign='right'; ctx.fillText('now',pL+plotW-2,H-10)

      rafRef.current=requestAnimationFrame(render)
    }
    rafRef.current=requestAnimationFrame(render)

    return ()=>{
      clearInterval(snapIv); clearInterval(tapeIv); clearInterval(deltaIv)
      cancelAnimationFrame(rafRef.current); ro.disconnect()
    }
  },[isDark])

  function toggleTheme(){
    const n=!isDark; setIsDark(n)
    try{ const p=JSON.parse(localStorage.getItem('heymonday_dashboard_prefs_v1')||'{}')
      localStorage.setItem('heymonday_dashboard_prefs_v1',JSON.stringify({...p,isDark:n})) }catch{}
  }

  return (
    <div style={{height:'100vh',background:C.pageBg,color:C.text,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'8px 16px',borderBottom:`1px solid ${C.border}`,background:C.panelBg,display:'flex',alignItems:'center',gap:14,flexShrink:0,flexWrap:'wrap'}}>
        <button onClick={()=>router.push('/dashboard')} style={{background:'none',border:'none',color:C.text3,cursor:'pointer',fontSize:12,padding:0}}>← Monday</button>
        <span style={{fontSize:12,fontWeight:700,color:C.gold,letterSpacing:'0.08em',textTransform:'uppercase'}}>Battlefield</span>
        <span style={{fontSize:10,color:C.text3}}>L2 order book over time — bids defend (green), asks attack (red), price traces the battle</span>
        <div style={{marginLeft:'auto'}}>
          <button onClick={toggleTheme} style={{background:'transparent',border:`1px solid ${C.border}`,padding:'4px 9px',color:C.text3,fontSize:13,cursor:'pointer'}}>{isDark?'☀':'◑'}</button>
        </div>
      </div>
      {/* How to trade */}
      <div style={{padding:'5px 16px',background:isDark?'rgba(232,184,75,0.04)':'rgba(184,117,12,0.05)',borderBottom:`1px solid ${C.borderFt}`,fontSize:10,color:C.text3,display:'flex',gap:20,flexWrap:'wrap',flexShrink:0}}>
        <span><b style={{color:C.green}}>Thick green band holds</b> → bid wall absorbing — buy the level, stop below</span>
        <span><b style={{color:C.red}}>Thick red band clears</b> → ask wall swept — momentum buy above, or reverse</span>
        <span><b style={{color:C.gold}}>ABSORB ring</b> → wall taking repeated hits without shrinking — high-conviction entry</span>
        <span><b style={{color:C.gold}}>Γ dashed line</b> → gamma wall — confluence with L2 = strongest S/R</span>
        <span><b style={{color:C.blue}}>Δ bar</b> → green=buyers in control, red=sellers</span>
      </div>
      <canvas ref={canvasRef} style={{flex:1,width:'100%',display:'block'}}/>
    </div>
  )
}
