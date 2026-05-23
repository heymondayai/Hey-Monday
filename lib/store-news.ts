import { createAdminSupabaseClient } from './supabase-admin'
import type { NewsArticle } from './providers/news'

export async function upsertNews(articles: NewsArticle[]): Promise<void> {
  if (!articles.length) return
  const supabase = createAdminSupabaseClient()
  const rows = articles
    .filter(a => a.url && a.externalId && a.headline)
    .map(a => ({
      external_id:  a.externalId,
      headline:     a.headline,
      summary:      a.summary   || null,
      url:          a.url,
      source:       a.source    || null,
      published_at: a.publishedAt,
      tickers:      a.tickers,
      sentiment:    a.sentiment,
    }))
  if (!rows.length) return
  const { error } = await supabase
    .from('news_articles')
    .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
  if (error) console.error('[store-news] upsert:', error.message)
}

export async function deleteOldNews(days = 95): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase.from('news_articles').delete().lt('published_at', cutoff)
  if (error) console.error('[store-news] cleanup:', error.message)
}
