/**
 * Realtime conversational voice adapter interface.
 *
 * Bridges full-duplex voice pipelines (STT + LLM + TTS in a single stream)
 * such as ElevenLabs Conversational AI, OpenAI Realtime API, or Azure
 * Realtime. Designed for spike (feat/voice-elevenlabs-spike) — once one
 * implementation is validated, this interface stays and others slot in.
 *
 * NOT to be confused with the existing decoupled adapters:
 *   - src/adapters/stt   (speech-to-text only)
 *   - src/adapters/tts   (text-to-speech only)
 *   - src/adapters/llm   (chat completion only)
 *
 * A realtime adapter swallows all three.
 */

export interface RealtimeSessionConfig {
  /** Provider-side agent identifier (e.g. ElevenLabs agent_id) */
  agentId: string

  /** Override the agent's static system prompt with a runtime one */
  systemPromptOverride?: string

  /** Voice ID — overrides agent default if provider supports it */
  voiceId?: string

  /** Runtime variables to interpolate into the agent prompt (e.g. {{user_name}}) */
  dynamicVariables?: Record<string, string>

  /** Language code for STT (e.g. 'tr', 'en') */
  language?: string
}

export interface RealtimeMetrics {
  /** ms from end-of-user-utterance to first AI audio byte */
  firstAudioLatencyMs: number | null
  /** ms from end-of-user-utterance to AI audio fully delivered */
  turnLatencyMs: number | null
  /** ms from user interrupt to AI audio stopping (barge-in) */
  bargeinLatencyMs: number | null
}

export interface RealtimeTranscriptEvent {
  role: 'user' | 'assistant'
  content: string
  /** Provider-issued sequence id, monotonically increasing */
  sequence: number
  timestamp: number
}

export interface IRealtimeAdapter {
  /**
   * Establish a connection. Returns a session handle the caller can use
   * to send audio, receive transcripts, and close.
   */
  connect(config: RealtimeSessionConfig): Promise<RealtimeSession>
}

export interface RealtimeSession {
  /** Stream microphone audio chunks (PCM16 or provider-native format) */
  sendAudio(chunk: ArrayBuffer): void

  /** Subscribe to transcript events (both user and assistant) */
  onTranscript(handler: (event: RealtimeTranscriptEvent) => void): () => void

  /** Subscribe to AI audio output chunks (for playback) */
  onAudioOutput(handler: (chunk: ArrayBuffer) => void): () => void

  /** Subscribe to instrumentation events (latency, barge-in, errors) */
  onMetrics(handler: (metrics: Partial<RealtimeMetrics>) => void): () => void

  /** Tear down the connection cleanly */
  close(): Promise<void>
}
