'use client'

import { useRouter } from 'next/navigation'
import { PersonaMiniCard } from '@/components/sessions/PersonaMiniCard'
import { ScenarioCard } from '@/components/sessions/ScenarioCard'

interface ScenarioSelectionStepProps {
  persona: any
  scenarios: any[]
}

export function ScenarioSelectionStep({ persona, scenarios }: ScenarioSelectionStepProps) {
  const router = useRouter()

  const handleSelect = (scenarioId: string) => {
    router.push(`/dashboard/sessions/new?persona=${persona.id}&scenario=${scenarioId}`)
  }

  const handleBack = () => {
    router.push('/dashboard/sessions/new')
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={handleBack}
          className="mb-2 text-xs text-muted-foreground hover:text-foreground"
        >
          ← Personaya Geri Dön
        </button>
        <h2 className="text-xl font-semibold">Senaryo Seçin</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {persona.name} ile çalışacağınız senaryoyu seçin.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sol: Persona özeti */}
        <div className="lg:col-span-1">
          <PersonaMiniCard persona={persona} />
        </div>

        {/* Sağ: Senaryo listesi */}
        <div className="space-y-3 lg:col-span-2">
          {scenarios.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Bu persona için tanımlı senaryo bulunmuyor. Tenant Admin&apos;inize başvurun.
            </p>
          ) : (
            scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                onSelect={handleSelect}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
