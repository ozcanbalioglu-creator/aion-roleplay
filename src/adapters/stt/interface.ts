export interface STTOptions {
  language?: string
  prompt?: string
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
