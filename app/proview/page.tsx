'use client'

// ProView — Unified options terrain + L2 order book + live tape
// The only retail tool that shows all three simultaneously on a shared price axis:
//   Background: options gamma terrain (macro structure)
//   Mid layer:  L2 bid/ask heatmap over time (micro structure)
//   Foreground: live tape print dots (execution)
//   Overlays:   Confluence zones, absorption rings, delta bar, VWAP

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const DARK_C = {
  pageBg:'#080808', panelBg:'#0a0a0a', cardBg:'#0d0d0d',
  border:'rgba(232,184,75,0.18)', borderFt:'rgba(232,184,75,0.08)',
  gold:'#e8b84b', goldFt:'rgba(232,184,75,0.12)',
  green:'#4ade80', red:'#f87171', blue:'#93c5fd', purple:'#c084fc',
  text:'#ffffff', text2:'rgba(255,255,255,0.75)',
  text3:'rgba(255,255,255,0.45)', text4:'rgba(255,255,255,0.20)',
}
const LIGHT_C = {
  pageBg:'#f5f4f1', panelBg:'#ffffff', cardBg:'#eeece8',
  border:'rgba(0,0,0,0.14)', borderFt:'rgba(0,0,0,0.06)',
  gold:'#b8750c', goldFt:'rgba(184,117,12,0.10)',
  green:'#16a34a', red:'#dc2626', blue:'#3b82f6', purple:'#9333ea',
  text:'#1a1a1a', text2:'rgba(0,0,0,0.72)',
  text3:'rgba(0,0,0,0.48)', text4:'rgba(0,0,0,0.20)',
}
type CT = typeof DARK_C

// ── Demo options data ─────────────────────────────────────────────────────────
interface Strike { strike:number; callOI:number; putOI:number; gammaWall:boolean }
const STRIKES:Strike[] = [
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
  {strike:551,callOI:56200,putOI:11800,gammaWall:false},
  {strike:552,callOI:42400,putOI:9400, gammaWall:false},
]
const DEMO_PRICE = 543.28
const GAMMA_SPREAD = 2.0  // Gaussian spread for gamma field
const gammaAt = (p:number) =>
  STRIKES.reduce((s,st)=>s+(st.callOI-st.putOI)*Math.exp(-((st.strike-p)**2)/(2*GAMMA_SPREAD**2)),0)

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
    const wallMulti=(Math.random()<0.04)?3.8:(Math.random()<0.06)?0.08:1
    return {
      price,
      bid:price<center?Math.floor(base*(0.5+Math.random()*0.5)*wallMulti):0,
      ask:price>=center?Math.floor(base*(0.5+Math.random()*0.5)*wallMulti):0,
    }
  })
}

export default function ProViewPage() {
  const router  = useRouter()
  const [isDark,setIsDark] = useState(true)
  const [zoom,  setZoom  ] = useState(3)   // ±$N around price
  useEffect(()=>{
    try{ const p=JSON.parse(localStorage.getItem('heymonday_dashboard_prefs_v1')||'{}')
      if(typeof p.isDark==='boolean') setIsDark(p.isDark) }catch{}
  },[])
  const C = isDark ? DARK_C : LIGHT_C

  const canvasRef=useRef<HTMLCanvasElement>(null)

  interface Snap { ts:number; price:number; levels:{price:number;bid:number;ask:number}[] }
  interface AbsorptionEvent { price:number; side:'bid'|'ask'; ts:number; count:number }

  const stRef=useRef<{
    snaps:Snap[]
    tape:{id:number;ts:number;price:number;size:number;side:'buy'|'sell';dark:boolean;large:boolean}[]
    price:number
    vwap:number
    vwapSum:number
    vwapCount:number
    vpoc:Map<number,number>  // volume at price (rounded to $0.04)
    deltaHistory:number[]
    absorptions:AbsorptionEvent[]
    prevL2:Map<number,{bid:number;ask:number}>
    hitCount:Map<number,number>
    terrainCols:number[][]
    nid:number
  }>({snaps:[],tape:[],price:DEMO_PRICE,vwap:DEMO_PRICE,vwapSum:0,vwapCount:0,vpoc:new Map(),deltaHistory:[],absorptions:[],prevL2:new Map(),hitCount:new Map(),terrainCols:[],nid:70000})

  const rafRef=useRef<number>(0)

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext('2d');if(!ctx)return
    const st=stRef.current
    const BUCKET=0.04, MAX_SNAPS=280, MAX_TCOLS=280
    const noise=()=>1+(Math.random()-0.5)*0.04

    // Pre-seed terrain columns
    if(!st.terrainCols.length){
      const buildCol=(center:number)=>{
        const buckets:number[]=[]
        for(let p=center-zoom-0.5;p<=center+zoom+0.5;p+=BUCKET) buckets.push(gammaAt(p)*noise())
        return buckets
      }
      for(let i=0;i<MAX_TCOLS;i++) st.terrainCols.push(buildCol(DEMO_PRICE))
    }

    const snapIv=setInterval(()=>{
      const levels=mockL2(st.price)
      // absorption check
      levels.forEach(l=>{
        const prev=st.prevL2.get(l.price)
        if(prev){
          const holdingBid=l.bid>0&&prev.bid>0&&(l.bid-prev.bid)>-prev.bid*0.12
          const holdingAsk=l.ask>0&&prev.ask>0&&(l.ask-prev.ask)>-prev.ask*0.12
          if(holdingBid||holdingAsk){
            st.hitCount.set(l.price,(st.hitCount.get(l.price)??0)+1)
            if((st.hitCount.get(l.price)??0)>=3){
              const ex=st.absorptions.find(a=>Math.abs(a.price-l.price)<0.02)
              if(!ex) st.absorptions.push({price:l.price,side:holdingBid?'bid':'ask',ts:Date.now(),count:3})
              else{ex.ts=Date.now();ex.count++}
            }
          } else st.hitCount.set(l.price,0)
        }
      })
      st.prevL2=new Map(levels.map(l=>[l.price,{bid:l.bid,ask:l.ask}]))
      st.snaps.push({ts:Date.now(),price:st.price,levels})
      if(st.snaps.length>MAX_SNAPS) st.snaps.shift()
      st.absorptions=st.absorptions.filter(a=>Date.now()-a.ts<9000)

      // Add terrain column
      const bMin=st.price-zoom-0.5, bMax=st.price+zoom+0.5
      const col:number[]=[]
      for(let p=bMin;p<=bMax;p+=BUCKET) col.push(gammaAt(p)*noise())
      st.terrainCols.push(col)
      if(st.terrainCols.length>MAX_TCOLS) st.terrainCols.shift()
    },350)

    const tapeIv=setInterval(()=>{
      const e=mockTape(st.price)
      st.price=e.price
      // VWAP
      st.vwapSum+=e.price*e.size; st.vwapCount+=e.size
      st.vwap=st.vwapSum/Math.max(st.vwapCount,1)
      // VPOC
      const pb=Math.round(e.price/BUCKET)*BUCKET
      st.vpoc.set(pb,(st.vpoc.get(pb)??0)+e.size)
      st.tape.unshift(e)
      if(st.tape.length>800) st.tape.pop()
    },160)

    const deltaIv=setInterval(()=>{
      const cutoff=Date.now()-60000
      const recent=st.tape.filter(e=>e.ts>cutoff)
      const buyV =recent.filter(e=>e.side==='buy').reduce((s,e)=>s+e.size,0)
      const sellV=recent.filter(e=>e.side==='sell').reduce((s,e)=>s+e.size,0)
      const total=Math.max(buyV+sellV,1)
      st.deltaHistory.push((buyV-sellV)/total)
      if(st.deltaHistory.length>80) st.deltaHistory.shift()
    },800)

    const ro=new ResizeObserver(()=>{canvas.width=canvas.offsetWidth;canvas.height=canvas.offsetHeight})
    ro.observe(canvas);canvas.width=canvas.offsetWidth;canvas.height=canvas.offsetHeight

    const render=()=>{
      const W=canvas.width,H=canvas.height
      if(!W||!H){rafRef.current=requestAnimationFrame(render);return}
      const cur=st.price
      const dMin=cur-zoom, dMax=cur+zoom, dRange=dMax-dMin
      const VPOC_W=28, DELTA_W=24, pL=60, pR=8
      const plotW=W-pL-pR-VPOC_W-DELTA_W
      const pT=22, pB=28, plotH=H-pT-pB
      const py=(p:number)=>pT+(1-(p-dMin)/dRange)*plotH

      ctx.fillStyle=isDark?'#080808':'#f5f4f1'
      ctx.fillRect(0,0,W,H)

      // ═══════════════════════════════════════════════════════════════════════
      // LAYER 1: Gamma terrain background (low opacity, macro structure)
      // ═══════════════════════════════════════════════════════════════════════
      {
        const tcols=st.terrainCols, bMin=cur-zoom-0.5
        const maxG=Math.max(...tcols.flat().map(Math.abs),1)
        const cW=Math.max(1,plotW/Math.max(tcols.length,1))
        const LEVEL_H=plotH/(dRange/BUCKET)+0.5
        const NEUTRAL=0.10

        tcols.forEach((col,ci)=>{
          const x=pL+ci*cW
          const tFade=(0.15+(ci/tcols.length)*0.85)*0.55 // terrain is background — keep subtle

          for(let bi=0;bi<col.length;bi++){
            const p=bMin+bi*BUCKET
            if(p<dMin-BUCKET||p>dMax+BUCKET) continue
            const y=py(p)
            const norm=col[bi]/maxG
            const abs=Math.abs(norm)
            if(abs<NEUTRAL) continue
            const a=Math.min((abs-NEUTRAL)/(1-NEUTRAL)*0.7,0.55)*tFade
            ctx.fillStyle=norm>0
              ?(isDark?`rgba(74,222,128,${a.toFixed(2)})`:`rgba(22,163,74,${a.toFixed(2)})`)
              :(isDark?`rgba(248,113,113,${a.toFixed(2)})`:`rgba(220,38,38,${a.toFixed(2)})`)
            ctx.fillRect(x,y-LEVEL_H*0.5,cW+0.5,LEVEL_H+0.5)
          }
        })
      }

      // ═══════════════════════════════════════════════════════════════════════
      // LAYER 2: L2 order book heatmap (mid opacity, micro structure)
      // ═══════════════════════════════════════════════════════════════════════
      {
        const snaps=st.snaps
        if(snaps.length){
          const maxBid=Math.max(...snaps.flatMap(s=>s.levels.map(l=>l.bid)),1)
          const maxAsk=Math.max(...snaps.flatMap(s=>s.levels.map(l=>l.ask)),1)
          const cW=Math.max(1,plotW/snaps.length)
          const LEVEL_H=plotH/(dRange/0.04)

          snaps.forEach((snap,si)=>{
            const x=pL+si*cW
            const tAge=si/snaps.length
            const fade=0.15+tAge*0.85

            snap.levels.forEach(l=>{
              if(l.price<dMin-0.04||l.price>dMax+0.04) return
              const y=py(l.price)
              if(l.bid>0){
                const a=Math.min((l.bid/maxBid)*fade*0.88,0.72)
                if(a>0.02){
                  ctx.fillStyle=isDark?`rgba(74,222,128,${a.toFixed(2)})`:`rgba(22,163,74,${a.toFixed(2)})`
                  ctx.fillRect(x,y-LEVEL_H*0.5,cW+0.5,LEVEL_H+0.5)
                }
              }
              if(l.ask>0){
                const a=Math.min((l.ask/maxAsk)*fade*0.88,0.72)
                if(a>0.02){
                  ctx.fillStyle=isDark?`rgba(248,113,113,${a.toFixed(2)})`:`rgba(220,38,38,${a.toFixed(2)})`
                  ctx.fillRect(x,y-LEVEL_H*0.5,cW+0.5,LEVEL_H+0.5)
                }
              }
            })
          })
        }
      }

      // ── Grid + price labels ─────────────────────────────────────────────────
      const GRID_STEP=zoom<=2?0.5:zoom<=3?0.5:1
      for(let p=Math.ceil(dMin/GRID_STEP)*GRID_STEP; p<=dMax; p+=GRID_STEP){
        const y=py(p)
        ctx.strokeStyle=isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
        ctx.lineWidth=1; ctx.setLineDash([])
        ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(pL+plotW,y); ctx.stroke()
        ctx.fillStyle=isDark?'rgba(255,255,255,0.38)':'rgba(0,0,0,0.40)'
        ctx.font='10px monospace'; ctx.textAlign='right'
        ctx.fillText(`$${p.toFixed(GRID_STEP<1?2:0)}`,pL-4,y+4)
      }

      // ── Gamma wall lines + confluence detection ──────────────────────────────
      STRIKES.filter(s=>s.gammaWall&&s.strike>=dMin&&s.strike<=dMax).forEach(s=>{
        const y=py(s.strike)
        // Confluence: check if there's significant L2 at this level
        const lastSnap=stRef.current.snaps[stRef.current.snaps.length-1]
        const l2AtStrike=lastSnap?.levels.find(l=>Math.abs(l.price-s.strike)<0.12)
        const maxL2Val=Math.max(...(lastSnap?.levels??[]).flatMap(l=>[l.bid,l.ask]),1)
        const l2Strength=l2AtStrike?(Math.max(l2AtStrike.bid,l2AtStrike.ask)/maxL2Val):0
        const isConfluence=l2Strength>0.35
        const net=s.callOI-s.putOI
        const zoneColor=net>0?(isDark?'rgba(74,222,128,0.65)':'rgba(22,163,74,0.65)')
                            :(isDark?'rgba(248,113,113,0.65)':'rgba(220,38,38,0.65)')

        if(isConfluence){
          // Highlight the entire row
          ctx.fillStyle=isDark?'rgba(232,184,75,0.08)':'rgba(184,117,12,0.07)'
          ctx.fillRect(pL,y-6,plotW,12)
        }
        ctx.strokeStyle=isConfluence?(isDark?'rgba(232,184,75,0.85)':'rgba(184,117,12,0.85)'):zoneColor
        ctx.lineWidth=isConfluence?2:1.5; ctx.setLineDash([8,5])
        ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(pL+plotW,y); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle=isDark?'#e8b84b':'#b8750c'
        ctx.font=`${isConfluence?'bold ':''}10px monospace`; ctx.textAlign='right'
        ctx.fillText(`Γ $${s.strike}${isConfluence?' ★CONF':''}`,pL-4,y-4)
      })

      // ── VWAP line ─────────────────────────────────────────────────────────
      const vwap=st.vwap
      if(vwap>=dMin&&vwap<=dMax){
        const y=py(vwap)
        ctx.strokeStyle=isDark?'rgba(147,197,253,0.60)':'rgba(59,130,246,0.60)'
        ctx.lineWidth=1.5; ctx.setLineDash([4,5])
        ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(pL+plotW,y); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle=isDark?C.blue:C.blue
        ctx.font='9px monospace'; ctx.textAlign='right'
        ctx.fillText(`VWAP $${vwap.toFixed(2)}`,pL-4,y+3)
      }

      // ── Price trace ───────────────────────────────────────────────────────
      {
        const snaps=st.snaps
        if(snaps.length>1){
          const cW=plotW/snaps.length
          ctx.strokeStyle=isDark?'#e8b84b':'#b8750c'
          ctx.lineWidth=2.5; ctx.setLineDash([]); ctx.lineJoin='round'
          ctx.beginPath()
          snaps.forEach((s,si)=>{
            const x=pL+si*cW+cW/2
            const y=py(Math.max(dMin,Math.min(dMax,s.price)))
            si===0?ctx.moveTo(x,y):ctx.lineTo(x,y)
          })
          ctx.stroke()
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // LAYER 3: Tape print dots (foreground — what's actually executing)
      // ═══════════════════════════════════════════════════════════════════════
      {
        const now=Date.now(), tw=st.snaps.length*350
        st.tape.forEach(e=>{
          const age=now-e.ts; if(age>tw) return
          if(e.price<dMin||e.price>dMax) return
          const x=pL+plotW*(1-age/tw)
          const y=py(e.price)
          const r=e.large?9:e.dark?7:4
          const alpha=Math.max(0.22,1-age/tw*0.70)
          const col=e.dark?C.purple:e.side==='buy'?C.green:C.red
          ctx.globalAlpha=alpha
          ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill()
          if(e.large||e.dark){
            ctx.globalAlpha=alpha*0.22
            ctx.beginPath(); ctx.arc(x,y,r*2.8,0,Math.PI*2); ctx.fillStyle=col; ctx.fill()
          }
        })
        ctx.globalAlpha=1
      }

      // ── Absorption rings ──────────────────────────────────────────────────
      {
        const cW=plotW/Math.max(st.snaps.length,1)
        const rightX=pL+plotW-cW*4
        st.absorptions.forEach(a=>{
          if(a.price<dMin||a.price>dMax) return
          const y=py(a.price)
          const age=(Date.now()-a.ts)/9000
          const r=10+age*12, alpha=Math.max(0,0.95-age)
          ctx.globalAlpha=alpha
          ctx.strokeStyle=isDark?'#e8b84b':'#b8750c'; ctx.lineWidth=2; ctx.setLineDash([])
          ctx.beginPath(); ctx.arc(rightX,y,r,0,Math.PI*2); ctx.stroke()
          if(alpha>0.5){
            ctx.fillStyle=isDark?'rgba(232,184,75,0.90)':'rgba(184,117,12,0.90)'
            ctx.font='bold 9px monospace'; ctx.textAlign='right'; ctx.globalAlpha=alpha
            ctx.fillText(`ABSORB`,rightX-r-4,y+3)
          }
        })
        ctx.globalAlpha=1; ctx.setLineDash([])
      }

      // ── Current price line ────────────────────────────────────────────────
      if(cur>=dMin&&cur<=dMax){
        const y=py(cur)
        ctx.strokeStyle=isDark?'#e8b84b':'#b8750c'; ctx.lineWidth=2.5; ctx.setLineDash([])
        ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(pL+plotW,y); ctx.stroke()
        ctx.fillStyle=isDark?'#e8b84b':'#b8750c'
        ctx.font='bold 12px monospace'; ctx.textAlign='right'
        ctx.fillText(`$${cur.toFixed(2)}`,pL-4,y-5)
      }

      // ── VPOC bar (left strip) ─────────────────────────────────────────────
      const vpocX=pL+plotW+pR
      const maxVpoc=Math.max(...st.vpoc.values(),1)
      ctx.fillStyle=isDark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)'
      ctx.fillRect(vpocX,pT,VPOC_W,plotH)
      st.vpoc.forEach((vol,price)=>{
        if(price<dMin||price>dMax) return
        const y=py(price)
        const barW=(vol/maxVpoc)*VPOC_W*0.9
        ctx.fillStyle=isDark?'rgba(147,197,253,0.38)':'rgba(59,130,246,0.32)'
        ctx.fillRect(vpocX,y-1,barW,3)
      })
      ctx.fillStyle=isDark?'rgba(255,255,255,0.20)':'rgba(0,0,0,0.22)'
      ctx.font='8px monospace'; ctx.textAlign='center'
      ctx.fillText('VOL',vpocX+VPOC_W/2,pT-6)

      // ── Delta bar (far right) ─────────────────────────────────────────────
      const dBx=vpocX+VPOC_W
      ctx.fillStyle=isDark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)'
      ctx.fillRect(dBx,pT,DELTA_W,plotH)
      ctx.strokeStyle=isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)'
      ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(dBx,pT); ctx.lineTo(dBx,H-pB); ctx.stroke()
      const dHist=st.deltaHistory
      if(dHist.length){
        const bH=plotH/dHist.length
        dHist.forEach((d,i)=>{
          const y=pT+i*bH
          const col=d>0?(isDark?`rgba(74,222,128,${(0.18+Math.abs(d)*0.72).toFixed(2)})`:`rgba(22,163,74,${(0.18+Math.abs(d)*0.72).toFixed(2)})`)
                     :(isDark?`rgba(248,113,113,${(0.18+Math.abs(d)*0.72).toFixed(2)})`:`rgba(220,38,38,${(0.18+Math.abs(d)*0.72).toFixed(2)})`)
          ctx.fillStyle=col; ctx.fillRect(dBx+1,y,DELTA_W-2,bH+0.5)
        })
      }
      ctx.fillStyle=isDark?'rgba(255,255,255,0.20)':'rgba(0,0,0,0.22)'
      ctx.font='8px monospace'; ctx.textAlign='center'
      ctx.fillText('Δ',dBx+DELTA_W/2,pT-6)
      const latestD=dHist[dHist.length-1]??0
      ctx.fillStyle=latestD>0?C.green:C.red
      ctx.font='bold 9px monospace'; ctx.textAlign='center'
      ctx.fillText(`${latestD>0?'+':''}${(latestD*100).toFixed(0)}%`,dBx+DELTA_W/2,H-10)

      // ── Time axis ─────────────────────────────────────────────────────────
      ctx.fillStyle=isDark?'rgba(255,255,255,0.16)':'rgba(0,0,0,0.20)'
      ctx.font='9px monospace'
      const sShown=Math.round(st.snaps.length*0.35)
      ctx.textAlign='left'; ctx.fillText(`${sShown}s ago`,pL+2,H-10)
      ctx.textAlign='right'; ctx.fillText('now',pL+plotW-2,H-10)

      // ── Legend strip ──────────────────────────────────────────────────────
      // (top bar — minimal)
      const ledge:[string,string][]=[
        [isDark?'rgba(74,222,128,0.55)':'rgba(22,163,74,0.55)','■ Call gamma + bid zone'],
        [isDark?'rgba(248,113,113,0.55)':'rgba(220,38,38,0.55)','■ Put gamma + ask zone'],
        [isDark?'#e8b84b':'#b8750c','— Gamma wall  ★ = confluence'],
        [isDark?'rgba(147,197,253,0.6)':'rgba(59,130,246,0.6)','— VWAP'],
        [C.green,'● Buy'],
        [C.red,'● Sell'],
        [C.purple,'● Dark pool'],
      ]
      let lx=pL
      ctx.font='9px sans-serif'; ctx.textAlign='left'; ctx.globalAlpha=1
      ledge.forEach(([col,txt])=>{
        ctx.fillStyle=col; ctx.fillText(txt,lx,H-8); lx+=ctx.measureText(txt).width+12
      })

      rafRef.current=requestAnimationFrame(render)
    }
    rafRef.current=requestAnimationFrame(render)

    return()=>{
      clearInterval(snapIv); clearInterval(tapeIv); clearInterval(deltaIv)
      cancelAnimationFrame(rafRef.current); ro.disconnect()
    }
  },[isDark,zoom])

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
        <span style={{fontSize:12,fontWeight:700,color:C.gold,letterSpacing:'0.08em',textTransform:'uppercase'}}>Pro View</span>
        <div style={{height:14,width:1,background:C.border}}/>
        <span style={{fontSize:10,color:C.green}}>■ Gamma terrain</span>
        <span style={{fontSize:10,color:isDark?'rgba(74,222,128,0.9)':'rgba(22,163,74,0.9)'}}>+</span>
        <span style={{fontSize:10,color:C.text3}}>L2 order book</span>
        <span style={{fontSize:10,color:isDark?'rgba(74,222,128,0.9)':'rgba(22,163,74,0.9)'}}>+</span>
        <span style={{fontSize:10,color:C.text3}}>live tape</span>
        <span style={{fontSize:10,color:C.gold}}>★ = gamma + L2 confluence</span>
        <div style={{marginLeft:'auto',display:'flex',gap:10,alignItems:'center'}}>
          <label style={{fontSize:10,color:C.text3,display:'flex',alignItems:'center',gap:6}}>
            Zoom ±${zoom}
            <input type="range" min={1.5} max={6} step={0.5} value={zoom}
              onChange={e=>setZoom(Number(e.target.value))}
              style={{width:80,accentColor:C.gold}}/>
          </label>
          <button onClick={toggleTheme} style={{background:'transparent',border:`1px solid ${C.border}`,padding:'4px 9px',color:C.text3,fontSize:13,cursor:'pointer'}}>{isDark?'☀':'◑'}</button>
        </div>
      </div>
      {/* Trade guide */}
      <div style={{padding:'5px 16px',background:isDark?'rgba(232,184,75,0.04)':'rgba(184,117,12,0.05)',borderBottom:`1px solid ${C.borderFt}`,fontSize:10,color:C.text3,display:'flex',gap:18,flexWrap:'wrap',flexShrink:0}}>
        <span><b style={{color:C.gold}}>★ CONFLUENCE</b> = gamma wall + L2 wall at same level — highest probability S/R</span>
        <span><b style={{color:C.gold}}>ABSORB</b> = wall holding under fire — strong entry signal</span>
        <span><b style={{color:C.green}}>Green = calls dominate + bids</b> / <b style={{color:C.red}}>Red = puts dominate + asks</b> — read the zone color to know the institutional bias</span>
        <span><b style={{color:isDark?C.blue:C.blue}}>VWAP</b> = intraday fair value — above = bullish bias, below = bearish</span>
      </div>
      <canvas ref={canvasRef} style={{flex:1,width:'100%',display:'block'}}/>
    </div>
  )
}
