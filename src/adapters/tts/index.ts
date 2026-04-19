import type { ITTSAdapter } from './interface'
import { ElevenLabsTTSAdapter } from './elevenlabs.adapter'

export function getTTSAdapter(): ITTSAdapter {
  const provider = process.env.TTS_PROVIDER ?? 'elevenlabs'
  switch (provider) {
    case 'elevenlabs':
      return new ElevenLabsTTSAdapter()
    default:
      throw new Error(`Unknown TTS provider: ${provider}. Supported: elevenlabs`)
  }
}

export type { ITTSAdapter, TTSOptions, TTSResult } from './interface'
