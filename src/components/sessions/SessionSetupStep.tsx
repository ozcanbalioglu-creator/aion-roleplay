'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PersonaMiniCard } from '@/components/sessions/PersonaMiniCard'
import { createSessionAction } from '@/lib/actions/session.actions'
import { toast } from '@/lib/toast'
import { Loader2Icon, MicIcon } from 'lucide-react'

interface SessionSetupStepProps {
  persona: any
  scenario: any
}

export function SessionSetupStep({ persona, scenario }: SessionSetupStepProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleBack = () => {
    router.push(`/dashboard/sessions/new?persona=${persona.id}`)
  }

  const handleStart = () => {
    startTransition(async () => {
      const result = await createSessionAction({
        personaId: persona.id,
        scenarioId: scenario.id,
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

        {/* Sağ: Başlat */}
        <div className="space-y-4">
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
                <MicIcon className="mr-2 h-4 w-4" />
                Sesli Seansı Başlat
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Seans sesli modda başlar. İstediğiniz zaman bitirebilirsiniz.
          </p>
        </div>
      </div>
    </div>
  )
}
