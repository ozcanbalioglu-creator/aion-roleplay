import OpenAI from 'openai'
import type { ISTTAdapter, STTOptions, STTResult } from './interface'

/**
 * P1-Voice-001 (2026-05-01): STT modeli env-driven yapıldı.
 *
 * Default `gpt-4o-mini-transcribe` (OpenAI 2025) — Whisper-1'e drop-in alternatif:
 *   - Aynı API endpoint (audio/transcriptions), aynı parametreler (language, prompt, file)
 *   - GPT-4o tabanlı; YouTube altyazı/outro halüsinasyonları büyük ölçüde azalır
 *     (Whisper'ın "Altyazı M.K.", "Abone olmayı unutmayın" örüntüleri)
 *   - Pricing: $0.003/dk (Whisper-1: $0.006/dk) — yarıya yakın tasarruf
 *
 * `WHISPER_PHANTOM_PATTERNS` regex listesi (stt/route.ts) defansif katman olarak
 * korunuyor — yeni model halüsinasyon üretirse de yakalansın.
 *
 * Rollback: env'e `OPENAI_STT_MODEL=whisper-1` ekleyince anında eski davranış.
 */
const DEFAULT_STT_MODEL = 'gpt-4o-mini-transcribe'

export class OpenAISTTAdapter implements ISTTAdapter {
  private client: OpenAI
  private model: string

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    this.model = process.env.OPENAI_STT_MODEL?.trim() || DEFAULT_STT_MODEL
  }

  async transcribe(audio: Buffer, options: STTOptions = {}): Promise<STTResult> {
    const start = Date.now()
    const filename = options.filename ?? 'audio.webm'
    const mimeType = options.mimeType ?? 'audio/webm'
    const file = new File([audio as unknown as BlobPart], filename, { type: mimeType })

    const response = await this.client.audio.transcriptions.create({
      model: this.model,
      file,
      language: options.language ?? 'tr',
      prompt: options.prompt
    })

    return {
      text: response.text,
      provider: 'openai',
      latency_ms: Date.now() - start
    }
  }
}
