import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export type DashboardPeriod = 'week' | 'month' | 'all'

function getPeriodStart(period: DashboardPeriod): string | null {
  if (period === 'all') return null
  const now = new Date()
  if (period === 'week') {
    const d = new Date(now)
    d.setUTCDate(now.getUTCDate() - 7)
    return d.toISOString()
  }
  const d = new Date(now)
  d.setUTCMonth(now.getUTCMonth() - 1)
  return d.toISOString()
}

// ── Özet istatistikler ──────────────────────────────────────
// PARÇALI SORGU pattern'i (EVAL-SCHEMA-MISMATCH-001 öğretisi):
// PostgREST nested join (evaluations(...)) bazen RLS context'inde sessizce
// null dönüyor — sessions geliyor ama evaluations array'i boş kalıyor.
// Çözüm: önce sessions çek, ID'lerle evaluations'ı ayrı çek, kodda eşle.
export async function getDashboardStats(period: DashboardPeriod = 'all') {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const supabase = await createServerClient()
  const since = getPeriodStart(period)

  // 1. Sessions
  let sessionsQuery = supabase
    .from('sessions')
    .select('id, completed_at')
    .eq('user_id', currentUser.id)
    .in('status', ['completed', 'debrief_completed'])

  if (since) sessionsQuery = sessionsQuery.gte('completed_at', since)
  const { data: sessions } = await sessionsQuery

  if (!sessions?.length) {
    return { totalSessions: 0, avgScore: null, bestScore: null, completionRate: null }
  }

  // 2. Evaluations (ayrı sorgu, manuel join)
  const sessionIds = sessions.map((s) => s.id)
  const { data: evals } = await supabase
    .from('evaluations')
    .select('session_id, overall_score, status')
    .in('session_id', sessionIds)
    .eq('status', 'completed')

  const scores = (evals ?? [])
    .map((e) => e.overall_score)
    .filter((s): s is number => s != null)

  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null

  const bestScore = scores.length ? Math.max(...scores) : null

  // Completion rate: tamamlanan / (tamamlanan + iptal + dropped)
  let totalQuery = supabase
    .from('sessions')
    .select('status', { count: 'exact', head: true })
    .eq('user_id', currentUser.id)
    .in('status', ['completed', 'debrief_completed', 'cancelled', 'dropped'])

  if (since) totalQuery = totalQuery.gte('created_at', since)
  const { count: totalAttempts } = await totalQuery

  const completionRate =
    totalAttempts && totalAttempts > 0
      ? Math.round((sessions.length / totalAttempts) * 100)
      : null

  return {
    totalSessions: sessions.length,
    avgScore,
    bestScore,
    completionRate,
  }
}

// ── Skor trend (son 15 seans) — PARÇALI SORGU ──────────────
export async function getScoreTrend(period: DashboardPeriod = 'all') {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const since = getPeriodStart(period)

  // 1. Sessions
  let sessionsQuery = supabase
    .from('sessions')
    .select('id, completed_at, persona_id')
    .eq('user_id', currentUser.id)
    .in('status', ['completed', 'debrief_completed'])
    .order('completed_at', { ascending: true })
    .limit(15)

  if (since) sessionsQuery = sessionsQuery.gte('completed_at', since)
  const { data: sessions } = await sessionsQuery
  if (!sessions?.length) return []

  // 2. Evaluations + 3. Personas (paralel, ayrı sorgular)
  const sessionIds = sessions.map((s) => s.id)
  const personaIds = [...new Set(sessions.map((s) => s.persona_id).filter(Boolean))]

  const [evalsRes, personasRes] = await Promise.all([
    supabase
      .from('evaluations')
      .select('session_id, overall_score')
      .in('session_id', sessionIds)
      .eq('status', 'completed'),
    personaIds.length > 0
      ? supabase.from('personas').select('id, name').in('id', personaIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const scoreBySession = new Map(
    (evalsRes.data ?? []).map((e) => [e.session_id, e.overall_score as number]),
  )
  const personaName = new Map(
    (personasRes.data ?? []).map((p) => [p.id, p.name]),
  )

  return sessions
    .filter((s) => scoreBySession.has(s.id))
    .map((s, idx) => ({
      index: idx + 1,
      date: new Date(s.completed_at!).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
      score: scoreBySession.get(s.id)!,
      persona: personaName.get(s.persona_id) ?? '',
    }))
}

// ── Boyut bazlı ortalama performans ────────────────────────
export async function getDimensionAverages(period: DashboardPeriod = 'all') {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const since = getPeriodStart(period)

  // Tamamlanan seans ID'leri
  let sessionQuery = supabase
    .from('sessions')
    .select('id')
    .eq('user_id', currentUser.id)
    .in('status', ['completed', 'debrief_completed'])

  if (since) sessionQuery = sessionQuery.gte('completed_at', since)
  const { data: sessions } = await sessionQuery
  if (!sessions?.length) return []

  const sessionIds = sessions.map((s) => s.id)

  // Dimension scores — session_id kolonu YOK, evaluation_id üzerinden join lazım.
  // Önce sessionIds'ye karşılık gelen evaluation_id'leri çek.
  const { data: evals } = await supabase
    .from('evaluations')
    .select('id')
    .in('session_id', sessionIds)

  const evaluationIds = evals?.map((e) => e.id) ?? []
  if (!evaluationIds.length) return []

  const { data: dimScores } = await supabase
    .from('dimension_scores')
    .select('dimension_code, score')
    .in('evaluation_id', evaluationIds)

  if (!dimScores?.length) return []

  // Boyut adlarını getir — kolon adı `name` (migration 026)
  const { data: dimMeta } = await supabase
    .from('rubric_dimensions')
    .select('dimension_code, name')

  const nameMap = new Map(dimMeta?.map((d) => [d.dimension_code, d.name]) ?? [])

  // Kod bazlı gruplama ve ortalama
  const grouped = new Map<string, number[]>()
  for (const ds of dimScores) {
    const arr = grouped.get(ds.dimension_code) ?? []
    arr.push(ds.score)
    grouped.set(ds.dimension_code, arr)
  }

  return Array.from(grouped.entries()).map(([code, scores]) => ({
    dimension: nameMap.get(code) ?? code,
    code,
    avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
    count: scores.length,
  }))
}

// ── Persona başarı karşılaştırması — PARÇALI SORGU ─────────
export async function getPersonaScoreComparison(period: DashboardPeriod = 'all') {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const since = getPeriodStart(period)

  // 1. Sessions
  let sessionsQuery = supabase
    .from('sessions')
    .select('id, persona_id')
    .eq('user_id', currentUser.id)
    .in('status', ['completed', 'debrief_completed'])
    .limit(100)

  if (since) sessionsQuery = sessionsQuery.gte('completed_at', since)
  const { data: sessions } = await sessionsQuery
  if (!sessions?.length) return []

  // 2. Evaluations + 3. Personas paralel
  const sessionIds = sessions.map((s) => s.id)
  const personaIds = [...new Set(sessions.map((s) => s.persona_id).filter(Boolean))]

  const [evalsRes, personasRes] = await Promise.all([
    supabase
      .from('evaluations')
      .select('session_id, overall_score')
      .in('session_id', sessionIds)
      .eq('status', 'completed'),
    personaIds.length > 0
      ? supabase.from('personas').select('id, name').in('id', personaIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const scoreBySession = new Map(
    (evalsRes.data ?? []).map((e) => [e.session_id, e.overall_score as number]),
  )
  const personaName = new Map(
    (personasRes.data ?? []).map((p) => [p.id, p.name]),
  )

  // Persona bazlı ortalama
  const personaMap = new Map<string, { name: string; scores: number[] }>()

  for (const s of sessions) {
    const score = scoreBySession.get(s.id)
    if (score == null) continue

    const name = personaName.get(s.persona_id) ?? s.persona_id
    let entry = personaMap.get(s.persona_id)
    if (!entry) {
      entry = { name, scores: [] }
      personaMap.set(s.persona_id, entry)
    }
    entry.scores.push(score)
  }

  return Array.from(personaMap.values())
    .map((p) => ({
      name: p.name,
      avg: Math.round((p.scores.reduce((a, b) => a + b, 0) / p.scores.length) * 10) / 10,
      sessions: p.scores.length,
    }))
    .sort((a, b) => b.avg - a.avg)
}

// ── Son seanslar (hızlı liste) ──────────────────────────────
export async function getRecentSessions(limit = 5) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()

  // PARÇALI SORGU — RLS context'inde nested evaluations join'i null döndüğü için
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, status, completed_at, duration_seconds, persona_id, scenario_id')
    .eq('user_id', currentUser.id)
    .in('status', ['completed', 'debrief_completed'])
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (!sessions?.length) return []

  const sessionIds = sessions.map((s) => s.id)
  const personaIds = [...new Set(sessions.map((s) => s.persona_id).filter(Boolean))]
  const scenarioIds = [...new Set(sessions.map((s) => s.scenario_id).filter(Boolean))]

  const [evalsRes, personasRes, scenariosRes] = await Promise.all([
    supabase
      .from('evaluations')
      .select('session_id, overall_score')
      .in('session_id', sessionIds)
      .eq('status', 'completed'),
    personaIds.length
      ? supabase.from('personas').select('id, name').in('id', personaIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    scenarioIds.length
      ? supabase.from('scenarios').select('id, title').in('id', scenarioIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ])

  const scoreBy = new Map((evalsRes.data ?? []).map((e) => [e.session_id, e.overall_score]))
  const personaName = new Map((personasRes.data ?? []).map((p) => [p.id, p.name]))
  const scenarioTitle = new Map((scenariosRes.data ?? []).map((s) => [s.id, s.title]))

  // RecentSessionsList şu shape'i bekliyor: { evaluations: [{overall_score}], personas:{name}, scenarios:{title} }
  return sessions.map((s) => ({
    ...s,
    evaluations: scoreBy.has(s.id) ? [{ overall_score: scoreBy.get(s.id) }] : [],
    personas: { name: personaName.get(s.persona_id) ?? null },
    scenarios: { title: scenarioTitle.get(s.scenario_id) ?? null },
  }))
}

// ── Boyut delta (bu ay vs geçen ay) ─────────────────────────
export async function getDimensionDelta() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const now = new Date()

  const thisMonthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1).toISOString()
  const lastMonthEnd = new Date(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59).toISOString()

  const [thisMonth, lastMonth] = await Promise.all([
    getDimensionAveragesForRange(currentUser.id, thisMonthStart, now.toISOString()),
    getDimensionAveragesForRange(currentUser.id, lastMonthStart, lastMonthEnd),
  ])

  const lastMonthMap = new Map(lastMonth.map((d) => [d.code, d.avg]))

  return thisMonth.map((d) => ({
    ...d,
    prevAvg: lastMonthMap.get(d.code) ?? null,
    delta: lastMonthMap.has(d.code) ? d.avg - lastMonthMap.get(d.code)! : null,
  }))
}

async function getDimensionAveragesForRange(userId: string, from: string, to: string) {
  const supabase = await createServerClient()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['completed', 'debrief_completed'])
    .gte('completed_at', from)
    .lte('completed_at', to)

  if (!sessions?.length) return []

  const sessionIds = sessions.map((s) => s.id)
  const { data: evals } = await supabase
    .from('evaluations')
    .select('id')
    .in('session_id', sessionIds)

  const evaluationIds = evals?.map((e) => e.id) ?? []
  if (!evaluationIds.length) return []

  const { data: dimScores } = await supabase
    .from('dimension_scores')
    .select('dimension_code, score')
    .in('evaluation_id', evaluationIds)

  if (!dimScores?.length) return []

  const { data: dimMeta } = await supabase
    .from('rubric_dimensions')
    .select('dimension_code, name')

  const nameMap = new Map(dimMeta?.map((d) => [d.dimension_code, d.name]) ?? [])
  const grouped = new Map<string, number[]>()

  for (const ds of dimScores) {
    const arr = grouped.get(ds.dimension_code) ?? []
    arr.push(ds.score)
    grouped.set(ds.dimension_code, arr)
  }

  return Array.from(grouped.entries()).map(([code, scores]) => ({
    code,
    dimension: nameMap.get(code) ?? code,
    avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
  }))
}
