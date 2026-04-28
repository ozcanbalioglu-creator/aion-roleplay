'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

const ScenarioSchema = z.object({
  title: z.string().min(3, 'Başlık en az 3 karakter olmalı'),
  description: z.string().min(10, 'Açıklama en az 10 karakter olmalı'),
  persona_id: z.string().uuid('Geçerli bir persona seçin'),
  target_skill_codes: z.array(z.string()).default([]),
  difficulty_level: z.coerce.number().min(1).max(5),
  estimated_duration_min: z.coerce.number().min(5).max(60).default(15),
  sector_tags: z.array(z.string()).default([]),
  role_context: z.string().optional(),
})

export async function createScenarioAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const raw = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    persona_id: formData.get('persona_id') as string,
    target_skill_codes: JSON.parse((formData.get('target_skill_codes') as string) || '[]'),
    difficulty_level: formData.get('difficulty') ?? formData.get('difficulty_level'),
    estimated_duration_min: formData.get('estimated_duration_min') ?? 15,
    sector_tags: JSON.parse((formData.get('sector_tags') as string) || '[]'),
    role_context: (formData.get('role_context') as string) || undefined,
  }

  const parsed = ScenarioSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.from('scenarios').insert({
    title: parsed.data.title,
    description: parsed.data.description,
    persona_id: parsed.data.persona_id,
    target_skills: parsed.data.target_skill_codes,
    difficulty_level: parsed.data.difficulty_level,
    estimated_duration_min: parsed.data.estimated_duration_min,
    sector_tags: parsed.data.sector_tags,
    role_context: parsed.data.role_context || null,
    is_active: true,
    tenant_id: user.role === 'super_admin' ? null : user.tenant_id,
    created_by: user.id,
  })

  if (error) return { error: 'Senaryo oluşturulamadı: ' + error.message }

  revalidatePath('/tenant/scenarios')
  return { success: 'Senaryo başarıyla oluşturuldu.' }
}

export async function updateScenarioAction(scenarioId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const raw = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    persona_id: formData.get('persona_id') as string,
    target_skill_codes: JSON.parse((formData.get('target_skill_codes') as string) || '[]'),
    difficulty_level: formData.get('difficulty') ?? formData.get('difficulty_level'),
    estimated_duration_min: formData.get('estimated_duration_min') ?? 15,
    sector_tags: JSON.parse((formData.get('sector_tags') as string) || '[]'),
    role_context: (formData.get('role_context') as string) || undefined,
  }

  const parsed = ScenarioSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('scenarios')
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      persona_id: parsed.data.persona_id,
      target_skills: parsed.data.target_skill_codes,
      difficulty_level: parsed.data.difficulty_level,
      estimated_duration_min: parsed.data.estimated_duration_min,
      sector_tags: parsed.data.sector_tags,
      role_context: parsed.data.role_context ?? null,
    })
    .eq('id', scenarioId)

  if (error) return { error: 'Senaryo güncellenemedi.' }

  revalidatePath('/tenant/scenarios')
  return { success: 'Senaryo başarıyla güncellendi.' }
}

export async function toggleScenarioStatusAction(scenarioId: string, isActive: boolean) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const service = createServiceClient()
  const { error } = await service
    .from('scenarios')
    .update({ is_active: !isActive })
    .eq('id', scenarioId)

  if (error) return { error: 'Durum güncellenemedi.' }

  revalidatePath('/tenant/scenarios')
  return { success: `Senaryo ${!isActive ? 'aktifleştirildi' : 'pasifleştirildi'}.` }
}

export async function getScenarioById(scenarioId: string) {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('scenarios')
    .select('*')
    .eq('id', scenarioId)
    .single()

  return data
}

export async function getScenarios() {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = createServiceClient()

  if (user.role === 'super_admin') {
    const { data, error } = await supabase
      .from('scenarios')
      .select('*, personas(name, personality_type, avatar_image_url)')
      .order('created_at', { ascending: false })
    if (error) return []
    return data
  }

  // tenant_admin ve diğerleri: sadece bu tenant'a atanmış personaların senaryoları
  const { data: mappings } = await supabase
    .from('persona_tenant_mapping')
    .select('persona_id')
    .eq('tenant_id', user.tenant_id)
    .eq('is_active', true)

  const personaIds = mappings?.map((m: { persona_id: string }) => m.persona_id) ?? []

  if (personaIds.length === 0) return []

  const { data, error } = await supabase
    .from('scenarios')
    .select('*, personas(name, personality_type, avatar_image_url)')
    .in('persona_id', personaIds)
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}
