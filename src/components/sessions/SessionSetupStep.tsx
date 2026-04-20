'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PersonaMiniCard } from '@/components/sessions/PersonaMiniCard'
import { createSessionAction } from '@/lib/actions/session.actions'
import { toast } from '@/lib/toast'
import { Loader2Icon, MessageSquareIcon, MicIcon, PlayIcon } from 'lucide-react'

interface SessionSetupStepProps {
  persona: any
  scenario: any
}

export function SessionSetupStep({ persona, scenario }: SessionSetupStepProps) {
  const router = useRouter()
  const [sessionMode, setSessionMode] = useState<'text' | 'voice'>('text')
  const [isPending, startTransition] = useTransition()

  const handleBack = () => {
    router.push(`/dashboard/sessions/new?persona=${persona.id}`)
  }

  const handleStart = () => {
    startTransition(async () => {
      const result = await createSessionAction({
        personaId: persona.id,
        scenarioId: scenario.id,
        sessionMode,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Seans başlatıldı!')
      router.push(`/dashboard/sessions/${result.sessionId}`)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={handleBack}
          className="mb-2 text-xs text-muted-foreground hover:text-foreground"
        >
          ← Senaryo Seçimine Geri Dön
        </button>
        <h2 className="text-xl font-semibold">Seansı Başlat</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Seçimlerinizi onaylayın ve seansı başlatın.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sol: Persona + Senaryo özeti */}
        <div className="space-y-4">
          <PersonaMiniCard persona={persona} />

          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Seçilen Senaryo
              </p>
              <p className="font-medium">{scenario.title}</p>
              <p className="text-sm text-muted-foreground">{scenario.description}</p>
              <p className="text-xs text-muted-foreground">
                Tahmini süre: ~{scenario.estimated_duration_min} dakika
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sağ: Mod seçimi + Başlat */}
        <div className="space-y-4">
          <div>
            <p className="mb-3 text-sm font-medium">Seans Modu</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Text Modu */}
              <button
                onClick={() => setSessionMode('text')}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all ${
                  sessionMode === 'text'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/30'
                }`}
              >
                <MessageSquareIcon
                  className={`h-6 w-6 ${
                    sessionMode === 'text' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span className="font-medium">Metin</span>
                <span className="text-xs text-muted-foreground">Yazarak konuş</span>
              </button>

              {/* Voice Modu */}
              <button
                onClick={() => setSessionMode('voice')}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all ${
                  sessionMode === 'voice'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/30'
                }`}
              >
                <MicIcon
                  className={`h-6 w-6 ${
                    sessionMode === 'voice' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span className="font-medium">Sesli</span>
                <span className="text-xs text-muted-foreground">Konuşarak iletişim</span>
              </button>
            </div>
          </div>

          {/* Senaryo bağlamı */}
          {scenario.context_setup && (
            <Card>
              <CardContent className="p-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Senaryo Bağlamı
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {scenario.context_setup}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Başlat Butonu */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleStart}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Seans oluşturuluyor...
              </>
            ) : (
              <>
                <PlayIcon className="mr-2 h-4 w-4" />
                Seansı Başlat
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Seans başladığında istediğiniz zaman duraklayabilir veya iptal edebilirsiniz.
          </p>
        </div>
      </div>
    </div>
  )
}
