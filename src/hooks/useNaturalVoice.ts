'use client'

import { useRef, useCallback, useEffect } from 'react'

const SPEECH_THRESHOLD = 0.005       // normal RMS energy eşiği
const SPEECH_THRESHOLD_DUCK = 0.030  // TTS oynarken: hoparlör→mic echo'sunu filtrelemek için yüksek eşik
const SILENCE_MS = 700               // konuşma sonu için sessizlik süresi
const MIN_SPEECH_MS = 300            // misfire önleme: minimum konuşma süresi
const VAD_INTERVAL_MS = 30           // AnalyserNode polling aralığı (ms)
const FFT_SIZE = 2048

interface UseNaturalVoiceProps {
  onSpeechStart: () => void
  onSpeechEnd: (audioBlob: Blob) => void
  onMisfire?: () => void
  enabled: boolean
  /** TTS playback aktifken VAD eşiği artırılır (echo loop önlemi). */
  isOutputPlaying?: boolean
}

interface VADState {
  ctx: AudioContext | null
  stream: MediaStream | null
  analyser: AnalyserNode | null
  muteGain: GainNode | null
  mediaRecorder: MediaRecorder | null
  speaking: boolean
  silenceTimer: ReturnType<typeof setTimeout> | null
  speechStartTime: number
  active: boolean
  intervalId: ReturnType<typeof setInterval> | null
  timeDomainBuffer: Float32Array<ArrayBuffer> | null
  debugFrameCount: number
  debugMaxRms: number
}

function getRMS(buffer: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
  return Math.sqrt(sum / buffer.length)
}

// Chrome+macOS uyumlu için webm/opus, Safari için audio/mp4 fallback
function pickSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const mt of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mt)) return mt
  }
  return ''
}

export function useNaturalVoice({
  onSpeechStart,
  onSpeechEnd,
  onMisfire,
  enabled,
  isOutputPlaying = false,
}: UseNaturalVoiceProps) {
  const isOutputPlayingRef = useRef(isOutputPlaying)
  useEffect(() => { isOutputPlayingRef.current = isOutputPlaying }, [isOutputPlaying])
  const s = useRef<VADState>({
    ctx: null, stream: null, analyser: null, muteGain: null, mediaRecorder: null,
    speaking: false, silenceTimer: null, speechStartTime: 0, active: false,
    intervalId: null, timeDomainBuffer: null,
    debugFrameCount: 0, debugMaxRms: 0,
  })

  const onSpeechStartRef = useRef(onSpeechStart)
  const onSpeechEndRef = useRef(onSpeechEnd)
  const onMisfireRef = useRef(onMisfire)
  useEffect(() => { onSpeechStartRef.current = onSpeechStart }, [onSpeechStart])
  useEffect(() => { onSpeechEndRef.current = onSpeechEnd }, [onSpeechEnd])
  useEffect(() => { onMisfireRef.current = onMisfire }, [onMisfire])

  const stopVAD = useCallback(async () => {
    const st = s.current
    st.active = false
    if (st.intervalId) { clearInterval(st.intervalId); st.intervalId = null }
    if (st.silenceTimer) { clearTimeout(st.silenceTimer); st.silenceTimer = null }
    if (st.mediaRecorder && st.mediaRecorder.state !== 'inactive') {
      st.mediaRecorder.onstop = () => { st.mediaRecorder = null }  // discard in-flight audio
      st.mediaRecorder.stop()
    } else {
      st.mediaRecorder = null
    }
    if (st.analyser) { st.analyser.disconnect(); st.analyser = null }
    if (st.muteGain) { st.muteGain.disconnect(); st.muteGain = null }
    if (st.stream) { st.stream.getTracks().forEach(t => t.stop()); st.stream = null }
    if (st.ctx) { await st.ctx.close().catch(() => {}); st.ctx = null }
    st.speaking = false
    st.timeDomainBuffer = null
  }, [])

  const startVAD = useCallback(async () => {
    const st = s.current
    if (st.active) return

    try {
      // Echo cancellation + noise suppression: TTS hoparlör çıkışının mic'e geri kaçmasını
      // donanım seviyesinde azaltır. Browser default'u inconsistent — açıkça istemek garanti.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      st.stream = stream

      const track = stream.getAudioTracks()[0]
      console.log(`[VAD] track: enabled=${track.enabled} muted=${track.muted} readyState=${track.readyState}`)

      const ctx = new AudioContext()
      st.ctx = ctx
      if (ctx.state === 'suspended') await ctx.resume()
      console.log(`[VAD] ctx.state=${ctx.state} sampleRate=${ctx.sampleRate}`)

      // AnalyserNode for VAD — not deprecated, reads audio data without ScriptProcessorNode
      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      st.analyser = analyser
      st.timeDomainBuffer = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>

      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      // CRITICAL (Chrome): graf bir destination'a bağlı değilse Chrome MediaStreamSource'u
      // optimize edip sıfır veri akıtıyor. 0-gain GainNode ile sessizce destination'a bağla.
      // Safari bunu zaten gerektirmiyor ama zarar vermez — cross-browser tutar.
      const muteGain = ctx.createGain()
      muteGain.gain.value = 0
      st.muteGain = muteGain
      analyser.connect(muteGain)
      muteGain.connect(ctx.destination)

      const mimeType = pickSupportedMimeType()
      if (!mimeType) {
        console.error('[VAD] Bu tarayıcı hiçbir desteklenen MediaRecorder MIME tipi sunmuyor')
        return
      }

      st.active = true
      console.log(`[VAD] started — mimeType=${mimeType} sampleRate=${ctx.sampleRate}`)

      st.intervalId = setInterval(() => {
        if (!st.active || !st.analyser || !st.timeDomainBuffer) return

        st.analyser.getFloatTimeDomainData(st.timeDomainBuffer)
        const rms = getRMS(st.timeDomainBuffer)

        st.debugFrameCount++
        if (rms > st.debugMaxRms) st.debugMaxRms = rms
        if (st.debugFrameCount % 100 === 0) {
          if (st.debugMaxRms === 0) {
            console.warn(`[VAD] ⚠️ 100 check sıfır ses — track: ${st.stream?.getAudioTracks()[0]?.readyState}`)
          } else {
            console.log(`[VAD] son 100 check maxRMS=${st.debugMaxRms.toFixed(4)} threshold=${SPEECH_THRESHOLD}`)
          }
          st.debugMaxRms = 0
        }

        // TTS oynarken eşiği yükselt — hoparlör→mic echo'su normalde 0.005-0.020 arasında,
        // gerçek konuşma 0.05+ üretir. 0.030 eşiği echo'yu filtreler, gerçek bargi-in'e izin verir.
        const threshold = isOutputPlayingRef.current ? SPEECH_THRESHOLD_DUCK : SPEECH_THRESHOLD

        if (rms > threshold) {
          if (!st.speaking) {
            st.speaking = true
            st.speechStartTime = Date.now()

            // Each speech segment gets its own local chunk array — no cross-session pollution
            const localChunks: Blob[] = []
            const recorder = new MediaRecorder(stream, { mimeType })
            st.mediaRecorder = recorder

            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) localChunks.push(e.data)
            }
            recorder.onstop = () => {
              const blob = new Blob(localChunks, { type: recorder.mimeType || mimeType })
              onSpeechEndRef.current(blob)
              st.mediaRecorder = null
            }
            recorder.start(100)  // emit ondataavailable every 100ms

            onSpeechStartRef.current()
          }
          if (st.silenceTimer) { clearTimeout(st.silenceTimer); st.silenceTimer = null }

        } else {
          if (st.speaking && !st.silenceTimer) {
            st.silenceTimer = setTimeout(() => {
              st.silenceTimer = null
              const elapsed = Date.now() - st.speechStartTime
              st.speaking = false

              const recorder = st.mediaRecorder
              if (!recorder || recorder.state === 'inactive') return

              if (elapsed < MIN_SPEECH_MS) {
                recorder.onstop = () => { st.mediaRecorder = null }  // discard
                recorder.stop()
                onMisfireRef.current?.()
              } else {
                recorder.stop()  // onstop set above fires onSpeechEnd
              }
            }, SILENCE_MS)
          }
        }
      }, VAD_INTERVAL_MS)

    } catch (err) {
      console.error('[VAD] start error:', err)
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      startVAD()
    } else {
      stopVAD()
    }
    return () => { stopVAD() }
  }, [enabled, startVAD, stopVAD])

  return { startVAD, stopVAD }
}
