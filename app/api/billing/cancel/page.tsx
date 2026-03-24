'use client'

import Link from 'next/link'

export default function BillingCancelPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a08',
      color: '#d4c5a0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace",
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 520,
        border: '1px solid #2a2618',
        background: '#120f07',
        padding: 28,
      }}>
        <div style={{
          color: '#e8d5a0',
          fontSize: 28,
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic',
          marginBottom: 10,
        }}>
          Checkout canceled
        </div>

        <div style={{
          color: '#a08040',
          fontSize: 13,
          lineHeight: 1.7,
          marginBottom: 22,
        }}>
          No payment was started. You can return to signup whenever you're ready.
        </div>

        <Link
          href="/signup"
          style={{
            display: 'inline-block',
            textDecoration: 'none',
            background: '#c9922a',
            color: '#0a0a08',
            padding: '12px 16px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontSize: 12,
          }}
        >
          Return to signup
        </Link>
      </div>
    </div>
  )
}