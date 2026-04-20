'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { resumeSessionAction, closeDroppedSessionAction } from '@/lib/actions/session.actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { WifiOff, PlayCircle, X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DroppedSessionRecoveryProps {
  sessionId: string
  personaName: string
  scenarioTitle: string
  droppedAt: string | null
}

export function DroppedSessionRecovery({
  sessionId,
  personaName,
  scenarioTitle,
  droppedAt,
}: DroppedSessionRecoveryProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState<'resume' | 'close' | null>(null)

  const droppedMinutes = droppedAt
    ? Math.round((Date.now() - new Date(droppedAt).getTime()) / 60000)
    : null

  const handleResume = async () => {
    setIsLoading('resume')
    const result = await resumeSessionAction(sessionId)
    if (result.success) {
      toast.success('Seans başarıyla devam ettiriliyor')
      router.refresh()
    } else {
      toast.error(result.error ?? 'Seans devam ettirilemedi')
      setIsLoading(null)
    }
  }

  const handleClose = async () => {
    setIsLoading('close')
    const result = await closeDroppedSessionAction(sessionId)
    if (result.success) {
      toast.info('Seans kapatıldı')
      router.push('/dashboard/sessions')
    } else {
      toast.error('Seans kapatılamadı')
      setIsLoading(null)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4 animate-in fade-in zoom-in duration-500">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
      
      <Card className="w-full max-w-md border-amber-500/20 bg-card/80 backdrop-blur-xl shadow-2xl shadow-amber-500/10">
        <CardContent className="pt-10 pb-8 flex flex-col items-center gap-8 text-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative h-20 w-20 rounded-full bg-surface-container-low border border-amber-500/30 flex items-center justify-center shadow-inner">
              <WifiOff className="h-10 w-10 text-amber-500" />
            </div>
            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
              <AlertCircle className="h-4 w-4 text-black" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Seans Kesintiye Uğradı!</h2>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm leading-relaxed">
                <span className="font-semibold text-foreground">{personaName}</span> ile yürüttüğünüz 
                <br />
                <span className="text-amber-500 font-medium italic">&ldquo;{scenarioTitle}&rdquo;</span>
                <br /> 
                başlıklı seansın bağlantısı koptu.
              </p>
              {droppedMinutes !== null && (
                <p className="text-[10px] uppercase tracking-widest text-amber-500/70 font-semibold pt-2">
                  {droppedMinutes > 0 ? `${droppedMinutes} dakika önce kesildi` : 'Az önce kesildi'}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col w-full gap-3 px-2">
            <Button
              onClick={handleResume}
              disabled={isLoading !== null}
              className={cn(
                "w-full h-12 gap-3 bg-amber-500 hover:bg-amber-600 text-black font-bold transition-all duration-300",
                "shadow-lg shadow-amber-500/20 active:scale-95"
              )}
            >
              {isLoading === 'resume' ? (
                <div className="h-5 w-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <PlayCircle className="h-5 w-5" />
              )}
              Seansa Devam Et
            </Button>

            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading !== null}
              className="w-full h-11 gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X className="h-4 w-4" />
              Seansı Kaydetmeden Kapat
            </Button>
          </div>

          <div className="pt-4 border-t border-border/50 w-full">
            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
              * Devam ederseniz koçluk diyaloğu kaldığı yerden sürer ancak görsel geçmiş temizlenmiş olabilir.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
