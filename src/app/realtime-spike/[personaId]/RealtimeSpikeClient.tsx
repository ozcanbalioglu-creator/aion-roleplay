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
import { useConversation } from '@elevenlabs/react'

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

export function RealtimeSpikeClient({ personaId, scenarioId }: Props) {
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

      if (role === 'user') {
        lastUserUtteranceEndRef.current = now
      } else if (role === 'assistant') {
        // First agent audio after connect
        if (!firstAgentAudioCapturedRef.current && connectStartRef.current) {
          const elapsed = now - connectStartRef.current
          firstAgentAudioCapturedRef.current = true
          setLatency((prev) => ({ ...prev, firstAgentAudio: elapsed }))
        }
        // Turn latency: last user utterance → this agent message
        if (lastUserUtteranceEndRef.current) {
          const turn = now - lastUserUtteranceEndRef.current
          setLatency((prev) => ({ ...prev, turns: [...prev.turns, turn] }))
          lastUserUtteranceEndRef.current = null
        }
      }
    }
  })

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
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `signed-url failed (${res.status})`)
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

  const avgTurnLatency = useMemo(() => {
    if (latency.turns.length === 0) return null
    return Math.round(latency.turns.reduce((a, b) => a + b, 0) / latency.turns.length)
  }, [latency.turns])

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
        <Stat label="Connect → first audio" value={latency.firstAgentAudio ? `${latency.firstAgentAudio} ms` : '—'} />
        <Stat label="Turn latency (avg)" value={avgTurnLatency ? `${avgTurnLatency} ms` : '—'} />
        <Stat label="Turns" value={String(latency.turns.length)} />
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
