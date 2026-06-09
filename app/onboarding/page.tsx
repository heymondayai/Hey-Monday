'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/app/context/theme-context'
import Link from 'next/link'
import { saveWindows } from '@/lib/useWakeSchedule'

// ── THEME ─────────────────────────────────────────────────────────────────────

const DARK = {
  pageBg: '#0a0a08', bg2: '#120f07', bg3: '#181410', bg4: '#1c1608',
  border: '#2a2618', border2: '#3a3420',
  gold: '#c9922a', goldDim: '#8a6420', goldFaint: 'rgba(201,146,42,0.12)',
  text: '#d4c5a0', text2: '#a08040', text3: '#6a6050', text4: '#4a4030',
  heading: '#e8d5a0',
  navBg: '#0a0a08',
  cardBg: 'rgba(255,255,255,0.02)', cardBorder: 'rgba(255,255,255,0.07)',
  featureText: 'rgba(212,197,160,0.35)', featureTextOn: 'rgba(212,197,160,0.8)',
  subText: 'rgba(212,197,160,0.4)',
  toggleOff: 'rgba(255,255,255,0.1)',
  gridLine: 'rgba(201,146,42,.03)',
  errColor: '#c94242',
  green: '#4ade80',
  greenFaint: 'rgba(74,222,128,0.12)',
  blue: '#60a5fa',
  blueFaint: 'rgba(96,165,250,0.12)',
  amber: '#f59e0b',
  amberFaint: 'rgba(245,158,11,0.12)',
}

const LIGHT = {
  pageBg: '#fafaf8', bg2: '#f2f1ee', bg3: '#eeede9', bg4: '#dedad5',
  border: '#d8d5d0', border2: '#c4c1bc',
  gold: '#b8750c', goldDim: '#9a6008', goldFaint: 'rgba(184,117,12,0.08)',
  text: '#1a1a1a', text2: '#4a4a4a', text3: '#737373', text4: '#a0a0a0',
  heading: '#0f0f0f',
  navBg: '#fafaf8',
  cardBg: 'rgba(0,0,0,0.02)', cardBorder: 'rgba(0,0,0,0.08)',
  featureText: 'rgba(0,0,0,0.35)', featureTextOn: 'rgba(0,0,0,0.80)',
  subText: 'rgba(0,0,0,0.45)',
  toggleOff: 'rgba(0,0,0,0.12)',
  gridLine: 'rgba(0,0,0,.03)',
  errColor: '#dc2626',
  green: '#16a34a',
  greenFaint: 'rgba(22,163,74,0.08)',
  blue: '#2563eb',
  blueFaint: 'rgba(37,99,235,0.08)',
  amber: '#d97706',
  amberFaint: 'rgba(217,119,6,0.08)',
}

// ── TRADER TYPES ─────────────────────────────────────────────────────────────

const TRADER_TYPES = [
  {
    id: 'day', icon: '⚡', label: 'Day Trader',
    sub: 'I open and close positions same day',
    features: ['Real-time prices & volume spikes', 'Options flow alerts', 'Instant voice alerts on big moves', '"What just happened" explanations'],
    color: '#e05c5c', borderColor: 'rgba(224,92,92,0.35)', bgColor: 'rgba(224,92,92,0.05)',
    glowDark: 'rgba(224,92,92,0.12)', glowLight: 'rgba(224,92,92,0.07)',
  },
  {
    id: 'swing', icon: '📈', label: 'Swing Trader',
    sub: 'I hold positions for days or weeks',
    features: ['Morning briefings', 'Earnings calendar & previews', 'Sector rotation signals', 'AI-curated watchlist news'],
    color: '#c9922a', borderColor: 'rgba(201,146,42,0.35)', bgColor: 'rgba(201,146,42,0.05)',
    glowDark: 'rgba(201,146,42,0.12)', glowLight: 'rgba(201,146,42,0.07)',
  },
  {
    id: 'longterm', icon: '🏦', label: 'Long-Term Investor',
    sub: 'I think in months and years',
    features: ['Macro & Fed calendar focus', 'Monthly portfolio briefings', 'Deep AI research mode', 'Low noise, calm interface'],
    color: '#5a8fc2', borderColor: 'rgba(90,143,194,0.35)', bgColor: 'rgba(90,143,194,0.05)',
    glowDark: 'rgba(90,143,194,0.12)', glowLight: 'rgba(90,143,194,0.07)',
  },
]

// ── FEATURE HIGHLIGHTS (done screen) ─────────────────────────────────────────

const FEATURES = [
  { icon: '🎙️', label: 'Wake Word', desc: 'Say "Hey Monday" anytime to ask questions hands-free — no keyboard needed.' },
  { icon: '💬', label: 'AI Chat', desc: 'Ask about prices, news, candles, sectors, catalysts, calendar events, anything.' },
  { icon: '📅', label: 'Smart Alerts', desc: 'Get notified before high-impact economic events and price moves on your watchlist.' },
  { icon: '📊', label: 'Daily Briefing', desc: 'Monday briefs you each morning on market conditions before the open.' },
]

// ── HOURS ─────────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const ampm = i < 12 ? 'AM' : 'PM'
  const h = i === 0 ? 12 : i > 12 ? i - 12 : i
  return { value: i, label: `${h}:00 ${ampm}` }
})

const BRIEFING_HOURS = HOURS.filter(h => h.value >= 4 && h.value <= 12)

// ── ONBOARDING PRESET SUMMARIES ───────────────────────────────────────────────

const ONBOARDING_PRESETS = [
  {
    name: 'Pre-Market',
    defaultTime: '09:00',
    prompt: 'Give me a pre-market briefing for today focused on my watchlist, biggest catalysts, and macro risks.',
    top_color: '#e8b84b',
    blurb: 'Before the open',
    hoverCopy: 'Watchlist, overnight movers, major headlines, macro events, and biggest risks heading into the open.',
  },
  {
    name: 'Open Pulse',
    defaultTime: '10:00',
    prompt: 'Give me a market open pulse with the strongest and weakest names on my watchlist plus the biggest early driver.',
    top_color: '#4ade80',
    blurb: 'First move after the bell',
    hoverCopy: 'Early strength and weakness, opening drivers, immediate watchlist movement, and what looks actionable right after the bell.',
  },
  {
    name: 'Midday',
    defaultTime: '12:00',
    prompt: 'Give me a midday summary of my watchlist, sector rotation, and what matters most into the afternoon.',
    top_color: '#7ab8e8',
    blurb: 'Mid-session reset',
    hoverCopy: 'Watchlist trends, sector rotation, market tone, and what matters most heading into the second half.',
  },
  {
    name: 'Power Hour',
    defaultTime: '15:00',
    prompt: 'Give me a power hour summary with strongest movers, closing themes, and any setups into the close.',
    top_color: '#f59e0b',
    blurb: 'Into the close',
    hoverCopy: 'Strongest movers, late-session momentum, closing themes, and anything worth watching into the final hour.',
  },
  {
    name: 'End of Day',
    defaultTime: '16:00',
    prompt: 'Give me an end of day recap focused on my watchlist, major catalysts, and what matters for tomorrow.',
    top_color: '#c084fc',
    blurb: 'Wrap up the session',
    hoverCopy: 'Biggest moves, key catalysts, how your watchlist finished, and what matters most for tomorrow.',
  },
]

function formatEtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${h12}:${m.toString().padStart(2, '0')} ${period} ET`
}

function nextWeekdayAtEtTime(hhmm: string): string {
  const [hour, minute] = hhmm.split(':').map(Number)
  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const d = new Date(Date.now() + daysAhead * 86_400_000)
    // Check if this day is a weekday in ET
    const etDayOfWeek = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay()
    if (etDayOfWeek === 0 || etDayOfWeek === 6) continue
    // Get ET date components
    const etParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d)
    const year = parseInt(etParts.find(p => p.type === 'year')!.value)
    const month = parseInt(etParts.find(p => p.type === 'month')!.value)
    const day = parseInt(etParts.find(p => p.type === 'day')!.value)
    // Find the UTC offset that maps to hour:minute ET on this date
    for (let offset = -12; offset <= 14; offset++) {
      const candidate = new Date(Date.UTC(year, month - 1, day, hour - offset, minute, 0))
      const check = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(candidate)
      if (
        parseInt(check.find(p => p.type === 'year')!.value) === year &&
        parseInt(check.find(p => p.type === 'month')!.value) === month &&
        parseInt(check.find(p => p.type === 'day')!.value) === day &&
        parseInt(check.find(p => p.type === 'hour')!.value) === hour &&
        parseInt(check.find(p => p.type === 'minute')!.value) === minute
      ) return candidate.toISOString()
    }
  }
  return new Date().toISOString()
}

// ── SMALL COMPONENTS ─────────────────────────────────────────────────────────

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

function Toggle({ on, onChange, color }: { on: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{
        width: 42, height: 24, borderRadius: 12, flexShrink: 0,
        background: on ? color : 'rgba(128,128,128,0.2)',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: on ? 21 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}

function SelectInput({ value, onChange, options, T }: { value: number; onChange: (v: number) => void; options: { value: number; label: string }[]; T: typeof DARK }) {
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        background: T.bg3, border: `1px solid ${T.border}`, color: T.text,
        fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
        padding: '6px 10px', cursor: 'pointer', outline: 'none',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { isDark, toggle } = useTheme()
  const T = isDark ? DARK : LIGHT
  const supabase = createClient()
  const router = useRouter()

  // ── FLOW STATE ───────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── PREFERENCES ──────────────────────────────────────────────────────────────
  const [traderType, setTraderType] = useState<string | null>(null)

  const [wakeWordOn, setWakeWordOn] = useState(true)
  const [voiceRepliesOn, setVoiceRepliesOn] = useState(true)
  const [scheduleOn, setScheduleOn] = useState(false)
  const [schedStartHour, setSchedStartHour] = useState(9)
  const [schedEndHour, setSchedEndHour] = useState(17)
  const [schedDays, setSchedDays] = useState<number[]>([1, 2, 3, 4, 5])

  const [calAlertsOn, setCalAlertsOn] = useState(true)
  const [calImpact, setCalImpact] = useState<'HIGH' | 'MEDIUM' | 'ALL'>('MEDIUM')
  const [tvAlertsOn, setTvAlertsOn] = useState(true)

  const [selectedPresets, setSelectedPresets] = useState<string[]>([])

  // ── AUTH CHECK ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    async function check() {
      const { data, error: authErr } = await supabase.auth.getUser()
      const user = data.user
      if (!mounted) return
      if (authErr || !user || !user.email_confirmed_at) {
        await supabase.auth.signOut(); router.replace('/login'); return
      }
      const { data: profile } = await supabase
        .from('profiles').select('trader_type, onboarding_complete').eq('id', user.id).maybeSingle()
      if (!mounted) return
      if (profile?.trader_type && profile?.onboarding_complete) { router.replace('/dashboard'); return }
      setChecking(false)
    }
    check()
    return () => { mounted = false }
  }, [supabase, router])

  // ── NAVIGATION ────────────────────────────────────────────────────────────────
  const TOTAL_STEPS = 6

  const goNext = useCallback(() => {
    setAnimKey(k => k + 1)
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
    setError(null)
  }, [])

  const goBack = useCallback(() => {
    setAnimKey(k => k + 1)
    setStep(s => Math.max(s - 1, 0))
    setError(null)
  }, [])

  const toggleDay = (d: number) => {
    setSchedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  // ── SAVE ALL + ENTER DASHBOARD ────────────────────────────────────────────────
  async function handleFinish() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) { router.replace('/login'); return }

      // 1. Save profile
      const { error: upsertErr } = await supabase.from('profiles').upsert({
        id: user.id,
        trader_type: traderType ?? 'swing',
        wake_word_enabled: wakeWordOn,
        voice_replies_enabled: voiceRepliesOn,
        event_alerts_enabled: calAlertsOn,
        event_alert_impact_filter: calImpact,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      if (upsertErr) throw upsertErr

      // 2. Save wake schedule to localStorage
      if (scheduleOn && (wakeWordOn || voiceRepliesOn)) {
        saveWindows([{
          id: crypto.randomUUID(),
          type: 'on',
          days: schedDays.length > 0 ? schedDays : [1, 2, 3, 4, 5],
          offHour: schedStartHour, offMin: 0,
          onHour: schedEndHour, onMin: 0,
        }])
      }

      // 3. TV alerts preference
      localStorage.setItem('tv_alert_behavior', tvAlertsOn ? 'speak' : 'silent')

      // 4. Scheduled summaries — one row per selected preset
      for (const presetName of selectedPresets) {
        const preset = ONBOARDING_PRESETS.find(p => p.name === presetName)
        if (!preset) continue
        await supabase.from('scheduled_summaries').insert({
          user_id: user.id,
          name: preset.name,
          run_at: nextWeekdayAtEtTime(preset.defaultTime),
          prompt: preset.prompt,
          icon: '',
          top_color: preset.top_color,
          type: 'preset',
          enabled: true,
          recurrence: 'weekdays',
          recurrence_end: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  // ── COMPUTED ──────────────────────────────────────────────────────────────────
  const activeType = TRADER_TYPES.find(t => t.id === traderType)
  const canAdvance = step !== 1 || !!traderType
  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div style={{ background: T.pageBg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.gold, fontFamily: "'JetBrains Mono', monospace" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}`}</style>
        Loading...
      </div>
    )
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: T.pageBg, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'JetBrains Mono', monospace", color: T.text, position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:0.6}50%{opacity:1}}
        .anim{animation:fadeUp 0.35s ease both}
        select option{background:#1a1a1a}
        @media(max-width:680px){.trader-grid{grid-template-columns:1fr!important}.feat-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* Background grid */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `linear-gradient(${T.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${T.gridLine} 1px, transparent 1px)`, backgroundSize: '48px 48px', pointerEvents: 'none', zIndex: 0 }} />

      {/* Glow for trader type */}
      {step === 1 && activeType && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 500, borderRadius: '50%', background: isDark ? activeType.glowDark : activeType.glowLight, filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0, transition: 'background 0.5s' }} />
      )}

      {/* NAV */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.navBg, position: 'relative', zIndex: 2 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.heading, fontWeight: 600 }}>Hey </span>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.gold, fontWeight: 700 }}>Monday</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} style={{
                width: i === step ? 18 : 6, height: 6, borderRadius: 3,
                background: i < step ? T.gold : i === step ? T.gold : T.border2,
                transition: 'all 0.3s', opacity: i > step ? 0.4 : 1,
              }} />
            ))}
          </div>
          <button onClick={toggle} style={{ background: T.bg2, border: `1px solid ${T.border2}`, borderRadius: 24, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: T.text2 }}>
            {isDark ? <SunIcon color={T.text2} /> : <MoonIcon color={T.text2} />}
          </button>
        </div>
      </nav>

      {/* CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', zIndex: 1 }}>

        <div key={animKey} className="anim" style={{ width: '100%', maxWidth: step === 1 ? 900 : 560 }}>

          {/* ── STEP 0: WELCOME ── */}
          {step === 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 13, letterSpacing: '0.25em', color: T.gold, textTransform: 'uppercase', marginBottom: 20 }}>
                Welcome
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 52, fontStyle: 'italic', fontWeight: 700, color: T.heading, lineHeight: 1.1, marginBottom: 8 }}>
                I'm Monday.
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontStyle: 'italic', color: T.text2, marginBottom: 40 }}>
                Your AI market intelligence partner.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 48 }}>
                {[
                  { icon: '🎙️', label: 'Voice-Powered', desc: 'Say "Hey Monday" anytime to ask questions hands-free' },
                  { icon: '📊', label: 'Real-Time Data', desc: 'Prices, news, calendars, candles — all in one place' },
                  { icon: '🔔', label: 'Smart Alerts', desc: 'Calendar events, price moves, TradingView webhooks' },
                ].map((f, i) => (
                  <div key={i} style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, padding: '20px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, letterSpacing: '0.08em', marginBottom: 6 }}>{f.label}</div>
                    <div style={{ fontSize: 10, color: T.subText, lineHeight: 1.6 }}>{f.desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: T.text3, letterSpacing: '0.1em', marginBottom: 24 }}>
                TAKES ABOUT 60 SECONDS · YOU CAN CHANGE ANYTHING LATER
              </div>
              <ContinueButton label="Let's get started →" onClick={goNext} color={T.gold} borderColor="rgba(201,146,42,0.4)" bg={T.goldFaint} />
            </div>
          )}

          {/* ── STEP 1: TRADER TYPE ── */}
          {step === 1 && (
            <div>
              <StepHeader
                tag="Step 1 of 5"
                title="How do you trade?"
                sub="Your dashboard, data, and Monday's voice will be tailored to your style."
                T={T}
              />
              <div className="trader-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 32 }}>
                {TRADER_TYPES.map(type => {
                  const sel = traderType === type.id
                  return (
                    <div key={type.id} onClick={() => setTraderType(type.id)} style={{ background: sel ? type.bgColor : T.cardBg, border: `1px solid ${sel ? type.borderColor : T.cardBorder}`, padding: '22px 18px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: sel ? type.color : 'transparent', transition: 'background 0.2s' }} />
                      {sel && <div style={{ position: 'absolute', top: 12, right: 12, width: 16, height: 16, borderRadius: '50%', background: type.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>✓</div>}
                      <div style={{ fontSize: 26, marginBottom: 10 }}>{type.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: sel ? type.color : T.heading, marginBottom: 4 }}>{type.label}</div>
                      <div style={{ fontSize: 10, color: T.subText, marginBottom: 14, lineHeight: 1.6 }}>{type.sub}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {type.features.map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                            <div style={{ width: 3, height: 3, borderRadius: '50%', background: sel ? type.color : T.text3, flexShrink: 0, marginTop: 5 }} />
                            <span style={{ fontSize: 10, color: sel ? T.featureTextOn : T.featureText, lineHeight: 1.5 }}>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <NavRow onBack={goBack} onNext={goNext} canNext={!!traderType} nextLabel={traderType ? `Continue as ${activeType?.label} →` : 'Select your style'} color={activeType?.color ?? T.gold} borderColor={activeType?.borderColor ?? T.border} bg={activeType?.bgColor ?? T.cardBg} T={T} />
            </div>
          )}

          {/* ── STEP 2: VOICE ── */}
          {step === 2 && (
            <div>
              <StepHeader tag="Step 2 of 5" title="Set up your voice." sub="Monday can listen for your wake word and speak responses aloud. Turn these on or off anytime." T={T} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 28 }}>
                <ToggleRow
                  label="Wake Word" desc={`Say "Hey Monday" anytime to activate voice — no button required.`}
                  icon="🎙️" iconBg={T.goldFaint}
                  on={wakeWordOn} onChange={setWakeWordOn} color={T.gold} T={T}
                />
                <ToggleRow
                  label="Voice Replies" desc="Monday will speak responses aloud after each answer."
                  icon="🔊" iconBg={T.goldFaint}
                  on={voiceRepliesOn} onChange={setVoiceRepliesOn} color={T.gold} T={T}
                />
              </div>

              {(wakeWordOn || voiceRepliesOn) && (
                <div style={{ border: `1px solid ${T.border}`, padding: '20px 20px', marginBottom: 28, background: T.cardBg }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: scheduleOn ? 18 : 0 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.heading, marginBottom: 3 }}>Active Schedule</div>
                      <div style={{ fontSize: 10, color: T.subText }}>Automatically enable voice during set hours.</div>
                    </div>
                    <Toggle on={scheduleOn} onChange={setScheduleOn} color={T.gold} />
                  </div>
                  {scheduleOn && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: T.text3, minWidth: 32 }}>From</span>
                        <SelectInput value={schedStartHour} onChange={setSchedStartHour} options={HOURS.filter(h => h.value < schedEndHour)} T={T} />
                        <span style={{ fontSize: 10, color: T.text3 }}>to</span>
                        <SelectInput value={schedEndHour} onChange={setSchedEndHour} options={HOURS.filter(h => h.value > schedStartHour)} T={T} />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {DAY_LABELS.map((d, i) => (
                          <div key={i} onClick={() => toggleDay(i)} style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: schedDays.includes(i) ? T.goldFaint : 'transparent', border: `1px solid ${schedDays.includes(i) ? T.gold : T.border}`, color: schedDays.includes(i) ? T.gold : T.text3, transition: 'all 0.15s' }} title={DAY_FULL[i]}>
                            {d}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <NavRow onBack={goBack} onNext={goNext} canNext T={T} />
            </div>
          )}

          {/* ── STEP 3: ALERTS ── */}
          {step === 3 && (
            <div>
              <StepHeader tag="Step 3 of 5" title="Configure your alerts." sub="Choose what Monday notifies you about. You can fine-tune everything in Settings later." T={T} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 28 }}>
                <div style={{ border: `1px solid ${T.border}`, padding: '18px 20px', background: T.cardBg }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.amberFaint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📅</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.heading }}>Economic Calendar Alerts</div>
                        <Toggle on={calAlertsOn} onChange={setCalAlertsOn} color={T.amber} />
                      </div>
                      <div style={{ fontSize: 10, color: T.subText, marginBottom: calAlertsOn ? 14 : 0 }}>Get notified before major economic events — CPI, FOMC, jobs data, and more.</div>
                      {calAlertsOn && (
                        <div>
                          <div style={{ fontSize: 10, color: T.text3, marginBottom: 8, letterSpacing: '0.06em' }}>IMPACT LEVEL</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {([['HIGH', 'High only'], ['MEDIUM', 'High + Medium'], ['ALL', 'All events']] as const).map(([val, lbl]) => (
                              <div key={val} onClick={() => setCalImpact(val)} style={{ padding: '6px 12px', fontSize: 10, cursor: 'pointer', border: `1px solid ${calImpact === val ? T.amber : T.border}`, background: calImpact === val ? T.amberFaint : 'transparent', color: calImpact === val ? T.amber : T.text3, transition: 'all 0.15s', fontWeight: calImpact === val ? 700 : 400 }}>
                                {lbl}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <ToggleRow
                  label="TradingView Alerts" desc="Forward TradingView webhook alerts to Monday — hear them spoken aloud."
                  icon="📡" iconBg={T.blueFaint}
                  on={tvAlertsOn} onChange={setTvAlertsOn} color={T.blue} T={T}
                />

                <div style={{ border: `1px solid ${T.border}`, padding: '18px 20px', background: T.cardBg }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.greenFaint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎯</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.heading }}>Price Alerts</div>
                        <div style={{ fontSize: 10, color: T.text3, background: T.bg2, border: `1px solid ${T.border}`, padding: '3px 8px' }}>Set up on dashboard</div>
                      </div>
                      <div style={{ fontSize: 10, color: T.subText, marginTop: 4 }}>Create watchlist price targets — Monday alerts you when they're hit.</div>
                    </div>
                  </div>
                </div>
              </div>

              <NavRow onBack={goBack} onNext={goNext} canNext T={T} />
            </div>
          )}

          {/* ── STEP 4: SCHEDULED SUMMARIES ── */}
          {step === 4 && (
            <div>
              <StepHeader tag="Step 4 of 5" title="Scheduled summaries" sub="Pick briefings to receive automatically every weekday. You can add, remove, or customize more on the dashboard." T={T} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {ONBOARDING_PRESETS.map(preset => {
                  const on = selectedPresets.includes(preset.name)
                  return (
                    <div
                      key={preset.name}
                      onClick={() => setSelectedPresets(prev =>
                        prev.includes(preset.name)
                          ? prev.filter(n => n !== preset.name)
                          : [...prev, preset.name]
                      )}
                      style={{ padding: '14px 18px', border: `1px solid ${on ? preset.top_color : T.border}`, background: on ? `${preset.top_color}12` : T.cardBg, cursor: 'pointer', transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 14 }}
                    >
                      <div style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${on ? preset.top_color : T.border2}`, background: on ? preset.top_color : 'transparent', flexShrink: 0, transition: 'all 0.18s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {on && <div style={{ width: 6, height: 6, background: '#000', borderRadius: 1 }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: on ? preset.top_color : T.heading }}>{preset.name}</span>
                          <span style={{ fontSize: 9, color: T.text3, letterSpacing: '0.06em' }}>{preset.blurb}</span>
                        </div>
                        <div style={{ fontSize: 10, color: T.subText, marginTop: 2 }}>{preset.hoverCopy}</div>
                      </div>
                      <div style={{ fontSize: 10, color: on ? preset.top_color : T.text3, flexShrink: 0, fontWeight: 600 }}>
                        {formatEtTime(preset.defaultTime)}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 10, color: T.text3, marginBottom: 28 }}>Runs every weekday at the listed ET time · Select any combination</div>

              <NavRow onBack={goBack} onNext={goNext} canNext T={T} />
            </div>
          )}

          {/* ── STEP 5: DONE ── */}
          {step === 5 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, fontStyle: 'italic', fontWeight: 700, color: T.heading, marginBottom: 8 }}>
                You're all set.
              </div>
              <div style={{ fontSize: 11, color: T.subText, marginBottom: 36 }}>
                Here's a quick look at what Monday can do.
              </div>

              <div className="feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 36, textAlign: 'left' }}>
                {FEATURES.map((f, i) => (
                  <div key={i} style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, padding: '18px 16px', display: 'flex', gap: 12 }}>
                    <div style={{ fontSize: 22, flexShrink: 0 }}>{f.icon}</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, marginBottom: 4 }}>{f.label}</div>
                      <div style={{ fontSize: 10, color: T.subText, lineHeight: 1.6 }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary of what was configured */}
              <div style={{ border: `1px solid ${T.border}`, padding: '14px 18px', marginBottom: 28, background: T.cardBg, textAlign: 'left' }}>
                <div style={{ fontSize: 9, color: T.text3, letterSpacing: '0.1em', marginBottom: 10 }}>YOUR SETUP</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    activeType ? `${activeType.icon} ${activeType.label}` : null,
                    wakeWordOn ? '🎙️ Wake Word on' : null,
                    voiceRepliesOn ? '🔊 Voice Replies on' : null,
                    scheduleOn ? `🕐 Schedule ${HOURS.find(h => h.value === schedStartHour)?.label}–${HOURS.find(h => h.value === schedEndHour)?.label}` : null,
                    calAlertsOn ? `📅 Calendar (${calImpact === 'HIGH' ? 'High only' : calImpact === 'MEDIUM' ? 'High+Med' : 'All'})` : null,
                    tvAlertsOn ? '📡 TradingView on' : null,
                    selectedPresets.length > 0 ? `📊 ${selectedPresets.length} summary${selectedPresets.length > 1 ? 's' : ''} scheduled` : null,
                  ].filter(Boolean).map((label, i) => (
                    <div key={i} style={{ fontSize: 10, color: T.text2, background: T.bg2, border: `1px solid ${T.border}`, padding: '4px 10px' }}>
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {error && <div style={{ fontSize: 11, color: T.errColor, marginBottom: 14, letterSpacing: '0.04em' }}>{error}</div>}

              <ContinueButton
                label={saving ? 'Setting up your dashboard…' : 'Open Dashboard →'}
                onClick={handleFinish}
                color={T.gold}
                borderColor="rgba(201,146,42,0.4)"
                bg={T.goldFaint}
                loading={saving}
              />
              <div style={{ marginTop: 10 }}>
                <button onClick={goBack} style={{ background: 'none', border: 'none', fontSize: 10, color: T.text3, cursor: 'pointer', letterSpacing: '0.06em' }}>← Back</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── SHARED SUB-COMPONENTS ─────────────────────────────────────────────────────

function StepHeader({ tag, title, sub, T }: { tag: string; title: string; sub: string; T: typeof DARK }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.2em', color: T.gold, textTransform: 'uppercase', marginBottom: 12 }}>{tag}</div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 34, fontStyle: 'italic', fontWeight: 700, color: T.heading, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 11, color: T.subText, lineHeight: 1.7 }}>{sub}</div>
    </div>
  )
}

function ToggleRow({ label, desc, icon, iconBg, on, onChange, color, T }: { label: string; desc: string; icon: string; iconBg: string; on: boolean; onChange: (v: boolean) => void; color: string; T: typeof DARK }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, padding: '18px 20px', background: T.cardBg, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.heading }}>{label}</div>
          <Toggle on={on} onChange={onChange} color={color} />
        </div>
        <div style={{ fontSize: 10, color: T.subText }}>{desc}</div>
      </div>
    </div>
  )
}

function ContinueButton({ label, onClick, color, borderColor, bg, loading = false }: { label: string; onClick: () => void; color: string; borderColor: string; bg: string; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ padding: '14px 44px', background: bg, border: `1px solid ${borderColor}`, color, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer', fontFamily: "'JetBrains Mono', monospace", display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {loading && <span style={{ width: 11, height: 11, border: `2px solid ${color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />}
      {label}
    </button>
  )
}

function NavRow({ onBack, onNext, canNext, nextLabel = 'Continue →', color, borderColor, bg, T }: { onBack: () => void; onNext: () => void; canNext: boolean; nextLabel?: string; color?: string; borderColor?: string; bg?: string; T: typeof DARK }) {
  const c = color ?? T.gold
  const b = borderColor ?? 'rgba(201,146,42,0.4)'
  const bk = bg ?? T.goldFaint
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 10, color: T.text3, cursor: 'pointer', letterSpacing: '0.06em', padding: '10px 0' }}>
        ← Back
      </button>
      <ContinueButton label={nextLabel} onClick={onNext} color={canNext ? c : T.text4} borderColor={canNext ? b : T.border} bg={canNext ? bk : 'transparent'} />
    </div>
  )
}
