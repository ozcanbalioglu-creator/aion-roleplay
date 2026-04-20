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
export async function getDashboardStats(period: DashboardPeriod = 'all') {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const supabase = await createServerClient()
  const since = getPeriodStart(period)

  let query = supabase
    .from('sessions')
    .select(`
      id, completed_at,
      evaluations(overall_score)
    `)
    .eq('user_id', currentUser.id)
    .eq('status', 'completed')

  if (since) query = query.gte('completed_at', since)

  const { data: sessions } = await query

  if (!sessions?.length) {
    return { totalSessions: 0, avgScore: null, bestScore: null, completionRate: null }
  }

  const scores = sessions
    .map((s) => (s.evaluations as any[])?.[0]?.overall_score)
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
    .in('status', ['completed', 'cancelled', 'dropped'])

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

// ── Skor trend (son 15 seans) ───────────────────────────────
export async function getScoreTrend(period: DashboardPeriod = 'all') {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const since = getPeriodStart(period)

  let query = supabase
    .from('sessions')
    .select(`
      id, completed_at,
      personas(name),
      evaluations(overall_score)
    `)
    .eq('user_id', currentUser.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true })
    .limit(15)

  if (since) query = query.gte('completed_at', since)

  const { data } = await query
  if (!data) return []

  return data
    .filter((s) => (s.evaluations as any[])?.[0]?.overall_score != null)
    .map((s, idx) => ({
      index: idx + 1,
      date: new Date(s.completed_at!).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
      score: (s.evaluations as any[])[0].overall_score as number,
      persona: (s.personas as any)?.name ?? '',
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
    .eq('status', 'completed')

  if (since) sessionQuery = sessionQuery.gte('completed_at', since)
  const { data: sessions } = await sessionQuery
  if (!sessions?.length) return []

  const sessionIds = sessions.map((s) => s.id)

  // Dimension scores
  const { data: dimScores } = await supabase
    .from('dimension_scores')
    .select('dimension_code, score')
    .in('session_id', sessionIds)

  if (!dimScores?.length) return []

  // Boyut adlarını getir
  const { data: dimMeta } = await supabase
    .from('rubric_dimensions')
    .select('dimension_code, dimension_name')

  const nameMap = new Map(dimMeta?.map((d) => [d.dimension_code, d.dimension_name]) ?? [])

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

// ── Persona başarı karşılaştırması ─────────────────────────
export async function getPersonaScoreComparison(period: DashboardPeriod = 'all') {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const since = getPeriodStart(period)

  let query = supabase
    .from('sessions')
    .select(`
      persona_id,
      personas(name),
      evaluations(overall_score)
    `)
    .eq('user_id', currentUser.id)
    .eq('status', 'completed')
    .limit(100)

  if (since) query = query.gte('completed_at', since)

  const { data } = await query
  if (!data) return []

  // Persona bazlı ortalama
  const personaMap = new Map<string, { name: string; scores: number[] }>()

  for (const s of data) {
    const score = (s.evaluations as any[])?.[0]?.overall_score as number | undefined
    if (score == null) continue

    const name = (s.personas as any)?.name ?? s.persona_id
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

  const { data } = await supabase
    .from('sessions')
    .select(`
      id, status, completed_at, duration_seconds,
      personas(name),
      scenarios(title),
      evaluations(overall_score)
    `)
    .eq('user_id', currentUser.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit)

  return (data as any[]) ?? []
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
    .eq('status', 'completed')
    .gte('completed_at', from)
    .lte('completed_at', to)

  if (!sessions?.length) return []

  const { data: dimScores } = await supabase
    .from('dimension_scores')
    .select('dimension_code, score')
    .in('session_id', sessions.map((s) => s.id))

  if (!dimScores?.length) return []

  const { data: dimMeta } = await supabase
    .from('rubric_dimensions')
    .select('dimension_code, dimension_name')

  const nameMap = new Map(dimMeta?.map((d) => [d.dimension_code, d.dimension_name]) ?? [])
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
