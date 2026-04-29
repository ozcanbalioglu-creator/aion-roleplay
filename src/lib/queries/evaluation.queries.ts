import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export async function getSessionReport(sessionId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  // Service role: RLS nested join sorunlarını bypass eder.
  // Güvenlik: user_id filtresi .eq() ile hâlâ uygulanıyor.
  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id, status, started_at, completed_at, duration_seconds,
      personas(id, name, title, personality_type),
      scenarios(id, title, difficulty_level, target_skills),
      evaluations(
        id, overall_score, strengths, development_areas,
        coaching_note, manager_insight, status, created_at,
        dimension_scores(
          dimension_code, score, evidence_quotes, improvement_tip, rationale
        )
      )
    `)
    .eq('id', sessionId)
    .eq('user_id', currentUser.id)
    .maybeSingle()

  if (error || !data) {
    console.error('[getSessionReport] query failed', {
      sessionId,
      userId: currentUser.id,
      errCode: error?.code ?? null,
      errMsg: error?.message ?? null,
      hint: error?.hint ?? null,
      hasData: !!data,
    })
    return null
  }

  return {
    session: data,
    evaluation: (data.evaluations as any[])?.[0] ?? null,
    persona: data.personas as any,
    scenario: data.scenarios as any,
  }
}

// Kullanıcının bu persona ile geçmiş ortalama skoru (trend için)
export async function getPersonaScoreHistory(userId: string, personaId: string) {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('sessions')
    .select(`
      completed_at,
      evaluations(overall_score)
    `)
    .eq('user_id', userId)
    .eq('persona_id', personaId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true })
    .limit(10)

  return (data ?? [])
    .map((s) => ({
      date: s.completed_at,
      score: (s.evaluations as any[])?.[0]?.overall_score ?? null,
    }))
    .filter((s) => s.score !== null)
}
