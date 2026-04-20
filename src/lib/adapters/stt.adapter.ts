import { OpenAI } from 'openai'

export interface ISTTAdapter {
  transcribe(audioBlob: Blob, languageHint?: string): Promise<string>
}

export class OpenAIWhisperAdapter implements ISTTAdapter {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }

  async transcribe(audioBlob: Blob, languageHint = 'tr'): Promise<string> {
    // Blob → File (Whisper API File nesnesi bekler)
    const buffer = Buffer.from(await audioBlob.arrayBuffer())

    // Ses formatını belirle
    const mimeType = audioBlob.type || 'audio/webm'
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'

    const file = new File([buffer], `audio.${extension}`, { type: mimeType })

    const response = await this.client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: languageHint,
      response_format: 'text',
    })

    return (response as unknown as string).trim()
  }
}
