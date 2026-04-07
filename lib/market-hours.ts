export type MarketKind = 'equities' | 'futures' | 'crypto'

export type MarketSession =
  | 'closed'
  | 'premarket'
  | 'open'
  | 'afterhours'
  | 'maintenance'

export type MarketStatusResult = {
  kind: MarketKind
  session: MarketSession
  label: string
  isOpen: boolean
  isWeekend: boolean
  isHoliday: boolean
  isHalfDay: boolean
  minutesToClose: number | null
  minutesToOpen: number | null
  etDateKey: string
  etTimeLabel: string
}

function getEtDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(now)

  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour12 = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const dayPeriod = (parts.find((p) => p.type === 'dayPeriod')?.value ?? '').toUpperCase()

  const hour24 =
    dayPeriod === 'PM'
      ? (hour12 === 12 ? 12 : hour12 + 12)
      : (hour12 === 12 ? 0 : hour12)

  const etDateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const etTimeLabel = `${hour12}:${String(minute).padStart(2, '0')} ${dayPeriod} ET`

  return { year, month, day, weekdayShort, hour24, minute, etDateKey, etTimeLabel }
}

function minutesSinceMidnight(hour24: number, minute: number) {
  return hour24 * 60 + minute
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number) {
  const first = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0))
  const firstWeekday = first.getUTCDay()
  const delta = (weekday - firstWeekday + 7) % 7
  return 1 + delta + (nth - 1) * 7
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number) {
  const last = new Date(Date.UTC(year, month, 0, 12, 0, 0))
  const lastDate = last.getUTCDate()
  const lastWeekday = last.getUTCDay()
  const delta = (lastWeekday - weekday + 7) % 7
  return lastDate - delta
}

function easterSundayUtc(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function goodFridayDateKey(year: number) {
  const easter = easterSundayUtc(year)
  easter.setUTCDate(easter.getUTCDate() - 2)
  return `${easter.getUTCFullYear()}-${String(easter.getUTCMonth() + 1).padStart(2, '0')}-${String(easter.getUTCDate()).padStart(2, '0')}`
}

function observedFixedHoliday(year: number, month: number, day: number) {
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const wd = dt.getUTCDay()

  if (wd === 6) {
    dt.setUTCDate(dt.getUTCDate() - 1)
  } else if (wd === 0) {
    dt.setUTCDate(dt.getUTCDate() + 1)
  }

  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function getNyseHolidaySet(year: number) {
  const mlk = nthWeekdayOfMonth(year, 1, 1, 3) // 3rd Monday Jan
  const presidents = nthWeekdayOfMonth(year, 2, 1, 3) // 3rd Monday Feb
  const memorial = lastWeekdayOfMonth(year, 5, 1) // last Monday May
  const labor = nthWeekdayOfMonth(year, 9, 1, 1) // 1st Monday Sep
  const thanksgiving = nthWeekdayOfMonth(year, 11, 4, 4) // 4th Thursday Nov

  return new Set<string>([
    observedFixedHoliday(year, 1, 1),
    `${year}-01-${String(mlk).padStart(2, '0')}`,
    `${year}-02-${String(presidents).padStart(2, '0')}`,
    goodFridayDateKey(year),
    `${year}-05-${String(memorial).padStart(2, '0')}`,
    observedFixedHoliday(year, 6, 19),
    observedFixedHoliday(year, 7, 4),
    `${year}-09-${String(labor).padStart(2, '0')}`,
    `${year}-11-${String(thanksgiving).padStart(2, '0')}`,
    observedFixedHoliday(year, 12, 25),
  ])
}

function getNyseHalfDaySet(year: number) {
  const thanksgiving = nthWeekdayOfMonth(year, 11, 4, 4)
  const dayAfterThanksgiving = new Date(Date.UTC(year, 10, thanksgiving, 12, 0, 0))
  dayAfterThanksgiving.setUTCDate(dayAfterThanksgiving.getUTCDate() + 1)

  const halfDays = new Set<string>([
    `${dayAfterThanksgiving.getUTCFullYear()}-${String(dayAfterThanksgiving.getUTCMonth() + 1).padStart(2, '0')}-${String(dayAfterThanksgiving.getUTCDate()).padStart(2, '0')}`,
  ])

  const christmasEve = new Date(Date.UTC(year, 11, 24, 12, 0, 0))
  if (christmasEve.getUTCDay() >= 1 && christmasEve.getUTCDay() <= 4) {
    halfDays.add(`${year}-12-24`)
  }

  const july3 = new Date(Date.UTC(year, 6, 3, 12, 0, 0))
  if (july3.getUTCDay() >= 1 && july3.getUTCDay() <= 4) {
    halfDays.add(`${year}-07-03`)
  }

  return halfDays
}

export function getNyseEquitiesStatus(now = new Date()): MarketStatusResult {
  const { year, weekdayShort, hour24, minute, etDateKey, etTimeLabel } = getEtDateParts(now)
  const mins = minutesSinceMidnight(hour24, minute)
  const isWeekend = weekdayShort === 'Sat' || weekdayShort === 'Sun'
  const holidays = getNyseHolidaySet(year)
  const halfDays = getNyseHalfDaySet(year)
  const isHoliday = holidays.has(etDateKey)
  const isHalfDay = halfDays.has(etDateKey)

  const preOpen = 4 * 60
  const coreOpen = 9 * 60 + 30
  const coreClose = isHalfDay ? 13 * 60 : 16 * 60
  const afterClose = isHalfDay ? 17 * 60 : 20 * 60

  if (isWeekend || isHoliday) {
    return {
      kind: 'equities',
      session: 'closed',
      label: isHoliday ? 'MARKET CLOSED · HOLIDAY' : 'MARKET CLOSED',
      isOpen: false,
      isWeekend,
      isHoliday,
      isHalfDay,
      minutesToClose: null,
      minutesToOpen: null,
      etDateKey,
      etTimeLabel,
    }
  }

  if (mins >= coreOpen && mins < coreClose) {
    return {
      kind: 'equities',
      session: 'open',
      label: isHalfDay ? 'MARKET OPEN · EARLY CLOSE 1PM ET' : 'MARKET OPEN',
      isOpen: true,
      isWeekend,
      isHoliday,
      isHalfDay,
      minutesToClose: coreClose - mins,
      minutesToOpen: 0,
      etDateKey,
      etTimeLabel,
    }
  }

  if (mins >= preOpen && mins < coreOpen) {
    return {
      kind: 'equities',
      session: 'premarket',
      label: 'PRE-MARKET',
      isOpen: false,
      isWeekend,
      isHoliday,
      isHalfDay,
      minutesToClose: null,
      minutesToOpen: coreOpen - mins,
      etDateKey,
      etTimeLabel,
    }
  }

  if (mins >= coreClose && mins < afterClose) {
    return {
      kind: 'equities',
      session: 'afterhours',
      label: isHalfDay ? 'AFTER-HOURS · POST EARLY CLOSE' : 'AFTER-HOURS',
      isOpen: false,
      isWeekend,
      isHoliday,
      isHalfDay,
      minutesToClose: null,
      minutesToOpen: null,
      etDateKey,
      etTimeLabel,
    }
  }

  return {
    kind: 'equities',
    session: 'closed',
    label: 'MARKET CLOSED',
    isOpen: false,
    isWeekend,
    isHoliday,
    isHalfDay,
    minutesToClose: null,
    minutesToOpen: null,
    etDateKey,
    etTimeLabel,
  }
}

export function getCmeFuturesStatus(now = new Date()): MarketStatusResult {
  const { weekdayShort, hour24, minute, etDateKey, etTimeLabel } = getEtDateParts(now)
  const mins = minutesSinceMidnight(hour24, minute)
  const isWeekend = weekdayShort === 'Sat' || weekdayShort === 'Sun'

  const sundayOpen = 18 * 60
  const dailyBreakStart = 17 * 60
  const dailyBreakEnd = 18 * 60

  let session: MarketSession = 'open'
  let label = 'FUTURES OPEN'
  let isOpen = true

  if (weekdayShort === 'Sat') {
    session = 'closed'
    label = 'FUTURES CLOSED'
    isOpen = false
  } else if (weekdayShort === 'Sun') {
    if (mins < sundayOpen) {
      session = 'closed'
      label = 'FUTURES CLOSED'
      isOpen = false
    }
  } else if (mins >= dailyBreakStart && mins < dailyBreakEnd) {
    session = 'maintenance'
    label = 'FUTURES MAINTENANCE'
    isOpen = false
  }

  return {
    kind: 'futures',
    session,
    label,
    isOpen,
    isWeekend,
    isHoliday: false,
    isHalfDay: false,
    minutesToClose: null,
    minutesToOpen: null,
    etDateKey,
    etTimeLabel,
  }
}

export function getCryptoStatus(now = new Date()): MarketStatusResult {
  const { etDateKey, etTimeLabel } = getEtDateParts(now)
  return {
    kind: 'crypto',
    session: 'open',
    label: 'CRYPTO OPEN 24/7',
    isOpen: true,
    isWeekend: false,
    isHoliday: false,
    isHalfDay: false,
    minutesToClose: null,
    minutesToOpen: 0,
    etDateKey,
    etTimeLabel,
  }
}

export function getMarketStatusByAssetKind(kind: MarketKind, now = new Date()) {
  if (kind === 'futures') return getCmeFuturesStatus(now)
  if (kind === 'crypto') return getCryptoStatus(now)
  return getNyseEquitiesStatus(now)
}