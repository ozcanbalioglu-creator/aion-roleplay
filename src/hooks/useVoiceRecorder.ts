'use client'

import { useRef, useCallback } from 'react'

interface UseVoiceRecorderReturn {
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | null>
  isRecording: boolean
  checkSupport: () => boolean
  requestPermission: () => Promise<boolean>
}

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const isRecordingRef = useRef(false)

  const checkSupport = useCallback((): boolean => {
    return (
      typeof window !== 'undefined' &&
      'MediaRecorder' in window &&
      'mediaDevices' in navigator &&
      !!getSupportedMimeType()
    )
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      // İzin alındı — stream'i sakla (yeniden açmaktan kaçın)
      streamRef.current = stream
      return true
    } catch {
      return false
    }
  }, [])

  const startRecording = useCallback(async (): Promise<void> => {
    if (isRecordingRef.current) return

    // Stream yoksa veya kapandıysa yeniden aç
    if (!streamRef.current || !streamRef.current.active) {
      const hasPermission = await requestPermission()
      if (!hasPermission) throw new Error('Mikrofon izni reddedildi')
    }

    const mimeType = getSupportedMimeType()
    if (!mimeType) throw new Error('Desteklenen ses formatı bulunamadı')

    chunksRef.current = []
    const recorder = new MediaRecorder(streamRef.current!, { mimeType })

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    mediaRecorderRef.current = recorder
    isRecordingRef.current = true
    recorder.start(100) // 100ms chunk'lar
  }, [requestPermission])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || !isRecordingRef.current) {
        resolve(null)
        return
      }

      recorder.onstop = () => {
        isRecordingRef.current = false
        if (chunksRef.current.length === 0) {
          resolve(null)
          return
        }
        const mimeType = recorder.mimeType
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []
        resolve(blob)
      }

      recorder.stop()
      mediaRecorderRef.current = null
    })
  }, [])

  return {
    startRecording,
    stopRecording,
    get isRecording() {
      return isRecordingRef.current
    },
    checkSupport,
    requestPermission,
  }
}
