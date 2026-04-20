'use client'

import { cn } from '@/lib/utils'
import type { VoiceSessionTurn } from '@/types'

interface VoiceWaveformProps {
  turn: VoiceSessionTurn
  className?: string
}

const BAR_COUNT = 12

export function VoiceWaveform({ turn, className }: VoiceWaveformProps) {
  const isActive = turn === 'recording' || turn === 'speaking'
  const isRecording = turn === 'recording'
  const isSpeaking = turn === 'speaking'

  return (
    <div className={cn('flex items-center justify-center gap-1', className)}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all',
            isRecording && 'bg-red-400',
            isSpeaking && 'bg-amber-400',
            !isActive && 'bg-muted-foreground/30',
            isActive && 'animate-pulse'
          )}
          style={{
            width: '3px',
            height: isActive
              ? `${8 + Math.sin((i / BAR_COUNT) * Math.PI * 2) * 16 + Math.random() * 8}px`
              : '6px',
            animationDelay: `${(i / BAR_COUNT) * 600}ms`,
            animationDuration: isRecording ? '400ms' : '700ms',
          }}
        />
      ))}
    </div>
  )
}
