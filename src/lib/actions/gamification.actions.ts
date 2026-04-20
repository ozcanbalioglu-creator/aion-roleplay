'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const BadgeSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().min(5).max(200),
  category: z.enum(['milestone', 'score', 'streak', 'level', 'custom']),
  xpReward: z.number().min(0).max(500),
  icon: z.string().max(4),
  criteriaType: z.enum(['session_count', 'min_score', 'streak', 'level', 'xp']),
  criteriaValue: z.number().min(0),
})

const ChallengeSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().min(5).max(300),
  challengeType: z.enum(['complete_sessions', 'achieve_score', 'try_persona', 'streak_maintain']),
  targetValue: z.number().min(1),
  xpReward: z.number().min(0).max(500),
})

export async function createTenantBadgeAction(formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['tenant_admin', 'super_admin'].includes(currentUser.role)) {
    return { success: false, error: 'Yetkisiz' }
  }

  const parsed = BadgeSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    category: formData.get('category'),
    xpReward: Number(formData.get('xpReward')),
    icon: formData.get('icon') ?? '🏅',
    criteriaType: formData.get('criteriaType'),
    criteriaValue: Number(formData.get('criteriaValue')),
  })

  if (!parsed.success) {
    console.error('Badge validation failed:', parsed.error)
    return { success: false, error: 'Geçersiz veri' }
  }

  const { name, description, category, xpReward, icon, criteriaType, criteriaValue } = parsed.data
  const supabase = await createServerClient()

  const badgeCode = `tenant_${currentUser.tenant_id}_${Date.now()}`

  const { error } = await supabase.from('badges').insert({
    badge_code: badgeCode,
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
  })

  if (!parsed.success) return { success: false, error: 'Geçersiz veri' }

  const supabase = await createServerClient()

  const { error } = await supabase.from('challenges').insert({
    title: parsed.data.title,
    description: parsed.data.description,
    challenge_type: parsed.data.challengeType,
    target_value: parsed.data.targetValue,
    xp_reward: parsed.data.xpReward,
    is_weekly: true,
    is_active: true,
    tenant_id: currentUser.tenant_id,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/tenant/gamification')
  return { success: true }
}
