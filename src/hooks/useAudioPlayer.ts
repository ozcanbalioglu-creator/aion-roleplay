'use client'

import { useRef, useCallback, useState } from 'react'

// Çok kısa sessiz WAV (44 byte header + 0 data). Browser autoplay engellemesini açmak için
// kullanıcı jesti sırasında bir kez oynatılır. Sonraki play() çağrılarında element "warm" kalır.
const SILENT_AUDIO_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const unlockedRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Singleton element. Tek bir HTMLAudioElement tüm session boyunca yeniden kullanılır;
  // bu sayede ilk user-gesture ile alınan "play izni" sonraki TTS'ler için de geçerli kalır.
  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.setAttribute('playsinline', '') // iOS Safari fullscreen takeover'ı önler
      audioRef.current = audio
    }
    return audioRef.current
  }, [])

  // unlock() — kullanıcı jesti (mikrofon butonu tıklaması) anında SENKRON çağrılmalı.
  // Browser'lar (özellikle Safari) audio.play()'i sadece user-gesture chain içinde izin veriyor;
  // chat streaming + TTS sentezi (~3-5sn async) sonrası gesture "tüketilmiş" olabiliyor.
  // Burada sessiz bir data URI'yi mute olarak oynatıp eleman'ı "primed" tutuyoruz.
  const unlock = useCallback(() => {
    if (unlockedRef.current) return
    const audio = ensureAudio()
    audio.muted = true
    audio.src = SILENT_AUDIO_DATA_URI
    audio
      .play()
      .then(() => {
        audio.pause()
        audio.currentTime = 0
        audio.muted = false
        unlockedRef.current = true
      })
      .catch((err) => {
        // Sessiz oynatma bile reddedildiyse autoplay tamamen kapalı; gerçek TTS de büyük ihtimalle reddedilecek.
        console.warn('[AudioPlayer] unlock() reddedildi:', (err as Error).message)
      })
  }, [ensureAudio])

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    if (audio.src?.startsWith('blob:')) {
      URL.revokeObjectURL(audio.src)
      audio.removeAttribute('src')
      audio.load()
    }
    setIsPlaying(false)
  }, [])

  const playBlob = useCallback(
    (blob: Blob): Promise<void> => {
      return new Promise((resolve) => {
        const audio = ensureAudio()

        // Önceki playback'i temizle (aynı element)
        audio.pause()
        if (audio.src?.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src)
        }

        // Bazı browserlar (Safari) blob.type boş ise audio decode etmiyor.
        const typedBlob = blob.type ? blob : new Blob([blob], { type: 'audio/mpeg' })
        const url = URL.createObjectURL(typedBlob)

        audio.src = url
        audio.muted = false

        audio.onplay = () => setIsPlaying(true)
        audio.onended = () => {
          setIsPlaying(false)
          URL.revokeObjectURL(url)
          resolve()
        }
        audio.onerror = () => {
          const code = audio.error?.code
          const msg = audio.error?.message
          console.error(
            `[AudioPlayer] decode/playback hatası code=${code} msg=${msg ?? '(boş)'} blobSize=${blob.size} blobType=${blob.type || '(boş)'}`
          )
          setIsPlaying(false)
          URL.revokeObjectURL(url)
          resolve()
        }

        audio.play().catch((err) => {
          console.error(
            `[AudioPlayer] play() reddedildi: ${(err as Error).message} (unlocked=${unlockedRef.current})`
          )
          resolve()
        })
      })
    },
    [ensureAudio]
  )

  return { playBlob, stopPlayback, unlock, isPlaying }
}
