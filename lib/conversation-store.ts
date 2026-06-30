import { createAdminSupabaseClient } from './supabase-admin'

export interface ConvMessage {
  role: 'user' | 'assistant'
  content: string
}

// Persist a user+assistant exchange. Fire-and-forget — never awaited on the
// hot path so it doesn't add latency to the streaming response.
export async function saveConversationMessages(
  userId: string,
  messages: ConvMessage[],
): Promise<void> {
  if (!userId || !messages.length) return
  const supabase = createAdminSupabaseClient()
  const rows = messages.map(m => ({ user_id: userId, role: m.role, content: m.content }))
  const { error } = await supabase.from('conversation_history').insert(rows)
  if (error) console.error('[conversation-store] save:', error.message)
}

// Fetch the last `limit` messages for a user, returned oldest-first.
export async function getConversationHistory(
  userId: string,
  limit = 20,
): Promise<ConvMessage[]> {
  if (!userId) return []
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('conversation_history')
    .select('role,content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('[conversation-store] fetch:', error.message); return [] }
  // Reverse so the array is chronological (oldest first) for the messages array
  return ((data ?? []) as ConvMessage[]).reverse()
}

// Prune history older than `days`. Intended for a scheduled cron job.
export async function pruneConversationHistory(
  userId: string,
  days = 30,
): Promise<void> {
  if (!userId) return
  const supabase = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const { error } = await supabase
    .from('conversation_history')
    .delete()
    .eq('user_id', userId)
    .lt('created_at', cutoff)
  if (error) console.error('[conversation-store] prune:', error.message)
}
