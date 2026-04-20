import { Mic, MicOff, Loader2, Volume2, Square, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VoiceSessionTurn } from '@/types'

interface VoiceMicButtonProps {
  turn: VoiceSessionTurn
  isActive: boolean
  onClick: () => void
  disabled?: boolean
}

export function VoiceMicButton({ turn, isActive, onClick, disabled }: VoiceMicButtonProps) {
  const isListening = turn === 'listening'
  const isRecording = turn === 'recording'
  const isProcessing = turn === 'processing'
  const isSpeaking = turn === 'speaking'
  const isError = turn === 'error'

  return (
    <div className="relative flex items-center justify-center">
      {/* Kayıt/Dinleme halka animasyonu */}
      {(isRecording || isListening) && (
        <>
          <div className="absolute w-36 h-36 rounded-full bg-primary/10 animate-ping" />
          <div className="absolute w-28 h-28 rounded-full bg-primary/15 animate-pulse" />
        </>
      )}

      {/* AI konuşma animasyonu */}
      {isSpeaking && (
        <>
          <div className="absolute w-36 h-36 rounded-full bg-amber-500/10 animate-pulse" />
          <div
            className="absolute w-28 h-28 rounded-full bg-amber-500/15 animate-pulse"
            style={{ animationDelay: '300ms' }}
          />
        </>
      )}

      {/* Buton */}
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'relative z-10 w-24 h-24 rounded-full flex items-center justify-center',
          'transition-all duration-300 select-none touch-none',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          // Durumlara göre renkler
          !isActive && 'bg-primary hover:bg-primary/90 active:scale-95 shadow-lg shadow-primary/20',
          isActive && !isSpeaking && !isProcessing && 'bg-primary/20 border-2 border-primary text-primary scale-110',
          isSpeaking && 'bg-amber-500 text-white',
          isProcessing && 'bg-muted cursor-wait',
          isError && 'bg-destructive text-white',
        )}
      >
        {!isActive ? (
          <Mic className="h-10 w-10 text-primary-foreground" />
        ) : isProcessing ? (
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        ) : isSpeaking ? (
          <Square className="h-10 w-10 fill-current animate-pulse" />
        ) : isRecording ? (
          <Mic className="h-10 w-10 text-primary animate-bounce" />
        ) : (
          <Square className="h-10 w-10 fill-current" />
        )}
      </button>
    </div>
  )
}
