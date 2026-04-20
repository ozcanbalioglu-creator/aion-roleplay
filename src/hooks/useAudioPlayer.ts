'use client'

import { useRef, useCallback, useState } from 'react'

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const stopPlayback = useCallback(() => {
    audioRef.current?.pause()
    if (audioRef.current?.src?.startsWith('blob:')) {
      URL.revokeObjectURL(audioRef.current.src)
    }
    audioRef.current = null
    setIsPlaying(false)
  }, [])

  const playBlob = useCallback(
    (blob: Blob): Promise<void> => {
      return new Promise((resolve) => {
        stopPlayback()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio

        audio.onplay = () => setIsPlaying(true)
        audio.onended = () => {
          setIsPlaying(false)
          URL.revokeObjectURL(url)
          audioRef.current = null
          resolve()
        }
        audio.onerror = () => {
          setIsPlaying(false)
          URL.revokeObjectURL(url)
          audioRef.current = null
          resolve()
        }

        audio.play().catch(() => resolve())
      })
    },
    [stopPlayback]
  )

  return { playBlob, stopPlayback, isPlaying }
}
