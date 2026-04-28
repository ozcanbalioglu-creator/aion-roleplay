'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function getTenantBadges() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('badges')
    .select('id, name, description, category, xp_reward, icon, criteria, is_active, created_at')
    .eq('tenant_id', currentUser.tenant_id)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function getTenantChallenges() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('challenges')
    .select('id, name, title, description, challenge_type, target_value, xp_reward, is_active, created_at')
    .eq('tenant_id', currentUser.tenant_id)
    .order('created_at', { ascending: false })

  return data ?? []
}

const BadgeSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().min(5).max(200),
  category: z.enum(['milestone', 'score', 'streak', 'level', 'custom']),
  xpReward: z.number().min(0).max(500),
  icon: z.string().max(4),
  criteriaType: z.enum(['session_count', 'min_score', 'streak', 'level', 'xp']),
  criteriaValue: z.number().min(0),
  code: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Sadece küçük harf, rakam ve tire').optional(),
})

const ChallengeSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().min(5).max(300),
  challengeType: z.enum(['complete_sessions', 'achieve_score', 'try_persona', 'try_scenario', 'streak_maintain']),
  targetValue: z.number().min(1),
  xpReward: z.number().min(0).max(500),
  period: z.enum(['weekly', 'monthly']).default('weekly'),
})

function deriveCodeFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50)
}

export async function createTenantBadgeAction(formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['tenant_admin', 'super_admin'].includes(currentUser.role)) {
    return { success: false, error: 'Yetkisiz' }
  }

  const rawName = formData.get('name') as string
  const rawCode = formData.get('code') as string | null

  const parsed = BadgeSchema.safeParse({
    name: rawName,
    description: formData.get('description'),
    category: formData.get('category'),
    xpReward: Number(formData.get('xpReward')),
    icon: formData.get('icon') ?? '🏅',
    criteriaType: formData.get('criteriaType'),
    criteriaValue: Number(formData.get('criteriaValue')),
    code: rawCode && rawCode.length > 0 ? rawCode : undefined,
  })

  if (!parsed.success) {
    return { success: false, error: 'Geçersiz veri' }
  }

  const { name, description, category, xpReward, icon, criteriaType, criteriaValue, code } = parsed.data
  const badgeCode = code && code.length > 0 ? code : deriveCodeFromName(name)
  const supabase = await createServerClient()

  const { error } = await supabase.from('badges').insert({
    code: badgeCode,
    name,
    description,
    category,
    criteria: { type: criteriaType, value: criteriaValue },
    xp_reward: xpReward,
    icon,
    is_active: true,
    tenant_id: currentUser.tenant_id,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/tenant/gamification')
  return { success: true }
}

export async function toggleBadgeStatusAction(badgeId: string, isActive: boolean) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['tenant_admin', 'super_admin'].includes(currentUser.role)) {
    return { success: false, error: 'Yetkisiz' }
  }
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('badges')
    .update({ is_active: !isActive })
    .eq('id', badgeId)
    .eq('tenant_id', currentUser.tenant_id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/tenant/gamification')
  return { success: true, newStatus: !isActive }
}

export async function deleteBadgeAction(badgeId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['tenant_admin', 'super_admin'].includes(currentUser.role)) {
    return { success: false, error: 'Yetkisiz' }
  }
  const supabase = await createServerClient()

  const { count } = await supabase
    .from('user_badges')
    .select('*', { count: 'exact', head: true })
    .eq('badge_id', badgeId)

  if (count && count > 0) {
    return {
      success: false,
      error: 'has_awards',
      message: 'Bu rozet kullanıcılara verilmiş, silinemez. Önce pasif yapın.',
    }
  }

  const { error } = await supabase
    .from('badges')
    .delete()
    .eq('id', badgeId)
    .eq('tenant_id', currentUser.tenant_id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/tenant/gamification')
  return { success: true, deleted: true }
}

export async function createTenantChallengeAction(formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['tenant_admin', 'super_admin'].includes(currentUser.role)) {
    return { success: false, error: 'Yetkisiz' }
  }

  const parsed = ChallengeSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    challengeType: formData.get('challengeType'),
    targetValue: Number(formData.get('targetValue')),
    xpReward: Number(formData.get('xpReward')),
    period: formData.get('period') ?? 'weekly',
  })

  if (!parsed.success) return { success: false, error: 'Geçersiz veri' }

  const supabase = await createServerClient()

  const { error } = await supabase.from('challenges').insert({
    name: parsed.data.title,
    title: parsed.data.title,
    description: parsed.data.description,
    challenge_type: parsed.data.challengeType,
    target_value: parsed.data.targetValue,
    xp_reward: parsed.data.xpReward,
    period: parsed.data.period,
    is_weekly: parsed.data.period === 'weekly',
    is_active: true,
    tenant_id: currentUser.tenant_id,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/tenant/gamification')
  return { success: true }
}

export async function toggleChallengeStatusAction(challengeId: string, isActive: boolean) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['tenant_admin', 'super_admin'].includes(currentUser.role)) {
    return { success: false, error: 'Yetkisiz' }
  }
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('challenges')
    .update({ is_active: !isActive })
    .eq('id', challengeId)
    .eq('tenant_id', currentUser.tenant_id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/tenant/gamification')
  return { success: true, newStatus: !isActive }
}

export async function deleteChallengeAction(challengeId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['tenant_admin', 'super_admin'].includes(currentUser.role)) {
    return { success: false, error: 'Yetkisiz' }
  }
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('challenges')
    .delete()
    .eq('id', challengeId)
    .eq('tenant_id', currentUser.tenant_id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/tenant/gamification')
  return { success: true, deleted: true }
}
