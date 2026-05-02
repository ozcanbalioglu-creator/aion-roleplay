'use client'

/**
 * RealtimeSpikeClient — ElevenLabs Conversational AI bağlantı + UI.
 *
 * Akış:
 *  1. Kullanıcı mikrofon butonuna basar
 *  2. /api/realtime-spike/signed-url POST → signed URL + override payload
 *  3. useConversation.startSession(signedUrl, overrides) → WebSocket bağlanır
 *  4. Mesaj event'leri transkript paneline akar
 *  5. Latency, status, hata ekranda gözükür
 *
 * Telemetri (basit):
 *  - connect → first agent audio: ms
 *  - user end-of-utterance → agent first audio: ms (her tur için)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConversationProvider, useConversation } from '@elevenlabs/react'

interface Props {
  personaId: string
  scenarioId: string | null
}

interface TranscriptLine {
  role: 'user' | 'assistant'
  text: string
  ts: number
}

interface LatencySample {
  /** ms */
  firstAgentAudio: number | null
  turns: number[]
}

/**
 * @elevenlabs/react@1.3 requires `useConversation()` to live inside a
 * `<ConversationProvider>`. We wrap the inner component here.
 */
export function RealtimeSpikeClient(props: Props) {
  return (
    <ConversationProvider>
      <RealtimeSpikeInner {...props} />
    </ConversationProvider>
  )
}

function RealtimeSpikeInner({ personaId, scenarioId }: Props) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'ended'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [latency, setLatency] = useState<LatencySample>({ firstAgentAudio: null, turns: [] })
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null)

  const connectStartRef = useRef<number | null>(null)
  const lastUserUtteranceEndRef = useRef<number | null>(null)
  const firstAgentAudioCapturedRef = useRef(false)

  const conversation = useConversation({
    onConnect: () => {
      setStatus('connected')
      const elapsed = connectStartRef.current ? Date.now() - connectStartRef.current : null
      console.log('[spike] connected', { elapsedMs: elapsed })
    },
    onDisconnect: () => {
      setStatus('ended')
    },
    onError: (msg: unknown) => {
      console.error('[spike] error', msg)
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
      setStatus('error')
    },
    onMessage: ({ source, message }: { source: 'user' | 'ai'; message: string }) => {
      const role: 'user' | 'assistant' = source === 'user' ? 'user' : 'assistant'
      const now = Date.now()
      setTranscript((prev) => [...prev, { role, text: message, ts: now }])
      // NOTE: agent message events fire AFTER the agent finishes speaking,
      // which means using them for turn latency conflates "time-to-respond"
      // with "speaking duration". Latency is now captured via mode change
      // (see useEffect below) — listening → speaking is the true
      // "agent started replying" moment.
      if (role === 'user') {
        lastUserUtteranceEndRef.current = now
      }
    }
  })

  // Capture true latency: time between user transcript event and the moment
  // the agent transitions from "listening" to "speaking" (i.e. first audio).
  // The previous metric (assistant message event - user message event)
  // included the entire agent utterance duration, which inflated reported
  // latency by 4-8s on long Claude responses.
  const prevModeRef = useRef<string | null>(null)
  useEffect(() => {
    const mode = conversation.mode
    if (mode === 'speaking' && prevModeRef.current !== 'speaking') {
      const now = Date.now()
      // First-audio after connect
      if (!firstAgentAudioCapturedRef.current && connectStartRef.current) {
        const elapsed = now - connectStartRef.current
        firstAgentAudioCapturedRef.current = true
        setLatency((prev) => ({ ...prev, firstAgentAudio: elapsed }))
      }
      // Per-turn latency: only meaningful after the first user utterance
      if (lastUserUtteranceEndRef.current) {
        const turn = now - lastUserUtteranceEndRef.current
        setLatency((prev) => ({ ...prev, turns: [...prev.turns, turn] }))
        lastUserUtteranceEndRef.current = null
      }
    }
    prevModeRef.current = mode
  }, [conversation.mode])

  const start = useCallback(async () => {
    setError(null)
    setTranscript([])
    setLatency({ firstAgentAudio: null, turns: [] })
    firstAgentAudioCapturedRef.current = false
    setStatus('connecting')

    try {
      // 1) Mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true })

      // 2) Get signed URL + overrides
      const res = await fetch('/api/realtime-spike/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, scenarioId })
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as Record<string, unknown>))
        const parts = [
          errBody.error ?? `signed-url failed (${res.status})`,
          errBody.status ? `[el-status=${errBody.status}]` : null,
          errBody.detail ? `\n${errBody.detail}` : null
        ].filter(Boolean)
        throw new Error(parts.join(' '))
      }
      const { signedUrl, overrides, meta: metaPayload } = await res.json()
      setMeta(metaPayload)

      // 3) Start session
      connectStartRef.current = Date.now()
      await conversation.startSession({ signedUrl, overrides })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      setError(msg)
      setStatus('error')
    }
  }, [conversation, personaId, scenarioId])

  const stop = useCallback(async () => {
    try {
      await conversation.endSession()
    } catch (e) {
      console.warn('[spike] endSession error', e)
    }
  }, [conversation])

  useEffect(() => {
    return () => {
      // Best-effort cleanup on unmount
      try {
        const result = conversation.endSession() as unknown
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          ;(result as Promise<unknown>).catch(() => {})
        }
      } catch {
        /* noop */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter out sub-100ms "turns" — those are spurious mode flips when the
  // agent emits a brief filler ("...", "Devam edin") that flips
  // listening→speaking without an actual LLM round trip. A real
  // user→agent turn cannot be faster than ~150ms (network + STT + LLM
  // first token), so anything below 100ms is noise.
  const validTurns = useMemo(
    () => latency.turns.filter((t) => t >= 100),
    [latency.turns]
  )

  const avgTurnLatency = useMemo(() => {
    if (validTurns.length === 0) return null
    return Math.round(validTurns.reduce((a, b) => a + b, 0) / validTurns.length)
  }, [validTurns])

  const medianTurnLatency = useMemo(() => {
    if (validTurns.length === 0) return null
    const sorted = [...validTurns].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid]
  }, [validTurns])

  const maxTurnLatency = useMemo(() => {
    if (validTurns.length === 0) return null
    return Math.max(...validTurns)
  }, [validTurns])

  const fmt = (ms: number | null): string => {
    if (ms == null) return '—'
    if (ms < 1000) return `${ms} ms`
    return `${(ms / 1000).toFixed(2)} s`
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-lg border border-outline/20 bg-surface-low p-4 flex items-center gap-4">
        {status === 'idle' || status === 'ended' || status === 'error' ? (
          <button
            onClick={start}
            className="px-6 py-3 rounded-full bg-primary text-on-primary font-medium hover:opacity-90 transition"
          >
            Mikrofonla Başlat
          </button>
        ) : (
          <button
            onClick={stop}
            className="px-6 py-3 rounded-full bg-error text-on-error font-medium hover:opacity-90 transition"
            disabled={status === 'connecting'}
          >
            Durdur
          </button>
        )}

        <div className="text-sm">
          <div>
            <span className="text-on-surface-variant">Status:</span>{' '}
            <strong>{status}</strong>
          </div>
          {error && <div className="text-error text-xs">{error}</div>}
        </div>
      </div>

      {/* Telemetry */}
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Connect → first audio" value={fmt(latency.firstAgentAudio)} />
        <Stat
          label="Turn latency (median / avg)"
          value={
            medianTurnLatency != null
              ? `${fmt(medianTurnLatency)} / ${fmt(avgTurnLatency)}`
              : '—'
          }
        />
        <Stat
          label={`Valid turns / max`}
          value={
            validTurns.length > 0
              ? `${validTurns.length} / ${fmt(maxTurnLatency)}`
              : `${latency.turns.length} (filtered)`
          }
        />
      </div>

      {/* Meta debug */}
      {meta ? (
        <details className="text-xs text-on-surface-variant">
          <summary className="cursor-pointer hover:text-on-surface">debug: signed-url payload meta</summary>
          <pre className="mt-2 p-2 bg-surface-low rounded overflow-x-auto">
            {JSON.stringify(meta, null, 2)}
          </pre>
        </details>
      ) : null}

      {/* Transcript */}
      <div className="rounded-lg border border-outline/20 bg-surface-low p-4 min-h-[300px] max-h-[500px] overflow-y-auto space-y-3">
        {transcript.length === 0 ? (
          <p className="text-sm text-on-surface-variant italic">
            Mikrofona basıp Türkçe konuşmaya başla. Konuşma transkripti burada akacak.
          </p>
        ) : (
          transcript.map((line, i) => (
            <div key={i} className="text-sm">
              <span
                className={
                  line.role === 'user'
                    ? 'font-medium text-on-primary-container'
                    : 'font-medium text-secondary'
                }
              >
                {line.role === 'user' ? 'Sen' : 'Persona'}:
              </span>{' '}
              {line.text}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline/20 bg-surface-low p-3">
      <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">{label}</div>
      <div className="text-lg font-headline italic mt-1">{value}</div>
    </div>
  )
}
