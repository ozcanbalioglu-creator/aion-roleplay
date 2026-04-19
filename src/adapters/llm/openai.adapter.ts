import OpenAI from 'openai'
import type { ILLMAdapter, LLMChatParams, LLMResponse } from './interface'

export class OpenAILLMAdapter implements ILLMAdapter {
  private client: OpenAI
  private model: string

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    this.model = process.env.OPENAI_LLM_MODEL ?? 'gpt-4o'
  }

  async chat(params: LLMChatParams): Promise<LLMResponse> {
    const start = Date.now()
    const messages = [
      { role: 'system' as const, content: params.systemPrompt },
      ...params.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    ]

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1024,
      response_format: params.responseFormat === 'json_object'
        ? { type: 'json_object' }
        : { type: 'text' }
    })

    const choice = response.choices[0]
    return {
      content: choice.message.content ?? '',
      usage: {
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
        total_tokens: response.usage?.total_tokens ?? 0
      },
      model: this.model,
      provider: 'openai',
      latency_ms: Date.now() - start
    }
  }

  async *streamChat(params: LLMChatParams): AsyncGenerator<string, void, unknown> {
    const messages = [
      { role: 'system' as const, content: params.systemPrompt },
      ...params.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    ]

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1024,
      stream: true
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) yield delta
    }
  }
}
