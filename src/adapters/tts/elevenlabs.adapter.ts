import { ElevenLabsClient } from 'elevenlabs'
import type { ITTSAdapter, TTSOptions, TTSResult } from './interface'

export class ElevenLabsTTSAdapter implements ITTSAdapter {
  private client: ElevenLabsClient

  constructor() {
    this.client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })
  }

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    const start = Date.now()
    const voiceId = options.voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || ''

    const audio = await this.client.textToSpeech.convert(voiceId, {
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
        speed: options.speed ?? 1.0
      }
    })

    const chunks: Buffer[] = []
    for await (const chunk of audio) {
      chunks.push(Buffer.from(chunk))
    }

    return {
      audio: Buffer.concat(chunks),
      provider: 'elevenlabs',
      latency_ms: Date.now() - start
    }
  }

  async *stream(text: string, options: TTSOptions): AsyncGenerator<Buffer, void, unknown> {
    const voiceId = options.voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || ''

    const audioStream = await this.client.textToSpeech.streamWithTimestamps(voiceId, {
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
        speed: options.speed ?? 1.0
      }
    })

    for await (const chunk of audioStream) {
      if (chunk.audio_base64) {
        yield Buffer.from(chunk.audio_base64, 'base64')
      }
    }
  }
}
