import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

async function getVerifiedUserId(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createAdminSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.id ?? null
}

async function getOrCreateKey(userId: string): Promise<string | null> {
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('webhook_keys')
    .select('secret_key')
    .eq('user_id', userId)
    .maybeSingle()
  if (data) return data.secret_key

  const { data: newRow } = await supabase
    .from('webhook_keys')
    .insert({ user_id: userId })
    .select('secret_key')
    .single()
  return newRow?.secret_key ?? null
}

export async function GET(req: NextRequest) {
  const userId = await getVerifiedUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const key = await getOrCreateKey(userId)
  return NextResponse.json({ key })
}

export async function POST(req: NextRequest) {
  const userId = await getVerifiedUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabaseClient()
  await supabase.from('webhook_keys').delete().eq('user_id', userId)
  const key = await getOrCreateKey(userId)
  return NextResponse.json({ key })
}
