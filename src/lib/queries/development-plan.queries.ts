import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export interface DevelopmentPlan {
  id: string
  topStrengths: string[]
  priorityDevelopmentAreas: string[]
  trainingRecommendations: Array<{ topic: string; format: string; reason: string }>
  bookRecommendations: Array<{ title: string; author: string; reason: string }>
  coachNote: string | null
  generatedAt: string
  expiresAt: string
  sessionsConsidered: number
}

export async function getMyDevelopmentPlan(): Promise<DevelopmentPlan | null> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('user_development_plans')
    .select('*')
    .eq('user_id', currentUser.id)
    .gte('expires_at', new Date().toISOString())
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? mapPlan(data) : null
}

export async function getDevelopmentPlanForUser(targetUserId: string): Promise<DevelopmentPlan | null> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  // Erişim kontrolü
  const canView =
    currentUser.id === targetUserId ||
    ['super_admin', 'tenant_admin', 'hr_admin', 'hr_viewer', 'manager'].includes(currentUser.role)
  if (!canView) return null

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('user_development_plans')
    .select('*')
    .eq('user_id', targetUserId)
    .gte('expires_at', new Date().toISOString())
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? mapPlan(data) : null
}

function mapPlan(data: any): DevelopmentPlan {
  return {
    id: data.id,
    topStrengths: data.top_strengths ?? [],
    priorityDevelopmentAreas: data.priority_development_areas ?? [],
    trainingRecommendations: data.training_recommendations ?? [],
    bookRecommendations: data.book_recommendations ?? [],
    coachNote: data.coach_note ?? null,
    generatedAt: data.generated_at,
    expiresAt: data.expires_at,
    sessionsConsidered: (data.sessions_considered ?? []).length,
  }
}
