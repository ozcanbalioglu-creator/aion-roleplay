import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export async function getSessionReport(sessionId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  // Service role: RLS bypass eder. Güvenlik: user_id filter explicit.
  const supabase = await createServiceRoleClient()

  // PARÇALI SORGU — Tek bir nested join'de bir kolon eksikse PostgREST tüm
  // sorguyu null'a çeviriyordu (schema cache stale olabiliyor). Parçalı
  // sorguda her tablo bağımsız okunur, bir tarafta hata olsa bile diğer
  // veriler gelir.

  // 1. Sessions ana row
  const { data: sessionRow, error: sessionErr } = await supabase
    .from('sessions')
    .select('id, status, persona_id, scenario_id, started_at, completed_at, duration_seconds')
    .eq('id', sessionId)
    .eq('user_id', currentUser.id)
    .maybeSingle()

  if (sessionErr) {
    console.error('[getSessionReport] sessions query error:', sessionErr)
    return null
  }
  if (!sessionRow) {
    console.warn('[getSessionReport] session bulunamadı:', { sessionId, userId: currentUser.id })
    return null
  }

  // 2-4. Persona, scenario, evaluation paralel
  const [personaRes, scenarioRes, evaluationRes] = await Promise.all([
    sessionRow.persona_id
      ? supabase
          .from('personas')
          .select('id, name, title, personality_type')
          .eq('id', sessionRow.persona_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sessionRow.scenario_id
      ? supabase
          .from('scenarios')
          .select('id, title, difficulty_level, target_skills')
          .eq('id', sessionRow.scenario_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('evaluations')
      .select('id, overall_score, strengths, development_areas, coaching_note, manager_insight, status, created_at')
      .eq('session_id', sessionId)
      .maybeSingle(),
  ])

  if (personaRes.error) console.error('[getSessionReport] persona err:', personaRes.error)
  if (scenarioRes.error) console.error('[getSessionReport] scenario err:', scenarioRes.error)
  if (evaluationRes.error) console.error('[getSessionReport] evaluation err:', evaluationRes.error)

  console.log(`[getSessionReport] sessionId=${sessionId} hasEval=${!!evaluationRes.data}`)

  // 5. Dimension scores (evaluation varsa) + rubric metadata
  type DimensionScoreRow = {
    dimension_code: string
    score: number
    evidence_quotes: string[] | null
    improvement_tip: string | null
    rationale: string | null
    name: string | null
    description: string | null
    is_required: boolean
    sort_order: number
  }
  let dimensionScores: DimensionScoreRow[] = []

  if (evaluationRes.data?.id) {
    const { data: dimRows, error: dimErr } = await supabase
      .from('dimension_scores')
      .select('dimension_code, score, evidence_quotes, improvement_tip, rationale')
      .eq('evaluation_id', evaluationRes.data.id)

    if (dimErr) {
      console.error('[getSessionReport] dimension_scores err:', dimErr)
    } else {
      // Rubric metadata: tenant_id zorunlu — boyut adı, açıklaması, sort, is_required
      const codes = (dimRows ?? []).map((r) => r.dimension_code)
      const metaByCode: Record<string, { name: string | null; description: string | null; is_required: boolean; sort_order: number }> = {}

      if (codes.length > 0) {
        const { data: metaRows, error: metaErr } = await supabase
          .from('rubric_dimensions')
          .select('dimension_code, name, description, is_required, sort_order, template_id, rubric_templates!inner(tenant_id, is_active)')
          .in('dimension_code', codes)

        if (metaErr) {
          console.error('[getSessionReport] rubric_dimensions err:', metaErr)
        } else {
          // Aynı kod birden fazla template'de olabilir; tenant_id eşleşeni veya global'i tercih et
          const userTenantId = currentUser.tenant_id
          for (const row of metaRows ?? []) {
            const tplTenant = (row as { rubric_templates?: { tenant_id?: string | null } | null }).rubric_templates?.tenant_id ?? null
            const isOwn = tplTenant === userTenantId
            const isGlobal = tplTenant === null
            const existing = metaByCode[row.dimension_code]
            // Önce kendi tenant'ı, sonra global, sonra ilk eşleşen
            if (!existing || isOwn || (!existing && isGlobal)) {
              metaByCode[row.dimension_code] = {
                name: row.name,
                description: row.description,
                is_required: !!row.is_required,
                sort_order: row.sort_order ?? 0,
              }
            }
          }
        }
      }

      dimensionScores = (dimRows ?? []).map((r) => ({
        dimension_code: r.dimension_code,
        score: r.score,
        evidence_quotes: r.evidence_quotes,
        improvement_tip: r.improvement_tip,
        rationale: r.rationale,
        name: metaByCode[r.dimension_code]?.name ?? null,
        description: metaByCode[r.dimension_code]?.description ?? null,
        is_required: metaByCode[r.dimension_code]?.is_required ?? false,
        sort_order: metaByCode[r.dimension_code]?.sort_order ?? 99,
      }))
    }
  }

  // Page rendering uyumu için evaluation objesine dimension_scores'u ekle
  const evaluation = evaluationRes.data
    ? { ...evaluationRes.data, dimension_scores: dimensionScores }
    : null

  return {
    session: sessionRow,
    evaluation,
    persona: personaRes.data,
    scenario: scenarioRes.data,
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
