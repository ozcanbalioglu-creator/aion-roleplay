export interface TTSOptions {
  voiceId?: string
  speed?: number
  stability?: number
  similarityBoost?: number
}

export interface TTSResult {
  audio: Buffer
  provider: string
  latency_ms: number
}

export interface ITTSAdapter {
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>
  stream(text: string, options?: TTSOptions): AsyncGenerator<Buffer, void, unknown>
}
