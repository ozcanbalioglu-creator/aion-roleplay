'use client'

import { useEffect, useLayoutEffect, useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/stores/session.store'
import type { SessionPhase } from '@/stores/session.store'
import { useVoiceSessionStore } from '@/stores/voice-session.store'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { useNaturalVoice } from '@/hooks/useNaturalVoice'
import { blobToWhisperFilename, sanitizeForTTS } from '@/lib/audio-utils'
import { VoiceMicButton } from './voice/VoiceMicButton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PhaseIndicator } from './PhaseIndicator'
import { LogOut, ScrollText } from 'lucide-react'
import { PersonaInfoColumn } from './PersonaInfoColumn'
import { SubHeaderShell } from './SubHeaderShell'
import { endSessionAction, cancelSessionAction } from '@/lib/actions/session.actions'
import { toast } from 'sonner'
import { useHeartbeat } from '@/hooks/useHeartbeat'
import { useSessionUnloadGuard } from '@/hooks/useSessionUnloadGuard'
import { CancelSessionModal, type CancelReason } from './CancelSessionModal'
import { cn } from '@/lib/utils'

// Selamlama tetikleyici — kullanıcı mesajı olarak gösterilmez ama LLM'e gönderilir
const GREETING_TRIGGER_PREFIX = '__GREET__:'

interface VoiceSessionClientProps {
  sessionId: string
  personaName: string
  personaTitle: string
  personaDepartment?: string | null
  personaAvatarUrl?: string | null
  personaExperienceYears?: number | null
  personaGrowthType?: string | null
  personaEmotionalBaseline?: string | null
  personaDifficulty?: number | null
  personaResistanceLevel?: number | null
  personaCooperativeness?: number | null
  coachingTips?: string[]
  coachingContext?: string | null
  triggerBehaviors?: string[]
  scenarioTitle: string
  scenarioContext?: string | null
  estimatedDuration: number
  initialPhase: SessionPhase
  userName?: string
}

const TURN_LABELS: Record<string, string> = {
  idle: 'Seansı başlatmak için butona dokunun',
  listening: 'Sizi dinliyorum...',
  recording: 'Konuşmanız algılandı...',
  processing: 'Düşünüyor...',
  speaking: '',
  error: 'Hata oluştu',
}

export function VoiceSessionClient({
  sessionId,
  personaName,
  personaTitle,
  personaDepartment = null,
  personaAvatarUrl = null,
  personaExperienceYears = null,
  personaGrowthType = null,
  personaEmotionalBaseline = null,
  personaDifficulty = null,
  personaResistanceLevel = null,
  personaCooperativeness = null,
  coachingTips = [],
  coachingContext = null,
  triggerBehaviors = [],
  scenarioTitle,
  scenarioContext = null,
  initialPhase,
  userName = '',
}: VoiceSessionClientProps) {
  const router = useRouter()
  const abortRef = useRef<AbortController | null>(null)
  const greetingStartedRef = useRef(false)

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
  const [isEnding, setIsEnding] = useState(false)
  // Local VAD gate — never reads from Zustand, so stale isActive can't trigger premature start
  const [vadEnabled, setVadEnabled] = useState(false)

  useHeartbeat(sessionId, !isEnded)
  useSessionUnloadGuard(sessionId, !isEnded)

  const { playBlob, stopPlayback, unlock: unlockAudio, isPlaying } = useAudioPlayer()

  // Chat API
  const sendTextToChat = useCallback(
    async (userText: string): Promise<string | null> => {
      abortRef.current = new AbortController()

      const isGreeting = userText.startsWith(GREETING_TRIGGER_PREFIX)
      const chatMessage = isGreeting ? userText.slice(GREETING_TRIGGER_PREFIX.length) : userText

      if (!isGreeting) {
        addMessage({ role: 'user', content: chatMessage, phase: currentPhase })
      }

      addMessage({ role: 'assistant', content: '', phase: currentPhase, isStreaming: true })
      setStreaming(true)

      try {
        const res = await fetch(`/api/sessions/${sessionId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: chatMessage }),
          signal: abortRef.current.signal,
        })

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => '(okunamadı)')
          throw new Error(`Chat API hatası [${res.status}]: ${errText}`)
        }

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
              if (data.error) {
                throw new Error(`Sunucu hatası: ${data.error}`)
              }
              if (data.text) {
                accumulatedText += data.text
                updateLastMessage(accumulatedText)
              }
              if (data.phase) finalPhase = data.phase as SessionPhase
              if (data.sessionEnded) sessionEnded = true
              if (data.done) finalizeLastMessage(finalPhase)
            } catch (e) {
              // data.error throw'unu yukarı bırak, JSON parse hatalarını yut
              if ((e as Error).message?.startsWith('Sunucu hatası:')) throw e
            }
          }
        }

        if (sessionEnded) {
          setEnded(true)
          setVoiceEnded(true)
        }

        return accumulatedText.trim() || null
      } catch (err) {
        if ((err as Error).name === 'AbortError') return null
        console.error('[Chat] sendTextToChat error:', err)
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
      // Defansif sanitize: server stripse de chunk boundary'lerinde marker geçebiliyor.
      const cleanText = sanitizeForTTS(text)
      if (!cleanText) return
      setTurn('speaking')

      try {
        const response = await fetch(`/api/sessions/${sessionId}/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText }),
        })

        if (!response.ok) {
          // 409 ("Seans aktif değil") — AI [SESSION_END] gönderdikten sonra status değişmiş;
          // bu son TTS isteği yarışta kaybetti. Sessizce yut, kullanıcı debrief'e geçiyor.
          if (response.status === 409) {
            console.log('[TTS] 409 ignored (session likely transitioned to debrief_active)')
            return
          }
          const errText = await response.text().catch(() => '(okunamadı)')
          throw new Error(`TTS [${response.status}]: ${errText}`)
        }

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

  const onSpeechEnd = useCallback(async (audioBlob: Blob) => {
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

  // Natural Voice Hook — enabled uses local state, not Zustand, so mount never triggers premature start
  // isOutputPlaying: TTS oynarken VAD eşiği yükselir → hoparlör→mic echo'su Whisper phantom'ları üretmez.
  const { startVAD, stopVAD } = useNaturalVoice({
    onSpeechStart,
    onSpeechEnd,
    enabled: vadEnabled && !isEnded,
    isOutputPlaying: isPlaying,
  })

  // Store'u paint öncesi sıfırla — passive effect'lerden (VAD dahil) önce çalışır.
  // Önceki seansın stale isActive=true'su VAD'ı erken tetikliyordu.
  useLayoutEffect(() => {
    reset()
    resetVoice()
    setPhase(initialPhase)
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // AI-ended: refresh so page transitions to DebriefSessionClient
  useEffect(() => {
    if (isEnded) {
      setVadEnabled(false)
      stopVAD()
      stopPlayback()
      router.refresh()
    }
  }, [isEnded, router, stopVAD, stopPlayback])

  const handleToggleActive = async () => {
    if (isActive) {
      // Durdur
      setVadEnabled(false)
      setIsActive(false)
      setTurn('idle')
      stopPlayback()
      stopVAD()
    } else {
      // Başlat
      // ÖNEMLİ: Audio autoplay engellemesini SENKRON olarak — kullanıcı jesti içinde — kaldır.
      // Aşağıdaki await chain (mic permission, chat streaming, TTS sentezi) ~3-5sn sürer;
      // bu süreden sonra browser gesture'ı "tüketilmiş" sayar ve audio.play() reddedilir.
      unlockAudio()

      setIsActive(true)
      setTurn('listening')

      // İlk kez izin kontrolü: VAD kendi stream'ini açıyor, burada sadece izni kontrol et.
      // Önceki pattern (aç/hemen kapat) hardware'i kötü durumda bırakıp VAD stream'ini sıfır veri üretiyordu.
      if (hasMicPermission !== true) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
            s.getTracks().forEach(t => t.stop())
            setMicPermission(true)
          })
        } catch {
          setMicPermission(false)
          setIsActive(false)
          setError('Mikrofon izni gerekli.')
          return
        }
        // Hardware'in serbest bırakıldıktan sonra VAD stream'ine hazır olması için kısa bekleme
        await new Promise(r => setTimeout(r, 150))
      }

      // Selamlaşmayı tetikle — yalnızca ilk kez ve mesaj yoksa
      // VAD greeting BİTTİKTEN sonra açılır — aksi halde mikrofon warm-up gürültüsü
      // sahte "konuşma başladı" tetikler, barge-in greeting'i abort eder, session 'failed' olur.
      let greetingOk = true
      if (messages.length === 0 && !greetingStartedRef.current) {
        greetingStartedRef.current = true
        setTurn('processing')
        // ÖNEMLİ: Kullanıcı yöneticidir/koçtur. Sen (AI) çalışan/personelsin.
        // Kullanıcı seni odasına çağırdı. Sen sadece selamla — KOÇ GİBİ AÇILIŞ YAPMA.
        const greetBody = userName
          ? `Kullanıcı (${userName}) yöneticin/koçun olarak seni odasına çağırdı. Karakterine uygun, kısa bir selam ver (örn. "Merhaba ${userName} Bey, çağırdığınızı duydum, geldim."). Hiçbir koç sorusu sorma, hiçbir bağlam kurma, hiçbir özet yapma — sadece selamla ve sus. Konuşmayı yönetici/koç başlatacak.`
          : `Kullanıcı yöneticin/koçun olarak seni odasına çağırdı. Karakterine uygun, kısa bir selam ver. Hiçbir koç sorusu sorma — sadece selamla ve sus. Konuşmayı yönetici başlatacak.`
        const text = await sendTextToChat(`${GREETING_TRIGGER_PREFIX}${greetBody}`)
        if (text) {
          await speakText(text)
        } else {
          // Greeting fail oldu (chat error veya AbortError). Session muhtemelen 'failed'.
          // VAD'ı AÇMA — kullanıcı boşuna konuşmasın.
          greetingOk = false
          setIsActive(false)
          setTurn('error')
          setError('Sohbet başlatılamadı. Lütfen sayfayı yenileyip yeni bir seans başlatın.')
        }
      }

      // VAD sadece greeting başarılıysa açılır
      if (greetingOk) {
        setVadEnabled(true)
      }
    }
  }

  const handleNaturalEnd = async () => {
    setIsEnding(true)
    abortRef.current?.abort()
    stopPlayback()
    setVadEnabled(false)
    stopVAD()
    try {
      const result = await endSessionAction(sessionId, 'user_ended')
      if (!result.success) {
        // "Aktif seans değil" — büyük olasılıkla AI persona [SESSION_END] gönderdi ve chat route
        // session'ı çoktan debrief_active'e geçirdi. Sayfa yenile, page route DebriefSessionClient'a yönlendirsin.
        if (result.error === 'Aktif seans değil') {
          router.refresh()
          return
        }
        toast.error(result.error ?? 'Seans sonlandırılamadı, tekrar deneyin.')
        setIsEnding(false)
        return
      }
      // Başarılı: page refresh status='debrief_active' okur ve DebriefSessionClient mount eder.
      router.refresh()
    } catch (err) {
      toast.error(`Seans sonlandırılamadı: ${(err as Error).message}`)
      setIsEnding(false)
    }
  }

  const handleEndSession = async (reason: CancelReason) => {
    setIsCancelling(true)
    abortRef.current?.abort()
    stopPlayback()
    setVadEnabled(false)
    stopVAD()
    await cancelSessionAction(sessionId, reason)
    setEnded(true)
    setVoiceEnded(true)
    setCancelModalOpen(false)
    setIsCancelling(false)
  }

  return (
    // h-[calc(100dvh-5rem)] — dashboard layout'un min-h-screen'i + AppHeader (h-20 = 5rem) ile
    // sticky mic butonu fold altına itiliyordu. Explicit viewport height (header çıkarılmış) +
    // overflow-hidden ile sol panel iç scroll'a geçiyor, mic her zaman görünür kalıyor.
    <div
      className="flex flex-col h-[calc(100dvh-5rem)] overflow-hidden"
      style={{
        background: 'linear-gradient(155deg, #1a1a2e 0%, #0f0e22 55%, #1c003a 100%)',
      }}
    >
      {/* SUB-HEADER — /sessions/new ile aynı SubHeaderShell. Persona name/title sol panelde
          zaten görünüyor, sub-header'da tekrar gereksizdi → kaldırıldı. Sol boş, sağ tarafta
          phase + mic + aksiyon butonları */}
      <SubHeaderShell>
        {/* SOL — Phase indicator */}
        <PhaseIndicator currentPhase={currentPhase} />

        {/* ORTA — Mic + status text (justify-between sayesinde otomatik ortalanır) */}
        <div className="flex items-center gap-3 pl-3 border-l border-white/10">
          <VoiceMicButton
            turn={turn}
            isActive={isActive}
            onClick={handleToggleActive}
            disabled={isEnded}
            size="sm"
          />
          <p
            className={cn(
              'text-[12px] font-medium transition-colors leading-tight max-w-[12rem]',
              turn === 'recording' && 'text-red-300',
              turn === 'speaking' && 'text-amber-300',
              turn === 'listening' && 'text-purple-300 animate-pulse',
              turn === 'processing' && 'text-white/50',
              turn === 'idle' && 'text-white/85',
              turn === 'error' && 'text-red-300',
            )}
          >
            {turn === 'speaking' ? `${personaName} konuşuyor...` : TURN_LABELS[turn]}
          </p>
        </div>

        {/* SAĞ — Aksiyon butonları */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCancelModalOpen(true)}
            disabled={isEnded || isEnding || isCancelling}
            className="text-white/60 hover:text-red-300 hover:bg-red-500/10 gap-1.5 text-xs"
          >
            <span className="hidden sm:inline">Yarıda Kes</span>
            <span className="sm:hidden">Bırak</span>
          </Button>
          <Button
            size="sm"
            onClick={handleNaturalEnd}
            disabled={isEnded || isEnding || isCancelling}
            className="gap-1.5"
          >
            {isEnding ? (
              <div className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Seansı Bitir</span>
          </Button>
        </div>
      </SubHeaderShell>

      <CancelSessionModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleEndSession}
        isLoading={isCancelling}
      />

      {/* 2-column main — CinematicPersonaStage ile aynı oran (42% / 58%) */}
      <div className="flex flex-1 overflow-hidden">

        {/* ════════════════ SOL — Persona info kolonu (foto üst + info kartları) + mic alt sticky */}
        <div
          className="relative flex flex-col overflow-hidden"
          style={{ flex: '0 0 42%' }}
        >
          {/* Üst kısım: PersonaInfoColumn (scrollable) */}
          <div className="flex-1 min-h-0">
            <PersonaInfoColumn
              name={personaName}
              title={personaTitle}
              department={personaDepartment}
              avatarUrl={personaAvatarUrl}
              experienceYears={personaExperienceYears}
              growthType={personaGrowthType}
              emotionalBaseline={personaEmotionalBaseline}
              difficulty={personaDifficulty}
              resistanceLevel={personaResistanceLevel}
              cooperativeness={personaCooperativeness}
              scenarioContext={scenarioContext}
              coachingContext={coachingContext}
              coachingTips={coachingTips}
              triggerBehaviors={triggerBehaviors}
            />
          </div>

          {/* Alt kısım: Status bar — sadece hata/ended durumunda görünür, mic sub-header'a taşındı */}
          {(errorMessage || isEnded) && (
            <div
              className="flex-shrink-0 px-6 py-3 z-20"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(16px)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex flex-col items-center gap-2">
                {errorMessage && (
                  <p className="text-xs text-red-300 max-w-xs text-center">{errorMessage}</p>
                )}
                {isEnded && (
                  <Badge
                    variant="outline"
                    className="text-amber-300 border-amber-500/30 bg-amber-500/10"
                  >
                    Seans tamamlandı · Debrief başlatılıyor...
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ════════════════ SAĞ — Transkript (light surface, CinematicPersonaStage'in scenario list yerine) */}
        <div
          className="flex flex-col overflow-hidden flex-1"
          style={{ background: 'var(--surface, #fcf8ff)' }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-6 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
          >
            <ScrollText className="h-3.5 w-3.5 opacity-50" />
            <p className="text-[10px] uppercase tracking-widest font-bold opacity-60">
              Konuşma Transkripti
            </p>
          </div>

          {/* Scrollable transcript */}
          <div
            ref={(el) => {
              if (el) el.scrollTop = el.scrollHeight
            }}
            key={messages.length}
            className="flex-1 overflow-y-auto px-8 py-6 space-y-4"
          >
            {messages.length === 0 && (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm italic text-center max-w-xs opacity-50">
                  Mikrofona basıp seansı başlatın — diyaloğunuz burada akacak.
                </p>
              </div>
            )}

            {messages
              .filter((m) => m.content || m.isStreaming)
              .map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex flex-col gap-1',
                    msg.role === 'user' ? 'items-end' : 'items-start',
                  )}
                >
                  <p className="text-[10px] uppercase tracking-wider opacity-50 font-medium px-1">
                    {msg.role === 'user' ? (userName || 'Sen') : personaName}
                  </p>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      msg.role === 'user' ? 'rounded-br-md text-white' : 'rounded-bl-md',
                    )}
                    style={
                      msg.role === 'user'
                        ? { background: 'linear-gradient(135deg, #9d6bdf 0%, #c4a0f5 100%)' }
                        : { background: 'rgba(157,107,223,0.08)', border: '1px solid rgba(157,107,223,0.14)' }
                    }
                  >
                    {msg.content || (
                      <span className="inline-flex gap-1 items-center opacity-50">
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
                      </span>
                    )}
                  </div>
                </div>
              ))}

            {currentTranscript && (turn === 'processing' || turn === 'recording') && (
              <div className="flex flex-col gap-1 items-end opacity-60">
                <p className="text-[10px] uppercase tracking-wider opacity-50 font-medium px-1">
                  {userName || 'Sen'} · işleniyor
                </p>
                <div
                  className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed italic text-white"
                  style={{ background: 'rgba(157,107,223,0.45)' }}
                >
                  &ldquo;{currentTranscript}&rdquo;
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

