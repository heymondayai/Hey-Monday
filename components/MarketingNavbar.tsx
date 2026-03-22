'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export default function MarketingNavbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = [
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/pricing', label: 'Pricing' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        .nav-link { transition: color 0.15s; }
        .nav-link:hover { color: #00e8a2 !important; }
        .nav-cta { transition: all 0.15s; }
        .nav-cta:hover { opacity: 0.85; }
        .nav-cta-outline { transition: all 0.15s; }
        .nav-cta-outline:hover { border-color: #00e8a2 !important; color: #00e8a2 !important; }
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,232,162,.4)} 50%{opacity:.8;box-shadow:0 0 0 6px rgba(0,232,162,0)} }
      `}</style>

      <nav style={{
        background: 'rgba(3,5,7,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #172030',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        fontFamily: "'Syne', sans-serif",
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 32 }}>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #00e8a2, #00a8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#030507' }}>M</div>
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.04em', color: '#c8daea' }}>
                MON<span style={{ color: '#00e8a2' }}>DAY</span>
              </span>
            </div>
          </Link>

          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#00e8a2', background: 'rgba(0,232,162,0.08)', border: '1px solid rgba(0,232,162,0.2)', padding: '3px 8px' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e8a2', display: 'inline-block', animation: 'pulse 2s ease infinite' }} />
            LIVE
          </div>

          {/* Nav links */}
          <div style={{ display: 'flex', gap: 28, marginLeft: 8 }}>
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
                <div className="nav-link" style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: pathname === link.href ? '#00e8a2' : '#8aa8c0',
                  borderBottom: pathname === link.href ? '2px solid #00e8a2' : '2px solid transparent',
                  paddingBottom: 2,
                }}>
                  {link.label}
                </div>
              </Link>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/login" style={{ textDecoration: 'none' }}>
              <div className="nav-cta-outline" style={{ fontSize: 13, fontWeight: 600, color: '#8aa8c0', padding: '7px 16px', border: '1px solid #1e2e42', cursor: 'pointer' }}>
                Log In
              </div>
            </Link>
            <Link href="/signup" style={{ textDecoration: 'none' }}>
              <div className="nav-cta" style={{ fontSize: 13, fontWeight: 700, color: '#030507', background: '#00e8a2', padding: '7px 18px', cursor: 'pointer', letterSpacing: '0.03em' }}>
                Start Free Trial →
              </div>
            </Link>
          </div>
        </div>
      </nav>
    </>
  )
}