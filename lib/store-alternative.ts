import { createAdminSupabaseClient } from './supabase-admin'
import type {
  InsiderTransaction, AnalystRating, OptionsFlow, SecFiling, SectorPerformance,
  CongressionalTrade, ShortInterestRow, InstitutionalHolding, DarkPoolPrint,
} from './providers/alternative'

export async function upsertInsiderTransactions(transactions: InsiderTransaction[]): Promise<void> {
  if (!transactions.length) return
  const supabase = createAdminSupabaseClient()
  const rows = transactions.map(t => ({
    external_id:      `${t.symbol}-${t.name}-${t.transactionDate}-${t.transactionType}`.replace(/\s+/g, '_'),
    ticker:           t.symbol,
    insider_name:     t.name      || null,
    insider_title:    null,
    transaction_type: t.transactionType,
    shares:           t.shares,
    price_per_share:  t.shares > 0 ? t.value / t.shares : null,
    total_value:      t.value,
    transaction_date: t.transactionDate || null,
    filed_at:         t.filingDate      || null,
  }))
  const { error } = await supabase
    .from('insider_transactions')
    .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
  if (error) console.error('[store-alt] insider:', error.message)
}

export async function upsertAnalystRatings(ratings: AnalystRating[]): Promise<void> {
  if (!ratings.length) return
  const supabase = createAdminSupabaseClient()
  const rows = ratings.map(r => ({
    external_id:  `${r.symbol}-${r.analyst}-${r.date}-${r.action}`.replace(/\s+/g, '_'),
    ticker:       r.symbol,
    analyst_firm: r.analyst     || null,
    rating:       r.rating      || null,
    price_target: r.priceTarget ?? null,
    action:       r.action      || null,
    rated_at:     r.date,
  }))
  const { error } = await supabase
    .from('analyst_ratings')
    .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
  if (error) console.error('[store-alt] analyst:', error.message)
}

export async function upsertOptionsFlow(flow: OptionsFlow[], snapshotDate: string): Promise<void> {
  if (!flow.length) return
  const supabase = createAdminSupabaseClient()
  const rows = flow.map(o => ({
    external_id:        `${o.symbol}-${o.strike}-${o.expiry}-${o.type}-${snapshotDate}`,
    ticker:             o.symbol,
    contract_type:      o.type,
    strike:             o.strike,
    expiry:             o.expiry    || null,
    premium:            o.premium,
    volume:             o.volume,
    open_interest:      o.openInterest,
    implied_volatility: o.impliedVolatility,
    sentiment:          o.sentiment,
    snapshot_date:      snapshotDate,
  }))
  const { error } = await supabase
    .from('options_flow')
    .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
  if (error) console.error('[store-alt] options:', error.message)
}

export async function upsertSectorSnapshots(sectors: SectorPerformance[], snapshotDate: string): Promise<void> {
  if (!sectors.length) return
  const supabase = createAdminSupabaseClient()
  const rows = sectors.map(s => ({
    sector:        s.sector,
    change_pct:    parseFloat(s.change),
    snapshot_date: snapshotDate,
  }))
  const { error } = await supabase
    .from('sector_snapshots')
    .upsert(rows, { onConflict: 'sector,snapshot_date' })
  if (error) console.error('[store-alt] sector:', error.message)
}

export async function upsertSecFilings(filings: SecFiling[]): Promise<void> {
  if (!filings.length) return
  const supabase = createAdminSupabaseClient()
  const rows = filings
    .filter(f => f.url)
    .map(f => ({
      external_id:  f.url,
      ticker:       f.symbol,
      filing_type:  f.type       || null,
      title:        f.title      || null,
      filed_at:     f.filingDate || null,
      url:          f.url,
    }))
  const { error } = await supabase
    .from('sec_filings')
    .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
  if (error) console.error('[store-alt] sec:', error.message)
}

export async function derivePriceSnapshots(tickers: string[]): Promise<void> {
  if (!tickers.length) return
  const supabase = createAdminSupabaseClient()
  const today      = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const startOfDay = new Date(`${today}T00:00:00-04:00`).toISOString()

  for (const ticker of tickers) {
    const { data: candles } = await supabase
      .from('candles_1m')
      .select('open, high, low, close, volume, ts')
      .eq('ticker', ticker)
      .gte('ts', startOfDay)
      .order('ts', { ascending: true })

    if (!candles?.length) continue

    const open   = candles[0].open
    const close  = candles[candles.length - 1].close
    const high   = Math.max(...candles.map((c: any) => c.high))
    const low    = Math.min(...candles.map((c: any) => c.low))
    const volume = candles.reduce((s: number, c: any) => s + c.volume, 0)

    let tpv = 0, vol = 0
    for (const c of candles as any[]) {
      tpv += ((c.high + c.low + c.close) / 3) * c.volume
      vol += c.volume
    }
    const vwap = vol > 0 ? tpv / vol : null

    await supabase.from('price_snapshots').upsert(
      { ticker, date: today, open, high, low, close, volume, vwap },
      { onConflict: 'ticker,date' }
    )
  }
}

// ── Scaffolded — no vendor yet ────────────────────────────────────────────────

export async function upsertCongressionalTrades(trades: CongressionalTrade[]): Promise<void> {
  if (!trades.length) return
  const supabase = createAdminSupabaseClient()
  const rows = trades.map(t => ({
    external_id:      t.externalId,
    ticker:           t.ticker,
    politician_name:  t.politicianName,
    chamber:          t.chamber,
    party:            t.party,
    state:            t.state,
    transaction_type: t.transactionType,
    amount_range:     t.amountRange,
    transaction_date: t.transactionDate,
    disclosure_date:  t.disclosureDate,
  }))
  const { error } = await supabase
    .from('congressional_trades')
    .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
  if (error) console.error('[store-alt] congressional:', error.message)
}

export async function upsertShortInterest(rows: ShortInterestRow[]): Promise<void> {
  if (!rows.length) return
  const supabase = createAdminSupabaseClient()
  const data = rows.map(r => ({
    ticker:             r.ticker,
    report_date:        r.reportDate,
    short_volume:       r.shortVolume,
    short_volume_ratio: r.shortVolumeRatio,
    days_to_cover:      r.daysToCover,
  }))
  const { error } = await supabase
    .from('short_interest')
    .upsert(data, { onConflict: 'ticker,report_date' })
  if (error) console.error('[store-alt] short interest:', error.message)
}

export async function upsertInstitutionalHoldings(holdings: InstitutionalHolding[]): Promise<void> {
  if (!holdings.length) return
  const supabase = createAdminSupabaseClient()
  const rows = holdings.map(h => ({
    external_id:      h.externalId,
    ticker:           h.ticker,
    institution_name: h.institutionName,
    shares:           h.shares,
    value_usd:        h.valueUsd,
    quarter:          h.quarter,
    change_shares:    h.changeShares,
  }))
  const { error } = await supabase
    .from('institutional_holdings')
    .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
  if (error) console.error('[store-alt] institutional:', error.message)
}

export async function upsertDarkPoolPrints(prints: DarkPoolPrint[]): Promise<void> {
  if (!prints.length) return
  const supabase = createAdminSupabaseClient()
  const rows = prints.map(p => ({
    external_id:    p.externalId,
    ticker:         p.ticker,
    price:          p.price,
    volume:         p.volume,
    notional_value: p.notionalValue,
    traded_at:      p.tradedAt,
  }))
  const { error } = await supabase
    .from('dark_pool_trades')
    .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
  if (error) console.error('[store-alt] dark pool:', error.message)
}

export async function cleanupAlternativeData(days = 95): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-CA')
  const cutoffTs = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  await Promise.all([
    supabase.from('insider_transactions').delete().lt('filed_at',         cutoffDate),
    supabase.from('analyst_ratings').delete().lt('rated_at',              cutoffDate),
    supabase.from('options_flow').delete().lt('snapshot_date',            cutoffDate),
    supabase.from('sector_snapshots').delete().lt('snapshot_date',        cutoffDate),
    supabase.from('sec_filings').delete().lt('filed_at',                  cutoffDate),
    supabase.from('price_snapshots').delete().lt('date',                  cutoffDate),
    supabase.from('congressional_trades').delete().lt('disclosure_date',  cutoffDate),
    supabase.from('short_interest').delete().lt('report_date',            cutoffDate),
    supabase.from('dark_pool_trades').delete().lt('traded_at',            cutoffTs),
  ])
}
