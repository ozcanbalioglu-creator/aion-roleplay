import type { ChatMessage, LLMUsage } from '@/types'

export interface LLMChatParams {
  systemPrompt: string
  messages: ChatMessage[]
  responseFormat?: 'text' | 'json_object'
  temperature?: number
  maxTokens?: number
  sessionId?: string
}

export interface LLMResponse {
  content: string
  usage: LLMUsage
  model: string
  provider: string
  latency_ms: number
}

export interface ILLMAdapter {
  chat(params: LLMChatParams): Promise<LLMResponse>
  streamChat(params: LLMChatParams): AsyncGenerator<string, void, unknown>
}
