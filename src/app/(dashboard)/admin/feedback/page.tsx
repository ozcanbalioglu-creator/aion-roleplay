import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'
import { maskPII } from '@/lib/pii-mask'
import { PageHeader } from '@/components/admin/PageHeader'
import { FeedbackFilters } from '@/components/admin/FeedbackFilters'
import { DebriefTranscriptCard } from '@/components/admin/DebriefTranscriptCard'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 15

interface FeedbackPageProps {
  searchParams: Promise<{
    tenantId?: string
    personaId?: string
    scenarioId?: string
    page?: string
  }>
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'super_admin') notFound()

  const { tenantId, personaId, scenarioId, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const serviceSupabase = await createServiceRoleClient()

  // Filter options + sessions (parallel)
  const [{ data: tenants }, { data: personas }, { data: scenarios }, sessionsResult] =
    await Promise.all([
      serviceSupabase.from('tenants').select('id, name').order('name'),
      serviceSupabase.from('personas').select('id, name').order('name'),
      serviceSupabase.from('scenarios').select('id, title').order('title'),
      (() => {
        let q = serviceSupabase
          .from('sessions')
          .select(
            'id, status, created_at, tenant_id, persona_id, scenario_id, personas(name), scenarios(title)',
            { count: 'exact' }
          )
          .in('status', ['debrief_active', 'debrief_completed'])
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)

        if (tenantId) q = q.eq('tenant_id', tenantId)
        if (personaId) q = q.eq('persona_id', personaId)
        if (scenarioId) q = q.eq('scenario_id', scenarioId)
        return q
      })(),
    ])

  const sessions = sessionsResult.data ?? []
  const totalCount = sessionsResult.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Debrief messages + existing feedbacks for these sessions
  const sessionIds = sessions.map((s) => s.id)

  const [messagesResult, feedbacksResult] = await Promise.all([
    sessionIds.length
      ? serviceSupabase
          .from('debrief_messages')
          .select('session_id, role, encrypted_content, phase, created_at')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    sessionIds.length
      ? serviceSupabase
          .from('persona_prompt_feedback')
          .select('id, session_id, feedback_text, status')
          .in('session_id', sessionIds)
      : Promise.resolve({ data: [] }),
  ])

  // Decrypt + mask PII, group by session
  const messagesBySession: Record<
    string,
    Array<{ role: string; content: string; phase: string }>
  > = {}
  for (const msg of messagesResult.data ?? []) {
    if (!messagesBySession[msg.session_id]) messagesBySession[msg.session_id] = []
    const raw = decrypt(msg.encrypted_content)
    const content = msg.role === 'user' ? maskPII(raw) : raw
    messagesBySession[msg.session_id].push({ role: msg.role, content, phase: msg.phase })
  }

  // Group feedbacks by session
  const feedbacksBySession: Record<
    string,
    Array<{ id: string; feedback_text: string; status: string }>
  > = {}
  for (const f of feedbacksResult.data ?? []) {
    if (!feedbacksBySession[f.session_id]) feedbacksBySession[f.session_id] = []
    feedbacksBySession[f.session_id].push(f)
  }

  const paginationParams = (p: number) => {
    const params = new URLSearchParams()
    if (tenantId) params.set('tenantId', tenantId)
    if (personaId) params.set('personaId', personaId)
    if (scenarioId) params.set('scenarioId', scenarioId)
    params.set('page', String(p))
    return `?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kullanıcı Geri Bildirimleri"
        description="Debrief konuşmalarını inceleyin ve persona prompt iyileştirme notları ekleyin"
      />

      <FeedbackFilters
        tenants={tenants ?? []}
        personas={personas ?? []}
        scenarios={scenarios ?? []}
        currentTenantId={tenantId}
        currentPersonaId={personaId}
        currentScenarioId={scenarioId}
      />

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            {tenantId || personaId || scenarioId
              ? 'Bu filtrelere uygun debrief seansı bulunamadı.'
              : 'Henüz tamamlanmış debrief seansı bulunmuyor.'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Toplam {totalCount} debrief seansı · Sayfa {page} / {Math.max(1, totalPages)}
          </p>

          <div className="space-y-4">
            {sessions.map((session) => (
              <DebriefTranscriptCard
                key={session.id}
                session={{
                  id: session.id,
                  status: session.status,
                  createdAt: session.created_at,
                  personaName: (session.personas as any)?.name ?? '—',
                  scenarioTitle: (session.scenarios as any)?.title ?? '—',
                  personaId: session.persona_id,
                  scenarioId: session.scenario_id,
                }}
                messages={messagesBySession[session.id] ?? []}
                feedbacks={feedbacksBySession[session.id] ?? []}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={paginationParams(p)}
                  className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                    p === page
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {p}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
