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
      // Rubric metadata — boyut adı, açıklaması, sort, is_required
      // NOT: rubric_templates.tenant_id YOK — template'ler global, tenant assignment
      // tenants.rubric_template_id üzerinden yapılır. Bu yüzden tenant'ın atanmış
      // template'ini ÖNCE çekip rubric_dimensions'ı template_id ile filtreliyoruz.
      const codes = (dimRows ?? []).map((r) => r.dimension_code)
      const metaByCode: Record<string, { name: string | null; description: string | null; is_required: boolean; sort_order: number }> = {}

      if (codes.length > 0) {
        // Tenant'ın atanmış template'ini çek
        const { data: tenantRow } = await supabase
          .from('tenants')
          .select('rubric_template_id')
          .eq('id', currentUser.tenant_id)
          .maybeSingle()

        const templateId = tenantRow?.rubric_template_id ?? null

        // rubric_dimensions sorgusu — template_id varsa ona göre filter,
        // yoksa tüm eşleşen dimension_code'ları al (fallback)
        let metaQuery = supabase
          .from('rubric_dimensions')
          .select('dimension_code, name, description, is_required, sort_order, template_id')
          .in('dimension_code', codes)
          .eq('is_active', true)

        if (templateId) {
          metaQuery = metaQuery.eq('template_id', templateId)
        }

        const { data: metaRows, error: metaErr } = await metaQuery

        if (metaErr) {
          console.error('[getSessionReport] rubric_dimensions err:', metaErr)
        } else {
          // İlk eşleşeni al (template_id filter aktifse zaten tek satır gelir)
          for (const row of metaRows ?? []) {
            if (!metaByCode[row.dimension_code]) {
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
