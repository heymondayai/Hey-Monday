'use client'

import React from 'react'
import { WakeWindow, WakeWindowType } from '@/lib/useWakeSchedule'

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
  onChangeStart,
  onChangeEnd,
  T,
}: {
  win: WakeWindow
  onRemove: () => void
  onToggleDay: (d: number) => void
  onChangeStart: (h: number, m: number) => void
  onChangeEnd: (h: number, m: number) => void
  T: any
}) {
  const type    = win.type ?? 'off'
  const startH  = win.offHour ?? (type === 'on' ? 9 : 22)
  const startM  = win.offMin  ?? 30
  const endH    = win.onHour  ?? (type === 'on' ? 16 : 7)
  const endM    = win.onMin   ?? 0

  const accentColor  = type === 'on' ? T.green      : T.red
  const accentBorder = type === 'on' ? T.greenBorder : T.redBorder
  const accentFaint  = type === 'on' ? T.greenFaint3 : T.redFaint
  const startLabel   = type === 'on' ? 'On at'      : 'Off at'
  const endLabel     = type === 'on' ? 'Off at'     : 'On at'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '10px',
      padding: '14px', background: T.inputBg,
      border: `1px solid ${T.borderFaint}`,
      borderLeft: `3px solid ${accentColor}`,
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
            border: `1px solid ${win.days.includes(idx) ? accentBorder : T.borderItem}`,
            background: win.days.includes(idx) ? accentFaint : 'transparent',
            color: win.days.includes(idx) ? accentColor : T.text6,
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Time range */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        {/* Start */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{
            fontSize: '10px', color: T.text6, fontFamily: "'DM Mono', monospace",
            letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>{startLabel}</span>
          <input
            type="time"
            value={`${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`}
            onChange={e => {
              const [h, m] = e.target.value.split(':').map(Number)
              if (!isNaN(h) && !isNaN(m)) onChangeStart(h, m)
            }}
            style={{
              background: T.inputBg, border: `1px solid ${accentBorder}`,
              color: T.text, padding: '6px 10px', outline: 'none',
              fontSize: '13px', fontFamily: "'DM Mono', monospace", colorScheme: 'dark',
            }}
          />
          <span style={{ fontSize: '10px', color: T.text8, fontFamily: "'DM Mono', monospace" }}>
            {toET(startH, startM)} ET
          </span>
        </div>

        <div style={{ paddingTop: '22px', fontSize: '12px', color: T.text6, fontFamily: "'DM Mono', monospace" }}>→</div>

        {/* End */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{
            fontSize: '10px', color: T.text6, fontFamily: "'DM Mono', monospace",
            letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>{endLabel}</span>
          <input
            type="time"
            value={`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`}
            onChange={e => {
              const [h, m] = e.target.value.split(':').map(Number)
              if (!isNaN(h) && !isNaN(m)) onChangeEnd(h, m)
            }}
            style={{
              background: T.inputBg, border: `1px solid ${accentBorder}`,
              color: T.text, padding: '6px 10px', outline: 'none',
              fontSize: '13px', fontFamily: "'DM Mono', monospace", colorScheme: 'dark',
            }}
          />
          <span style={{ fontSize: '10px', color: T.text8, fontFamily: "'DM Mono', monospace" }}>
            {toET(endH, endM)} ET
          </span>
        </div>

        <div style={{ marginLeft: 'auto', paddingTop: '20px' }}>
          <div onClick={onRemove} style={{
            fontSize: '11px', color: T.red, cursor: 'pointer',
            padding: '4px 9px', border: `1px solid ${T.redBorder}`,
          }}>Remove</div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ fontSize: '11px', color: T.text5, fontFamily: "'DM Mono', monospace" }}>
        {type === 'on'
          ? <>Wake word <span style={{ color: T.green }}>on</span> {fmt24to12(startH, startM)} → <span style={{ color: T.red }}>off</span> {fmt24to12(endH, endM)} · {describeDays(win.days)} · manual off reverts after 10 min</>
          : <>Wake word <span style={{ color: T.red }}>off</span> {fmt24to12(startH, startM)} → <span style={{ color: T.green }}>on</span> {fmt24to12(endH, endM)} · {describeDays(win.days)} · manual on reverts after 30 min</>
        }
      </div>
    </div>
  )
}

export default function WakeScheduleModal({
  onClose,
  T,
  scheduledOff,
  scheduledOn,
  windows,
  addWindow,
  removeWindow,
  updateWindow,
}: {
  onClose: () => void
  T: any
  scheduledOff: boolean
  scheduledOn: boolean
  windows: WakeWindow[]
  addWindow: (w: Omit<WakeWindow, 'id'>) => void
  removeWindow: (id: string) => void
  updateWindow: (id: string, patch: Partial<WakeWindow>) => void
}) {
  const offWindows = windows.filter(w => (w.type ?? 'off') === 'off')
  const onWindows  = windows.filter(w => w.type === 'on')

  function handleAdd(type: WakeWindowType) {
    if (type === 'on') {
      addWindow({ type: 'on', days: [1,2,3,4,5], offHour: 9, offMin: 30, onHour: 16, onMin: 0 })
    } else {
      addWindow({ type: 'off', days: [1,2,3,4,5], offHour: 22, offMin: 0, onHour: 7, onMin: 0 })
    }
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')

  const currentStatus = scheduledOff ? 'quiet' : scheduledOn ? 'active' : 'default'

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
              <span style={{ color: T.green, fontFamily: "'DM Mono', monospace" }}>Active windows</span> force wake word on — manual off reverts after 10 min.{' '}
              <span style={{ color: T.red, fontFamily: "'DM Mono', monospace" }}>Quiet windows</span> force it off — manual on reverts after 30 min.{' '}
              Outside any window the toggle sets your default. All times are{' '}
              <span style={{ color: T.gold, fontFamily: "'DM Mono', monospace" }}>your local time</span> ({localTz}).
            </div>
          </div>
          <div onClick={onClose} style={{ fontSize: '17px', color: T.text6, cursor: 'pointer', padding: '2px 6px', marginLeft: '16px', flexShrink: 0 }}>✕</div>
        </div>

        {/* Status pill */}
        <div style={{
          padding: '10px 24px', borderBottom: `1px solid ${T.borderFaint2}`,
          flexShrink: 0, background: T.inputBg,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px',
            border: `1px solid ${currentStatus === 'quiet' ? T.redBorder2 : currentStatus === 'active' ? T.greenBorder : T.borderItem}`,
            background: currentStatus === 'quiet' ? T.redFaint : currentStatus === 'active' ? T.greenFaint3 : 'transparent',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: currentStatus === 'quiet' ? T.red : currentStatus === 'active' ? T.green : T.text6,
              boxShadow: currentStatus === 'quiet' ? `0 0 6px ${T.red}` : currentStatus === 'active' ? `0 0 6px ${T.green}` : 'none',
            }} />
            <span style={{
              fontSize: '11px', fontFamily: "'DM Mono', monospace",
              fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: currentStatus === 'quiet' ? T.red : currentStatus === 'active' ? T.green : T.text6,
            }}>
              {currentStatus === 'quiet' ? 'In a quiet window — wake word suppressed' :
               currentStatus === 'active' ? 'In an active window — wake word on' :
               'Outside any window — following toggle default'}
            </span>
          </div>
        </div>

        {/* Window list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Active windows */}
          <div>
            <div style={{
              fontSize: '10px', fontFamily: "'DM Mono', monospace", fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: T.green, marginBottom: '10px',
            }}>Active Windows</div>
            {onWindows.length === 0 ? (
              <div style={{ fontSize: '12px', color: T.text7, fontStyle: 'italic', fontFamily: "'Playfair Display', serif", padding: '8px 0' }}>
                No active windows — wake word follows toggle default during these hours.
              </div>
            ) : onWindows.map(win => (
              <WindowRow
                key={win.id} win={win} T={T}
                onRemove={() => removeWindow(win.id)}
                onToggleDay={d => updateWindow(win.id, { days: win.days.includes(d) ? win.days.filter(x => x !== d) : [...win.days, d] })}
                onChangeStart={(h, m) => updateWindow(win.id, { offHour: h, offMin: m })}
                onChangeEnd={(h, m) => updateWindow(win.id, { onHour: h, onMin: m })}
              />
            ))}
          </div>

          {/* Quiet windows */}
          <div>
            <div style={{
              fontSize: '10px', fontFamily: "'DM Mono', monospace", fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: T.red, marginBottom: '10px',
            }}>Quiet Windows</div>
            {offWindows.length === 0 ? (
              <div style={{ fontSize: '12px', color: T.text7, fontStyle: 'italic', fontFamily: "'Playfair Display', serif", padding: '8px 0' }}>
                No quiet windows — wake word is never automatically suppressed.
              </div>
            ) : offWindows.map(win => (
              <WindowRow
                key={win.id} win={win} T={T}
                onRemove={() => removeWindow(win.id)}
                onToggleDay={d => updateWindow(win.id, { days: win.days.includes(d) ? win.days.filter(x => x !== d) : [...win.days, d] })}
                onChangeStart={(h, m) => updateWindow(win.id, { offHour: h, offMin: m })}
                onChangeEnd={(h, m) => updateWindow(win.id, { onHour: h, onMin: m })}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: `1px solid ${T.borderFaint}`,
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: T.inputBg, gap: '10px',
        }}>
          <div style={{ fontSize: '11px', color: T.text7, fontFamily: "'DM Mono', monospace" }}>
            {windows.length}/10 windows · Local time · Saves automatically
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {windows.length < 10 && (
              <>
                <div onClick={() => handleAdd('on')} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', background: T.greenFaint3,
                  border: `1px solid ${T.greenBorder}`, color: T.green,
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                }}>
                  <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> Active Window
                </div>
                <div onClick={() => handleAdd('off')} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', background: T.redFaint,
                  border: `1px solid ${T.redBorder}`, color: T.red,
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                }}>
                  <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> Quiet Window
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
