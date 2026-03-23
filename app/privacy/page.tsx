'use client'

import Link from 'next/link'
import { useTheme } from '@/app/context/theme-context'

const DARK = {
  pageBg: '#0a0a08', navBg: '#0a0a08', sectionBg: '#0f0d09', cardBg: '#120f07',
  border: '#2a2618', border2: '#3a3420',
  gold: '#c9922a', goldDim: '#8a6420', goldFaint: 'rgba(201,146,42,0.06)', goldBorder: 'rgba(201,146,42,0.18)',
  text: '#d4c5a0', text2: '#a08040', text3: '#6a6050',
  heading: '#e8d5a0', red: '#c94242', redFaint: 'rgba(201,66,66,0.08)', redBorder: 'rgba(201,66,66,0.2)',
}
const LIGHT = {
  pageBg: '#f5f0e8', navBg: '#f5f0e8', sectionBg: '#ede6d6', cardBg: '#faf7f0',
  border: '#c8b898', border2: '#b8a47e',
  gold: '#a06818', goldDim: '#7a5010', goldFaint: 'rgba(160,104,24,0.05)', goldBorder: 'rgba(160,104,24,0.2)',
  text: '#2a1f0e', text2: '#6b4c20', text3: '#8a7050',
  heading: '#1a1008', red: '#b83232', redFaint: 'rgba(184,50,50,0.06)', redBorder: 'rgba(184,50,50,0.25)',
}

function SunIcon({ color }: { color: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
}
function MoonIcon({ color }: { color: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
}

const EFFECTIVE_DATE = 'March 22, 2026'

export default function PrivacyPage() {
  const { isDark, toggle } = useTheme()
  const T = isDark ? DARK : LIGHT

  const h2Style: React.CSSProperties = {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 22, fontWeight: 700, fontStyle: 'italic',
    color: T.heading, marginBottom: 12, marginTop: 40,
  }
  const h3Style: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10, fontWeight: 600, letterSpacing: '0.2em',
    textTransform: 'uppercase' as const, color: T.gold, marginBottom: 8, marginTop: 24,
  }
  const pStyle: React.CSSProperties = {
    fontSize: 14, color: T.text2, lineHeight: 1.85, marginBottom: 14,
  }
  const liStyle: React.CSSProperties = {
    fontSize: 14, color: T.text2, lineHeight: 1.85, marginBottom: 6,
    paddingLeft: 16, position: 'relative' as const,
  }

  const DataCard = ({ title, items }: { title: string; items: { label: string; value: string }[] }) => (
    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, background: T.goldFaint }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.gold }}>{title}</span>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ padding: '10px 16px', borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : 'none', display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12 }}>
          <span style={{ fontSize: 12, color: T.text3, fontFamily: "'JetBrains Mono',monospace" }}>{item.label}</span>
          <span style={{ fontSize: 13, color: T.text2, lineHeight: 1.6 }}>{item.value}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ background: T.pageBg, color: T.text, fontFamily: "'JetBrains Mono', monospace", minHeight: '100vh', transition: 'background 0.3s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600;1,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        ::selection { background: rgba(201,146,42,0.25); }
        a { color: ${T.gold}; text-decoration: underline; }
      `}</style>

      {/* NAV */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, padding: '0 32px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.navBg, position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 340 340" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(224,178)">
              <rect x="-162" y="-12" width="20" height="50" rx="10" fill="#c9922a" opacity="0.20"/>
              <rect x="-134" y="-46" width="20" height="110" rx="10" fill="#c9922a" opacity="0.38"/>
              <rect x="-106" y="-80" width="20" height="172" rx="10" fill="#c9922a" opacity="0.60"/>
              <rect x="-78" y="-58" width="20" height="116" rx="10" fill="#c9922a" opacity="0.68"/>
              <rect x="-50" y="-100" width="20" height="210" rx="10" fill="#c9922a"/>
              <rect x="-22" y="-72" width="20" height="148" rx="10" fill="#c9922a" opacity="0.72"/>
              <rect x="6" y="-56" width="20" height="118" rx="10" fill="#c9922a" opacity="0.55"/>
              <rect x="34" y="-28" width="20" height="68" rx="10" fill="#c9922a" opacity="0.35"/>
            </g>
          </svg>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.heading, fontWeight: 600 }}>Hey </span>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontStyle: 'italic', color: T.gold, fontWeight: 700 }}>Monday</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/terms" style={{ fontSize: 10, color: T.text3, letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>Terms of Service</Link>
          <button onClick={toggle} style={{ background: T.cardBg, border: `1px solid ${T.border2}`, borderRadius: 24, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: T.text2 }}>
            {isDark ? <SunIcon color={T.text2} /> : <MoonIcon color={T.text2} />}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: '56px 32px 40px', background: T.sectionBg }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: T.goldDim, textTransform: 'uppercase', marginBottom: 14 }}>Legal</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 48, fontWeight: 700, fontStyle: 'italic', color: T.heading, marginBottom: 12, lineHeight: 1.1 }}>Privacy Policy</h1>
          <p style={{ fontSize: 12, color: T.text3 }}>Effective {EFFECTIVE_DATE} · Expedition Way Ventures LLC d/b/a Hey Monday · Arizona, United States</p>
        </div>
      </div>

      {/* BODY */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 32px 80px' }}>

        <p style={pStyle}>
          Expedition Way Ventures LLC, doing business as Hey Monday ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains what data we collect, how we use it, who we share it with, and your rights regarding your data. By using Hey Monday, you agree to the practices described here.
        </p>

        {/* 1 */}
        <h2 style={h2Style}>1. Data We Collect</h2>

        <DataCard title="Account Data" items={[
          { label: 'Full name', value: 'Collected at signup' },
          { label: 'Email address', value: 'Used for login, confirmation emails, and account notices' },
          { label: 'Password', value: 'Stored as a secure hash — we never store your plaintext password' },
          { label: 'Account creation date', value: 'Stored for record keeping' },
        ]} />

        <DataCard title="Subscription & Payment Data" items={[
          { label: 'Subscription plan', value: 'Monthly or annual, stored in our database' },
          { label: 'Billing status', value: 'Active, trialing, cancelled — synced from Stripe' },
          { label: 'Stripe customer ID', value: 'Reference token only — we do not store full card details' },
          { label: 'Payment history', value: 'Managed by Stripe — subject to Stripe\'s privacy policy' },
        ]} />

        <DataCard title="Usage Data" items={[
          { label: 'Watchlist', value: 'Tickers you add, stored per account' },
          { label: 'Chat history', value: 'Your questions and Monday\'s responses, stored per day' },
          { label: 'Price alerts', value: 'Tickers and price targets you set' },
          { label: 'Scheduled summaries', value: 'Names, prompts, and times you configure' },
          { label: 'Trader type', value: 'Day trader, swing trader, or long-term investor — set during onboarding' },
          { label: 'Onboarding status', value: 'Whether you have completed setup' },
        ]} />

        <DataCard title="Voice Data" items={[
          { label: 'Voice recordings', value: 'When you use the voice input feature, audio is temporarily processed to generate a transcript. Audio is not permanently stored.' },
          { label: 'Wake word detection', value: '"Hey Monday" wake word detection runs locally in your browser via ONNX models. Audio is not sent to our servers for wake word detection.' },
          { label: 'TTS playback', value: 'Text sent to ElevenLabs to generate spoken audio responses. Subject to ElevenLabs\' privacy policy.' },
        ]} />

        <DataCard title="Technical Data" items={[
          { label: 'Browser & device', value: 'Standard server logs — browser type, OS, device type' },
          { label: 'IP address', value: 'Collected for security and abuse prevention' },
          { label: 'Session data', value: 'Authentication tokens managed by Supabase' },
        ]} />

        {/* 2 */}
        <h2 style={h2Style}>2. How We Use Your Data</h2>
        <ul style={{ listStyle: 'none', marginBottom: 16 }}>
          {[
            'Provide and operate the Service, including delivering real-time market data and AI responses',
            'Personalize Monday\'s briefings and analysis to your watchlist and trader type',
            'Process payments and manage your subscription through Stripe',
            'Send transactional emails (email confirmation, billing receipts, account notices)',
            'Detect and prevent fraud, abuse, and security incidents',
            'Improve the Service through aggregated, anonymized usage analysis',
            'Comply with legal obligations',
          ].map((item, i) => (
            <li key={i} style={liStyle}>
              <span style={{ position: 'absolute', left: 0, color: T.gold }}>·</span>
              {item}
            </li>
          ))}
        </ul>
        <p style={pStyle}>We do not sell your personal data. We do not use your data for advertising.</p>

        {/* 3 */}
        <h2 style={h2Style}>3. Third-Party Services</h2>
        <p style={pStyle}>We share data with the following third parties only as necessary to deliver the Service:</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {[
            { name: 'Stripe', purpose: 'Payment processing', data: 'Name, email, payment method', link: 'https://stripe.com/privacy' },
            { name: 'Supabase', purpose: 'Database & authentication', data: 'All account and usage data', link: 'https://supabase.com/privacy' },
            { name: 'Anthropic', purpose: 'AI language model (Monday)', data: 'Your chat messages and context', link: 'https://www.anthropic.com/privacy' },
            { name: 'ElevenLabs', purpose: 'Voice synthesis', data: 'Text of AI responses for TTS conversion', link: 'https://elevenlabs.io/privacy' },
            { name: 'Resend', purpose: 'Transactional email', data: 'Email address and message content', link: 'https://resend.com/privacy' },
            { name: 'Finnhub / data providers', purpose: 'Market data & news', data: 'Watchlist tickers (to fetch relevant data)', link: 'https://finnhub.io/privacy' },
          ].map((p, i) => (
            <div key={i} style={{ background: T.cardBg, border: `1px solid ${T.border}`, padding: '12px 16px', display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: 12, alignItems: 'start' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.gold }}>{p.name}</span>
              <span style={{ fontSize: 12, color: T.text2 }}>{p.purpose} — {p.data}</span>
              <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T.text3, textAlign: 'right' }}>Privacy Policy ↗</a>
            </div>
          ))}
        </div>

        {/* 4 */}
        <h2 style={h2Style}>4. Data Retention</h2>
        <p style={pStyle}>We retain your account data for as long as your account is active. Chat history is retained for rolling 48-hour periods by default for past summary access, and longer for conversation continuity features. If you delete your account, we will delete your personal data within 30 days, except where we are required to retain it for legal or tax purposes.</p>
        <p style={pStyle}>Voice audio processed for transcription is not stored — only the resulting text transcript is retained as part of chat history.</p>

        {/* 5 */}
        <h2 style={h2Style}>5. Data Security</h2>
        <p style={pStyle}>We use industry-standard security measures including TLS encryption in transit, hashed passwords, and Supabase Row Level Security (RLS) to ensure users can only access their own data. Payments are handled entirely by Stripe — we never transmit or store raw card data on our servers.</p>
        <p style={pStyle}>No system is 100% secure. We cannot guarantee the absolute security of your data and encourage you to use a strong, unique password.</p>

        {/* 6 */}
        <h2 style={h2Style}>6. Your Rights</h2>
        <p style={pStyle}>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
        <ul style={{ listStyle: 'none', marginBottom: 16 }}>
          {[
            'Access — request a copy of the personal data we hold about you',
            'Correction — request correction of inaccurate data',
            'Deletion — request deletion of your account and associated data',
            'Portability — request your data in a portable format',
            'Objection — object to certain processing of your data',
          ].map((item, i) => (
            <li key={i} style={liStyle}>
              <span style={{ position: 'absolute', left: 0, color: T.gold }}>·</span>
              {item}
            </li>
          ))}
        </ul>
        <p style={pStyle}>To exercise any of these rights, email us at <a href="mailto:support@heymonday.store">support@heymonday.store</a>. We will respond within 30 days.</p>

        {/* 7 */}
        <h2 style={h2Style}>7. Cookies</h2>
        <p style={pStyle}>Hey Monday uses session cookies for authentication (managed by Supabase) and local storage for theme preferences. We do not use advertising cookies or third-party tracking pixels. We do not use Google Analytics or similar tracking services.</p>

        {/* 8 */}
        <h2 style={h2Style}>8. Children's Privacy</h2>
        <p style={pStyle}>Hey Monday is intended for users who are 18 years of age or older. We do not knowingly collect personal data from anyone under 18. If you believe a minor has created an account, please contact us at <a href="mailto:support@heymonday.store">support@heymonday.store</a> and we will promptly delete it.</p>

        {/* 9 */}
        <h2 style={h2Style}>9. Changes to This Policy</h2>
        <p style={pStyle}>We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a notice in the Service. The effective date at the top of this page reflects the most recent update. Continued use of the Service after changes constitutes acceptance of the updated policy.</p>

        {/* 10 */}
        <h2 style={h2Style}>10. Contact</h2>
        <p style={pStyle}>For privacy questions, data requests, or concerns, contact us at:</p>
        <div style={{ background: T.goldFaint, border: `1px solid ${T.goldBorder}`, padding: '16px 20px', marginTop: 8 }}>
          <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.9, marginBottom: 0 }}>
            Expedition Way Ventures LLC d/b/a Hey Monday<br />
            Arizona, United States<br />
            <a href="mailto:support@heymonday.store">support@heymonday.store</a>
          </p>
        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${T.border}`, display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/terms" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.gold }}>Terms of Service →</Link>
          <Link href="/" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.text3, textDecoration: 'none' }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}