import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

const LEVEL_THRESHOLDS = [0, 300, 800, 1800, 3500]

export function getLevelProgress(xpPoints: number): {
  level: number
  currentLevelXP: number
  nextLevelXP: number
  progressPercent: number
} {
  let level = 1
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xpPoints >= LEVEL_THRESHOLDS[i]) { level = i + 1; break }
  }

  const currentLevelXP = LEVEL_THRESHOLDS[level - 1] ?? 0
  const nextLevelXP = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  const progressPercent = level >= 5
    ? 100
    : Math.round(((xpPoints - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100)

  return { level, currentLevelXP, nextLevelXP, progressPercent }
}

export async function getGamificationProfile() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const supabase = await createServerClient()

  const { data } = await supabase
    .from('gamification_profiles')
    .select('xp_points, level, current_streak, weekly_session_count')
    .eq('user_id', currentUser.id)
    .single()

  if (!data) return null

  return {
    ...data,
    ...getLevelProgress(data.xp_points as number),
  }
}

export async function getWeeklyChallenges() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const now = new Date().toISOString()

  const { data } = await supabase
    .from('user_challenges')
    .select(`
      id, progress, target_value, status,
      challenges(title, description, challenge_type, xp_reward)
    `)
    .eq('user_id', currentUser.id)
    .eq('status', 'active')
    .gt('expires_at', now)
    .order('assigned_at', { ascending: true })

  return (data as any[]) ?? []
}

export async function getUserBadges(limit = 50) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()

  const { data } = await supabase
    .from('user_badges')
    .select(`
      id, earned_at,
      badges(badge_code, name, description, category, icon, xp_reward)
    `)
    .eq('user_id', currentUser.id)
    .order('earned_at', { ascending: false })
    .limit(limit)

  return (data as any[]) ?? []
}

export async function getXPHistory(limit = 20) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()

  const { data } = await supabase
    .from('point_transactions')
    .select('points, transaction_type, description, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data as any[]) ?? []
}
