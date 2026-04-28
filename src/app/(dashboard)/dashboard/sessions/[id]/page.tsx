import { notFound, redirect } from 'next/navigation'
import { getActiveSessionData } from '@/lib/queries/session.queries'
import { activateSessionAction } from '@/lib/actions/session.actions'
import { getCurrentUser } from '@/lib/auth'
import { VoiceSessionClient } from '@/components/sessions/VoiceSessionClient'
import { DroppedSessionRecovery } from '@/components/sessions/DroppedSessionRecovery'
import { DebriefSessionClient } from '@/components/sessions/DebriefSessionClient'

interface SessionPageProps {
  params: Promise<{ id: string }>
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params

  const [session, currentUser] = await Promise.all([
    getActiveSessionData(id),
    getCurrentUser(),
  ])
  if (!session) notFound()

  const firstName = currentUser?.full_name?.split(' ')[0] ?? ''

  // PENDING ise activate et, sonra sayfayı yenile (local session.status güncel değil)
  if (session.status === 'pending') {
    const result = await activateSessionAction(id)
    console.log('[SessionPage] activateSessionAction result:', result)
    if (!result.success) {
      console.error('[SessionPage] activation failed:', result.error)
      redirect(`/dashboard/sessions?error=${encodeURIComponent(result.error)}`)
    }
    redirect(`/dashboard/sessions/${id}`)
  }

  // DROPPED durumu
  if (session.status === 'dropped') {
    return (
      <DroppedSessionRecovery
        sessionId={id}
        personaName={(session.personas as any)?.name ?? 'Ekip Üyesi'}
        scenarioTitle={(session.scenarios as any)?.title ?? ''}
        droppedAt={session.cancelled_at ?? null}
      />
    )
  }

  // DEBRIEF aktif
  if (session.status === 'debrief_active') {
    return (
      <DebriefSessionClient
        sessionId={id}
        personaName={(session.personas as any)?.name ?? 'Ekip Üyesi'}
        scenarioTitle={(session.scenarios as any)?.title ?? ''}
        userName={firstName}
      />
    )
  }

  // CANCELLED — yarıda kesilen seansta rapor yok, listeye dön (eskiden /report'a gidip 404 oluyordu)
  if (session.status === 'cancelled') {
    redirect(`/dashboard/sessions?cancelled=${id}`)
  }

  // COMPLETED/FAILED/DEBRIEF_COMPLETED ise rapor sayfasına yönlendir
  if (['completed', 'failed', 'debrief_completed'].includes(session.status)) {
    redirect(`/dashboard/sessions/${id}/report`)
  }

  if (session.status !== 'active') notFound()

  const persona = session.personas as any
  const scenario = session.scenarios as any
  const coachingTips: string[] = Array.isArray(persona?.coaching_tips)
    ? persona.coaching_tips.filter(Boolean)
    : (typeof persona?.coaching_tips === 'string' && persona.coaching_tips ? [persona.coaching_tips] : [])
  const triggerBehaviors: string[] = Array.isArray(persona?.trigger_behaviors)
    ? persona.trigger_behaviors.filter(Boolean)
    : []

  const commonProps = {
    sessionId: id,
    personaName: persona?.name ?? 'Ekip Üyesi',
    personaTitle: persona?.title ?? '',
    personaDepartment: (persona?.department as string | null) ?? null,
    personaAvatarUrl: (persona?.avatar_image_url as string | null) ?? null,
    personaExperienceYears: (persona?.experience_years as number | null) ?? null,
    personaGrowthType: (persona?.growth_type as string | null) ?? null,
    personaEmotionalBaseline: (persona?.emotional_baseline as string | null) ?? null,
    personaDifficulty: (persona?.difficulty as number | null) ?? null,
    personaResistanceLevel: (persona?.resistance_level as number | null) ?? null,
    personaCooperativeness: (persona?.cooperativeness as number | null) ?? null,
    coachingTips,
    coachingContext: (persona?.coaching_context as string | null) ?? null,
    triggerBehaviors,
    scenarioTitle: scenario?.title ?? '',
    scenarioContext: (scenario?.context_setup as string | null) ?? null,
    estimatedDuration: scenario?.estimated_duration_min ?? 20,
    initialPhase: 'opening' as const,
    userName: firstName,
  }

  return <VoiceSessionClient {...commonProps} />
}
