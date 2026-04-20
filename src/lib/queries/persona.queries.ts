import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import type { Persona } from '@/types/index'

export type PersonaRecommendationTag =
  | 'never_tried'      // Hiç tamamlanmamış seans
  | 'low_score'        // Ortalama skor < 3.0
  | 'stale'            // Son seans > 30 gün
  | 'other'            // Diğer

export interface PersonaWithRecommendation extends Persona {
  kpi_count: number
  completed_sessions: number
  avg_score: number | null
  last_completed_at: string | null
  // Öneri meta
  recommendation_tag: PersonaRecommendationTag
  recommendation_priority: number // 1=en yüksek
}

export async function getPersonasWithRecommendations(): Promise<PersonaWithRecommendation[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()

  // Tüm aktif personaları al
  const { data: personas } = await supabase
    .from('personas')
    .select(`
      id, name, title, department, personality_type, emotional_baseline,
      resistance_level, cooperativeness_level, is_active,
      trigger_behaviors,
      persona_kpis (kpi_code, kpi_name, value, unit, is_custom)
    `)
    .eq('tenant_id', currentUser.tenant_id)
    .eq('is_active', true)
    .order('name')

  if (!personas) return []

  // Kullanıcının persona istatistiklerini VIEW'den al
  const { data: stats } = await supabase
    .from('user_persona_stats')
    .select('persona_id, completed_sessions, avg_score, last_completed_at, never_completed')
    .eq('user_id', currentUser.id)

  const statsMap = new Map(stats?.map((s) => [s.persona_id, s]) ?? [])

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const enriched: PersonaWithRecommendation[] = personas.map((p) => {
    const stat = statsMap.get(p.id)
    const completed = stat?.completed_sessions ?? 0
    const avgScore = stat?.avg_score ?? null
    const lastCompleted = stat?.last_completed_at ? new Date(stat.last_completed_at) : null
    const kpiCount = (p.persona_kpis || []).length

    let tag: PersonaRecommendationTag
    let priority: number

    if (!stat || stat.never_completed) {
      tag = 'never_tried'
      priority = 1
    } else if (avgScore !== null && avgScore < 3.0) {
      tag = 'low_score'
      priority = 2
    } else if (lastCompleted && lastCompleted < thirtyDaysAgo) {
      tag = 'stale'
      priority = 3
    } else {
      tag = 'other'
      priority = 4
    }

    return {
      ...p,
      surname: (p as any).surname ?? null,
      experience_years: (p as any).experience_years ?? null,
      scenario_description: (p as any).scenario_description ?? null,
      coaching_context: (p as any).coaching_context ?? null,
      coaching_tips: (p as any).coaching_tips ?? [],
      kpi_count: kpiCount,
      completed_sessions: completed,
      avg_score: avgScore,
      last_completed_at: stat?.last_completed_at ?? null,
      recommendation_tag: tag,
      recommendation_priority: priority,
    }
  })

  // 4-priority sıralama: önce priority, aynı priority içinde avg_score artan (düşük skor önce)
  return enriched.sort((a, b) => {
    if (a.recommendation_priority !== b.recommendation_priority) {
      return a.recommendation_priority - b.recommendation_priority
    }
    // Aynı priority → avg_score düşük olan önce (gelişim fırsatı)
    const aScore = a.avg_score ?? 0
    const bScore = b.avg_score ?? 0
    return aScore - bScore
  })
}

export async function getPersonaDetail(personaId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('personas')
    .select(`
      id, name, title, department, age_range, experience_years,
      personality_type, emotional_baseline, resistance_level,
      cooperativeness_level, trigger_behaviors, is_active,
      persona_kpis (kpi_code, kpi_name, value, unit, is_custom)
    `)
    .eq('id', personaId)
    .eq('tenant_id', currentUser.tenant_id)
    .single()

  return data
}

export async function getScenariosForPersona(personaId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('scenarios')
    .select('id, title, description, difficulty_level, estimated_duration_min, target_skills, context_setup')
    .eq('persona_id', personaId)
    .eq('tenant_id', currentUser.tenant_id)
    .eq('is_active', true)
    .order('difficulty_level')

  return data ?? []
}