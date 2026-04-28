import {
  getPersonasWithRecommendations,
  getPersonaDetail,
  getScenariosForPersona,
} from '@/lib/queries/persona.queries'
import { PersonaSelectionStep } from '@/components/sessions/PersonaSelectionStep'
import { CinematicPersonaStage } from '@/components/sessions/CinematicPersonaStage'
import { NewSessionStepper } from '@/components/sessions/NewSessionStepper'
import { SubHeaderShell } from '@/components/sessions/SubHeaderShell'
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

  // Adım 2/3 — CinematicPersonaStage kendi SubHeaderShell+Stepper'ını render ediyor
  // (senaryo seçilince step 3'e geçmek için iç state'e ihtiyaç var).
  if (currentStep === 2 && personaDetail) {
    return (
      <div
        // h-[calc(100dvh-5rem)] — AppHeader yüksekliğini düş; sub-header + içerik bu hattın
        // içinde dağılır, sayfa-bazlı scroll yerine iç scroll oluşur.
        className="flex flex-col h-[calc(100dvh-5rem)] overflow-hidden"
        style={{
          background: 'linear-gradient(155deg, #1a1a2e 0%, #0f0e22 55%, #1c003a 100%)',
        }}
      >
        <CinematicPersonaStage persona={personaDetail} scenarios={scenarios} />
      </div>
    )
  }

  // Adım 1 — Persona listesi
  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] overflow-hidden">
      <SubHeaderShell>
        <NewSessionStepper currentStep={1} />
      </SubHeaderShell>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl w-full px-6 py-8 space-y-8">
          <PersonaSelectionStep personas={personas} />
        </div>
      </div>
    </div>
  )
}
