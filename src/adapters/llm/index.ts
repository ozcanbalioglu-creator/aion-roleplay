import type { ILLMAdapter } from './interface'
import { OpenAILLMAdapter } from './openai.adapter'

export function getLLMAdapter(): ILLMAdapter {
  const provider = process.env.LLM_PROVIDER ?? 'openai'
  switch (provider) {
    case 'openai':
      return new OpenAILLMAdapter()
    default:
      throw new Error(`Unknown LLM provider: ${provider}. Supported: openai`)
  }
}

export type { ILLMAdapter, LLMChatParams, LLMResponse } from './interface'
