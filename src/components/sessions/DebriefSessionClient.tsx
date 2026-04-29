'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/stores/session.store'
import { useVoiceSessionStore } from '@/stores/voice-session.store'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { useNaturalVoice } from '@/hooks/useNaturalVoice'
import { blobToWhisperFilename } from '@/lib/audio-utils'
import { VoiceWaveform } from './voice/VoiceWaveform'
import { finishDebriefAction, checkEvaluationReadyAction } from '@/lib/actions/debrief.actions'
import { Loader2, MessageSquare, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const DEBRIEF_INIT_PREFIX = '[DEBRIEF_INIT]'

const TURN_LABELS: Record<string, string> = {
  idle: 'Hazırlanıyor...',
  listening: 'Sizi dinliyorum...',
  recording: 'Konuşmanız algılandı...',
  processing: 'Düşünüyor...',
  speaking: 'Koç konuşuyor...',
  error: 'Hata oluştu, lütfen tekrar deneyin',
}

interface DebriefSessionClientProps {
  sessionId: string
  personaName: string
  scenarioTitle: string
  userName: string
}

export function DebriefSessionClient({
  sessionId,
  personaName,
  scenarioTitle,
  userName,
}: DebriefSessionClientProps) {
  const router = useRouter()
  const abortRef = useRef<AbortController | null>(null)
  const debriefStartedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    currentPhase,
    addMessage,
    updateLastMessage,
    finalizeLastMessage,
    setStreaming,
    reset,
  } = useSessionStore()

  const {
    turn,
    isActive,
    currentTranscript,
    errorMessage,
    setTurn,
    setIsActive,
    setMicPermission,
    setCurrentTranscript,
    setError,
    reset: resetVoice,
  } = useVoiceSessionStore()

  const [debriefEnded, setDebriefEnded] = useState(false)
  const [waitingForEval, setWaitingForEval] = useState(false)
  const [isSkipping, setIsSkipping] = useState(false)
  const [debriefStarting, setDebriefStarting] = useState(false)
  // Auto-start: kullanıcı Seansı Bitir'e basınca direkt buraya gelir. Pre-start butonu yok.
  // Ancak page refresh sonrası gesture chain koparsa audio.play() reddedilebilir → fallback button.
  const [hasStarted, setHasStarted] = useState(false)
  const [needsManualStart, setNeedsManualStart] = useState(false)

  const { playBlob, stopPlayback, unlock: unlockAudio, isPlaying } = useAudioPlayer()

  // Debrief chat API
  const sendToDebrief = useCallback(
    async (userText: string): Promise<string | null> => {
      abortRef.current = new AbortController()

      const isInit = userText.startsWith(DEBRIEF_INIT_PREFIX)
      const chatContent = isInit ? userText.slice(DEBRIEF_INIT_PREFIX.length) : userText

      if (!isInit) {
        addMessage({ role: 'user', content: chatContent, phase: currentPhase })
      }
      addMessage({ role: 'assistant', content: '', phase: currentPhase, isStreaming: true })
      setStreaming(true)

      try {
        const res = await fetch(`/api/sessions/${sessionId}/debrief/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userText }), // full prefix sent to API for detection
          signal: abortRef.current.signal,
        })

        if (!res.ok || !res.body) throw new Error('Debrief chat API hatası')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulatedText = ''
        let ended = false

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
              if (data.debriefEnded) ended = true
              if (data.done) finalizeLastMessage(currentPhase)
            } catch { /* chunk parse error */ }
          }
        }

        if (ended) setDebriefEnded(true)

        return accumulatedText.trim() || null
      } catch (err) {
        if ((err as Error).name === 'AbortError') return null
        finalizeLastMessage(currentPhase)
        return null
      } finally {
        setStreaming(false)
      }
    },
    [sessionId, currentPhase, addMessage, updateLastMessage, finalizeLastMessage, setStreaming]
  )

  // Debrief TTS (farklı voice ID)
  const speakDebrief = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return
      setTurn('speaking')
      try {
        const response = await fetch(`/api/sessions/${sessionId}/debrief/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        if (!response.ok) throw new Error('TTS hatası')
        const audioBlob = await response.blob()
        await playBlob(audioBlob)
      } catch (err) {
        console.error('[DebriefSessionClient] TTS hatası:', err)
      } finally {
        if (isActive && !debriefEnded) {
          setTurn('listening')
        } else {
          setTurn('idle')
        }
      }
    },
    [sessionId, playBlob, isActive, debriefEnded, setTurn]
  )

  // VAD handlers
  const onSpeechStart = useCallback(() => {
    if (isPlaying) {
      stopPlayback()
      abortRef.current?.abort()
    }
    setTurn('recording')
  }, [isPlaying, stopPlayback, setTurn])

  const onSpeechEnd = useCallback(
    async (audioBlob: Blob) => {
      if (debriefEnded) return
      setTurn('processing')
      try {
        const formData = new FormData()
        formData.append('audio', audioBlob, blobToWhisperFilename(audioBlob))

        const sttRes = await fetch(`/api/sessions/${sessionId}/stt`, {
          method: 'POST',
          body: formData,
        })

        if (!sttRes.ok) {
          const errText = await sttRes.text().catch(() => '(okunamadı)')
          throw new Error(`STT [${sttRes.status}]: ${errText}`)
        }
        const { transcript, isEmpty } = await sttRes.json()

        if (isEmpty || !transcript) {
          setTurn('listening')
          return
        }

        setCurrentTranscript(transcript)
        const coachText = await sendToDebrief(transcript)
        if (coachText) await speakDebrief(coachText)
        else setTurn('listening')
      } catch (err) {
        console.error('[DebriefSessionClient] onSpeechEnd error:', err)
        setTurn('error')
        setTimeout(() => setTurn('listening'), 3000)
      }
    },
    [sessionId, debriefEnded, sendToDebrief, speakDebrief, setCurrentTranscript, setTurn]
  )

  const { stopVAD } = useNaturalVoice({
    onSpeechStart,
    onSpeechEnd,
    enabled: isActive && !debriefEnded,
    isOutputPlaying: isPlaying,
  })

  // Debrief başlatma — hem auto-start hem manuel buton kullanır
  const handleStartDebrief = async () => {
    if (debriefStartedRef.current || debriefStarting) return
    debriefStartedRef.current = true
    setDebriefStarting(true)

    // ÖNEMLİ: unlock'u SENKRON (await öncesi) çağır — gesture chain içinde olmalı.
    unlockAudio()

    setHasStarted(true)
    setIsActive(true)
    setTurn('processing')

    const initMessage = `${DEBRIEF_INIT_PREFIX}Debrief seansını başlat. Sistem promptundaki AÇILIŞ kuralına göre önce kullanıcıyı sıcak bir karşılama ile rahatlat, değerlendirme analizinin hazırlanmakta olduğunu belirt, sonra ilk soruyu sor (genel izlenim).`

    const micPromise = navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(() => {
        setMicPermission(true)
        return true as const
      })
      .catch(() => {
        setError('Mikrofon erişimi gerekli.')
        return false as const
      })

    const chatPromise = sendToDebrief(initMessage)

    const [micOk, text] = await Promise.all([micPromise, chatPromise])

    if (!micOk) {
      setDebriefStarting(false)
      debriefStartedRef.current = false
      setHasStarted(false)
      return
    }

    if (text) await speakDebrief(text)
    setDebriefStarting(false)
  }

  // Mount: store reset + auto-start.
  useEffect(() => {
    reset()
    resetVoice()

    // Race koşullarını engelle (StrictMode'da useEffect 2x çalışır)
    if (debriefStartedRef.current) return

    handleStartDebrief().catch((err) => {
      console.warn('[DebriefSessionClient] auto-start failed, manual fallback:', err)
      setNeedsManualStart(true)
      setHasStarted(false)
      debriefStartedRef.current = false
      setDebriefStarting(false)
    })
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debrief bittiğinde
  useEffect(() => {
    if (!debriefEnded) return

    stopVAD()
    stopPlayback()
    setIsActive(false)
    setTurn('idle')

    const finish = async () => {
      const result = await finishDebriefAction(sessionId)
      if (!result.success) {
        console.error('[DebriefSessionClient] finishDebriefAction failed:', result.error)
        // Yine de waiting ekranına geç — kullanıcı boş ekranda kalmasın
        setWaitingForEval(true)
        return
      }

      // Her durumda waiting ekranına geç; polling 3sn'de bir checkEvaluationReadyAction
      // çağırır ve hazır olunca /report'a yönlendirir. Direkt push'ta race condition
      // çıkıyordu (eval hazır ama sayfa stale → 404).
      setWaitingForEval(true)
    }

    finish()
  }, [debriefEnded, sessionId, router, stopVAD, stopPlayback, setIsActive, setTurn])

  // Mesaj gelince otomatik aşağı kaydır
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Değerlendirme hazır olana kadar poll
  useEffect(() => {
    if (!waitingForEval) return

    const interval = setInterval(async () => {
      const ready = await checkEvaluationReadyAction(sessionId)
      if (ready) {
        clearInterval(interval)
        router.push(`/dashboard/sessions/${sessionId}/report`)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [waitingForEval, sessionId, router])

  const handleSkip = async () => {
    if (isSkipping) return
    setIsSkipping(true)
    abortRef.current?.abort()
    stopPlayback()
    stopVAD()
    setDebriefEnded(true)
  }

  // Auto-start fallback: gesture chain koptuğunda (page refresh) kullanıcı manuel başlatır
  if (needsManualStart && !hasStarted) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-6 px-4">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(157,107,223,0.15)', border: '1px solid rgba(157,107,223,0.3)' }}
        >
          <MessageSquare className="h-9 w-9" style={{ color: '#9d6bdf' }} />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-xl font-semibold">Geri Bildirim Zamanı</h2>
          <p className="text-sm text-muted-foreground">
            Sesli başlangıç tarayıcı tarafından engellendi (sayfa yenilenmiş olabilir).
            Devam etmek için aşağıdaki butona dokun.
          </p>
        </div>
        <button
          onClick={() => {
            setNeedsManualStart(false)
            handleStartDebrief().catch(() => setNeedsManualStart(true))
          }}
          disabled={debriefStarting}
          className="px-6 py-3 rounded-full text-sm font-medium text-white transition disabled:opacity-50"
          style={{ background: '#9d6bdf' }}
        >
          {debriefStarting ? 'Başlatılıyor...' : 'Geri bildirime başla'}
        </button>
        <button
          onClick={handleSkip}
          disabled={isSkipping}
          className="text-xs text-muted-foreground hover:text-foreground transition px-3 py-1"
        >
          {isSkipping ? 'Atlıyor...' : 'Atla, doğrudan rapora geç'}
        </button>
      </div>
    )
  }

  // Auto-start henüz tamamlanmadı: brief loading
  if (!hasStarted) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4 px-4">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#9d6bdf' }} />
        <p className="text-sm text-muted-foreground">
          Geri bildirim sohbeti başlatılıyor{userName ? `, ${userName}` : ''}...
        </p>
      </div>
    )
  }

  // Değerlendirme bekleme ekranı
  if (waitingForEval) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-6 px-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(157,107,223,0.15)' }}
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#9d6bdf' }} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Seans Raporunuz Hazırlanıyor</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Yapay zeka değerlendirmenizi analiz ediyor. Bu birkaç saniye sürebilir.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{
          background: 'linear-gradient(to right, rgba(157,107,223,0.08), transparent)',
          borderColor: 'rgba(157,107,223,0.2)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(157,107,223,0.2)', border: '1px solid rgba(157,107,223,0.3)' }}
          >
            <MessageSquare className="h-4 w-4" style={{ color: '#9d6bdf' }} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">Debrief Koçu</p>
            <p className="text-xs text-muted-foreground truncate">
              {personaName} · {scenarioTitle}
            </p>
          </div>
        </div>

        <button
          onClick={handleSkip}
          disabled={debriefEnded || isSkipping}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1 rounded-md hover:bg-muted disabled:opacity-40"
        >
          {isSkipping ? 'Atlıyor...' : 'Atla'}
        </button>
      </div>

      {/* Konuşma transkripti - tam metin, kaydırılabilir */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages
          .filter((m) => m.content || m.isStreaming)
          .map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col max-w-[80%]',
                msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
              )}
            >
              <p className="text-[10px] font-medium text-muted-foreground mb-1">
                {msg.role === 'user' ? (userName || 'Siz') : 'Debrief Koçu'}
              </p>
              <div
                className={cn(
                  'px-4 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'rounded-2xl rounded-br-sm bg-primary/10'
                    : 'rounded-2xl rounded-bl-sm bg-card border border-border/60'
                )}
              >
                {msg.isStreaming && !msg.content ? (
                  <span className="flex gap-1 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </span>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

        {debriefEnded && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Debrief tamamlandı
          </div>
        )}
      </div>

      {/* Alt durum çubuğu */}
      <div
        className="flex-shrink-0 border-t px-4 py-3 flex items-center gap-4"
        style={{ borderColor: 'rgba(157,107,223,0.2)' }}
      >
        <VoiceWaveform turn={turn} className="h-8 flex-1" />
        <div className="text-right shrink-0">
          <p
            className={cn(
              'text-sm font-medium transition-colors',
              turn === 'recording' && 'text-red-400',
              turn === 'speaking' && 'text-purple-400',
              turn === 'listening' && 'text-primary',
              turn === 'processing' && 'text-muted-foreground',
              turn === 'idle' && 'text-foreground',
              turn === 'error' && 'text-destructive',
            )}
          >
            {TURN_LABELS[turn]}
          </p>
          {currentTranscript && (turn === 'processing' || turn === 'recording') && (
            <p className="text-xs text-muted-foreground italic line-clamp-1 max-w-[200px]">
              &ldquo;{currentTranscript}&rdquo;
            </p>
          )}
          {errorMessage && (
            <p className="text-xs text-destructive max-w-[200px]">{errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  )
}
