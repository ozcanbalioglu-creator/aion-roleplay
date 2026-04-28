import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export async function getUserSessions() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('sessions')
    .select(`
      id, status, started_at, completed_at, duration_seconds,
      cancelled_at, cancellation_reason,
      personas(id, name, title, personality_type),
      scenarios(id, title, difficulty_level),
      evaluations(overall_score)
    `)
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return data ?? []
}

export async function getWeeklySessionStatus(userId: string) {
  const supabase = await createServerClient()

  // Bu haftanın Pazartesi 00:00 (UTC)
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  monday.setUTCHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', monday.toISOString())

  return { completedThisWeek: count ?? 0, weekStart: monday }
}

// Aktif seans için gerekli tüm veriyi tek sorguda getir
export async function getActiveSessionData(sessionId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id, status, phase, session_mode, started_at, completed_at, cancelled_at, created_at,
      personas(id, name, title, department, experience_years, growth_type, personality_type, resistance_level, cooperativeness, difficulty, avatar_image_url, coaching_tips, coaching_context, trigger_behaviors, emotional_baseline),
      scenarios(id, title, difficulty_level, estimated_duration_min, target_skills, context_setup),
      evaluations(id, overall_score)
    `)
    .eq('id', sessionId)
    .eq('user_id', currentUser.id)
    .single()

  if (error || !data) {
    console.error('[getActiveSessionData] query failed | sessionId:', sessionId, '| userId:', currentUser.id, '| errCode:', error?.code, '| errMsg:', error?.message, '| hint:', error?.hint, '| details:', error?.details)
    return null
  }
  return data
}

// Seans mesaj sayısını getir (tarihçe göstergesi için)
export async function getSessionMessageCount(sessionId: string): Promise<number> {
  const supabase = await createServerClient()
  const { count } = await supabase
    .from('session_messages')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .neq('role', 'system')

  return count ?? 0
}

// Dashboard için aktif/pending seansı getir
export async function getActiveOrPendingSession() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('sessions')
    .select(`
      id, status,
      personas(name),
      scenarios(title)
    `)
    .eq('user_id', currentUser.id)
    .in('status', ['pending', 'active', 'dropped'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data ?? null
}
