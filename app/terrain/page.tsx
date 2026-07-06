'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const DARK_C = {
  pageBg:'#080808', panelBg:'#0a0a0a', cardBg:'#0d0d0d',
  border:'rgba(232,184,75,0.18)', borderFt:'rgba(232,184,75,0.09)',
  gold:'#e8b84b', goldFt:'rgba(232,184,75,0.10)',
  green:'#4ade80', red:'#f87171', blue:'#93c5fd', purple:'#c084fc',
  text:'#ffffff', text2:'rgba(255,255,255,0.75)',
  text3:'rgba(255,255,255,0.45)', text4:'rgba(255,255,255,0.22)',
}
const LIGHT_C = {
  pageBg:'#f5f4f1', panelBg:'#ffffff', cardBg:'#eeece8',
  border:'rgba(0,0,0,0.14)', borderFt:'rgba(0,0,0,0.07)',
  gold:'#b8750c', goldFt:'rgba(184,117,12,0.10)',
  green:'#16a34a', red:'#dc2626', blue:'#3b82f6', purple:'#9333ea',
  text:'#1a1a1a', text2:'rgba(0,0,0,0.72)',
  text3:'rgba(0,0,0,0.48)', text4:'rgba(0,0,0,0.24)',
}
type CT = typeof DARK_C

// ── Demo options data ─────────────────────────────────────────────────────────
interface StrikeData { strike:number; callOI:number; putOI:number; gammaWall:boolean }
const DEMO_STRIKES:StrikeData[] = [
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
  {strike:553,callOI:34600,putOI:8000, gammaWall:false},
  {strike:554,callOI:26400,putOI:6600, gammaWall:false},
  {strike:555,callOI:36800,putOI:9200, gammaWall:false},
  {strike:556,callOI:22400,putOI:5800, gammaWall:false},
  {strike:557,callOI:16800,putOI:4600, gammaWall:false},
  {strike:558,callOI:12400,putOI:3800, gammaWall:false},
]
const DEMO_PRICE = 543.28

// ── Generators ────────────────────────────────────────────────────────────────
let _tid = 1
function mockTape(lastPrice:number) {
  const price = Math.round((lastPrice + (Math.random()-0.49)*0.11)*100)/100
  const size  = Math.floor(Math.random()*14000)+100
  const side:'buy'|'sell' = Math.random()>0.5?'buy':'sell'
  const dark  = Math.random()<0.07
  const large = size>9000
  return {id:_tid++,ts:Date.now(),price,size,side,dark,large}
}
function mockL2(center:number) {
  return Array.from({length:20},(_,i)=>{
    const price = Math.round((center-0.40+i*0.04)*100)/100
    const prox  = 1-Math.abs(i-10)/10
    const base  = 8000+prox*70000
    return {
      price,
      bid: price < center  ? Math.floor(base*(0.4+Math.random()*0.6)) : 0,
      ask: price >= center ? Math.floor(base*(0.4+Math.random()*0.6)) : 0,
    }
  })
}

export default function TerrainPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(true)
  const [zoom, setZoom] = useState(4)        // ±$N around price
  const [ticker] = useState('SPY')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(()=>{
    try{ const p=JSON.parse(localStorage.getItem('heymonday_dashboard_prefs_v1')||'{}')
      if(typeof p.isDark==='boolean') setIsDark(p.isDark) }catch{}
  },[])

  const C = isDark ? DARK_C : LIGHT_C

  // Pre-compute terrain from demo data
  const BUCKET = 0.25
  const SPREAD = 2.0
  const terrainField = (p:number) =>
    DEMO_STRIKES.reduce((s,st)=>s+(st.callOI-st.putOI)*Math.exp(-((st.strike-p)**2)/(2*SPREAD**2)),0)

  const stRef = useRef<{
    tape:{id:number;ts:number;price:number;size:number;side:'buy'|'sell';dark:boolean;large:boolean}[]
    l2:{price:number;bid:number;ask:number}[]
    price:number
    colHistory:number[][]
    priceBuckets:number[]
    nid:number
  }>({tape:[],l2:[],price:DEMO_PRICE,colHistory:[],priceBuckets:[],nid:30000})

  const rafRef = useRef<number>(0)

  useEffect(()=>{
    const canvas = canvasRef.current; if(!canvas) return
    const ctx    = canvas.getContext('2d'); if(!ctx) return
    const st     = stRef.current

    // Seed history
    const MAX_COLS = 220
    const noise = () => 1+(Math.random()-0.5)*0.04

    const rebuildBuckets = (center:number, z:number) => {
      const min = center-z-0.5, max = center+z+0.5
      const b:number[] = []
      for(let p=min; p<=max; p+=BUCKET) b.push(Math.round(p*4)/4)
      return b
    }
    st.priceBuckets = rebuildBuckets(st.price, zoom)

    if(!st.colHistory.length) {
      const col = st.priceBuckets.map(p=>terrainField(p)*noise())
      for(let i=0;i<MAX_COLS;i++) st.colHistory.push(col.map(v=>v*noise()))
    }
    st.l2 = mockL2(st.price)

    const tapeIv = setInterval(()=>{
      const e = mockTape(st.price)
      st.price = e.price
      st.tape.unshift(e)
      if(st.tape.length>800) st.tape.pop()
    },160)

    const l2Iv = setInterval(()=>{ st.l2 = mockL2(st.price) },600)

    const colIv = setInterval(()=>{
      st.priceBuckets = rebuildBuckets(st.price, zoom)
      const col = st.priceBuckets.map(p=>terrainField(p)*noise())
      st.colHistory.push(col)
      if(st.colHistory.length>MAX_COLS) st.colHistory.shift()
    },1500)

    const ro = new ResizeObserver(()=>{
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    })
    ro.observe(canvas)
    canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight

    const render = () => {
      const W=canvas.width, H=canvas.height
      if(!W||!H){ rafRef.current=requestAnimationFrame(render); return }

      const cur    = st.price
      const dMin   = cur-zoom, dMax=cur+zoom, dRange=dMax-dMin
      const pL=64, pR=100, pT=20, pB=32
      const plotW  = W-pL-pR, plotH=H-pT-pB
      const py     = (p:number) => pT+(1-(p-dMin)/dRange)*plotH

      ctx.fillStyle = isDark?'#080808':'#f5f4f1'
      ctx.fillRect(0,0,W,H)

      // ── Terrain background ──────────────────────────────────────────────────
      const cols     = st.colHistory
      const maxG     = Math.max(...cols.flat().map(Math.abs),1)
      const colW     = Math.max(1,plotW/Math.max(cols.length,1))
      const NEUTRAL  = 0.12  // values below this fraction of maxG are grey

      cols.forEach((col,ci)=>{
        const x    = pL+ci*colW
        const tAge = ci/cols.length   // 0=old, 1=new
        const tFade= 0.25+tAge*0.75

        st.priceBuckets.forEach((p,pi)=>{
          if(p<dMin-BUCKET||p>dMax+BUCKET) return
          const y    = py(p)
          const raw  = col[pi]??0
          const norm = raw/maxG
          const abs  = Math.abs(norm)
          if(abs<NEUTRAL){ // neutral band — subtle grey
            ctx.fillStyle = isDark?`rgba(255,255,255,${(abs*0.08*tFade).toFixed(2)})`:`rgba(0,0,0,${(abs*0.06*tFade).toFixed(2)})`
          } else {
            const a = Math.min((abs-NEUTRAL)/(1-NEUTRAL)*0.85,0.78)*tFade
            ctx.fillStyle = norm>0
              ?(isDark?`rgba(74,222,128,${a.toFixed(2)})`:`rgba(22,163,74,${a.toFixed(2)})`)
              :(isDark?`rgba(248,113,113,${a.toFixed(2)})`:`rgba(220,38,38,${a.toFixed(2)})`)
          }
          ctx.fillRect(x, y-BUCKET/dRange*plotH*0.5+0.5, colW+0.5, BUCKET/dRange*plotH+0.5)
        })
      })

      // ── Horizontal grid + price labels ──────────────────────────────────────
      const step = zoom<=2?0.5:zoom<=4?1:2
      for(let p=Math.ceil(dMin/step)*step; p<=dMax; p+=step) {
        const y = py(p)
        ctx.strokeStyle = isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
        ctx.lineWidth=1; ctx.setLineDash([])
        ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(W-pR,y); ctx.stroke()
        ctx.fillStyle = isDark?'rgba(255,255,255,0.38)':'rgba(0,0,0,0.40)'
        ctx.font='10px monospace'; ctx.textAlign='right'
        ctx.fillText(`$${p.toFixed(step<1?2:0)}`,pL-5,y+4)
      }

      // ── Gamma wall dashed lines ─────────────────────────────────────────────
      DEMO_STRIKES.filter(s=>s.gammaWall&&s.strike>=dMin&&s.strike<=dMax).forEach(s=>{
        const y   = py(s.strike)
        const net = s.callOI-s.putOI
        const col = net>0?(isDark?'rgba(74,222,128,0.55)':'rgba(22,163,74,0.55)')
                        :(isDark?'rgba(248,113,113,0.55)':'rgba(220,38,38,0.55)')
        ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.setLineDash([6,5])
        ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(W-pR,y); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle=isDark?'#e8b84b':'#b8750c'
        ctx.font='bold 10px monospace'; ctx.textAlign='left'
        const oi = ((Math.max(s.callOI,s.putOI))/1000).toFixed(0)+'K'
        ctx.fillText(`Γ $${s.strike}  ${net>0?'C':'P'} ${oi}`, W-pR+4, y+4)
      })

      // ── Strike OI bar on right axis ─────────────────────────────────────────
      const maxOI = Math.max(...DEMO_STRIKES.map(s=>Math.max(s.callOI,s.putOI)))
      DEMO_STRIKES.filter(s=>s.strike>=dMin&&s.strike<=dMax).forEach(s=>{
        const y  = py(s.strike)
        const cW2= (s.callOI/maxOI)*34
        const pW2= (s.putOI /maxOI)*34
        ctx.fillStyle=isDark?'rgba(74,222,128,0.28)':'rgba(22,163,74,0.25)'
        ctx.fillRect(W-pR+2, y-4, cW2, 4)
        ctx.fillStyle=isDark?'rgba(248,113,113,0.28)':'rgba(220,38,38,0.25)'
        ctx.fillRect(W-pR+2, y+1, pW2, 4)
      })

      // ── Current L2 depth strip (far right, 36px) ────────────────────────────
      const l2Strip = W-32
      const maxL2   = Math.max(...st.l2.flatMap(l=>[l.bid,l.ask]),1)
      st.l2.forEach(l=>{
        if(l.price<dMin||l.price>dMax) return
        const y  = py(l.price)
        const rH = Math.max(2, BUCKET/dRange*plotH-1)
        if(l.bid>0) {
          const bW=(l.bid/maxL2)*28
          ctx.fillStyle=isDark?`rgba(74,222,128,0.55)`:`rgba(22,163,74,0.55)`
          ctx.fillRect(l2Strip-bW, y-rH/2, bW, rH)
        }
        if(l.ask>0) {
          const aW=(l.ask/maxL2)*28
          ctx.fillStyle=isDark?`rgba(248,113,113,0.55)`:`rgba(220,38,38,0.55)`
          ctx.fillRect(l2Strip, y-rH/2, aW, rH)
        }
      })
      ctx.strokeStyle=isDark?'rgba(255,255,255,0.10)':'rgba(0,0,0,0.10)'
      ctx.lineWidth=1; ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(l2Strip,pT); ctx.lineTo(l2Strip,H-pB); ctx.stroke()
      ctx.fillStyle=isDark?'rgba(255,255,255,0.22)':'rgba(0,0,0,0.22)'
      ctx.font='8px monospace'; ctx.textAlign='center'
      ctx.fillText('L2',l2Strip+1,pT-6)

      // ── Tape dots ───────────────────────────────────────────────────────────
      const now = Date.now(), timeWindow=cols.length*1500
      st.tape.forEach(e=>{
        const age=now-e.ts; if(age>timeWindow) return
        if(e.price<dMin||e.price>dMax) return
        const x   = pL+plotW*(1-age/timeWindow)
        const y   = py(e.price)
        const r   = e.large?9:e.dark?7:4
        const alpha=Math.max(0.18,1-age/timeWindow*0.72)
        const col = e.dark?C.purple:e.side==='buy'?C.green:C.red
        ctx.globalAlpha=alpha
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2)
        ctx.fillStyle=col; ctx.fill()
        if(e.large||e.dark) {
          ctx.globalAlpha=alpha*0.22
          ctx.beginPath(); ctx.arc(x,y,r*2.8,0,Math.PI*2)
          ctx.fillStyle=col; ctx.fill()
        }
      })
      ctx.globalAlpha=1

      // ── Current price line ──────────────────────────────────────────────────
      if(cur>=dMin&&cur<=dMax) {
        const y=py(cur)
        ctx.strokeStyle=isDark?'#e8b84b':'#b8750c'
        ctx.lineWidth=2.5; ctx.setLineDash([])
        ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(l2Strip-2,y); ctx.stroke()
        ctx.fillStyle=isDark?'#e8b84b':'#b8750c'
        ctx.font='bold 12px monospace'; ctx.textAlign='right'
        ctx.fillText(`$${cur.toFixed(2)}`,pL-5,y-6)
      }

      // ── Legend ──────────────────────────────────────────────────────────────
      const lgItems:[string,string][]=[
        [isDark?'rgba(74,222,128,0.75)':'rgba(22,163,74,0.75)','■ Call gamma zone'],
        [isDark?'rgba(248,113,113,0.75)':'rgba(220,38,38,0.75)','■ Put gamma zone'],
        [isDark?'#e8b84b':'#b8750c','— Gamma wall'],
        [C.green,'● Buy print'],
        [C.red,'● Sell print'],
        [C.purple,'● Dark pool'],
      ]
      let lx=pL; ctx.font='9px sans-serif'; ctx.textAlign='left'; ctx.globalAlpha=1
      lgItems.forEach(([col,txt])=>{
        ctx.fillStyle=col; ctx.fillText(txt,lx,H-8); lx+=ctx.measureText(txt).width+14
      })

      // ── Time axis ────────────────────────────────────────────────────────────
      ctx.fillStyle=isDark?'rgba(255,255,255,0.18)':'rgba(0,0,0,0.22)'
      ctx.font='9px monospace'; ctx.textAlign='right'
      ctx.fillText(`${Math.round(cols.length*1.5/60)}m ago`,pL+40,H-8)
      ctx.textAlign='left'; ctx.fillText('now',W-pR-34,H-8)

      rafRef.current = requestAnimationFrame(render)
    }
    rafRef.current = requestAnimationFrame(render)

    return ()=>{
      clearInterval(tapeIv); clearInterval(l2Iv); clearInterval(colIv)
      cancelAnimationFrame(rafRef.current); ro.disconnect()
    }
  },[isDark, zoom])

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
        <span style={{fontSize:12,fontWeight:700,color:C.gold,letterSpacing:'0.08em',textTransform:'uppercase'}}>Gamma Terrain</span>
        <span style={{fontSize:10,color:C.text3}}>Options gamma field — call zones green, put zones red — tape prints overlaid</span>
        <div style={{marginLeft:'auto',display:'flex',gap:10,alignItems:'center'}}>
          <label style={{fontSize:10,color:C.text3,display:'flex',alignItems:'center',gap:6}}>
            Zoom ±${zoom}
            <input type="range" min={1.5} max={8} step={0.5} value={zoom}
              onChange={e=>setZoom(Number(e.target.value))}
              style={{width:80,accentColor:C.gold}}/>
          </label>
          <button onClick={toggleTheme} style={{background:'transparent',border:`1px solid ${C.border}`,padding:'4px 9px',color:C.text3,fontSize:13,cursor:'pointer'}}>{isDark?'☀':'◑'}</button>
        </div>
      </div>
      {/* How to read */}
      <div style={{padding:'5px 16px',background:isDark?'rgba(232,184,75,0.04)':'rgba(184,117,12,0.05)',borderBottom:`1px solid ${C.borderFt}`,fontSize:10,color:C.text3,display:'flex',gap:20,flexWrap:'wrap',flexShrink:0}}>
        <span><b style={{color:C.green}}>Green band</b> = call-dominated gamma zone — expect price to bounce/compress</span>
        <span><b style={{color:C.red}}>Red band</b> = put-dominated zone — expect selling pressure / vol expansion</span>
        <span><b style={{color:C.gold}}>Γ dashed line</b> = gamma wall — market makers must hedge here, strongest S/R</span>
        <span><b style={{color:C.text2}}>Dots</b> = live tape prints scrolling right→left</span>
      </div>
      <canvas ref={canvasRef} style={{flex:1,width:'100%',display:'block'}}/>
    </div>
  )
}
