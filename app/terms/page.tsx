'use client'

import Link from 'next/link'
import { useTheme } from '@/app/context/theme-context'

const DARK = {
  pageBg: '#0a0a08', navBg: '#0a0a08', sectionBg: '#0f0d09', cardBg: '#120f07',
  border: '#2a2618', border2: '#3a3420',
  gold: '#c9922a', goldDim: '#8a6420', goldFaint: 'rgba(201,146,42,0.06)', goldBorder: 'rgba(201,146,42,0.18)',
  text: '#d4c5a0', text2: '#a08040', text3: '#6a6050', text4: '#4a3828',
  heading: '#e8d5a0', red: '#c94242', redFaint: 'rgba(201,66,66,0.08)', redBorder: 'rgba(201,66,66,0.2)',
}
const LIGHT = {
  pageBg: '#f5f0e8', navBg: '#f5f0e8', sectionBg: '#ede6d6', cardBg: '#faf7f0',
  border: '#c8b898', border2: '#b8a47e',
  gold: '#a06818', goldDim: '#7a5010', goldFaint: 'rgba(160,104,24,0.05)', goldBorder: 'rgba(160,104,24,0.2)',
  text: '#2a1f0e', text2: '#6b4c20', text3: '#8a7050', text4: '#b8a070',
  heading: '#1a1008', red: '#b83232', redFaint: 'rgba(184,50,50,0.06)', redBorder: 'rgba(184,50,50,0.25)',
}

function SunIcon({ color }: { color: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
}
function MoonIcon({ color }: { color: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
}

const EFFECTIVE_DATE = 'March 22, 2026'

export default function TermsPage() {
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
          <Link href="/privacy" style={{ fontSize: 10, color: T.text3, letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>Privacy Policy</Link>
          <button onClick={toggle} style={{ background: T.cardBg, border: `1px solid ${T.border2}`, borderRadius: 24, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: T.text2 }}>
            {isDark ? <SunIcon color={T.text2} /> : <MoonIcon color={T.text2} />}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: '56px 32px 40px', background: T.sectionBg }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: T.goldDim, textTransform: 'uppercase', marginBottom: 14 }}>Legal</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 48, fontWeight: 700, fontStyle: 'italic', color: T.heading, marginBottom: 12, lineHeight: 1.1 }}>Terms of Service</h1>
          <p style={{ fontSize: 12, color: T.text3, fontFamily: "'JetBrains Mono',monospace" }}>Effective {EFFECTIVE_DATE} · Expedition Way Ventures LLC d/b/a Hey Monday · Arizona, United States</p>
        </div>
      </div>

      {/* FINANCIAL DISCLAIMER BANNER */}
      <div style={{ background: T.redFaint, borderBottom: `1px solid ${T.redBorder}`, padding: '16px 32px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>⚠</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.red, marginBottom: 4 }}>Not Financial Advice</div>
            <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.7 }}>
              Hey Monday is an AI-powered market intelligence and information tool. Nothing provided by Hey Monday — including market data, news summaries, AI responses, briefings, or any other content — constitutes financial advice, investment advice, trading advice, or any recommendation to buy, sell, or hold any security or asset. All content is for informational purposes only. You are solely responsible for your own investment decisions. Past performance is not indicative of future results. Always consult a qualified financial advisor before making investment decisions.
            </p>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 32px 80px' }}>

        <p style={pStyle}>
          Please read these Terms of Service carefully before using Hey Monday. By creating an account or using any part of the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
        </p>

        {/* 1 */}
        <h2 style={h2Style}>1. About Hey Monday</h2>
        <p style={pStyle}>Hey Monday is an AI-powered market intelligence platform operated by Expedition Way Ventures LLC, an Arizona limited liability company doing business as Hey Monday ("Company", "we", "us", or "our"). The Service provides real-time market data, AI-generated analysis, voice-driven market briefings, news summaries, economic calendar data, and related tools to registered subscribers.</p>

        {/* 2 */}
        <h2 style={h2Style}>2. Eligibility</h2>
        <p style={pStyle}>You must be at least <strong style={{ color: T.gold }}>18 years of age</strong> to use Hey Monday. By using the Service, you represent and warrant that you are 18 or older, have the legal capacity to enter into a binding contract, and are not prohibited from using the Service under applicable law. Hey Monday is intended for users in the United States. We make no representation that the Service is appropriate or available in other jurisdictions.</p>

        {/* 3 */}
        <h2 style={h2Style}>3. Account Registration</h2>
        <p style={pStyle}>You must create an account to access Hey Monday. You agree to provide accurate, complete, and current information during registration and to keep your account information updated. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at <a href="mailto:support@heymonday.store">support@heymonday.store</a> if you suspect unauthorized access to your account.</p>
        <p style={pStyle}>You may not share your account with others, create multiple accounts, or use another user's account.</p>

        {/* 4 */}
        <h2 style={h2Style}>4. Subscription & Billing</h2>
        <h3 style={h3Style}>4.1 Plans & Pricing</h3>
        <p style={pStyle}>Hey Monday offers monthly and annual subscription plans. Current pricing is displayed on the signup page and is subject to change with notice. Annual plans are billed as a single upfront charge.</p>
        <h3 style={h3Style}>4.2 Free Trial</h3>
        <p style={pStyle}>New subscribers receive a 5-day free trial. You will not be charged during the trial period. At the end of the trial your subscription will automatically begin and your payment method will be charged unless you cancel before the trial ends.</p>
        <h3 style={h3Style}>4.3 Automatic Renewal</h3>
        <p style={pStyle}>Subscriptions automatically renew at the end of each billing period. By subscribing you authorize Hey Monday to charge your payment method on a recurring basis until you cancel.</p>
        <h3 style={h3Style}>4.4 Cancellation</h3>
        <p style={pStyle}>You may cancel your subscription at any time through your account settings or by contacting us at <a href="mailto:support@heymonday.store">support@heymonday.store</a>. Cancellation takes effect at the end of the current billing period. We do not provide refunds for partial billing periods.</p>
        <h3 style={h3Style}>4.5 Payment Processing</h3>
        <p style={pStyle}>All payments are processed by Stripe, Inc. By providing your payment information you agree to Stripe's terms of service. Hey Monday does not store your full credit card details.</p>
        <h3 style={h3Style}>4.6 Price Changes</h3>
        <p style={pStyle}>We reserve the right to change subscription prices. We will provide at least 30 days advance notice of any price increase. Continued use of the Service after a price change constitutes your acceptance of the new price.</p>

        {/* 5 */}
        <h2 style={h2Style}>5. The Service</h2>
        <h3 style={h3Style}>5.1 What Hey Monday Provides</h3>
        <ul style={{ listStyle: 'none', marginBottom: 16 }}>
          {[
            'Real-time and delayed market data for stocks, ETFs, futures, commodities, and cryptocurrencies',
            'AI-generated market analysis, news summaries, and spoken briefings via voice',
            'Economic and earnings calendar with high-impact event tracking',
            'Customizable watchlists and price alerts',
            'Level 2 order flow descriptions and market context',
            'A conversational AI assistant (Monday) accessible by voice or text',
          ].map((item, i) => (
            <li key={i} style={liStyle}>
              <span style={{ position: 'absolute', left: 0, color: T.gold }}>·</span>
              {item}
            </li>
          ))}
        </ul>
        <h3 style={h3Style}>5.2 Service Availability</h3>
        <p style={pStyle}>We strive for high availability but do not guarantee uninterrupted access. Market data availability depends on third-party data providers and market hours. We are not responsible for delays, inaccuracies, or interruptions in data caused by third parties.</p>
        <h3 style={h3Style}>5.3 AI Limitations</h3>
        <p style={pStyle}>Monday is powered by artificial intelligence. AI responses may be inaccurate, incomplete, or outdated. Do not rely solely on Monday's output for any financial or investment decision. Always verify information independently.</p>

        {/* 6 */}
        <h2 style={h2Style}>6. Financial Disclaimer</h2>
        <div style={{ background: T.redFaint, border: `1px solid ${T.redBorder}`, padding: '16px 20px', marginBottom: 20, borderLeft: `3px solid ${T.red}` }}>
          <p style={{ ...pStyle, marginBottom: 0, color: T.text }}>
            <strong style={{ color: T.red }}>Hey Monday does not provide financial advice.</strong> All market data, analysis, AI responses, voice briefings, news summaries, and other content provided by the Service are for <strong>informational and educational purposes only</strong>. Nothing in the Service constitutes a recommendation, solicitation, or offer to buy or sell any security, commodity, futures contract, or other financial instrument. Hey Monday (Expedition Way Ventures LLC) is not a registered investment adviser, broker-dealer, or financial planner. Market data may be delayed and is provided "as is" without warranty of accuracy. You acknowledge that investing in financial markets involves substantial risk of loss and that you are solely responsible for all trading and investment decisions you make.
          </p>
        </div>

        {/* 7 */}
        <h2 style={h2Style}>7. Acceptable Use</h2>
        <p style={pStyle}>You agree not to:</p>
        <ul style={{ listStyle: 'none', marginBottom: 16 }}>
          {[
            'Use the Service for any unlawful purpose or in violation of any regulations',
            'Attempt to reverse engineer, scrape, or extract data from the Service at scale',
            'Share, resell, or redistribute market data or AI-generated content to third parties',
            'Use the Service to manipulate markets or engage in fraudulent trading activity',
            'Attempt to bypass any security measures or access accounts you do not own',
            'Use automated bots or scripts to access the Service except via our official API',
            'Impersonate any person or entity or misrepresent your affiliation',
          ].map((item, i) => (
            <li key={i} style={liStyle}>
              <span style={{ position: 'absolute', left: 0, color: T.red }}>·</span>
              {item}
            </li>
          ))}
        </ul>

        {/* 8 */}
        <h2 style={h2Style}>8. Intellectual Property</h2>
        <p style={pStyle}>Hey Monday and all its content, features, and functionality — including but not limited to the AI models, interface design, waveform logo, brand name, briefing audio, and underlying technology — are owned by Expedition Way Ventures LLC (operating as Hey Monday) and are protected by applicable intellectual property laws.</p>
        <p style={pStyle}>Your subscription grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for personal, non-commercial purposes. This license does not include any right to resell, sublicense, or redistribute any content or data.</p>

        {/* 9 */}
        <h2 style={h2Style}>9. Third-Party Services</h2>
        <p style={pStyle}>Hey Monday integrates with several third-party services to deliver the Service, including:</p>
        <ul style={{ listStyle: 'none', marginBottom: 16 }}>
          {[
            'Stripe — payment processing',
            'Supabase — database and authentication',
            'Anthropic — AI language model powering Monday',
            'ElevenLabs — AI voice synthesis for spoken briefings',
            'Finnhub / financial data providers — market data and news',
          ].map((item, i) => (
            <li key={i} style={liStyle}>
              <span style={{ position: 'absolute', left: 0, color: T.gold }}>·</span>
              {item}
            </li>
          ))}
        </ul>
        <p style={pStyle}>Your use of the Service is subject to the terms and privacy policies of these third-party providers. We are not responsible for their practices.</p>

        {/* 10 */}
        <h2 style={h2Style}>10. Disclaimers & Limitation of Liability</h2>
        <p style={{ ...pStyle, textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.02em' }}>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT MARKET DATA IS ACCURATE, COMPLETE, OR TIMELY.
        </p>
        <p style={{ ...pStyle, textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.02em' }}>
          TO THE FULLEST EXTENT PERMITTED BY LAW, EXPEDITION WAY VENTURES LLC D/B/A HEY MONDAY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS OR TRADING LOSSES, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY TO YOU SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
        </p>

        {/* 11 */}
        <h2 style={h2Style}>11. Indemnification</h2>
        <p style={pStyle}>You agree to indemnify, defend, and hold harmless Expedition Way Ventures LLC d/b/a Hey Monday and its officers, directors, employees, and agents from any claims, damages, losses, and expenses (including reasonable legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.</p>

        {/* 12 */}
        <h2 style={h2Style}>12. Termination</h2>
        <p style={pStyle}>We may suspend or terminate your account at any time for violation of these Terms, suspected fraudulent activity, or for any other reason at our discretion, with or without notice. Upon termination your right to use the Service ceases immediately. Provisions of these Terms that by their nature should survive termination will survive.</p>

        {/* 13 */}
        <h2 style={h2Style}>13. Governing Law & Disputes</h2>
        <p style={pStyle}>These Terms are governed by the laws of the State of Arizona, United States, without regard to conflict of law principles. The Service is operated by Expedition Way Ventures LLC, doing business as Hey Monday. Any dispute arising from these Terms or your use of the Service shall be resolved through binding arbitration in Maricopa County, Arizona, under the rules of the American Arbitration Association, except that either party may seek injunctive relief in court. You waive any right to participate in a class action lawsuit or class-wide arbitration.</p>

        {/* 14 */}
        <h2 style={h2Style}>14. Changes to These Terms</h2>
        <p style={pStyle}>We may update these Terms from time to time. We will notify you of material changes by email or by posting a notice in the Service. Continued use of the Service after changes become effective constitutes your acceptance of the updated Terms.</p>

        {/* 15 */}
        <h2 style={h2Style}>15. Contact</h2>
        <p style={pStyle}>Questions about these Terms? Contact us at <a href="mailto:support@heymonday.store">support@heymonday.store</a>.</p>
        <div style={{ background: T.goldFaint, border: `1px solid ${T.goldBorder}`, padding: '16px 20px', marginTop: 8 }}>
          <p style={{ fontSize: 12, color: T.text3, lineHeight: 1.7, marginBottom: 0 }}>
            Expedition Way Ventures LLC d/b/a Hey Monday · Arizona, United States<br />
            <a href="mailto:support@heymonday.store">support@heymonday.store</a>
          </p>
        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${T.border}`, display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/privacy" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.gold }}>Privacy Policy →</Link>
          <Link href="/" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.text3, textDecoration: 'none' }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}