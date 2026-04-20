'use client'

import { useRef, useCallback, useEffect } from 'react'
import * as ort from 'onnxruntime-web'

// VAD kütüphanesi dynamic import gerektirebilir (SSR hatası almamak için)
let MicVAD: any = null

interface UseNaturalVoiceProps {
  onSpeechStart: () => void
  onSpeechEnd: (audio: Float32Array) => void
  onMisfire?: () => void
  enabled: boolean
}

export function useNaturalVoice({
  onSpeechStart,
  onSpeechEnd,
  onMisfire,
  enabled,
}: UseNaturalVoiceProps) {
  const vadRef = useRef<any>(null)

  useEffect(() => {
    // Client-side initialization
    const init = async () => {
      if (typeof window === 'undefined') return
      
      // onnxruntime paths
      ort.env.wasm.wasmPaths = '/assets/vad/'
      
      if (!MicVAD) {
        const mod = await import('@ricky0123/vad-web')
        MicVAD = mod.MicVAD
      }
    }
    init()
  }, [])

  const startVAD = useCallback(async () => {
    if (!MicVAD || vadRef.current) return

    try {
      vadRef.current = await MicVAD.new({
        modelURL: '/assets/vad/silero_vad.onnx',
        workletURL: '/assets/vad/vad.worklet.js', // Bu dosya da public'te olmalı
        onSpeechStart: () => {
          console.log('[VAD] Speech started')
          onSpeechStart()
        },
        onSpeechEnd: (audio: Float32Array) => {
          console.log('[VAD] Speech ended')
          onSpeechEnd(audio)
        },
        onVADMisfire: () => {
          console.log('[VAD] Misfire')
          onMisfire?.()
        },
        // Hassasiyet ayarları
        positiveSpeechThreshold: 0.8,
        negativeSpeechThreshold: 0.35,
        minSpeechFrames: 3,
        redemptionFrames: 24, // Sessizlik algılandıktan sonra ne kadar beklenecek (800ms civarı)
        preSpeechPadFrames: 10,
      })
      
      if (enabled) {
        await vadRef.current.start()
      }
    } catch (err) {
      console.error('VAD Initialization Error:', err)
    }
  }, [onSpeechStart, onSpeechEnd, onMisfire, enabled])

  const stopVAD = useCallback(async () => {
    if (vadRef.current) {
      await vadRef.current.destroy()
      vadRef.current = null
    }
  }, [])

  // Enable/Disable toggle
  useEffect(() => {
    if (enabled) {
      if (!vadRef.current) {
        startVAD()
      } else {
        vadRef.current.start()
      }
    } else {
      vadRef.current?.pause()
    }
  }, [enabled, startVAD])

  return { startVAD, stopVAD }
}
