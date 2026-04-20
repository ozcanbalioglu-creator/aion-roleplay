import { notFound, redirect } from 'next/navigation'
import { getActiveSessionData } from '@/lib/queries/session.queries'
import { activateSessionAction } from '@/lib/actions/session.actions'
import { SessionClient } from '@/components/sessions/SessionClient'
import { VoiceSessionClient } from '@/components/sessions/VoiceSessionClient'
import { DroppedSessionRecovery } from '@/components/sessions/DroppedSessionRecovery'

interface SessionPageProps {
  params: Promise<{ id: string }>
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params

  const session = await getActiveSessionData(id)
  if (!session) notFound()

  // PENDING ise activate et
  if (session.status === 'pending') {
    const result = await activateSessionAction(id)
    if (!result.success) {
      // Aktivasyon hatası — sessions listesine yönlendir
      redirect('/dashboard/sessions?error=activation_failed')
    }
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

  // COMPLETED/CANCELLED/FAILED ise rapor sayfasına yönlendir
  if (['completed', 'cancelled', 'failed'].includes(session.status)) {
    redirect(`/dashboard/sessions/${id}/report`)
  }

  if (session.status !== 'active') notFound()

  const commonProps = {
    sessionId: id,
    personaName: (session.personas as any)?.name ?? 'Ekip Üyesi',
    personaTitle: (session.personas as any)?.title ?? '',
    scenarioTitle: (session.scenarios as any)?.title ?? '',
    estimatedDuration: (session.scenarios as any)?.estimated_duration_min ?? 20,
    initialPhase: 'opening' as const,
  }

  // session_mode branch
  if (session.session_mode === 'voice') {
    return <VoiceSessionClient {...commonProps} />
  }

  return <SessionClient {...commonProps} />
}
