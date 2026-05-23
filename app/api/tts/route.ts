import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { normalizeTTS } from '@/lib/tts-normalize'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

type WatchlistItem = {
  ticker?: string
  company_name?: string
}

const TTS_BUCKET = 'tts-cache'

// Module-level in-memory cache — survives across invocations within the same
// warm lambda instance. Capped at 200 entries; evicts oldest on overflow.
const memCache = new Map<string, ArrayBuffer>()
const MEM_MAX = 200

function memSet(hash: string, buf: ArrayBuffer) {
  if (memCache.size >= MEM_MAX) {
    const oldest = memCache.keys().next().value
    if (oldest) memCache.delete(oldest)
  }
  memCache.set(hash, buf)
}

export async function POST(req: Request) {
  try {
    const { text, watchlist = [] } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    const voiceId = process.env.ELEVENLABS_VOICE_ID

    if (!apiKey) return NextResponse.json({ error: 'Missing ELEVENLABS_API_KEY' }, { status: 500 })
    if (!voiceId) return NextResponse.json({ error: 'Missing ELEVENLABS_VOICE_ID' }, { status: 500 })

    const dynamicTickerMap = Object.fromEntries(
      (watchlist as WatchlistItem[])
        .filter((w) => w?.ticker && w?.company_name)
        .map((w) => [String(w.ticker).toUpperCase(), String(w.company_name)])
    )

    // Normalize BEFORE trimming so normalizeTTS sees the full context,
    // then trim + cap length after.
    const normalized = normalizeTTS(text, { tickerMap: dynamicTickerMap })
    const trimmed = normalized.trim().slice(0, 4000)

    const hash = createHash('sha256').update(trimmed).digest('hex')
    const storagePath = `${hash}.mp3`

    // ── Layer 1: in-memory cache ──────────────────────────────────────────────
    if (memCache.has(hash)) {
      return new Response(memCache.get(hash)!, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'X-Cache': 'HIT-MEM' },
      })
    }

    // ── Layer 2: Supabase Storage cache ───────────────────────────────────────
    try {
      const supabase = createAdminSupabaseClient()
      const { data, error } = await supabase.storage.from(TTS_BUCKET).download(storagePath)
      if (!error && data) {
        const buf = await data.arrayBuffer()
        memSet(hash, buf)
        return new Response(buf, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg', 'X-Cache': 'HIT-STORAGE' },
        })
      }
    } catch {
      // Bucket not set up or unavailable — fall through to ElevenLabs
    }

    // ── Cache miss: call ElevenLabs ───────────────────────────────────────────
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: trimmed,
          model_id: 'eleven_flash_v2_5',
          output_format: 'mp3_44100_128',
          voice_settings: {
            stability: 0.7,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!elevenRes.ok) {
      const errText = await elevenRes.text()
      console.error('[tts] ElevenLabs error:', elevenRes.status, errText)
      return NextResponse.json(
        { error: 'ElevenLabs request failed', status: elevenRes.status, details: errText },
        { status: 500 }
      )
    }

    const audioBuffer = await elevenRes.arrayBuffer()

    // Persist to caches fire-and-forget — don't block the audio response
    void (async () => {
      try {
        memSet(hash, audioBuffer.slice(0))
        const supabase = createAdminSupabaseClient()
        await supabase.storage.from(TTS_BUCKET).upload(
          storagePath,
          new Uint8Array(audioBuffer),
          { contentType: 'audio/mpeg', upsert: false }
        )
      } catch {
        // Non-fatal — caching is best-effort
      }
    })()

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Cache': 'MISS',
      },
    })
  } catch (err: any) {
    console.error('[tts] Error:', err?.message || err)
    return NextResponse.json(
      { error: 'TTS route failed', details: err?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
