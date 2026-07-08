'use client';

/**
 * PROVIEW — Structure vs. Flow
 * ----------------------------
 * One shared vertical price axis. Three horizons of the same market:
 *
 *   LEFT   — GAMMA STRUCTURE (slow):  options OI per strike. Big put OI = floor,
 *            big call OI = ceiling. These move once a day, not once a second.
 *   MIDDLE — LIVE FLOW (fast): a Bookmap-style liquidity heat trail (last 60s of
 *            L2 snapshots), the resting book right now, the price line, and the
 *            tape hitting those levels.
 *   RIGHT  — TAPE + 60s pressure.
 *
 * Because everything shares one y-axis, the three signals that matter literally
 * line up on screen:
 *   CONFLUENCE  = a gold beam when live L2 size stacks exactly on a gamma strike.
 *   ABSORPTION  = a pulsing chip when the tape keeps hitting a wall that won't move.
 *   SWEEP       = a red/green shatter flash when resting size vanishes under a print.
 * A verdict engine turns those into one sentence at the top: what to do, right now.
 *
 * Constraints honored: no chart libs, no Tailwind/CSS files, canvas + rAF,
 * per-frame state in refs, ResizeObserver, full cleanup, instant demo data.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/* ——————————————————————————— design tokens ——————————————————————————— */

const DARK = { pageBg: '#080808', gold: '#e8b84b', green: '#4ade80', red: '#f87171', purple: '#c084fc', text: '#ffffff' };
const LIGHT = { pageBg: '#f5f4f1', gold: '#b8750c', green: '#16a34a', red: '#dc2626', purple: '#9333ea', text: '#1a1a1a' };
type Tok = { pageBg: string; gold: string; green: string; red: string; purple: string; text: string };

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const PREFS_KEY = 'heymonday_dashboard_prefs_v1';

function alpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
function fmtK(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(n >= 9950 ? 0 : 1)}K` : `${Math.round(n)}`; }
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/* ——————————————————————————— demo market structure ——————————————————————————— */

interface KeyWall { price: number; side: 'put' | 'call'; oi: number }
const KEY_WALLS: KeyWall[] = [
  { price: 535, side: 'put', oi: 72000 },
  { price: 540, side: 'put', oi: 91000 },
  { price: 545, side: 'call', oi: 82000 },
  { price: 550, side: 'call', oi: 89000 },
];
const MAX_OI = 91000;

interface ChainRow { strike: number; call: number; put: number }
const CHAIN: ChainRow[] = (() => {
  const rows: ChainRow[] = [];
  for (let s = 531; s <= 558; s++) {
    const h1 = Math.abs(Math.sin(s * 12.9898) * 43758.5453) % 1;
    const h2 = Math.abs(Math.sin(s * 78.2330) * 12543.1230) % 1;
    let call = Math.round(3500 + h1 * 19000);
    let put = Math.round(3500 + h2 * 19000);
    const kw = KEY_WALLS.find(k => k.price === s);
    if (kw) {
      if (kw.side === 'call') { call = kw.oi; put = Math.round(6000 + h2 * 9000); }
      else { put = kw.oi; call = Math.round(6000 + h1 * 9000); }
    }
    rows.push({ strike: s, call, put });
  }
  return rows;
})();

/* ——————————————————————————— simulation ——————————————————————————— */

interface Print { t: number; price: number; size: number; side: 1 | -1; dark: boolean; large: boolean }
interface Lvl { price: number; size: number; wall: boolean; gamma: boolean }
interface Snap { t: number; bids: Lvl[]; asks: Lvl[] }
interface Sweep { t: number; price: number; side: 'bid' | 'ask'; size: number }
interface Sim {
  price: number;
  tape: Print[];
  hist: { t: number; p: number }[];
  book: { bids: Lvl[]; asks: Lvl[] };
  snaps: Snap[];
  sweeps: Sweep[];
  hits: Record<number, { t: number; size: number }[]>;
  liq: { bid: { price: number; until: number } | null; ask: { price: number; until: number } | null };
  viewCenter: number;
}

const T0 = 62; // seconds of prefilled history so the page is "alive" on first paint

function targetPrice(t: number) {
  const u = t - T0;
  return 542.7 + 2.3 * Math.sin(u * 0.072 + 0.26) + 0.45 * Math.sin(u * 0.31);
}

function stepTape(sim: Sim, t: number) {
  const tgt = targetPrice(t);
  let d = (tgt - sim.price) * 0.05 + (Math.random() - 0.5) * 0.075;
  d = clamp(d, -0.1, 0.1);
  // gamma walls defend: crossing attempts usually get damped (this *is* absorption)
  for (const kw of KEY_WALLS) {
    const before = sim.price - kw.price;
    const after = sim.price + d - kw.price;
    if (Math.sign(before) !== Math.sign(after) && Math.random() < 0.72) d *= 0.12;
  }
  sim.price = Math.round((sim.price + d) * 100) / 100;

  let pBuy = 0.5 + clamp((tgt - sim.price) * 0.55, -0.22, 0.22);
  for (const kw of KEY_WALLS) {
    const dist = sim.price - kw.price;
    if (kw.side === 'put' && dist >= -0.05 && dist < 0.3) pBuy += 0.12;
    if (kw.side === 'call' && dist <= 0.05 && dist > -0.3) pBuy -= 0.12;
  }
  const side: 1 | -1 = Math.random() < pBuy ? 1 : -1;
  const large = Math.random() < 0.10;
  const size = large
    ? Math.round(9000 + Math.random() * 5000)
    : Math.round(100 + Math.pow(Math.random(), 2.4) * 8800);
  const dark = Math.random() < 0.07;
  const px = Math.round((sim.price + (Math.random() - 0.5) * 0.02) * 100) / 100;

  sim.tape.unshift({ t, price: px, size, side, dark, large });
  if (sim.tape.length > 420) sim.tape.length = 420;

  sim.hist.push({ t, p: sim.price });
  while (sim.hist.length && t - sim.hist[0].t > 66) sim.hist.shift();

  for (const kw of KEY_WALLS) {
    if (Math.abs(px - kw.price) <= 0.15) {
      if (!sim.hits[kw.price]) sim.hits[kw.price] = [];
      sim.hits[kw.price].push({ t, size });
    }
    const arr = sim.hits[kw.price];
    if (arr) while (arr.length && t - arr[0].t > 10) arr.shift();
  }
}

function stepBook(sim: Sim, t: number) {
  const grid = Math.round(sim.price / 0.04) * 0.04;
  const mk = (price: number, i: number): Lvl => ({
    price: Math.round(price * 100) / 100,
    size: Math.round((4600 - i * 360) * (0.65 + Math.random() * 0.7)),
    wall: false,
    gamma: false,
  });
  const bids: Lvl[] = [];
  const asks: Lvl[] = [];
  for (let i = 1; i <= 9; i++) {
    bids.push(mk(grid - i * 0.04, i));
    asks.push(mk(grid + i * 0.04, i));
  }

  // transient liquidity walls: appear, sit, then either fade or get SWEPT
  (['bid', 'ask'] as const).forEach(key => {
    const w = sim.liq[key];
    if (w) {
      if (t > w.until) {
        sim.liq[key] = null;
        if (Math.random() < 0.6) {
          const sz = Math.round(9000 + Math.random() * 5000);
          sim.sweeps.push({ t, price: w.price, side: key, size: sz });
          sim.tape.unshift({ t, price: w.price, size: sz, side: key === 'bid' ? -1 : 1, dark: false, large: true });
        }
      } else {
        const arr = key === 'bid' ? bids : asks;
        const lvl = arr.find(l => Math.abs(l.price - w.price) < 0.021);
        if (lvl) { lvl.size = Math.round(lvl.size * (3.4 + Math.random() * 1.4)); lvl.wall = true; }
        else sim.liq[key] = null; // price drifted away; wall out of visible range
      }
    } else if (Math.random() < 0.055) {
      const off = (3 + Math.floor(Math.random() * 5)) * 0.04;
      sim.liq[key] = {
        price: Math.round((key === 'bid' ? grid - off : grid + off) * 100) / 100,
        until: t + 7 + Math.random() * 13,
      };
    }
  });

  // structural anchors: when a gamma strike is inside L2 range, real size rests there.
  // This is CONFLUENCE — options structure + live book at the same level.
  for (const kw of KEY_WALLS) {
    const arr = kw.side === 'put' ? bids : asks;
    const lvl = arr.find(l => Math.abs(l.price - kw.price) < 0.021);
    if (lvl) { lvl.size = Math.round(lvl.size * (4 + Math.random() * 1.2)); lvl.wall = true; lvl.gamma = true; }
  }

  sim.book = { bids, asks };
  sim.snaps.push({ t, bids, asks });
  while (sim.snaps.length && t - sim.snaps[0].t > 62) sim.snaps.shift();
  while (sim.sweeps.length && t - sim.sweeps[0].t > 5) sim.sweeps.shift();
}

function initSim(): Sim {
  const sim: Sim = {
    price: 543.28, tape: [], hist: [], book: { bids: [], asks: [] },
    snaps: [], sweeps: [], hits: {}, liq: { bid: null, ask: null }, viewCenter: 543.28,
  };
  let bookT = 0;
  for (let t = 0; t <= T0; t += 0.16) {
    stepTape(sim, t);
    if (t - bookT >= 0.3) { stepBook(sim, t); bookT = t; }
  }
  sim.viewCenter = sim.price;
  return sim;
}

/* ——————————————————————————— signal engines ——————————————————————————— */

function absorbState(sim: Sim, kw: KeyWall) {
  const arr = sim.hits[kw.price] || [];
  let vol = 0;
  for (const h of arr) vol += h.size;
  const defending = kw.side === 'put' ? sim.price >= kw.price - 0.06 : sim.price <= kw.price + 0.06;
  return { active: arr.length >= 7 && vol >= 22000 && defending, vol, n: arr.length };
}

interface Verdict {
  title: string; sub: string; tone: 'buy' | 'sell' | 'warn' | 'wait';
  putW: KeyWall; callW: KeyWall; dP: number; dC: number;
  buy: number; sell: number;
}
function computeVerdict(sim: Sim, t: number): Verdict {
  const price = sim.price;
  const putW = KEY_WALLS.filter(k => k.side === 'put' && k.price <= price).sort((a, b) => b.price - a.price)[0] || KEY_WALLS[0];
  const callW = KEY_WALLS.filter(k => k.side === 'call' && k.price >= price).sort((a, b) => a.price - b.price)[0] || KEY_WALLS[KEY_WALLS.length - 1];
  const dP = price - putW.price;
  const dC = callW.price - price;

  let buy = 0, sell = 0;
  for (const p of sim.tape) {
    if (t - p.t > 60) break;
    if (p.side === 1) buy += p.size; else sell += p.size;
  }

  const bidSweep = sim.sweeps.find(s => s.side === 'bid' && t - s.t < 4.5);
  const askSweep = sim.sweeps.find(s => s.side === 'ask' && t - s.t < 4.5);
  const aP = absorbState(sim, putW);
  const aC = absorbState(sim, callW);

  if (bidSweep) return {
    title: `BIDS SWEPT @ ${bidSweep.price.toFixed(2)}`,
    sub: `${fmtK(bidSweep.size)} print pulled the support wall — stand aside, breakdown risk toward $${putW.price}`,
    tone: 'warn', putW, callW, dP, dC, buy, sell,
  };
  if (askSweep) return {
    title: `OFFERS SWEPT @ ${askSweep.price.toFixed(2)}`,
    sub: `${fmtK(askSweep.size)} print cleared the resistance wall — breakout watch above, next lid $${callW.price}`,
    tone: 'buy', putW, callW, dP, dC, buy, sell,
  };
  if (dP < 0.45 && aP.active && buy >= sell * 0.85) return {
    title: `BUY ZONE · $${putW.price} HOLDING`,
    sub: `put wall absorbed ${fmtK(aP.vol)} of selling in 10s and hasn't moved — bids stacked on structure, risk is defined below`,
    tone: 'buy', putW, callW, dP, dC, buy, sell,
  };
  if (dP < 0.45) return {
    title: `TESTING $${putW.price} SUPPORT`,
    sub: `tape is hitting the ${fmtK(putW.oi)} put wall — wait for absorption before entering`,
    tone: 'wait', putW, callW, dP, dC, buy, sell,
  };
  if (dC < 0.45 && aC.active && sell >= buy * 0.85) return {
    title: `FADE ZONE · $${callW.price} CAPPING`,
    sub: `call wall absorbed ${fmtK(aC.vol)} of buying — trim longs into strength, don't chase this level`,
    tone: 'sell', putW, callW, dP, dC, buy, sell,
  };
  if (dC < 0.45) return {
    title: `TESTING $${callW.price} RESISTANCE`,
    sub: `buyers pressing the ${fmtK(callW.oi)} call wall — needs a sweep to break, otherwise it caps price`,
    tone: 'wait', putW, callW, dP, dC, buy, sell,
  };
  return {
    title: 'WAIT · MID-RANGE',
    sub: `no edge between walls — next decision at $${putW.price} below or $${callW.price} above`,
    tone: 'wait', putW, callW, dP, dC, buy, sell,
  };
}

/* ——————————————————————————— the page ——————————————————————————— */

export default function ProViewPage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<Sim | null>(null);
  const tokRef = useRef<Tok>(DARK);
  const reducedRef = useRef(false);

  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      if (typeof prefs.isDark === 'boolean') setIsDark(prefs.isDark);
    } catch { /* keep default */ }
    try {
      reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { tokRef.current = isDark ? DARK : LIGHT; }, [isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!simRef.current) simRef.current = initSim();
    const sim = simRef.current;
    const startMs = performance.now();
    const now = () => T0 + (performance.now() - startMs) / 1000;

    let cssW = 0, cssH = 0;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const dpr = window.devicePixelRatio || 1;
        cssW = e.contentRect.width;
        cssH = e.contentRect.height;
        canvas.width = Math.max(1, Math.round(cssW * dpr));
        canvas.height = Math.max(1, Math.round(cssH * dpr));
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
      }
    });
    ro.observe(wrap);

    const tapeTimer = window.setInterval(() => stepTape(sim, now()), 160);
    const bookTimer = window.setInterval(() => stepBook(sim, now()), 300);

    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (cssW < 40 || cssH < 40) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, cssW, cssH, now(), sim, tokRef.current, tokRef.current === DARK, reducedRef.current);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(tapeTimer);
      clearInterval(bookTimer);
      ro.disconnect();
    };
  }, []);

  const T = isDark ? DARK : LIGHT;
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)';
  const dim = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs, isDark: next }));
    } catch { /* ignore */ }
  };

  const legendDot = (color: string, label: string) => (
    <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 10, letterSpacing: '0.08em', color: dim }}>{label}</span>
    </span>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      background: T.pageBg, color: T.text, fontFamily: MONO,
      transition: 'background 200ms ease, color 200ms ease',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: '10px 16px', borderBottom: `1px solid ${border}`, flex: '0 0 auto',
      }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
            color: T.gold, background: 'transparent', border: `1px solid ${alpha(T.gold, 0.45)}`,
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
          }}
        >
          ← Monday
        </button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.14em' }}>PROVIEW</span>
          <span style={{ fontSize: 11, letterSpacing: '0.1em', color: dim }}>STRUCTURE + FLOW · SPY 0DTE</span>
        </div>
        <span style={{
          fontSize: 10, letterSpacing: '0.12em', color: T.gold,
          border: `1px solid ${alpha(T.gold, 0.35)}`, borderRadius: 999, padding: '3px 10px',
        }}>
          ● LIVE · DEMO FEED
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {legendDot(T.green, 'BIDS / BUYS')}
          {legendDot(T.red, 'ASKS / SELLS')}
          {legendDot(T.gold, 'GAMMA STRUCTURE')}
          {legendDot(T.purple, 'DARK POOL')}
          <button
            onClick={toggleTheme}
            aria-label="Toggle light or dark mode"
            style={{
              fontFamily: MONO, fontSize: 12, color: T.text, background: 'transparent',
              border: `1px solid ${border}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
            }}
          >
            {isDark ? '☀' : '☾'}
          </button>
        </div>
      </header>

      <div ref={wrapRef} style={{ flex: '1 1 auto', position: 'relative', minHeight: 0 }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, display: 'block' }} />
      </div>
    </div>
  );
}

/* ——————————————————————————— renderer ——————————————————————————— */

function draw(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, t: number,
  sim: Sim, T: Tok, dark: boolean, reduced: boolean,
) {
  const price = sim.price;
  const v = computeVerdict(sim, t);
  const pulse = reduced ? 0.75 : 0.6 + 0.4 * Math.sin(t * 4.2);

  ctx.clearRect(0, 0, w, h);
  ctx.textBaseline = 'middle';

  const dimText = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const faint = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const panelBg = dark ? '#0d0d0d' : '#ffffff';

  const PAD = 12;
  const narrow = w < 900;
  const gammaW = narrow ? 168 : 216;
  const tapeW = narrow ? 200 : 252;
  const gX0 = PAD, gX1 = PAD + gammaW;
  const tX1 = w - PAD, tX0 = tX1 - tapeW;
  const mX0 = gX1 + 10, mX1 = tX0 - 10;

  const panel = (x0: number, x1: number) => {
    rr(ctx, x0, PAD, x1 - x0, h - PAD * 2, 12);
    ctx.fillStyle = panelBg;
    ctx.fill();
    ctx.strokeStyle = faint;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  panel(gX0, gX1);
  panel(mX0, mX1);
  panel(tX0, tX1);

  /* — shared vertical mapping for the flow view — */
  sim.viewCenter += (price - sim.viewCenter) * 0.04;
  const span = 6.2;
  const chartY0 = PAD + 84;
  const chartY1 = h - PAD - 96;
  const chartH = Math.max(60, chartY1 - chartY0);
  const yOf = (p: number) => chartY0 + ((sim.viewCenter + span / 2 - p) / span) * chartH;
  const pxPerDollar = chartH / span;
  const lvlH = Math.max(2, 0.04 * pxPerDollar - 0.5);

  const labelW = 54;
  const heatX0 = mX0 + 10;
  const nowX = mX0 + (mX1 - mX0) * 0.56;
  const depthX1 = mX1 - labelW - 8;
  const heatW = nowX - heatX0;

  /* ———————— MIDDLE · LIVE FLOW ———————— */

  ctx.save();
  ctx.beginPath();
  ctx.rect(mX0 + 1, chartY0 - 6, mX1 - mX0 - 2, chartH + 12);
  ctx.clip();

  // gridlines every $0.50
  ctx.font = `10px ${MONO}`;
  const gridStart = Math.ceil((sim.viewCenter - span / 2) * 2) / 2;
  for (let p = gridStart; p <= sim.viewCenter + span / 2; p += 0.5) {
    const y = yOf(p);
    ctx.strokeStyle = faint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(heatX0, y);
    ctx.lineTo(mX1 - 8, y);
    ctx.stroke();
    ctx.fillStyle = dimText;
    ctx.textAlign = 'right';
    ctx.fillText(p.toFixed(2), mX1 - 12, y - 6);
  }

  // liquidity heat trail (last 60s of L2 snapshots on absolute price)
  const colW = Math.max(1.6, heatW / (62 / 0.3)) + 0.6;
  for (const snap of sim.snaps) {
    const x = nowX - ((t - snap.t) / 60) * heatW - colW;
    if (x < heatX0 - colW) continue;
    for (const lvl of snap.bids) {
      const inten = clamp(lvl.size / 9000, 0, 1);
      ctx.fillStyle = alpha(T.green, (lvl.wall ? 0.16 : 0.04) + inten * (lvl.wall ? 0.55 : 0.34));
      ctx.fillRect(Math.max(x, heatX0), yOf(lvl.price) - lvlH / 2, colW, lvlH);
    }
    for (const lvl of snap.asks) {
      const inten = clamp(lvl.size / 9000, 0, 1);
      ctx.fillStyle = alpha(T.red, (lvl.wall ? 0.16 : 0.04) + inten * (lvl.wall ? 0.55 : 0.34));
      ctx.fillRect(Math.max(x, heatX0), yOf(lvl.price) - lvlH / 2, colW, lvlH);
    }
  }

  // gamma wall bands across the whole flow view
  for (const kw of KEY_WALLS) {
    const y = yOf(kw.price);
    if (y < chartY0 - 30 || y > chartY1 + 30) continue;
    const thick = 8 + (kw.oi / MAX_OI) * 26;
    const c = kw.side === 'put' ? T.green : T.red;
    const grad = ctx.createLinearGradient(0, y - thick, 0, y + thick);
    grad.addColorStop(0, alpha(c, 0));
    grad.addColorStop(0.5, alpha(c, 0.16));
    grad.addColorStop(1, alpha(c, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(heatX0, y - thick, mX1 - 8 - heatX0, thick * 2);
    ctx.strokeStyle = alpha(T.gold, 0.85);
    ctx.setLineDash([7, 5]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(heatX0, y);
    ctx.lineTo(mX1 - 8, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'left';
    ctx.font = `700 11px ${MONO}`;
    ctx.fillStyle = T.gold;
    const tag = `$${kw.price} ${kw.side.toUpperCase()} WALL · ${fmtK(kw.oi)} OI`;
    ctx.fillText(tag, heatX0 + 4, y - Math.max(10, thick * 0.55) - 4);

    // absorption chip: tape keeps hitting the wall, wall isn't moving
    const ab = absorbState(sim, kw);
    if (ab.active) {
      const txt = `ABSORBING ${fmtK(ab.vol)} · NOT MOVING`;
      ctx.font = `700 10px ${MONO}`;
      const tw = ctx.measureText(txt).width;
      const bx = nowX + 10, by = y + (kw.side === 'put' ? 18 : -18);
      rr(ctx, bx - 6, by - 9, tw + 12, 18, 9);
      ctx.fillStyle = alpha(kw.side === 'put' ? T.green : T.red, 0.16 + 0.12 * pulse);
      ctx.fill();
      ctx.strokeStyle = alpha(kw.side === 'put' ? T.green : T.red, 0.5 + 0.4 * pulse);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = kw.side === 'put' ? T.green : T.red;
      ctx.fillText(txt, bx, by + 0.5);
    }
  }

  // sweep flashes: resting size vanished under a large print
  for (const sw of sim.sweeps) {
    const age = t - sw.t;
    if (age > 2.8) continue;
    const y = yOf(sw.price);
    const k = age / 2.8;
    const c = sw.side === 'bid' ? T.red : T.green;
    ctx.fillStyle = alpha(c, 0.28 * (1 - k));
    ctx.fillRect(heatX0, y - 4 - k * 26, mX1 - 8 - heatX0, 8 + k * 52);
    ctx.font = `800 12px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = alpha(c, 1 - k * 0.6);
    ctx.fillText(`⚡ ${sw.side === 'bid' ? 'BIDS' : 'OFFERS'} SWEPT · ${fmtK(sw.size)}`, (heatX0 + depthX1) / 2, y - 18 - k * 14);
  }

  // resting book right now (bars grow rightward from the "now" line)
  let maxSz = 1;
  for (const l of sim.book.bids) maxSz = Math.max(maxSz, l.size);
  for (const l of sim.book.asks) maxSz = Math.max(maxSz, l.size);
  const depthW = depthX1 - nowX - 6;
  const bar = (lvl: Lvl, c: string) => {
    const y = yOf(lvl.price);
    const len = Math.sqrt(lvl.size / maxSz) * depthW;
    ctx.fillStyle = alpha(c, lvl.wall ? 0.85 : 0.42);
    ctx.fillRect(nowX + 2, y - lvlH / 2, len, lvlH);
    if (lvl.wall) {
      ctx.strokeStyle = lvl.gamma ? T.gold : alpha(c, 0.9);
      ctx.lineWidth = lvl.gamma ? 1.5 : 1;
      ctx.strokeRect(nowX + 2, y - lvlH / 2, len, lvlH);
      ctx.font = `700 10px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = lvl.gamma ? T.gold : c;
      ctx.fillText(fmtK(lvl.size), nowX + 6 + len, y);
    }
  };
  for (const l of sim.book.bids) bar(l, T.green);
  for (const l of sim.book.asks) bar(l, T.red);

  // price trail over the heat
  ctx.beginPath();
  let started = false;
  for (const hpt of sim.hist) {
    const x = nowX - ((t - hpt.t) / 60) * heatW;
    if (x < heatX0) continue;
    const y = yOf(hpt.p);
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = alpha(T.gold, 0.9);
  ctx.lineWidth = 1.6;
  ctx.shadowColor = alpha(T.gold, 0.6);
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // recent prints hitting the now-line (buys/sells/dark pool)
  for (const p of sim.tape) {
    const age = t - p.t;
    if (age > 1.6) break;
    const y = yOf(p.price);
    const r = 1.5 + Math.sqrt(p.size) / 22;
    const c = p.dark ? T.purple : p.side === 1 ? T.green : T.red;
    ctx.beginPath();
    ctx.arc(nowX, y, r, 0, Math.PI * 2);
    ctx.fillStyle = alpha(c, 0.75 * (1 - age / 1.6));
    ctx.fill();
    if (p.large) {
      ctx.beginPath();
      ctx.arc(nowX, y, r + age * 16, 0, Math.PI * 2);
      ctx.strokeStyle = alpha(c, 0.6 * (1 - age / 1.6));
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // current price line + tag
  const py = yOf(price);
  ctx.strokeStyle = alpha(T.gold, 0.95);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(heatX0, py);
  ctx.lineTo(depthX1, py);
  ctx.stroke();
  ctx.font = `800 13px ${MONO}`;
  const ptxt = price.toFixed(2);
  const ptw = ctx.measureText(ptxt).width;
  rr(ctx, mX1 - 10 - ptw - 14, py - 11, ptw + 14, 22, 6);
  ctx.fillStyle = T.gold;
  ctx.fill();
  ctx.fillStyle = dark ? '#080808' : '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(ptxt, mX1 - 10 - ptw - 7, py + 0.5);

  // off-screen key walls — edge chips so you always know what's above/below
  ctx.font = `700 10px ${MONO}`;
  for (const kw of KEY_WALLS) {
    const y = yOf(kw.price);
    if (y >= chartY0 - 30 && y <= chartY1 + 30) continue;
    const above = y < chartY0;
    const txt = `${above ? '▲' : '▼'} $${kw.price} ${kw.side.toUpperCase()} WALL · ${fmtK(kw.oi)} · ${Math.abs(kw.price - price).toFixed(1)} AWAY`;
    const tw = ctx.measureText(txt).width;
    const cy = above ? chartY0 + 10 : chartY1 - 10;
    rr(ctx, heatX0 + 2, cy - 9, tw + 14, 18, 9);
    ctx.fillStyle = alpha(T.gold, 0.12);
    ctx.fill();
    ctx.strokeStyle = alpha(T.gold, 0.4);
    ctx.stroke();
    ctx.fillStyle = T.gold;
    ctx.textAlign = 'left';
    ctx.fillText(txt, heatX0 + 9, cy + 0.5);
  }

  ctx.restore();

  // "now" divider between the heat trail and the resting book
  ctx.strokeStyle = alpha(T.gold, 0.25);
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(nowX, chartY0);
  ctx.lineTo(nowX, chartY1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `9px ${MONO}`;
  ctx.fillStyle = dimText;
  ctx.textAlign = 'center';
  ctx.fillText('←60s — LIQUIDITY HEAT', (heatX0 + nowX) / 2, chartY1 + 12);
  ctx.fillText('RESTING BOOK NOW →', (nowX + depthX1) / 2, chartY1 + 12);

  /* — CONFLUENCE beam: gamma strike + live L2 wall at the same price — */
  for (const kw of KEY_WALLS) {
    const arr = kw.side === 'put' ? sim.book.bids : sim.book.asks;
    const lvl = arr.find(l => l.gamma && l.wall && Math.abs(l.price - kw.price) < 0.021);
    if (!lvl) continue;
    const y = yOf(kw.price);
    if (y < chartY0 || y > chartY1) continue;
    const grad = ctx.createLinearGradient(gX0, 0, depthX1, 0);
    grad.addColorStop(0, alpha(T.gold, 0));
    grad.addColorStop(0.5, alpha(T.gold, 0.10 + 0.10 * pulse));
    grad.addColorStop(1, alpha(T.gold, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(gX0 + 6, y - 9, depthX1 - gX0 - 12, 18);
    ctx.strokeStyle = alpha(T.gold, 0.35 + 0.35 * pulse);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gX0 + 6, y - 9); ctx.lineTo(depthX1, y - 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gX0 + 6, y + 9); ctx.lineTo(depthX1, y + 9); ctx.stroke();

    const txt = `★ CONFLUENCE — ${fmtK(kw.oi)} OI + ${fmtK(lvl.size)} LIVE ${kw.side === 'put' ? 'BIDS' : 'OFFERS'}`;
    ctx.font = `800 10px ${MONO}`;
    const tw = ctx.measureText(txt).width;
    const bx = heatX0 + 4, by = y + (kw.side === 'put' ? 26 : -26);
    rr(ctx, bx - 6, by - 10, tw + 12, 20, 10);
    ctx.fillStyle = dark ? '#141005' : '#fdf6e3';
    ctx.fill();
    ctx.strokeStyle = alpha(T.gold, 0.8);
    ctx.stroke();
    ctx.fillStyle = T.gold;
    ctx.textAlign = 'left';
    ctx.fillText(txt, bx, by + 0.5);
  }

  /* — verdict banner (the answer, not the homework) — */
  const toneC = v.tone === 'buy' ? T.green : v.tone === 'sell' || v.tone === 'warn' ? T.red : T.gold;
  const bY = PAD + 10, bH = 62;
  rr(ctx, mX0 + 8, bY, mX1 - mX0 - 16, bH, 10);
  ctx.fillStyle = alpha(toneC, dark ? 0.10 : 0.08);
  ctx.fill();
  ctx.strokeStyle = alpha(toneC, 0.55);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = `800 ${narrow ? 15 : 19}px ${MONO}`;
  ctx.fillStyle = toneC;
  const arrow = v.tone === 'buy' ? '▲ ' : v.tone === 'sell' || v.tone === 'warn' ? '▼ ' : '◆ ';
  ctx.fillText(arrow + v.title, mX0 + 22, bY + 20);
  ctx.font = `11px ${MONO}`;
  ctx.fillStyle = dimText;
  const subMax = mX1 - mX0 - (narrow ? 44 : 250);
  let sub = v.sub;
  if (ctx.measureText(sub).width > subMax) {
    while (sub.length > 4 && ctx.measureText(sub + '…').width > subMax) sub = sub.slice(0, -1);
    sub += '…';
  }
  ctx.fillText(sub, mX0 + 22, bY + 43);

  if (!narrow) {
    ctx.textAlign = 'right';
    ctx.font = `700 11px ${MONO}`;
    ctx.fillStyle = T.red;
    ctx.fillText(`▲ $${v.callW.price} CALL WALL · ${v.dC.toFixed(2)} AWAY`, mX1 - 22, bY + 18);
    ctx.fillStyle = T.green;
    ctx.fillText(`▼ $${v.putW.price} PUT WALL · ${v.dP.toFixed(2)} AWAY`, mX1 - 22, bY + 44);
  }

  /* — 60s pressure strip — */
  const sY0 = h - PAD - 84;
  ctx.textAlign = 'left';
  ctx.font = `700 10px ${MONO}`;
  ctx.fillStyle = dimText;
  ctx.fillText('ORDER FLOW · LAST 60S', mX0 + 18, sY0 + 12);

  const tot = Math.max(1, v.buy + v.sell);
  const buyPct = v.buy / tot;
  const barX0 = mX0 + 18, barX1 = mX1 - 18, barY = sY0 + 26, barH = 16;
  rr(ctx, barX0, barY, barX1 - barX0, barH, 8);
  ctx.fillStyle = faint;
  ctx.fill();
  ctx.save();
  rr(ctx, barX0, barY, barX1 - barX0, barH, 8);
  ctx.clip();
  ctx.fillStyle = alpha(T.green, 0.8);
  ctx.fillRect(barX0, barY, (barX1 - barX0) * buyPct, barH);
  ctx.fillStyle = alpha(T.red, 0.8);
  ctx.fillRect(barX0 + (barX1 - barX0) * buyPct, barY, (barX1 - barX0) * (1 - buyPct), barH);
  ctx.restore();
  ctx.strokeStyle = T.text;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(barX0 + (barX1 - barX0) * 0.5, barY - 3);
  ctx.lineTo(barX0 + (barX1 - barX0) * 0.5, barY + barH + 3);
  ctx.stroke();

  ctx.font = `700 11px ${MONO}`;
  ctx.fillStyle = T.green;
  ctx.fillText(`BUY ${(buyPct * 100).toFixed(0)}% · ${fmtK(v.buy)}`, barX0, barY + barH + 14);
  ctx.textAlign = 'right';
  ctx.fillStyle = T.red;
  ctx.fillText(`${fmtK(v.sell)} · ${((1 - buyPct) * 100).toFixed(0)}% SELL`, barX1, barY + barH + 14);
  const delta = v.buy - v.sell;
  ctx.textAlign = 'center';
  ctx.fillStyle = delta >= 0 ? T.green : T.red;
  ctx.fillText(`Δ ${delta >= 0 ? '+' : '-'}${fmtK(Math.abs(delta))}`, (barX0 + barX1) / 2, barY + barH + 14);

  /* ———————— LEFT · GAMMA STRUCTURE ———————— */

  ctx.textAlign = 'left';
  ctx.font = `800 11px ${MONO}`;
  ctx.fillStyle = T.text;
  ctx.fillText('GAMMA STRUCTURE', gX0 + 14, PAD + 20);
  ctx.font = `9px ${MONO}`;
  ctx.fillStyle = dimText;
  ctx.fillText('SPY OPTIONS OPEN INTEREST', gX0 + 14, PAD + 34);
  ctx.fillStyle = alpha(T.green, 0.9);
  ctx.fillText('■ PUT OI = FLOOR', gX0 + 14, PAD + 50);
  ctx.fillStyle = alpha(T.red, 0.9);
  ctx.fillText('■ CALL OI = CEILING', gX0 + 98, PAD + 50);

  const lY0 = PAD + 66, lY1 = h - PAD - 16;
  const sMin = 530.5, sMax = 558.5;
  const lyOf = (s: number) => lY0 + ((sMax - s) / (sMax - sMin)) * (lY1 - lY0);
  const rowH = (lY1 - lY0) / (sMax - sMin);
  const barMax = gammaW - 78;
  const lab = 40;

  // view window of the flow panel, projected onto the ladder
  const wy0 = lyOf(sim.viewCenter + span / 2);
  const wy1 = lyOf(sim.viewCenter - span / 2);
  ctx.fillStyle = alpha(T.gold, 0.06);
  ctx.fillRect(gX0 + 4, wy0, gammaW - 8, wy1 - wy0);
  ctx.strokeStyle = alpha(T.gold, 0.3);
  ctx.setLineDash([2, 3]);
  ctx.strokeRect(gX0 + 4, wy0, gammaW - 8, wy1 - wy0);
  ctx.setLineDash([]);

  for (const row of CHAIN) {
    const y = lyOf(row.strike);
    const isKey = KEY_WALLS.some(k => k.price === row.strike);
    const bh = clamp(rowH * 0.34, 2.5, 7);
    const putLen = (row.put / MAX_OI) * barMax;
    const callLen = (row.call / MAX_OI) * barMax;
    ctx.fillStyle = alpha(T.green, isKey ? 0.95 : 0.4);
    ctx.fillRect(gX0 + lab + 14, y - bh - 1, putLen, bh);
    ctx.fillStyle = alpha(T.red, isKey ? 0.95 : 0.4);
    ctx.fillRect(gX0 + lab + 14, y + 1, callLen, bh);

    ctx.font = `${isKey ? '800' : '400'} 9px ${MONO}`;
    ctx.fillStyle = isKey ? T.gold : dimText;
    ctx.textAlign = 'right';
    ctx.fillText(String(row.strike), gX0 + lab + 8, y);

    if (isKey) {
      const kw = KEY_WALLS.find(k => k.price === row.strike)!;
      ctx.textAlign = 'left';
      ctx.font = `800 8.5px ${MONO}`;
      ctx.fillStyle = T.gold;
      const len = kw.side === 'put' ? putLen : callLen;
      const yy = kw.side === 'put' ? y - bh / 2 - 1 : y + bh / 2 + 1;
      ctx.fillText(`${kw.side.toUpperCase()} WALL ${fmtK(kw.oi)}`, gX0 + lab + 18 + len, yy);
    }
  }

  // current price on the ladder
  const lpy = clamp(lyOf(price), lY0, lY1);
  ctx.strokeStyle = T.gold;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(gX0 + 8, lpy);
  ctx.lineTo(gX1 - 8, lpy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gX0 + 8, lpy);
  ctx.lineTo(gX0 + 14, lpy - 4);
  ctx.lineTo(gX0 + 14, lpy + 4);
  ctx.closePath();
  ctx.fillStyle = T.gold;
  ctx.fill();
  ctx.font = `800 10px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText(price.toFixed(2), gX0 + 18, lpy - 8);

  /* ———————— RIGHT · TAPE ———————— */

  ctx.textAlign = 'left';
  ctx.font = `800 11px ${MONO}`;
  ctx.fillStyle = T.text;
  ctx.fillText('TAPE · TIME & SALES', tX0 + 14, PAD + 20);
  ctx.font = `9px ${MONO}`;
  ctx.fillStyle = dimText;
  ctx.fillText('EXECUTIONS HITTING THE LEVELS', tX0 + 14, PAD + 34);

  const listY0 = PAD + 50;
  const rowStep = 20;
  const rows = Math.max(0, Math.floor((h - PAD - 14 - listY0) / rowStep));
  ctx.save();
  ctx.beginPath();
  ctx.rect(tX0 + 1, listY0 - 8, tapeW - 2, h - PAD - listY0);
  ctx.clip();

  let i = 0;
  for (const p of sim.tape) {
    if (i >= rows) break;
    const y = listY0 + i * rowStep + 8;
    const c = p.dark ? T.purple : p.side === 1 ? T.green : T.red;
    if (p.large) {
      ctx.fillStyle = alpha(c, 0.10);
      ctx.fillRect(tX0 + 6, y - 9, tapeW - 12, 18);
    }
    const dt = new Date(Date.now() - (t - p.t) * 1000);
    const ts = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}:${String(dt.getSeconds()).padStart(2, '0')}`;
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = dimText;
    ctx.textAlign = 'left';
    ctx.fillText(ts, tX0 + 12, y);
    ctx.font = `${p.large ? '800' : '400'} 10px ${MONO}`;
    ctx.fillStyle = T.text;
    ctx.fillText(p.price.toFixed(2), tX0 + (narrow ? 62 : 72), y);
    ctx.fillStyle = c;
    ctx.textAlign = 'right';
    ctx.fillText(fmtK(p.size), tX1 - (narrow ? 34 : 48), y);
    ctx.textAlign = 'left';
    ctx.fillText(p.side === 1 ? '▲' : '▼', tX1 - (narrow ? 26 : 40), y);
    if (p.dark && !narrow) {
      ctx.fillStyle = T.purple;
      ctx.font = `800 8px ${MONO}`;
      ctx.fillText('DP', tX1 - 26, y);
    }
    i++;
  }
  ctx.restore();
}
