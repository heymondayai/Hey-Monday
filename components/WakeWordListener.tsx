'use client'

/**
 * WakeWordListener.tsx
 *
 * Drop this anywhere inside your dashboard layout.
 * It renders nothing visible — it just runs the wake word pipeline
 * and calls onDetected() when "Hey Monday" is heard.
 *
 * Usage in your dashboard page:
 *
 *   <WakeWordListener
 *     enabled={wakeEnabled}
 *     onDetected={() => {
 *       // open the mic, focus the chat input, start recording — whatever you need
 *       setVoiceActive(true)
 *     }}
 *   />
 */

import { useEffect } from 'react'
import { useWakeWord } from '@/lib/useWakeWord'

interface WakeWordListenerProps {
  enabled: boolean
  onDetected: () => void
  threshold?: number
}

export default function WakeWordListener({
  enabled,
  onDetected,
  threshold,
}: WakeWordListenerProps) {
  const { listening, loading, error, start, stop } = useWakeWord({
    onDetected,
    threshold,
  })

  // Start/stop based on the enabled prop
  useEffect(() => {
    if (enabled) {
      start()
    } else {
      stop()
    }
    return () => { stop() }
  }, [enabled])  // eslint-disable-line react-hooks/exhaustive-deps

  // This component renders nothing — it's purely functional
  // Remove the null return below if you want a visible status indicator
  return null

  // ── OPTIONAL: uncomment to show a small status badge ──────────────────
  // return (
  //   <div style={{
  //     position: 'fixed', bottom: 20, left: 20, zIndex: 999,
  //     background: listening ? 'rgba(0,232,162,0.1)' : 'rgba(255,255,255,0.05)',
  //     border: `1px solid ${listening ? '#00e8a2' : '#333'}`,
  //     padding: '4px 10px', borderRadius: 4,
  //     fontFamily: 'monospace', fontSize: 10,
  //     color: listening ? '#00e8a2' : '#666',
  //   }}>
  //     {loading ? 'Loading models…' : listening ? '● Listening' : error ? `Error: ${error}` : '○ Off'}
  //   </div>
  // )
}