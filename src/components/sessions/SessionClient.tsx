'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/stores/session.store'
import { useSSERetry } from '@/hooks/useSSERetry'
import type { SessionPhase } from '@/stores/session.store'
import { ChatBubble } from './ChatBubble'
import { ChatInput } from './ChatInput'
import { PhaseIndicator } from './PhaseIndicator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut, Clock } from 'lucide-react'
import { endSessionAction } from '@/lib/actions/session.actions'
import { toast } from 'sonner'
import { useHeartbeat } from '@/hooks/useHeartbeat'
import { useSessionUnloadGuard } from '@/hooks/useSessionUnloadGuard'
import { CancelSessionModal, type CancelReason } from './CancelSessionModal'
import { cancelSessionAction } from '@/lib/actions/session.actions'

interface SessionClientProps {
  sessionId: string
  personaName: string
  personaTitle: string
  scenarioTitle: string
  estimatedDuration: number
  initialPhase: SessionPhase
}

export function SessionClient({
  sessionId,
  personaName,
  personaTitle,
  scenarioTitle,
  estimatedDuration,
  initialPhase,
}: SessionClientProps) {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastMessageRef = useRef<string>('')
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const {
    messages,
    currentPhase,
    isStreaming,
    isEnded,
    addMessage,
    updateLastMessage,
    finalizeLastMessage,
    setPhase,
    setStreaming,
    setEnded,
    reset,
  } = useSessionStore()

  useHeartbeat(sessionId, !isEnded)
  useSessionUnloadGuard(sessionId, !isEnded)

  const { scheduleRetry, resetRetries } = useSSERetry({
    maxRetries: 3,
    baseDelayMs: 2000,
    onRetry: (attempt) => {
      toast.info(`Yeniden bağlanılıyor... (${attempt}/3)`)
    },
    onFailed: () => {
      setConnectionFailed(true)
      setStreaming(false)
      finalizeLastMessage(currentPhase)
      toast.error('Bağlantı kurulamadı. Lütfen kontrol edip yeniden deneyin.')
    },
  })

  // Sayfa mount'ta sıfırla ve açılış mesajı gönder
  useEffect(() => {
    reset()
    setPhase(initialPhase)
    // Persona'nın seansı başlatmasını sağla (ilk boş mesaj trick'i yerine doğrudan API tetikle)
    sendInitialGreeting()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Otomatik scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Seans bitince rapor sayfasına yönlendir
  useEffect(() => {
    if (isEnded) {
      const timer = setTimeout(() => {
        router.push(`/sessions/${sessionId}/report`)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isEnded, sessionId, router])

  const sendInitialGreeting = useCallback(async () => {
    await sendMessage('__INIT__')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(
    async (userText: string) => {
      if (isStreaming || isEnded) return

      const isInit = userText === '__INIT__'
      abortControllerRef.current = new AbortController()

      // Kullanıcı mesajını hemen göster (init değilse)
      if (!isInit) {
        addMessage({ role: 'user', content: userText, phase: currentPhase })
      }

      // Streaming AI yanıtı placeholder
      addMessage({
        role: 'assistant',
        content: '',
        phase: currentPhase,
        isStreaming: true,
      })

      setStreaming(true)

      try {
        const res = await fetch(`/api/sessions/${sessionId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: isInit ? 'Seansa başla, kendini tanıt.' : userText }),
          signal: abortControllerRef.current.signal,
        })

        if (!res.ok || !res.body) throw new Error('API hatası')

        resetRetries()
        setConnectionFailed(false)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulatedText = ''
        let finalPhase: SessionPhase = currentPhase

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n\n')

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))

              if (data.text) {
                accumulatedText += data.text
                updateLastMessage(accumulatedText)
              }

              if (data.phase) finalPhase = data.phase as SessionPhase
              if (data.sessionEnded) setEnded(true)

              if (data.done) {
                finalizeLastMessage(finalPhase)
              }
            } catch {
              // Kötü JSON chunk — atla
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        
        lastMessageRef.current = userText
        scheduleRetry(() => sendMessage(userText))
      } finally {
        setStreaming(false)
      }
    },
    [sessionId, isStreaming, isEnded, currentPhase, addMessage, updateLastMessage, finalizeLastMessage, setStreaming, setEnded]
  )

  const handleEndSession = async (reason: CancelReason) => {
    setIsCancelling(true)
    abortControllerRef.current?.abort()
    
    // "completed_naturally" -> endSessionAction, diğerleri -> cancelSessionAction
    if (reason === 'completed_naturally') {
      await endSessionAction(sessionId, 'user_ended')
    } else {
      await cancelSessionAction(sessionId, reason)
    }

    setEnded(true)
    setCancelModalOpen(false)
    setIsCancelling(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-screen">
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
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>~{estimatedDuration}dk</span>
          </div>
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.filter((m) => m.content || m.isStreaming).map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            personaName={personaName}
          />
        ))}

        {isEnded && (
          <div className="flex justify-center py-4">
            <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
              Seans tamamlandı · Rapora yönlendiriliyorsunuz...
            </Badge>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Connection Recovery UI */}
      {connectionFailed && (
        <div className="flex-shrink-0 bg-destructive/10 border-t border-destructive/30 px-4 py-2 flex items-center justify-between animate-in slide-in-from-bottom-2">
          <span className="text-sm text-destructive">
            Bağlantı kesildi. Mesajlar kaydedilemeyebilir.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setConnectionFailed(false)
              resetRetries()
              sendMessage(lastMessageRef.current)
            }}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 h-8"
          >
            Yeniden Dene
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0">
        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming || isEnded}
          placeholder={isEnded ? 'Seans tamamlandı' : undefined}
        />
      </div>
    </div>
  )
}
