import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export type ReportPeriod = 'week' | 'month' | 'all'

type SupabaseClient = Awaited<ReturnType<typeof createServerClient>>
type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
type ReportRole = CurrentUser['role']
type RelatedEvaluation = { overall_score: number | null }

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function getOverallScore(evaluations: unknown) {
  const evaluation = asArray(evaluations as RelatedEvaluation | RelatedEvaluation[] | null)[0]
  return typeof evaluation?.overall_score === 'number' ? evaluation.overall_score : null
}

function periodStart(period: ReportPeriod): string | null {
  if (period === 'all') return null
  const d = new Date()
  if (period === 'week') d.setUTCDate(d.getUTCDate() - 7)
  else d.setUTCMonth(d.getUTCMonth() - 1)
  return d.toISOString()
}

function canViewTenantUsers(role: ReportRole) {
  return role === 'hr_viewer' || role === 'tenant_admin' || role === 'super_admin'
}

async function getVisibleUserIds(supabase: SupabaseClient, currentUser: CurrentUser) {
  if (canViewTenantUsers(currentUser.role)) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', currentUser.tenant_id)
      .in('role', ['manager', 'user'])

    return data?.map((u) => u.id) ?? []
  }

  if (currentUser.role === 'manager') {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('manager_id', currentUser.id)
      .eq('tenant_id', currentUser.tenant_id)

    return data?.map((u) => u.id) ?? []
  }

  return []
}

export async function getTeamStats(period: ReportPeriod = 'all') {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const supabase = await createServerClient()
  const userIds = await getVisibleUserIds(supabase, currentUser)
  if (!userIds.length) {
    return { totalUsers: 0, activeUsers: 0, avgScore: null, totalSessions: 0, weeklyCompletionRate: null }
  }

  const since = periodStart(period)
  let sessionQuery = supabase
    .from('sessions')
    .select('id, user_id, evaluations(overall_score)')
    .in('user_id', userIds)
    .eq('status', 'completed')

  if (since) sessionQuery = sessionQuery.gte('completed_at', since)
  const { data: sessions } = await sessionQuery

  const activeUserIds = new Set(sessions?.map((s) => s.user_id) ?? [])
  const scores = (sessions ?? [])
    .map((s) => getOverallScore(s.evaluations))
    .filter((s): s is number => s != null)

  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null

  const weekAgo = new Date()
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7)
  const { data: weeklySessions } = await supabase
    .from('sessions')
    .select('user_id')
    .in('user_id', userIds)
    .eq('status', 'completed')
    .gte('completed_at', weekAgo.toISOString())

  const weeklyActiveIds = new Set(weeklySessions?.map((s) => s.user_id) ?? [])
  const weeklyCompletionRate = userIds.length
    ? Math.round((weeklyActiveIds.size / userIds.length) * 100)
    : null

  return {
    totalUsers: userIds.length,
    activeUsers: activeUserIds.size,
    avgScore,
    totalSessions: sessions?.length ?? 0,
    weeklyCompletionRate,
  }
}

export async function getTeamMembers(period: ReportPeriod = 'all') {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const userIds = await getVisibleUserIds(supabase, currentUser)
  if (!userIds.length) return []

  const since = periodStart(period)
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, role, created_at, gamification_profiles(xp_points, level)')
    .in('id', userIds)
    .order('full_name')

  if (!users?.length) return []

  return Promise.all(
    users.map(async (user) => {
      let query = supabase
        .from('sessions')
        .select('id, completed_at, evaluations(overall_score)')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      if (since) query = query.gte('completed_at', since)
      const { data: sessions } = await query

      const scores = (sessions ?? [])
        .map((s) => getOverallScore(s.evaluations))
        .filter((s): s is number => s != null)

      const avgScore = scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null

      const trend: 'up' | 'down' | 'stable' | null =
        scores.length >= 2
          ? scores[0] > scores[1]
            ? 'up'
            : scores[0] < scores[1]
              ? 'down'
              : 'stable'
          : null

      const gamification = Array.isArray(user.gamification_profiles)
        ? user.gamification_profiles[0]
        : user.gamification_profiles

      return {
        id: user.id,
        name: user.full_name ?? user.email,
        email: user.email,
        role: user.role,
        xpPoints: gamification?.xp_points ?? 0,
        level: gamification?.level ?? 1,
        sessionCount: sessions?.length ?? 0,
        avgScore,
        lastSessionAt: sessions?.[0]?.completed_at ?? null,
        trend,
      }
    })
  )
}

export async function getTeamLeaderboard(
  period: ReportPeriod = 'all',
  sortBy: 'score' | 'xp' | 'sessions' = 'score'
) {
  const members = await getTeamMembers(period)

  return members
    .filter((m) => m.sessionCount > 0)
    .sort((a, b) => {
      if (sortBy === 'score') return (b.avgScore ?? 0) - (a.avgScore ?? 0)
      if (sortBy === 'xp') return b.xpPoints - a.xpPoints
      return b.sessionCount - a.sessionCount
    })
    .map((m, i) => ({ ...m, rank: i + 1 }))
}

export async function getTeamDimensionAverages(period: ReportPeriod = 'all') {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const userIds = await getVisibleUserIds(supabase, currentUser)
  if (!userIds.length) return []

  const since = periodStart(period)
  let sessionQuery = supabase
    .from('sessions')
    .select('id')
    .in('user_id', userIds)
    .eq('status', 'completed')

  if (since) sessionQuery = sessionQuery.gte('completed_at', since)
  const { data: sessions } = await sessionQuery
  if (!sessions?.length) return []

  const { data: evaluations } = await supabase
    .from('evaluations')
    .select('id')
    .in('session_id', sessions.map((s) => s.id))

  if (!evaluations?.length) return []

  const { data: dimScores } = await supabase
    .from('dimension_scores')
    .select('dimension_code, score')
    .in('evaluation_id', evaluations.map((evaluation) => evaluation.id))

  if (!dimScores?.length) return []

  const { data: dimMeta } = await supabase
    .from('rubric_dimensions')
    .select('dimension_code, name')

  const nameMap = new Map(dimMeta?.map((d) => [d.dimension_code, d.name]) ?? [])
  const grouped = new Map<string, number[]>()

  for (const ds of dimScores) {
    const scores = grouped.get(ds.dimension_code) ?? []
    scores.push(ds.score)
    grouped.set(ds.dimension_code, scores)
  }

  return Array.from(grouped.entries())
    .map(([code, scores]) => ({
      code,
      dimension: nameMap.get(code) ?? code,
      avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      count: scores.length,
    }))
    .sort((a, b) => b.avg - a.avg)
}

export async function getUserReportData(targetUserId: string, period: ReportPeriod = 'all') {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const supabase = await createServerClient()
  const { data: targetUser } = await supabase
    .from('users')
    .select('id, full_name, email, role, tenant_id, manager_id, gamification_profiles(xp_points, level)')
    .eq('id', targetUserId)
    .single()

  if (!targetUser || targetUser.tenant_id !== currentUser.tenant_id) return null

  const canView =
    currentUser.role === 'hr_viewer' ||
    currentUser.role === 'hr_admin' ||
    currentUser.role === 'tenant_admin' ||
    currentUser.role === 'super_admin' ||
    (currentUser.role === 'manager' && targetUser.manager_id === currentUser.id)

  if (!canView) return null

  const since = periodStart(period)
  let sessionQuery = supabase
    .from('sessions')
    .select(`
      id, completed_at, duration_seconds, session_mode,
      personas(name, title),
      scenarios(title, difficulty),
      evaluations(
        overall_score, strengths, development_areas, coaching_note,
        dimension_scores(dimension_code, score, rationale, improvement_tip)
      )
    `)
    .eq('user_id', targetUserId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(20)

  if (since) sessionQuery = sessionQuery.gte('completed_at', since)
  const { data: sessions } = await sessionQuery

  const gamification = Array.isArray(targetUser.gamification_profiles)
    ? targetUser.gamification_profiles[0]
    : targetUser.gamification_profiles

  return {
    user: {
      ...targetUser,
      name: targetUser.full_name,
      xpPoints: gamification?.xp_points ?? 0,
      level: gamification?.level ?? 1,
    },
    sessions: sessions ?? [],
  }
}

export async function getTeamCSVData(period: ReportPeriod = 'all') {
  const members = await getTeamMembers(period)
  return members.map((m) => ({
    'Ad Soyad': m.name,
    'E-posta': m.email,
    'Tamamlanan Seans': m.sessionCount,
    'Ortalama Puan': m.avgScore ?? '',
    XP: m.xpPoints,
    Seviye: m.level,
    'Son Seans': m.lastSessionAt ? new Date(m.lastSessionAt).toLocaleDateString('tr-TR') : '',
  }))
}
