import { NextResponse } from 'next/server'
import { normalizeTTS } from '@/lib/tts-normalize'

type WatchlistItem = {
  ticker?: string
  company_name?: string
}

export async function POST(req: Request) {
  try {
    const { text, watchlist = [] } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    const voiceId = process.env.ELEVENLABS_VOICE_ID

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing ELEVENLABS_API_KEY' }, { status: 500 })
    }

    if (!voiceId) {
      return NextResponse.json({ error: 'Missing ELEVENLABS_VOICE_ID' }, { status: 500 })
    }

    const dynamicTickerMap = Object.fromEntries(
      (watchlist as WatchlistItem[])
        .filter((w) => w?.ticker && w?.company_name)
        .map((w) => [String(w.ticker).toUpperCase(), String(w.company_name)])
    )

    // Normalize BEFORE trimming so normalizeTTS sees the full context,
    // then trim + cap length after.
    const normalized = normalizeTTS(text, {
      tickerMap: dynamicTickerMap,
    })
    const trimmed = normalized.trim().slice(0, 2500)

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
          model_id: 'eleven_turbo_v2_5',
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
        {
          error: 'ElevenLabs request failed',
          status: elevenRes.status,
          details: errText,
        },
        { status: 500 }
      )
    }

    const audioBuffer = await elevenRes.arrayBuffer()

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
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