import { Mic, MicOff, Loader2, Volume2, Square, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VoiceSessionTurn } from '@/types'

interface VoiceMicButtonProps {
  turn: VoiceSessionTurn
  isActive: boolean
  onClick: () => void
  disabled?: boolean
  /** lg (default) sol panel altı için ~96px, sm sub-header için ~40px */
  size?: 'lg' | 'sm'
}

const SIZE_CONFIG = {
  lg: {
    button: 'w-24 h-24',
    haloOuter: 'w-36 h-36',
    haloInner: 'w-28 h-28',
    icon: 'h-10 w-10',
  },
  sm: {
    button: 'w-10 h-10',
    haloOuter: 'w-14 h-14',
    haloInner: 'w-12 h-12',
    icon: 'h-5 w-5',
  },
} as const

export function VoiceMicButton({
  turn,
  isActive,
  onClick,
  disabled,
  size = 'lg',
}: VoiceMicButtonProps) {
  const isListening = turn === 'listening'
  const isRecording = turn === 'recording'
  const isProcessing = turn === 'processing'
  const isSpeaking = turn === 'speaking'
  const isError = turn === 'error'

  const sz = SIZE_CONFIG[size]

  return (
    <div className="relative flex items-center justify-center">
      {/* Kayıt/Dinleme halka animasyonu */}
      {(isRecording || isListening) && (
        <>
          <div className={cn('absolute rounded-full bg-primary/10 animate-ping', sz.haloOuter)} />
          <div className={cn('absolute rounded-full bg-primary/15 animate-pulse', sz.haloInner)} />
        </>
      )}

      {/* AI konuşma animasyonu */}
      {isSpeaking && (
        <>
          <div className={cn('absolute rounded-full bg-amber-500/10 animate-pulse', sz.haloOuter)} />
          <div
            className={cn('absolute rounded-full bg-amber-500/15 animate-pulse', sz.haloInner)}
            style={{ animationDelay: '300ms' }}
          />
        </>
      )}

      {/* Buton */}
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'relative z-10 rounded-full flex items-center justify-center',
          'transition-all duration-300 select-none touch-none',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          sz.button,
          // Durumlara göre renkler
          !isActive && 'bg-primary hover:bg-primary/90 active:scale-95 shadow-lg shadow-primary/20',
          isActive && !isSpeaking && !isProcessing && 'bg-primary/20 border-2 border-primary text-primary scale-110',
          isSpeaking && 'bg-amber-500 text-white',
          isProcessing && 'bg-muted cursor-wait',
          isError && 'bg-destructive text-white',
        )}
      >
        {!isActive ? (
          <Mic className={cn(sz.icon, 'text-primary-foreground')} />
        ) : isProcessing ? (
          <Loader2 className={cn(sz.icon, 'text-primary animate-spin')} />
        ) : isSpeaking ? (
          <Square className={cn(sz.icon, 'fill-current animate-pulse')} />
        ) : isRecording ? (
          <Mic className={cn(sz.icon, 'text-primary animate-bounce')} />
        ) : (
          <Square className={cn(sz.icon, 'fill-current')} />
        )}
      </button>
    </div>
  )
}
