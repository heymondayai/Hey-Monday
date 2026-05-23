import { createAdminSupabaseClient } from './supabase-admin'
import type { MacroObservation } from './providers/macro'

export async function upsertMacroIndicators(observations: MacroObservation[]): Promise<void> {
  if (!observations.length) return
  const supabase = createAdminSupabaseClient()
  const rows = observations
    .filter(o => o.value != null && o.date)
    .map(o => ({
      series_id:   o.seriesId,
      date:        o.date,
      value:       o.value,
      series_name: o.seriesName,
    }))
  if (!rows.length) return
  const { error } = await supabase
    .from('macro_indicators')
    .upsert(rows, { onConflict: 'series_id,date' })
  if (error) console.error('[store-macro] upsert:', error.message)
}

export async function deleteOldMacro(days = 95): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]
  const { error } = await supabase.from('macro_indicators').delete().lt('date', cutoff)
  if (error) console.error('[store-macro] cleanup:', error.message)
}
