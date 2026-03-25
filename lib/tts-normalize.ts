/**
 * tts-normalize.ts
 *
 * Pre-processes text before sending to ElevenLabs so it reads naturally aloud.
 */

type NormalizeTTSOptions = {
  tickerMap?: Record<string, string>
}

// ── BUILT-IN TICKER PRONUNCIATIONS ────────────────────────────────────────────
const BUILTIN_TICKER_MAP: Record<string, string> = {
  AAPL: 'Apple',
  ABBV: 'AbbVie',
  ABNB: 'Airbnb',
  ADBE: 'Adobe',
  AMD: 'AMD',
  AMGN: 'Amgen',
  AMZN: 'Amazon',
  AVGO: 'Broadcom',
  BA: 'Boeing',
  BAC: 'Bank of America',
  BABA: 'Alibaba',
  BRK: 'Berkshire Hathaway',
  C: 'Citigroup',
  CAT: 'Caterpillar',
  CL: 'crude oil futures',
  COIN: 'Coinbase',
  COST: 'Costco',
  CRM: 'Salesforce',
  CRWD: 'CrowdStrike',
  CVX: 'Chevron',
  DIA: 'Dow ETF',
  DIS: 'Disney',
  DKNG: 'DraftKings',
  ELF: 'e l f Beauty',
  ES: 'S and P futures',
  ETH: 'Ethereum',
  F: 'Ford',
  FDX: 'FedEx',
  GDX: 'gold miners',
  GLD: 'gold',
  GOOGL: 'Alphabet',
  GS: 'Goldman Sachs',
  HIMS: 'Hims and Hers',
  HOOD: 'Robinhood',
  IBM: 'IBM',
  INTC: 'Intel',
  IWM: 'Russell ETF',
  JNJ: 'Johnson and Johnson',
  JPM: 'J P Morgan',
  KO: 'Coca-Cola',
  LLY: 'Eli Lilly',
  LULU: 'Lululemon',
  MCD: 'McDonald’s',
  META: 'Meta',
  MS: 'Morgan Stanley',
  MSFT: 'Microsoft',
  MU: 'Micron',
  NEE: 'NextEra Energy',
  NFLX: 'Netflix',
  NKE: 'Nike',
  NQ: 'Nasdaq futures',
  NVDA: 'Nvidia',
  OXY: 'Occidental',
  PANW: 'Palo Alto Networks',
  PDD: 'P D D',
  PEP: 'Pepsi',
  PLTR: 'Palantir',
  PYPL: 'PayPal',
  QCOM: 'Qualcomm',
  QQQ: 'Nasdaq ETF',
  RBLX: 'Roblox',
  RIOT: 'Riot Platforms',
  RIVN: 'Rivian',
  ROKU: 'Roku',
  SHOP: 'Shopify',
  SMCI: 'Super Micro',
  SNAP: 'Snap',
  SNOW: 'Snowflake',
  SOFI: 'SoFi',
  SPOT: 'Spotify',
  SPY: 'S and P ETF',
  SQ: 'Block',
  TLT: 'Treasury ETF',
  TMO: 'Thermo Fisher',
  TSLA: 'Tesla',
  UAL: 'United Airlines',
  UNH: 'UnitedHealth',
  UPST: 'Upstart',
  V: 'Visa',
  VRT: 'Vertiv',
  WFC: 'Wells Fargo',
  XLE: 'energy sector',
  XLF: 'financials sector',
  XLK: 'technology sector',
  XLP: 'consumer staples sector',
  XLRE: 'real estate sector',
  XLU: 'utilities sector',
  XLV: 'healthcare sector',
  XLY: 'consumer discretionary sector',
  XOM: 'Exxon',
  ZM: 'Zoom',
  ZS: 'Zscaler',

  BTC: 'Bitcoin',
  GC: 'gold futures',
  OIL: 'oil',

  FOMC: 'the Fed',
  CPI: 'C P I',
  GDP: 'G D P',
  PCE: 'P C E',
  NFP: 'the jobs report',
  ETF: 'E T F',
  IPO: 'I P O',
  SEC: 'the S E C',
  VWAP: 'V WAP',
  HOD: 'high of day',
  LOD: 'low of day',
  EOD: 'end of day',
  YTD: 'year to date',
}

const TIMEZONE_MAP: Record<string, string> = {
  ET: 'Eastern time',
  EST: 'Eastern Standard Time',
  EDT: 'Eastern Daylight Time',
  CT: 'Central time',
  CST: 'Central Standard Time',
  MT: 'Mountain time',
  PT: 'Pacific time',
  PST: 'Pacific Standard Time',
  PDT: 'Pacific Daylight Time',
  UTC: 'U T C',
}

function stripCommas(num: string): string {
  return num.replace(/,/g, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function spokenInteger(n: number): string {
  if (n === 0) return 'zero'

  const ones = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
    'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  ]

  const tens = [
    '', '', 'twenty', 'thirty', 'forty', 'fifty',
    'sixty', 'seventy', 'eighty', 'ninety',
  ]

  function below1000(num: number): string {
    if (num === 0) return ''
    if (num < 20) return ones[num]
    if (num < 100) {
      const t = tens[Math.floor(num / 10)]
      const o = ones[num % 10]
      return o ? `${t} ${o}` : t
    }
    const h = ones[Math.floor(num / 100)]
    const rest = num % 100
    return rest ? `${h} hundred ${below1000(rest)}` : `${h} hundred`
  }

  const parts: string[] = []
  const scales = [
    { value: 1_000_000_000_000, name: 'trillion' },
    { value: 1_000_000_000, name: 'billion' },
    { value: 1_000_000, name: 'million' },
    { value: 1_000, name: 'thousand' },
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

function expandDecimal(numStr: string): string {
  const clean = stripCommas(numStr)
  const [wholePart, fracPart] = clean.split('.')
  const wholeNum = parseInt(wholePart, 10)
  const wholeSpoken = spokenInteger(wholeNum)

  if (!fracPart) return wholeSpoken

  // Preserve all digits after the decimal, including trailing zeros.
  // 175.20 -> one hundred seventy five point 2 0
  const fracDigits = fracPart.split('').join(' ')
  return `${wholeSpoken} point ${fracDigits}`
}

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

function buildMergedTickerMap(dynamicTickerMap?: Record<string, string>) {
  const merged = { ...BUILTIN_TICKER_MAP }

  for (const [ticker, spoken] of Object.entries(dynamicTickerMap || {})) {
    const cleanTicker = ticker.toUpperCase().trim()
    const cleanSpoken = String(spoken || '').trim()

    // Do not let dynamic values overwrite built-ins if the "company name"
    // is just the ticker letters again.
    if (!cleanSpoken) continue
    if (cleanSpoken.toUpperCase() === cleanTicker) continue

    merged[cleanTicker] = cleanSpoken
  }

  return merged
}

export function normalizeTTS(text: string, options: NormalizeTTSOptions = {}): string {
  let s = text
  const TICKER_MAP = buildMergedTickerMap(options.tickerMap)

  // 1. Numeric ranges first
  s = s.replace(
    /\b(\$?\d[\d,]*\.?\d*[TBMK]?)\s*[-–—]\s*(\$?\d[\d,]*\.?\d*[TBMK]?)\b/g,
    (_match, left, right) => {
      const expandSide = (value: string) => {
        const m = value.match(/^(\$?)(\d[\d,]*\.?\d*)([TBMK]?)$/i)
        if (!m) return value
        const [, dollar, numRaw, suffix] = m
        return expandMoney(value, dollar, numRaw, suffix)
      }

      return `${expandSide(left)} to ${expandSide(right)}`
    }
  )

  // 2. Tickers / names
  for (const [ticker, spoken] of Object.entries(TICKER_MAP)) {
    const re = new RegExp(`\\b${escapeRegExp(ticker)}\\b`, 'g')
    s = s.replace(re, spoken)
  }

  // 3. Time zones
  for (const [tz, spoken] of Object.entries(TIMEZONE_MAP)) {
    const re = new RegExp(`\\b${escapeRegExp(tz)}\\b`, 'g')
    s = s.replace(re, spoken)
  }

  // 4. Percentages
  s = s.replace(/([+\-±]?)(\d[\d,]*\.?\d*)%/g, (match, sign, num) =>
    expandPercent(match, sign, num)
  )

  // 5. Suffixed numbers
  s = s.replace(/(\$?)(\d[\d,]*\.?\d*)([TBMK])\b/gi, (match, dollar, num, suffix) =>
    expandMoney(match, dollar, num, suffix)
  )

  // 6. Dollar amounts with commas
  s = s.replace(/\$(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/g, (_match, num) =>
    `${expandDecimal(num)} dollars`
  )

  // 7. Plain dollar decimals
  s = s.replace(/\$(\d+\.\d+)/g, (_match, num) => `${expandDecimal(num)} dollars`)

  // 8. Plain dollar integers
  s = s.replace(/\$(\d+)\b/g, (_match, num) => `${expandDecimal(num)} dollars`)

  // 9. Comma-formatted standalone numbers
  s = s.replace(/(?<!\$)\b(\d{1,3}(?:,\d{3})+)\b/g, (_match, num) =>
    expandDecimal(num)
  )

  // 10. Standalone decimals like 175.20, 383.03, 26.60
  s = s.replace(/(?<![$\d])(\d+\.\d+)\b/g, (_match, num) => expandDecimal(num))

  // 11. 24-hour times
  s = s.replace(/\b([01]?\d|2[0-3]):([0-5]\d)(?!\s*[AaPp][Mm])\b/g, (match, h, m) =>
    expandTime(match, h, m)
  )

  // 12. 12-hour times
  s = s.replace(/\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)\b/g, (match, h, m, period) =>
    expandTime(match, h, m, period)
  )

  // 13. Bare hour + AM/PM
  s = s.replace(/\b(\d{1,2})\s*(AM|PM)\b/g, (_, h, period) => {
    const spoken = period.toUpperCase().replace('AM', 'A M').replace('PM', 'P M')
    return `${h} ${spoken}`
  })

  // 14. Basis points
  s = s.replace(/\b(\d+)\s*bps?\b/gi, (_, n) => `${n} basis points`)

  // 15. Symbols
  s = s.replace(/▲/g, 'up')
  s = s.replace(/▼/g, 'down')
  s = s.replace(/→/g, '')
  s = s.replace(/←/g, '')

  // 16. Cleanup
  s = s.replace(/  +/g, ' ').trim()

  return s
}