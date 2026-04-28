export interface STTOptions {
  language?: string
  prompt?: string
  filename?: string  // ör. 'audio.webm', 'audio.mp4' — Whisper format çıkarımı için
  mimeType?: string  // ör. 'audio/webm', 'audio/mp4'
}

export interface STTResult {
  text: string
  confidence?: number
  provider: string
  latency_ms: number
}

export interface ISTTAdapter {
  transcribe(audio: Buffer, options?: STTOptions): Promise<STTResult>
}
