import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing DEEPGRAM_API_KEY' }, { status: 500 })
    }

    const formData = await req.formData()
    const audio = formData.get('audio')

    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: 'Missing audio blob' }, { status: 400 })
    }

    const mimeType = audio.type || 'audio/webm'
    const audioBuffer = await audio.arrayBuffer()

    const deepgramRes = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&language=en',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': mimeType,
        },
        body: audioBuffer,
      }
    )

    if (!deepgramRes.ok) {
      const errText = await deepgramRes.text()
      console.error('[transcribe] Deepgram error:', deepgramRes.status, errText)
      return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 })
    }

    const data = await deepgramRes.json()
    const transcript =
      data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || ''

    return NextResponse.json({ transcript })
  } catch (err: any) {
    console.error('[transcribe] Error:', err.message)
    return NextResponse.json({ error: 'Transcription route failed' }, { status: 500 })
  }
}