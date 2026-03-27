'use client'

/**
 * useWakeWord.ts
 *
 * Runs the full openWakeWord pipeline in the browser:
 *   Mic → 1280-sample chunks (80ms @ 16kHz)
 *     → melspectrogram.onnx
 *     → (output / 10 + 2) transform
 *     → mel buffer (sliding window of 76 frames)
 *     → embedding_model.onnx
 *     → embedding buffer (sliding window)
 *     → hey_monday.onnx
 *     → score > threshold → onDetected()
 *
 * Place all three .onnx files in /public/models/
 * Install: npm install onnxruntime-web
 *
 * Usage:
 *   const { listening, error, start, stop } = useWakeWord({
 *     onDetected: () => console.log('Hey Monday detected!'),
 *   })
 */

import { useRef, useState, useCallback, useEffect } from 'react'

// ── CONSTANTS (must match openWakeWord's Python pipeline exactly) ─────────────
const SAMPLE_RATE       = 16000
const CHUNK_SAMPLES     = 1280          // 80ms per chunk
const MEL_FRAMES_NEEDED = 76            // embedding model input window
const MEL_STEP          = 8             // slide mel buffer by this many frames
const DETECTION_THRESHOLD = 0.08       // score above this = detected
const COOLDOWN_MS       = 2000          // prevent re-firing for 2 seconds

interface UseWakeWordOptions {
  onDetected: () => void
  threshold?: number
  modelBasePath?: string
}

interface UseWakeWordReturn {
  listening: boolean
  loading: boolean
  error: string | null
  start: () => Promise<void>
  stop: () => void
}

export function useWakeWord({
  onDetected,
  threshold = DETECTION_THRESHOLD,
  modelBasePath = '/models',
}: UseWakeWordOptions): UseWakeWordReturn {

  const [listening, setListening] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // ONNX sessions
  const melSession       = useRef<any>(null)
  const embSession       = useRef<any>(null)
  const wakeSession      = useRef<any>(null)

  // Audio pipeline refs
  const audioCtxRef      = useRef<AudioContext | null>(null)
  const streamRef        = useRef<MediaStream | null>(null)
  const processorRef     = useRef<ScriptProcessorNode | null>(null)
  const sourceRef        = useRef<MediaStreamAudioSourceNode | null>(null)

  // Pipeline state — must persist across chunk callbacks
  const sampleBufferRef  = useRef<Float32Array>(new Float32Array(0))
  const melBufferRef     = useRef<number[][]>([])   // array of mel frames [frames][32]
  const embBufferRef     = useRef<number[][]>([])   // array of embeddings [n][96]
  const lastDetectRef    = useRef<number>(0)
  const embWindowSizeRef = useRef<number>(16)        // will be inferred from model

  //Chunk Handling
  const pendingChunksRef = useRef<Float32Array[]>([])
  const processingLoopActiveRef = useRef(false)

  //Consecutive Calls
  const consecutiveHitsRef = useRef(0)

  //Scoring Ref
  const scoreHistoryRef = useRef<number[]>([])

  // ── LOAD MODELS ─────────────────────────────────────────────────────────────
  const loadModels = useCallback(async () => {
    // Dynamic import so onnxruntime-web only loads client-side
    const ort = await import('onnxruntime-web')

    // WASM backend is required for melspectrogram (uses audio-specific ops)
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/'

    const opts = { executionProviders: ['wasm'] }

    const [mel, emb, wake] = await Promise.all([
      ort.InferenceSession.create(`${modelBasePath}/melspectrogram.onnx`, opts),
      ort.InferenceSession.create(`${modelBasePath}/embedding_model.onnx`, opts),
      ort.InferenceSession.create(`${modelBasePath}/hey_monday.onnx`, opts),
    ])

    melSession.current  = mel
    embSession.current  = emb
    wakeSession.current = wake

    // Infer the embedding window size from the wake word model's input shape
    // The input is typically [1, N, 96] where N is the window size
    try {
      const inputName = wake.inputNames[0]
      const meta = (wake.inputMetadata as any)?.[inputName]
      if (meta?.dims?.[1]) {
        embWindowSizeRef.current = Number(meta.dims[1])
      }
    } catch {
      // fallback to 16 — correct for most custom models
    }
  }, [modelBasePath])

  // ── PROCESS ONE 1280-SAMPLE CHUNK ────────────────────────────────────────
    const runChunkInference = useCallback(async (samples: Float32Array) => {
    const ort = await import('onnxruntime-web')
    const mel = melSession.current
    const emb = embSession.current
    const wake = wakeSession.current
    if (!mel || !emb || !wake) return

    try {
      // ── STAGE 1: Melspectrogram ──────────────────────────────────────────
      const melInput = new ort.Tensor('float32', samples, [1, CHUNK_SAMPLES])
      const melResult = await mel.run({ [mel.inputNames[0]]: melInput })
      const melOutput = melResult[mel.outputNames[0]].data as Float32Array

      // Mandatory transform: output = (value / 10.0) + 2.0
      const melFrames: number[][] = []
      const framesPerChunk = melOutput.length / 32
      for (let f = 0; f < framesPerChunk; f++) {
        const frame: number[] = []
        for (let b = 0; b < 32; b++) {
          const raw = melOutput[f * 32 + b]
          frame.push((raw / 10.0) + 2.0)
        }
        melFrames.push(frame)
      }

      melBufferRef.current.push(...melFrames)

      // ── STAGE 2: Embedding ───────────────────────────────────────────────
      while (melBufferRef.current.length >= MEL_FRAMES_NEEDED) {
        const window = melBufferRef.current.slice(0, MEL_FRAMES_NEEDED)

        const flat = new Float32Array(MEL_FRAMES_NEEDED * 32)
        for (let i = 0; i < MEL_FRAMES_NEEDED; i++) {
          for (let j = 0; j < 32; j++) {
            flat[i * 32 + j] = window[i][j]
          }
        }

        const embInput = new ort.Tensor('float32', flat, [1, MEL_FRAMES_NEEDED, 32, 1])
        const embResult = await emb.run({ [emb.inputNames[0]]: embInput })
        const embOutput = embResult[emb.outputNames[0]].data as Float32Array

        embBufferRef.current.push(Array.from(embOutput))

        // Slide mel buffer forward
        melBufferRef.current.splice(0, MEL_STEP)

        // ── STAGE 3: Wake word detection ──────────────────────────────────
        const embWindowSize = embWindowSizeRef.current
        if (embBufferRef.current.length >= embWindowSize) {
          const embWindow = embBufferRef.current.slice(-embWindowSize)

          const embFlat = new Float32Array(embWindowSize * 96)
          for (let i = 0; i < embWindowSize; i++) {
            for (let j = 0; j < 96; j++) {
              embFlat[i * 96 + j] = embWindow[i][j]
            }
          }

          const wakeInput = new ort.Tensor('float32', embFlat, [1, embWindowSize, 96])
          const wakeResult = await wake.run({ [wake.inputNames[0]]: wakeInput })
          const score = (wakeResult[wake.outputNames[0]].data as Float32Array)[0]

          console.log('[WakeWord] score:', score.toFixed(4))

          // Rolling average of last 4 scores
          const scoreHistoryRef_scores = scoreHistoryRef.current
          scoreHistoryRef_scores.push(score)
          if (scoreHistoryRef_scores.length > 4) scoreHistoryRef_scores.shift()
          const avgScore = scoreHistoryRef_scores.reduce((a, b) => a + b, 0) / scoreHistoryRef_scores.length

if (avgScore > threshold) {
  const now = Date.now()
  if (now - lastDetectRef.current > COOLDOWN_MS) {
    lastDetectRef.current = now
    consecutiveHitsRef.current = 0
    onDetected()

    try {
      const AudioCtx = globalThis.AudioContext || (globalThis as any).webkitAudioContext
      const actx = new AudioCtx()
      if (actx.state === 'suspended') await actx.resume()

      const osc1 = actx.createOscillator()
      const osc2 = actx.createOscillator()
      const gain = actx.createGain()

      osc1.type = 'sine'
      osc2.type = 'sine'
      osc1.frequency.setValueAtTime(440, actx.currentTime)
      osc2.frequency.setValueAtTime(587, actx.currentTime + 0.12)

      gain.gain.setValueAtTime(0.0, actx.currentTime)
      gain.gain.linearRampToValueAtTime(0.18, actx.currentTime + 0.03)
      gain.gain.setValueAtTime(0.18, actx.currentTime + 0.10)
      gain.gain.linearRampToValueAtTime(0.0, actx.currentTime + 0.38)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(actx.destination)

      osc1.start(actx.currentTime)
      osc1.stop(actx.currentTime + 0.14)
      osc2.start(actx.currentTime + 0.12)
      osc2.stop(actx.currentTime + 0.38)
      osc2.onended = () => { void actx.close() }
    } catch (err) {
      console.error('Wake word chime failed:', err)
    }
  }
}

          if (embBufferRef.current.length > embWindowSize * 3) {
            embBufferRef.current = embBufferRef.current.slice(-embWindowSize)
          }
        }
      }
    } catch (err) {
      console.error('[WakeWord] processChunk error:', err)
    }
  }, [onDetected, threshold])

  // ── QUEUED CHUNK PROCESSOR ───────────────────────────────────────────────
  const processChunk = useCallback(async (samples: Float32Array) => {
  pendingChunksRef.current.push(samples)

  // keep only the most recent few chunks so we don't lag behind live speech
  if (pendingChunksRef.current.length > 4) {
    pendingChunksRef.current = pendingChunksRef.current.slice(-4)
  }

  if (processingLoopActiveRef.current) return
  processingLoopActiveRef.current = true

  try {
    while (pendingChunksRef.current.length > 0) {
      const next = pendingChunksRef.current.shift()
      if (!next) continue
      await runChunkInference(next)
    }
  } finally {
    processingLoopActiveRef.current = false
  }
}, [runChunkInference])

  // ── START ────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (listening || loading) return
    setLoading(true)
    setError(null)

    try {
      if (!melSession.current) {
        await loadModels()
      }

      sampleBufferRef.current = new Float32Array(0)
      melBufferRef.current = []
      embBufferRef.current = []
      pendingChunksRef.current = []
      processingLoopActiveRef.current = false
      lastDetectRef.current = 0
      scoreHistoryRef.current = []


      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      streamRef.current = stream

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
      audioCtxRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      const processor = ctx.createScriptProcessor(8192, 1, 1)
      processorRef.current = processor

      const silentGain = ctx.createGain()
      silentGain.gain.value = 0

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const inputData = e.inputBuffer.getChannelData(0)
        const inputRate = ctx.sampleRate

        const ratio = inputRate / SAMPLE_RATE
        const outLen = Math.floor(inputData.length / ratio)
        const resampled = new Float32Array(outLen)

        for (let i = 0; i < outLen; i++) {
          const start = Math.floor(i * ratio)
          const end = Math.min(Math.floor((i + 1) * ratio), inputData.length)

          let sum = 0
          let count = 0
          for (let j = start; j < end; j++) {
            sum += inputData[j]
            count++
          }

          resampled[i] = count > 0 ? sum / count : 0
        }

        const combined = new Float32Array(sampleBufferRef.current.length + resampled.length)
        combined.set(sampleBufferRef.current)
        combined.set(resampled, sampleBufferRef.current.length)
        sampleBufferRef.current = combined

        while (sampleBufferRef.current.length >= CHUNK_SAMPLES) {
          const chunk = sampleBufferRef.current.slice(0, CHUNK_SAMPLES)
          sampleBufferRef.current = sampleBufferRef.current.slice(CHUNK_SAMPLES)
          void processChunk(chunk)
        }
      }

      source.connect(processor)
      processor.connect(silentGain)
      silentGain.connect(ctx.destination)

      setListening(true)
    } catch (err: any) {
      const msg = err?.message || 'Failed to start wake word detection'
      setError(msg)
      console.error('[WakeWord] start error:', err)
    } finally {
      setLoading(false)
    }
  }, [listening, loading, loadModels, processChunk])

  // ── STOP ─────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    processorRef.current?.disconnect()
    sourceRef.current?.disconnect()
    void audioCtxRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())

    processorRef.current = null
    sourceRef.current = null
    audioCtxRef.current = null
    streamRef.current = null

    sampleBufferRef.current = new Float32Array(0)
    melBufferRef.current = []
    embBufferRef.current = []
    pendingChunksRef.current = []
    processingLoopActiveRef.current = false
    scoreHistoryRef.current = []

    setListening(false)
  }, [])

  useEffect(() => () => stop(), [stop])

  return { listening, loading, error, start, stop }
}