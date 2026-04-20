'use client'

import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/stores/session.store'

interface ChatBubbleProps {
  message: ChatMessage
  personaName: string
}

const PHASE_LABELS: Record<string, string> = {
  opening: 'Açılış',
  exploration: 'Keşif',
  deepening: 'Derinleştirme',
  action: 'Aksiyon',
  closing: 'Kapanış',
}

export function ChatBubble({ message, personaName }: ChatBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3 max-w-[85%]', isUser ? 'ml-auto flex-row-reverse' : 'mr-auto')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        )}
      >
        {isUser ? 'Sen' : personaName[0]}
      </div>

      <div className="flex flex-col gap-1">
        {!isUser && (
          <span className="text-xs text-muted-foreground ml-1">{personaName}</span>
        )}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-card border border-border rounded-bl-sm text-foreground'
          )}
        >
          {message.content}
          {message.isStreaming && (
            <span className="inline-flex ml-1 gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground mx-1">
          {PHASE_LABELS[message.phase]} · {message.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
