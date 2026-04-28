import {
  getPersonasWithRecommendations,
  getPersonaDetail,
  getScenariosForPersona,
} from '@/lib/queries/persona.queries'
import { PersonaSelectionStep } from '@/components/sessions/PersonaSelectionStep'
import { CinematicPersonaStage } from '@/components/sessions/CinematicPersonaStage'
import { NewSessionStepper } from '@/components/sessions/NewSessionStepper'
import { notFound } from 'next/navigation'

interface NewSessionPageProps {
  searchParams: Promise<{ persona?: string; scenario?: string }>
}

export default async function NewSessionPage({ searchParams }: NewSessionPageProps) {
  const { persona: personaId } = await searchParams

  // Persona seçilmemişse → Adım 1
  // Persona seçilmişse → Adım 2 (sinematik sahne: senaryo seçimi + başlatma)
  const currentStep: 1 | 2 = personaId ? 2 : 1

  /* ── Adım 1: persona listesi ── */
  const personas = currentStep === 1 ? await getPersonasWithRecommendations() : []

  /* ── Adım 2: persona detayı + senaryolar ── */
  const personaDetail =
    currentStep === 2 && personaId ? await getPersonaDetail(personaId) : null

  if (currentStep === 2 && !personaDetail) notFound()

  const scenarios =
    currentStep === 2 && personaId ? await getScenariosForPersona(personaId) : []

  if (currentStep === 2 && personaDetail) {
    return (
      // Wrapper sahnenin dark gradient'ını taşır — sidebar bg-background gap'i kaybolur,
      // stepper ve stage aynı dark zemin üstünde seamless akar.
      <div
        className="flex flex-col flex-1 overflow-hidden"
        style={{
          background: 'linear-gradient(155deg, #1a1a2e 0%, #0f0e22 55%, #1c003a 100%)',
        }}
      >
        <div className="px-6 py-4 shrink-0">
          <NewSessionStepper currentStep={currentStep} />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <CinematicPersonaStage persona={personaDetail} scenarios={scenarios} />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl w-full px-6 py-8 space-y-8">
      <NewSessionStepper currentStep={currentStep} />
      <PersonaSelectionStep personas={personas} />
    </div>
  )
}
