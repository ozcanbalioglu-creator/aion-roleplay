import OpenAI from 'openai'
import type { ISTTAdapter, STTOptions, STTResult } from './interface'

export class OpenAISTTAdapter implements ISTTAdapter {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async transcribe(audio: Buffer, options: STTOptions = {}): Promise<STTResult> {
    const start = Date.now()
    const filename = options.filename ?? 'audio.webm'
    const mimeType = options.mimeType ?? 'audio/webm'
    const file = new File([audio as unknown as BlobPart], filename, { type: mimeType })

    const response = await this.client.audio.transcriptions.create({
      model: 'whisper-1',
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
