'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

const ScenarioSchema = z.object({
  title: z.string().min(3, 'Başlık en az 3 karakter olmalı'),
  description: z.string().min(10, 'Açıklama en az 10 karakter olmalı'),
  persona_id: z.string().uuid('Geçerli bir persona seçin'),
  target_skill_codes: z.array(z.string()).default([]),
  difficulty: z.coerce.number().min(1).max(5),
  sector_tags: z.array(z.string()).default([]),
})

export async function createScenarioAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const raw = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    persona_id: formData.get('persona_id') as string,
    target_skill_codes: JSON.parse((formData.get('target_skill_codes') as string) || '[]'),
    difficulty: formData.get('difficulty'),
    sector_tags: JSON.parse((formData.get('sector_tags') as string) || '[]'),
  }

  const parsed = ScenarioSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.from('scenarios').insert({
    title: parsed.data.title,
    description: parsed.data.description,
    persona_id: parsed.data.persona_id,
    target_skill_codes: parsed.data.target_skill_codes,
    difficulty: parsed.data.difficulty,
    sector_tags: parsed.data.sector_tags,
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
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const raw = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    persona_id: formData.get('persona_id') as string,
    target_skill_codes: JSON.parse((formData.get('target_skill_codes') as string) || '[]'),
    difficulty: formData.get('difficulty'),
    sector_tags: JSON.parse((formData.get('sector_tags') as string) || '[]'),
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
      target_skill_codes: parsed.data.target_skill_codes,
      difficulty: parsed.data.difficulty,
      sector_tags: parsed.data.sector_tags,
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

  const supabase = await createClient()
  const { error } = await supabase
    .from('scenarios')
    .update({ is_active: !isActive })
    .eq('id', scenarioId)

  if (error) return { error: 'Durum güncellenemedi.' }

  revalidatePath('/tenant/scenarios')
  return { success: `Senaryo ${!isActive ? 'aktifleştirildi' : 'pasifleştirildi'}.` }
}

export async function getScenarios() {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()
  const query = supabase
    .from('scenarios')
    .select('*, personas(name, personality_type)')
    .order('created_at', { ascending: false })

  if (user.role !== 'super_admin') {
    query.or(`tenant_id.eq.${user.tenant_id},tenant_id.is.null`)
  }

  const { data, error } = await query
  if (error) return []
  return data
}
