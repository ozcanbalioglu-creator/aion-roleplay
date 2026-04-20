export interface ITTSAdapter {
  synthesize(text: string): Promise<ReadableStream<Uint8Array>>
}

export class ElevenLabsAdapter implements ITTSAdapter {
  private apiKey: string
  private voiceId: string
  private model: string

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY!
    this.voiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID!
    this.model = process.env.ELEVENLABS_MODEL ?? 'eleven_turbo_v2_5'
  }

  async synthesize(text: string): Promise<ReadableStream<Uint8Array>> {
    if (!text.trim()) throw new Error('TTS: boş metin')

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: this.model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
          output_format: 'mp3_44100_128',
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`ElevenLabs TTS hatası: ${response.status} ${err}`)
    }

    if (!response.body) throw new Error('ElevenLabs: boş stream')
    return response.body
  }
}
