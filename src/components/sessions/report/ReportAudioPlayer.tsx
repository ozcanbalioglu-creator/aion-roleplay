'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ReportAudioPlayerProps {
  sessionId: string
}

export function ReportAudioPlayer({ sessionId }: ReportAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [status, setStatus] = useState<'checking' | 'none' | 'generating' | 'ready' | 'error'>('checking')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Mount'ta mevcut audio var mı kontrol et
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/report-audio`)
      .then((r) => r.json())
      .then(({ audioUrl }) => {
        if (audioUrl) {
          setAudioUrl(audioUrl)
          setStatus('ready')
        } else {
          setStatus('none')
        }
      })
      .catch(() => setStatus('none'))
  }, [sessionId])

  // Audio element event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return

    audio.src = audioUrl

    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => setDuration(audio.duration)
    const onEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnded)
    }
  }, [audioUrl])

  const handleGenerate = async () => {
    setStatus('generating')
    try {
      const res = await fetch(`/api/sessions/${sessionId}/report-audio`, { method: 'POST' })
      const { audioUrl, error } = await res.json()
      if (error || !audioUrl) {
        setStatus('error')
        return
      }
      setAudioUrl(audioUrl)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Number(e.target.value)
  }

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4">
      <audio ref={audioRef} preload="metadata" />

      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-muted-foreground flex-shrink-0" style={{ color: '#9d6bdf' }} />
        <span className="text-sm font-medium">Sesli Değerlendirme</span>
      </div>

      {status === 'checking' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Kontrol ediliyor...
        </div>
      )}

      {status === 'none' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Değerlendirmenizin sesli özetini oluşturmak için tıklayın.
          </p>
          <Button size="sm" onClick={handleGenerate} className="gap-2 text-xs">
            <Volume2 className="h-3.5 w-3.5" />
            Sesli Raporu Oluştur
          </Button>
        </div>
      )}

      {status === 'generating' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Sesli rapor hazırlanıyor... (30-60 saniye)
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-2">
          <p className="text-xs text-destructive">Ses oluşturulamadı. Lütfen tekrar deneyin.</p>
          <Button size="sm" variant="outline" onClick={handleGenerate} className="text-xs">
            Tekrar Dene
          </Button>
        </div>
      )}

      {status === 'ready' && (
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className={cn(
              'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
              'bg-primary/10 hover:bg-primary/20 border border-primary/20'
            )}
            style={{ color: '#9d6bdf' }}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 translate-x-0.5" />
            )}
          </button>

          <div className="flex-1 space-y-1">
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 accent-purple-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{fmt(currentTime)}</span>
              <span>{duration ? fmt(duration) : '--:--'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
