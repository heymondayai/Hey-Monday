import { createAdminSupabaseClient } from './supabase-admin'
import type { EconomicEvent, EarningsEvent } from './providers/events'

function ecoId(e: EconomicEvent): string {
  return `eco-${e.date}-${e.event.replace(/\s+/g, '_').slice(0, 50)}`
}

function earnId(e: EarningsEvent): string {
  return `earn-${e.date}-${e.symbol}`
}

export async function upsertEconomicEvents(events: EconomicEvent[]): Promise<void> {
  if (!events.length) return
  const supabase = createAdminSupabaseClient()
  const rows = events.map(e => ({
    external_id:    ecoId(e),
    event_type:     'economic',
    ticker:         null,
    title:          e.event,
    event_date:     e.date,
    event_time:     e.time   || null,
    impact:         e.impact,
    actual_value:   e.actual   ?? null,
    expected_value: e.forecast ?? null,
    previous_value: e.previous ?? null,
    updated_at:     new Date().toISOString(),
  }))
  const { error } = await supabase
    .from('calendar_events')
    .upsert(rows, { onConflict: 'external_id' })
  if (error) console.error('[store-events] upsert economic:', error.message)
}

export async function upsertEarningsEvents(events: EarningsEvent[]): Promise<void> {
  if (!events.length) return
  const supabase = createAdminSupabaseClient()
  const rows = events.map(e => ({
    external_id:    earnId(e),
    event_type:     'earnings',
    ticker:         e.symbol,
    title:          `${e.symbol} Earnings`,
    event_date:     e.date,
    event_time:     e.time === 'bmo' ? 'Before Open' : e.time === 'amc' ? 'After Close' : null,
    impact:         'HIGH',
    actual_value:   e.epsActual    != null ? String(e.epsActual)    : null,
    expected_value: e.epsEstimate  != null ? String(e.epsEstimate)  : null,
    previous_value: null,
    updated_at:     new Date().toISOString(),
  }))
  const { error } = await supabase
    .from('calendar_events')
    .upsert(rows, { onConflict: 'external_id' })
  if (error) console.error('[store-events] upsert earnings:', error.message)
}

export async function deleteOldEvents(days = 95): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const { error } = await supabase.from('calendar_events').delete().lt('event_date', cutoff)
  if (error) console.error('[store-events] cleanup:', error.message)
}
