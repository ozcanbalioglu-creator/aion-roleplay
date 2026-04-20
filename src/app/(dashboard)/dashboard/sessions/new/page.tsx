import { getPersonasWithRecommendations, getPersonaDetail, getScenariosForPersona } from '@/lib/queries/persona.queries'
import { PersonaSelectionStep } from '@/components/sessions/PersonaSelectionStep'
import { ScenarioSelectionStep } from '@/components/sessions/ScenarioSelectionStep'
import { SessionSetupStep } from '@/components/sessions/SessionSetupStep'
import { NewSessionStepper } from '@/components/sessions/NewSessionStepper'
import { notFound } from 'next/navigation'

interface NewSessionPageProps {
  searchParams: Promise<{ persona?: string; scenario?: string }>
}

export default async function NewSessionPage({ searchParams }: NewSessionPageProps) {
  const { persona: personaId, scenario: scenarioId } = await searchParams

  // Adım belirleme
  let currentStep: 1 | 2 | 3 = 1
  if (personaId && scenarioId) currentStep = 3
  else if (personaId) currentStep = 2

  // Veri yükle (adıma göre)
  const personas = currentStep === 1 ? await getPersonasWithRecommendations() : []

  const personaDetail =
    currentStep >= 2 && personaId ? await getPersonaDetail(personaId) : null

  if (currentStep >= 2 && !personaDetail) notFound()

  const scenarios =
    currentStep >= 2 && personaId ? await getScenariosForPersona(personaId) : []

  const selectedScenario =
    currentStep === 3 && scenarioId
      ? scenarios.find((s) => s.id === scenarioId) ?? null
      : null

  if (currentStep === 3 && !selectedScenario) notFound()

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <NewSessionStepper currentStep={currentStep} />

      {currentStep === 1 && (
        <PersonaSelectionStep personas={personas} />
      )}

      {currentStep === 2 && personaDetail && (
        <ScenarioSelectionStep
          persona={personaDetail}
          scenarios={scenarios}
        />
      )}

      {currentStep === 3 && personaDetail && selectedScenario && (
        <SessionSetupStep
          persona={personaDetail}
          scenario={selectedScenario}
        />
      )}
    </div>
  )
}
