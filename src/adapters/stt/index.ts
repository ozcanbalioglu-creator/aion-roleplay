import type { ISTTAdapter } from './interface'
import { OpenAISTTAdapter } from './openai.adapter'

export function getSTTAdapter(): ISTTAdapter {
  const provider = process.env.STT_PROVIDER ?? 'openai'
  switch (provider) {
    case 'openai':
      return new OpenAISTTAdapter()
    default:
      throw new Error(`Unknown STT provider: ${provider}. Supported: openai`)
  }
}

export type { ISTTAdapter, STTOptions, STTResult } from './interface'
