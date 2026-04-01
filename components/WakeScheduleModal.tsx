'use client'

import React from 'react'
import { WakeWindow } from '@/lib/useWakeSchedule'

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function fmt24to12(h: number, m: number): string {
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  const min = String(m).padStart(2, '0')
  return `${hour}:${min} ${period}`
}

function toET(h: number, m: number): string {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

function describeDays(days: number[]): string {
  if (days.length === 7) return 'Every day'
  if (days.length === 0) return 'No days'
  const sorted = [...days].sort()
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays'
  if (sorted.join() === '0,6') return 'Weekends'
  return sorted.map(d => DAY_LABELS[d]).join(', ')
}

function WindowRow({
  win,
  onRemove,
  onToggleDay,
  onChangeTime,
  T,
}: {
  win: WakeWindow
  onRemove: () => void
  onToggleDay: (d: number) => void
  onChangeTime: (field: 'offHour' | 'offMin' | 'onHour' | 'onMin', val: number) => void
  T: any
}) {
  const offH = win.offHour ?? 22
  const offM = win.offMin ?? 0
  const onH  = win.onHour  ?? 7
  const onM  = win.onMin   ?? 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '10px',
      padding: '14px', background: T.inputBg,
      border: `1px solid ${T.borderFaint}`,
      borderLeft: `3px solid ${T.gold}`,
    }}>

      {/* Day selector */}
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        <span style={{
          fontSize: '10px', color: T.text6, fontFamily: "'DM Mono', monospace",
          letterSpacing: '0.14em', textTransform: 'uppercase', width: '36px', flexShrink: 0,
        }}>Days</span>
        {DAY_LABELS.map((label, idx) => (
          <div key={idx} onClick={() => onToggleDay(idx)} style={{
            width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, fontFamily: "'DM Mono', monospace",
            cursor: 'pointer', transition: 'all 0.12s',
            border: `1px solid ${win.days.includes(idx) ? T.goldFaint9 : T.borderItem}`,
            background: win.days.includes(idx) ? T.goldFaint2 : 'transparent',
            color: win.days.includes(idx) ? T.gold : T.text6,
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Time range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '10px', color: T.text6, fontFamily: "'DM Mono', monospace",
          letterSpacing: '0.14em', textTransform: 'uppercase', width: '36px', flexShrink: 0,
        }}>Off at</span>
        <input
          type="time"
          value={`${String(offH).padStart(2, '0')}:${String(offM).padStart(2, '0')}`}
          onChange={e => {
            const [h, m] = e.target.value.split(':').map(Number)
            if (!isNaN(h)) onChangeTime('offHour', h)
            if (!isNaN(m)) onChangeTime('offMin', m)
          }}
          style={{
            background: T.inputBg, border: `1px solid ${T.goldFaint7}`,
            color: T.text, padding: '6px 10px', outline: 'none',
            fontSize: '13px', fontFamily: "'DM Mono', monospace",
          }}
        />
        <span style={{ fontSize: '10px', color: T.text6, fontFamily: "'DM Mono', monospace" }}>→</span>
        <span style={{
          fontSize: '10px', color: T.text6, fontFamily: "'DM Mono', monospace",
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>On at</span>
        <input
          type="time"
          value={`${String(onH).padStart(2, '0')}:${String(onM).padStart(2, '0')}`}
          onChange={e => {
            const [h, m] = e.target.value.split(':').map(Number)
            if (!isNaN(h)) onChangeTime('onHour', h)
            if (!isNaN(m)) onChangeTime('onMin', m)
          }}
          style={{
            background: T.inputBg, border: `1px solid ${T.goldFaint7}`,
            color: T.text, padding: '6px 10px', outline: 'none',
            fontSize: '13px', fontFamily: "'DM Mono', monospace",
          }}
        />
        <div style={{ marginLeft: 'auto' }}>
          <div onClick={onRemove} style={{
            fontSize: '11px', color: T.red, cursor: 'pointer',
            padding: '4px 9px', border: `1px solid ${T.redBorder}`,
          }}>Remove</div>
        </div>
      </div>

      {/* Summary — local time */}
      <div style={{ fontSize: '11px', color: T.goldText2, fontFamily: "'DM Mono', monospace" }}>
        Wake word <span style={{ color: T.red }}>off</span> {fmt24to12(offH, offM)} → <span style={{ color: T.green }}>on</span> {fmt24to12(onH, onM)} · {describeDays(win.days)}
      </div>

      {/* ET time hint */}
      <div style={{ fontSize: '10px', color: T.text8, fontFamily: "'DM Mono', monospace" }}>
        ET: off {toET(offH, offM)} → on {toET(onH, onM)}
      </div>
    </div>
  )
}

export default function WakeScheduleModal({
  onClose,
  T,
  scheduledOff,
  windows,
  addWindow,
  removeWindow,
  updateWindow,
}: {
  onClose: () => void
  T: any
  scheduledOff: boolean
  windows: WakeWindow[]
  addWindow: (w: Omit<WakeWindow, 'id'>) => void
  removeWindow: (id: string) => void
  updateWindow: (id: string, patch: Partial<WakeWindow>) => void
}) {

  function handleAdd() {
    addWindow({
      days: [1, 2, 3, 4, 5],
      offHour: 22, offMin: 0,
      onHour: 7,   onMin: 0,
    })
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 260,
        background: T.modalOverlay, backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: T.overlayBg, border: `1px solid ${T.border}`,
        width: '580px', maxWidth: '96vw', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: `1px solid ${T.borderFaint}`,
          flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: '19px',
              fontStyle: 'italic', color: T.text, marginBottom: '4px',
            }}>
              Wake Word Schedule
            </div>
            <div style={{ fontSize: '12px', color: T.text5, lineHeight: 1.6 }}>
              Set windows when{' '}
              <span style={{ color: T.gold, fontFamily: "'DM Mono', monospace" }}>Hey Monday</span>{' '}
              is automatically silenced. All times are{' '}
              <span style={{ color: T.gold, fontFamily: "'DM Mono', monospace" }}>your local time</span>{' '}
              ({localTz}). ET equivalent shown below each window.
              Manually enabling during a scheduled window keeps it active for 30 minutes before reverting.
            </div>
          </div>
          <div
            onClick={onClose}
            style={{ fontSize: '17px', color: T.text6, cursor: 'pointer', padding: '2px 6px', marginLeft: '16px', flexShrink: 0 }}
          >✕</div>
        </div>

        {/* Status pill */}
        <div style={{
          padding: '10px 24px', borderBottom: `1px solid ${T.borderFaint2}`,
          flexShrink: 0, background: T.inputBg,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px',
            border: `1px solid ${scheduledOff ? T.redBorder2 : T.greenBorder}`,
            background: scheduledOff ? T.redFaint : T.greenFaint3,
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: scheduledOff ? T.red : T.green,
              boxShadow: scheduledOff ? `0 0 6px ${T.red}` : `0 0 6px ${T.green}`,
            }} />
            <span style={{
              fontSize: '11px', fontFamily: "'DM Mono', monospace",
              fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: scheduledOff ? T.red : T.green,
            }}>
              {scheduledOff ? 'Currently in a scheduled off window' : 'Wake word active'}
            </span>
          </div>
        </div>

        {/* Window list */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '18px 24px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {windows.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 0', color: T.text7,
              fontSize: '13px', fontStyle: 'italic', fontFamily: "'Playfair Display', serif",
            }}>
              No scheduled windows. The wake word is always active when enabled.
            </div>
          ) : windows.map(win => (
            <WindowRow
              key={win.id}
              win={win}
              T={T}
              onRemove={() => removeWindow(win.id)}
              onToggleDay={d => updateWindow(win.id, {
                days: win.days.includes(d)
                  ? win.days.filter(x => x !== d)
                  : [...win.days, d],
              })}
              onChangeTime={(field, val) => updateWindow(win.id, { [field]: val })}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: `1px solid ${T.borderFaint}`,
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: T.inputBg,
        }}>
          <div style={{ fontSize: '11px', color: T.text7, fontFamily: "'DM Mono', monospace" }}>
            {windows.length}/5 windows · Local time · Changes save automatically
          </div>
          {windows.length < 5 && (
            <div onClick={handleAdd} style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '8px 16px', background: T.goldFaint2,
              border: `1px solid ${T.goldFaint8}`, color: T.gold,
              cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            }}>
              <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Add Window
            </div>
          )}
        </div>
      </div>
    </div>
  )
}