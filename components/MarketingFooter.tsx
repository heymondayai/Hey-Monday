'use client'

import Link from 'next/link'

export default function MarketingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer style={{
      background: '#070c11',
      borderTop: '1px solid #172030',
      fontFamily: "'Syne', sans-serif",
      color: '#c8daea',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        .footer-link { transition: color 0.15s; text-decoration: none; }
        .footer-link:hover { color: #00e8a2 !important; }
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,232,162,.4)} 50%{opacity:.8;box-shadow:0 0 0 6px rgba(0,232,162,0)} }
      `}</style>

      {/* Main footer grid */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 24px 40px', display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 40 }}>

        {/* Brand col */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #00e8a2, #00a8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#030507' }}>M</div>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.04em' }}>
              MON<span style={{ color: '#00e8a2' }}>DAY</span>
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#8aa8c0', lineHeight: 1.7, maxWidth: 280, marginBottom: 20 }}>
            Your AI voice market analyst. Live prices, real-time intelligence, and spoken briefings — for every trader.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#00e8a2' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e8a2', display: 'inline-block', animation: 'pulse 2s ease infinite' }} />
            Market intelligence, always on
          </div>
        </div>

        {/* Product */}
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.2em', color: '#527090', marginBottom: 16, textTransform: 'uppercase' }}>Product</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { href: '/how-it-works', label: 'How It Works' },
              { href: '/pricing', label: 'Pricing' },
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/changelog', label: 'Changelog' },
            ].map(l => (
              <Link key={l.href} href={l.href} className="footer-link" style={{ fontSize: 13, color: '#8aa8c0' }}>{l.label}</Link>
            ))}
          </div>
        </div>

        {/* Features */}
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.2em', color: '#527090', marginBottom: 16, textTransform: 'uppercase' }}>Features</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { href: '/how-it-works#voice', label: 'AI Voice Assistant' },
              { href: '/how-it-works#watchlist', label: 'Live Watchlist' },
              { href: '/how-it-works#calendar', label: 'Economic Calendar' },
              { href: '/how-it-works#news', label: 'News Feed' },
              { href: '/how-it-works#level2', label: 'Level 2 / Order Flow' },
              { href: '/how-it-works#briefings', label: 'Daily Briefings' },
            ].map(l => (
              <Link key={l.href} href={l.href} className="footer-link" style={{ fontSize: 13, color: '#8aa8c0' }}>{l.label}</Link>
            ))}
          </div>
        </div>

        {/* Company */}
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.2em', color: '#527090', marginBottom: 16, textTransform: 'uppercase' }}>Company</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { href: '/about', label: 'About' },
              { href: '/privacy', label: 'Privacy Policy' },
              { href: '/terms', label: 'Terms of Service' },
              { href: 'mailto:hello@heymonday.ai', label: 'Contact Us' },
            ].map(l => (
              <Link key={l.href} href={l.href} className="footer-link" style={{ fontSize: 13, color: '#8aa8c0' }}>{l.label}</Link>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.15em', color: '#527090', marginBottom: 10, textTransform: 'uppercase' }}>Powered by</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['Claude AI', 'ElevenLabs', 'Finnhub'].map(t => (
                <div key={t} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#3a5570' }}>{t}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: '1px solid #172030', padding: '20px 24px', maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#3a5570' }}>
          © {year} Monday AI, Inc. All rights reserved.
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#3a5570', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Not financial advice.</span>
          <span>·</span>
          <span>Past performance does not guarantee future results.</span>
        </div>
      </div>
    </footer>
  )
}