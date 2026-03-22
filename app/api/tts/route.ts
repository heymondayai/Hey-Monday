import { NextResponse } from 'next/server'
import { normalizeTTS } from '@/lib/tts-normalize'

export async function POST(req: Request) {
  try {
    const { text } = await req.json()

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

    // Normalize BEFORE trimming so normalizeTTS sees the full context,
    // then trim + cap length after.
    const normalized = normalizeTTS(text)
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
          // eleven_turbo_v2_5 handles numbers and decimals better than flash
          model_id: 'eleven_turbo_v2_5',
          output_format: 'mp3_44100_128',
          voice_settings: {
            stability: 0.5,
            // Lowered from 0.8 → 0.65: high similarity boost causes ElevenLabs
            // to "stylize" delivery in ways that mangle numbers and abbreviations.
            similarity_boost: 0.65,
            style: 0.2,
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