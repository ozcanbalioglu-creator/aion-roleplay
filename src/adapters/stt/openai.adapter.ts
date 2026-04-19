import OpenAI from 'openai'
import type { ISTTAdapter, STTOptions, STTResult } from './interface'

export class OpenAISTTAdapter implements ISTTAdapter {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async transcribe(audio: Buffer, options: STTOptions = {}): Promise<STTResult> {
    const start = Date.now()
    // Convert Buffer to Blob-compatible format
    const file = new File([audio as unknown as BlobPart], 'audio.webm', { type: 'audio/webm' })

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
