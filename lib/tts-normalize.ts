/**
 * tts-normalize.ts
 *
 * Pre-processes text before sending to ElevenLabs so it reads naturally aloud.
 * Run this on any string before passing it to the ElevenLabs TTS API.
 *
 * Usage:
 *   import { normalizeTTS } from '@/lib/tts-normalize'
 *   const spokenText = normalizeTTS(atlasReply)
 *   // then send spokenText to ElevenLabs
 */

// ── TICKER PRONUNCIATIONS ─────────────────────────────────────────────────────
const TICKER_MAP: Record<string, string> = {
  NVDA: 'Nvidia',
  AAPL: 'Apple',
  TSLA: 'Tesla',
  MSFT: 'Microsoft',
  META: 'Meta',
  AMZN: 'Amazon',
  GOOGL: 'Alphabet',
  AMD: 'A M D',
  SPY: 'S P Y',
  QQQ: 'Q Q Q',
  IWM: 'I W M',
  GLD: 'G L D',
  OIL: 'oil',
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  GC: 'gold futures',
  CL: 'crude oil futures',
  NQ: 'Nasdaq futures',
  ES: 'S and P futures',
  XLK: 'X L K tech',
  XLE: 'X L E energy',
  XLF: 'X L F financials',
  XLV: 'X L V healthcare',
  XLRE: 'X L R E real estate',
  XLI: 'X L I industrials',
  XLU: 'X L U utilities',
  XLB: 'X L B materials',
  XLY: 'X L Y consumer discretionary',
  XLP: 'X L P consumer staples',
  FOMC: 'the Fed',
  CPI: 'C P I',
  GDP: 'G D P',
  PCE: 'P C E',
  NFP: 'the jobs report',
  ETF: 'E T F',
  IPO: 'I P O',
  SEC: 'the S E C',
  VWAP: 'V-WAP',
  HOD: 'high of day',
  LOD: 'low of day',
  EOD: 'end of day',
  YTD: 'year to date',
}

// ── TIME ZONES ────────────────────────────────────────────────────────────────
const TIMEZONE_MAP: Record<string, string> = {
  ET:  'Eastern time',
  EST: 'Eastern Standard Time',
  EDT: 'Eastern Daylight Time',
  CT:  'Central time',
  CST: 'Central Standard Time',
  MT:  'Mountain time',
  PT:  'Pacific time',
  PST: 'Pacific Standard Time',
  PDT: 'Pacific Daylight Time',
  UTC: 'U T C',
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function stripCommas(num: string): string {
  return num.replace(/,/g, '')
}

/**
 * Convert a plain integer into spoken English words.
 * 70600  → "seventy thousand six hundred"
 * 71000  → "seventy-one thousand"
 * 1000000 → "one million"
 */
function spokenInteger(n: number): string {
  if (n === 0) return 'zero'

  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
    'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty',
    'sixty', 'seventy', 'eighty', 'ninety']

  function below1000(num: number): string {
    if (num === 0) return ''
    if (num < 20) return ones[num]
    if (num < 100) {
      const t = tens[Math.floor(num / 10)]
      const o = ones[num % 10]
      return o ? `${t}-${o}` : t
    }
    const h = ones[Math.floor(num / 100)]
    const rest = num % 100
    return rest ? `${h} hundred ${below1000(rest)}` : `${h} hundred`
  }

  const parts: string[] = []
  const scales = [
    { value: 1_000_000_000_000, name: 'trillion' },
    { value: 1_000_000_000,     name: 'billion'  },
    { value: 1_000_000,         name: 'million'  },
    { value: 1_000,             name: 'thousand' },
  ]

  let remaining = n
  for (const { value, name } of scales) {
    if (remaining >= value) {
      const count = Math.floor(remaining / value)
      parts.push(`${below1000(count)} ${name}`)
      remaining -= count * value
    }
  }
  if (remaining > 0) parts.push(below1000(remaining))

  return parts.join(' ')
}

/**
 * Expand a numeric string (may include commas and decimals) into spoken form.
 * "70,600"  → "seventy thousand six hundred"
 * "70600"   → "seventy thousand six hundred"
 * "3.21"    → "three point 21"
 * "891.40"  → "eight hundred ninety-one point 40"
 */
function expandDecimal(numStr: string): string {
  const clean = stripCommas(numStr)
  const [wholePart, fracPart] = clean.split('.')
  const wholeNum = parseInt(wholePart, 10)
  const wholeSpoken = spokenInteger(wholeNum)
  if (!fracPart) return wholeSpoken
  const trimmedFrac = fracPart.replace(/0+$/, '') || '0'
  return `${wholeSpoken} point ${trimmedFrac}`
}

/**
 * Expand a money expression — currency label always goes at the END.
 * "$70,600"  → "seventy thousand six hundred dollars"
 * "$70K"     → "seventy thousand dollars"
 * "$21.1B"   → "twenty-one point 1 billion dollars"
 * "48.2M"    → "forty-eight point 2 million"   (no $ = no "dollars")
 */
function expandMoney(
  _match: string,
  dollar: string,
  numRaw: string,
  suffix: string
): string {
  const hasDollar = dollar === '$'
  const suffixMap: Record<string, string> = {
    T: 'trillion',
    B: 'billion',
    M: 'million',
    K: 'thousand',
  }
  const suffixWord = suffix ? (suffixMap[suffix.toUpperCase()] ?? '') : ''
  const spoken = expandDecimal(numRaw)
  const full = suffixWord ? `${spoken} ${suffixWord}` : spoken
  return hasDollar ? `${full} dollars` : full
}

function expandTime(match: string, h: string, m: string, period?: string): string {
  let hour = parseInt(h, 10)
  const minute = m ? parseInt(m, 10) : 0
  let ampm: string
  if (period) {
    ampm = period.toUpperCase().replace('AM', 'A M').replace('PM', 'P M')
  } else {
    ampm = hour >= 12 ? 'P M' : 'A M'
    if (hour > 12) hour -= 12
    if (hour === 0) hour = 12
  }
  const minuteStr = minute === 0 ? '' : ` ${minute < 10 ? 'oh ' + minute : minute}`
  return `${hour}${minuteStr} ${ampm}`
}

function expandPercent(_match: string, sign: string, numRaw: string): string {
  const spoken = expandDecimal(numRaw)
  if (sign === '+') return `up ${spoken} percent`
  if (sign === '-') return `down ${spoken} percent`
  if (sign === '±') return `plus or minus ${spoken} percent`
  return `${spoken} percent`
}

// ── MAIN NORMALIZER ───────────────────────────────────────────────────────────

export function normalizeTTS(text: string): string {
  let s = text

  // 1. Expand known tickers — whole word only, before anything else
  for (const [ticker, spoken] of Object.entries(TICKER_MAP)) {
    const re = new RegExp(`\\b${ticker}\\b`, 'g')
    s = s.replace(re, spoken)
  }

  // 2. Expand time zones — whole word
  for (const [tz, spoken] of Object.entries(TIMEZONE_MAP)) {
    const re = new RegExp(`\\b${tz}\\b`, 'g')
    s = s.replace(re, spoken)
  }

  // 3. Normalize ± symbol
  s = s.replace(/±/g, '±')

  // 4. Expand percentages FIRST (before dollar/number passes)
  s = s.replace(/([+\-±]?)(\d[\d,]*\.?\d*)%/g, (match, sign, num) =>
    expandPercent(match, sign, num)
  )

  // 5. Expand $amount with T/B/M/K suffix: $21.1B  $70K  $2.19T
  s = s.replace(/(\$?)(\d[\d,]*\.?\d*)([TBMK])\b/gi, (match, dollar, num, suffix) =>
    expandMoney(match, dollar, num, suffix)
  )

  // 6. Expand $amount with commas: $70,600  $1,234,567.89
  //    MUST be before plain $number so "$70,600" isn't matched as "$70" + ",600"
  s = s.replace(/\$(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/g, (_match, num) =>
    `${expandDecimal(num)} dollars`
  )

  // 7. Expand plain $decimal: $891.40  $5.59
  s = s.replace(/\$(\d+\.\d+)/g, (_match, num) => `${expandDecimal(num)} dollars`)

  // 8. Expand plain $integer: $70  $100
  s = s.replace(/\$(\d+)\b/g, (_match, num) => `${expandDecimal(num)} dollars`)

  // 9. Expand comma-formatted standalone numbers not preceded by $: 70,600
  s = s.replace(/(?<!\$)\b(\d{1,3}(?:,\d{3})+)\b/g, (_match, num) =>
    expandDecimal(num)
  )

  // 10. Expand 24-hour times: 14:00, 09:30 (not followed by AM/PM)
  s = s.replace(/\b([01]?\d|2[0-3]):([0-5]\d)(?!\s*[AaPp][Mm])\b/g, (match, h, m) =>
    expandTime(match, h, m)
  )

  // 11. Expand 12-hour times with AM/PM: 9:30 AM, 2:00 PM
  s = s.replace(/\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)\b/g, (match, h, m, period) =>
    expandTime(match, h, m, period)
  )

  // 12. Expand bare hour + AM/PM: "7 AM" → "7 A M"
  s = s.replace(/\b(\d{1,2})\s*(AM|PM)\b/g, (_, h, period) => {
    const spoken = period.toUpperCase().replace('AM', 'A M').replace('PM', 'P M')
    return `${h} ${spoken}`
  })

  // 13. Expand basis points: 49bp / 49bps
  s = s.replace(/\b(\d+)\s*bps?\b/gi, (_, n) => `${n} basis points`)

  // 14. Arrow symbols to words
  s = s.replace(/▲/g, 'up')
  s = s.replace(/▼/g, 'down')
  s = s.replace(/→/g, '')
  s = s.replace(/←/g, '')

  // 15. Clean up double spaces
  s = s.replace(/  +/g, ' ').trim()

  return s
}