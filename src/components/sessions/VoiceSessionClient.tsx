'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/stores/session.store'
import type { SessionPhase } from '@/stores/session.store'
import { useVoiceSessionStore } from '@/stores/voice-session.store'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { useNaturalVoice } from '@/hooks/useNaturalVoice'
import { float32ArrayToWav } from '@/lib/audio-utils'
import { VoiceMicButton } from './voice/VoiceMicButton'
import { VoiceWaveform } from './voice/VoiceWaveform'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PhaseIndicator } from './PhaseIndicator'
import { LogOut, AlertCircle } from 'lucide-react'
import { endSessionAction, cancelSessionAction } from '@/lib/actions/session.actions'
import { toast } from 'sonner'
import { useHeartbeat } from '@/hooks/useHeartbeat'
import { useSessionUnloadGuard } from '@/hooks/useSessionUnloadGuard'
import { CancelSessionModal, type CancelReason } from './CancelSessionModal'
import { cn } from '@/lib/utils'

interface VoiceSessionClientProps {
  sessionId: string
  personaName: string
  personaTitle: string
  scenarioTitle: string
  estimatedDuration: number
  initialPhase: SessionPhase
}

const TURN_LABELS: Record<string, string> = {
  idle: 'Seansı başlatmak için butona dokunun',
  listening: 'Sizi dinliyorum...',
  recording: 'Konuşmanız algılandı...',
  processing: 'Düşünüyor...',
  speaking: 'Koç konuşuyor...',
  error: 'Hata oluştu',
}

export function VoiceSessionClient({
  sessionId,
  personaName,
  personaTitle,
  scenarioTitle,
  estimatedDuration,
  initialPhase,
}: VoiceSessionClientProps) {
  const router = useRouter()
  const abortRef = useRef<AbortController | null>(null)

  // Shared store
  const {
    messages,
    currentPhase,
    isEnded,
    addMessage,
    updateLastMessage,
    finalizeLastMessage,
    setPhase,
    setStreaming,
    setEnded,
    reset,
  } = useSessionStore()

  const {
    turn,
    isActive,
    isSupported,
    hasMicPermission,
    currentTranscript,
    errorMessage,
    setTurn,
    setIsActive,
    setSupported,
    setMicPermission,
    setCurrentTranscript,
    setError,
    setEnded: setVoiceEnded,
    reset: resetVoice,
  } = useVoiceSessionStore()

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  useHeartbeat(sessionId, !isEnded)
  useSessionUnloadGuard(sessionId, !isEnded)

  const { playBlob, stopPlayback, isPlaying } = useAudioPlayer()

  // Chat API
  const sendTextToChat = useCallback(
    async (userText: string): Promise<string | null> => {
      abortRef.current = new AbortController()

      const isInit = userText === 'Seansa başla, kendini tanıt.'
      if (!isInit) {
        addMessage({ role: 'user', content: userText, phase: currentPhase })
      }

      addMessage({ role: 'assistant', content: '', phase: currentPhase, isStreaming: true })
      setStreaming(true)

      try {
        const res = await fetch(`/api/sessions/${sessionId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userText }),
          signal: abortRef.current.signal,
        })

        if (!res.ok || !res.body) throw new Error('Chat API hatası')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulatedText = ''
        let finalPhase: SessionPhase = currentPhase
        let sessionEnded = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const lines = decoder.decode(value, { stream: true }).split('\n\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text) {
                accumulatedText += data.text
                updateLastMessage(accumulatedText)
              }
              if (data.phase) finalPhase = data.phase as SessionPhase
              if (data.sessionEnded) sessionEnded = true
              if (data.done) finalizeLastMessage(finalPhase)
            } catch { /* chunk error */ }
          }
        }

        if (sessionEnded) {
          setEnded(true)
          setVoiceEnded(true)
        }

        return accumulatedText.trim() || null
      } catch (err) {
        if ((err as Error).name === 'AbortError') return null
        finalizeLastMessage(currentPhase)
        return null
      } finally {
        setStreaming(false)
      }
    },
    [sessionId, currentPhase, addMessage, updateLastMessage, finalizeLastMessage, setStreaming, setEnded, setVoiceEnded]
  )

  // TTS
  const speakText = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return
      setTurn('speaking')

      try {
        const response = await fetch(`/api/sessions/${sessionId}/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })

        if (!response.ok) throw new Error('TTS hatası')

        const audioBlob = await response.blob()
        await playBlob(audioBlob)
      } catch (err) {
        console.error('TTS playback error:', err)
      } finally {
        // Eğer seans hala aktifse dinleme moduna geri dön
        if (isActive) {
          setTurn('listening')
        } else {
          setTurn('idle')
        }
      }
    },
    [sessionId, playBlob, isActive, setTurn]
  )

  // VAD Handlers
  const onSpeechStart = useCallback(() => {
    // BARGE-IN: AI konuşuyorsa sustur
    if (isPlaying) {
      stopPlayback()
      if (abortRef.current) abortRef.current.abort()
    }
    setTurn('recording')
  }, [isPlaying, stopPlayback, setTurn])

  const onSpeechEnd = useCallback(async (audioData: Float32Array) => {
    setTurn('processing')
    try {
      const audioBlob = float32ArrayToWav(audioData)
      
      const formData = new FormData()
      formData.append('audio', audioBlob)

      const sttRes = await fetch(`/api/sessions/${sessionId}/stt`, {
        method: 'POST',
        body: formData,
      })

      if (!sttRes.ok) throw new Error('STT failed')
      const { transcript, isEmpty } = await sttRes.json()

      if (isEmpty || !transcript) {
        setTurn('listening')
        return
      }

      setCurrentTranscript(transcript)
      const aiText = await sendTextToChat(transcript)

      if (aiText && !isEnded) {
        await speakText(aiText)
      } else {
        setTurn('listening')
      }
    } catch (err) {
      console.error('Turn handling error:', err)
      setTurn('error')
      setTimeout(() => setTurn('listening'), 2000)
    }
  }, [sessionId, isEnded, sendTextToChat, speakText, setCurrentTranscript, setTurn])

  // Natural Voice Hook
  const { startVAD, stopVAD } = useNaturalVoice({
    onSpeechStart,
    onSpeechEnd,
    enabled: isActive && !isEnded,
  })

  // Init & Greetings
  useEffect(() => {
    reset()
    resetVoice()
    setPhase(initialPhase)

    // Browsers require user interaction for audio context usually
    // first greeting will stay text-only until user clicks "Play"
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Session end redirect
  useEffect(() => {
    if (isEnded) {
      stopVAD()
      stopPlayback()
      const t = setTimeout(() => router.push(`/dashboard/sessions/${sessionId}/report`), 2000)
      return () => clearTimeout(t)
    }
  }, [isEnded, sessionId, router, stopVAD, stopPlayback])

  const handleToggleActive = async () => {
    if (isActive) {
      // Durdur
      setIsActive(false)
      setTurn('idle')
      stopPlayback()
      stopVAD()
    } else {
      // Başlat
      setIsActive(true)
      setTurn('listening')
      
      // İlk kez izin iste (gerekirse)
      if (hasMicPermission !== true) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(t => t.stop())
          setMicPermission(true)
        } catch {
          setMicPermission(false)
          setError('Mikrofon izni gerekli.')
          return
        }
      }

      // Selamlaşmayı tetikle (eğer hiç mesaj yoksa)
      if (messages.length === 0) {
        setTurn('processing')
        const text = await sendTextToChat('Seansa başla, kendini tanıt.')
        if (text) await speakText(text)
      }
    }
  }

  const handleEndSession = async (reason: CancelReason) => {
    setIsCancelling(true)
    abortRef.current?.abort()
    stopPlayback()
    stopVAD()

    if (reason === 'completed_naturally') {
      await endSessionAction(sessionId, 'user_ended')
    } else {
      await cancelSessionAction(sessionId, reason)
    }

    setEnded(true)
    setVoiceEnded(true)
    setCancelModalOpen(false)
    setIsCancelling(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-semibold text-sm flex-shrink-0">
            {personaName[0]}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{personaName}</p>
            <p className="text-xs text-muted-foreground truncate">{personaTitle} · {scenarioTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <PhaseIndicator currentPhase={currentPhase} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCancelModalOpen(true)}
            disabled={isEnded}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Seansı Bitir</span>
          </Button>
        </div>
      </div>

      <CancelSessionModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleEndSession}
        isLoading={isCancelling}
      />

      {/* Ana ses arayüzü */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4">
        <div className="text-center space-y-1">
          <p className={cn(
            'text-lg font-medium transition-colors',
            turn === 'recording' && 'text-red-400',
            turn === 'speaking' && 'text-amber-400',
            turn === 'listening' && 'text-primary animate-pulse',
            turn === 'processing' && 'text-muted-foreground',
            turn === 'idle' && 'text-foreground',
            turn === 'error' && 'text-destructive',
          )}>
            {TURN_LABELS[turn]}
          </p>
          {currentTranscript && (turn === 'processing' || turn === 'recording') && (
            <p className="text-sm text-muted-foreground max-w-xs italic line-clamp-2">
              &ldquo;{currentTranscript}&rdquo;
            </p>
          )}
          {errorMessage && (
            <p className="text-sm text-destructive max-w-xs">{errorMessage}</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-6">
          <VoiceWaveform turn={turn} className="h-10" />
          <VoiceMicButton
            turn={turn}
            isActive={isActive}
            onClick={handleToggleActive}
            disabled={isEnded}
          />
          <p className="text-xs text-muted-foreground h-4">
            {!isActive && 'Serbest konuşmayı başlatmak için dokunun'}
            {isActive && turn === 'listening' && 'Konuşmanızı bekliyorum...'}
            {isActive && turn === 'speaking' && 'Sözünü kesmek için konuşmaya başlayın'}
          </p>
        </div>

        {/* Son mesajlar */}
        {messages.length > 0 && (
          <div className="w-full max-w-md space-y-2 mt-4 opacity-60">
            {messages
              .filter((m) => m.content && !m.isStreaming)
              .slice(-2)
              .map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg max-w-[85%]',
                    msg.role === 'user'
                      ? 'ml-auto bg-primary/10 text-right'
                      : 'mr-auto bg-card border border-border'
                  )}
                >
                  <p className="line-clamp-1">{msg.content}</p>
                </div>
              ))}
          </div>
        )}

        {isEnded && (
          <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
            Seans tamamlandı · Rapora yönlendiriliyorsunuz...
          </Badge>
        )}
      </div>
    </div>
  )
}

