'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { encrypt, decrypt } from '@/lib/encryption/aes-gcm'

const PERSONA_TYPES = [
  'falling_performance',
  'rising_performance',
  'resistant_experience',
  'new_to_role',
  'motivation_crisis',
] as const

const PersonaSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter olmalı'),
  title: z.string().min(2, 'Unvan en az 2 karakter olmalı'),
  department: z.string().optional(),
  location: z.string().optional(),
  experience_years: z.coerce.number().min(0).max(50).optional(),
  growth_type: z.enum(PERSONA_TYPES),
  emotional_baseline: z.enum([
    'motivated', 'demotivated', 'frustrated', 'neutral', 'anxious', 'confident', 'burned_out',
  ]),
  scenario_description: z.string().optional(),
  coaching_context: z.string().optional(),
  coaching_tips: z.array(z.string()).default([]),
  difficulty: z.coerce.number().min(1).max(5),
  resistance_level: z.coerce.number().min(1).max(5),
  cooperativeness: z.coerce.number().min(1).max(5),
  system_prompt: z.string().min(10, 'Sistem promptu en az 10 karakter olmalı'),
  avatar_image_url: z.string().url().optional().or(z.literal('')),
  voice_id: z.string().trim().max(100).optional().or(z.literal('')),
  roleplay_contract: z.string().trim().max(8000).optional().or(z.literal('')),
  opening_directive: z.string().trim().max(2000).optional().or(z.literal('')),
  trigger_behaviors: z.array(z.string()).default([]),
  kpis: z.array(z.object({
    code: z.string(),
    name: z.string(),
    value: z.coerce.number().min(0).max(200),
    is_custom: z.boolean().default(false)
  })).default([]),
})

function parseRaw(formData: FormData) {
  return {
    name: formData.get('name') as string,
    title: formData.get('title') as string,
    department: (formData.get('department') as string) || undefined,
    location: (formData.get('location') as string) || undefined,
    experience_years: formData.get('experience_years') || undefined,
    growth_type: formData.get('growth_type'),
    emotional_baseline: formData.get('emotional_baseline') || 'neutral',
    scenario_description: (formData.get('scenario_description') as string) || undefined,
    coaching_context: (formData.get('coaching_context') as string) || undefined,
    coaching_tips: [(formData.get('coaching_tips') as string) || ''].filter(Boolean),
    trigger_behaviors: JSON.parse((formData.get('trigger_behaviors') as string) || '[]'),
    difficulty: formData.get('difficulty'),
    resistance_level: formData.get('resistance_level') || 3,
    cooperativeness: formData.get('cooperativeness') || 3,
    system_prompt: formData.get('system_prompt') as string,
    avatar_image_url: formData.get('avatar_image_url') as string,
    voice_id: (formData.get('voice_id') as string) || '',
    roleplay_contract: (formData.get('roleplay_contract') as string) || '',
    opening_directive: (formData.get('opening_directive') as string) || '',
    kpis: JSON.parse((formData.get('kpis') as string) || '[]'),
  }
}

export async function createPersonaAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const parsed = PersonaSchema.safeParse(parseRaw(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .insert({
      name: parsed.data.name,
      title: parsed.data.title,
      department: parsed.data.department ?? null,
      location: parsed.data.location ?? null,
      experience_years: parsed.data.experience_years ?? null,
      growth_type: parsed.data.growth_type as any,
      emotional_baseline: parsed.data.emotional_baseline as any,
      scenario_description: parsed.data.scenario_description ?? null,
      coaching_context: parsed.data.coaching_context ?? null,
      coaching_tips: parsed.data.coaching_tips,
      trigger_behaviors: parsed.data.trigger_behaviors,
      difficulty: parsed.data.difficulty,
      resistance_level: parsed.data.resistance_level,
      cooperativeness: parsed.data.cooperativeness,
      avatar_image_url: parsed.data.avatar_image_url || null,
      voice_id: parsed.data.voice_id?.trim() || null,
      roleplay_contract: parsed.data.roleplay_contract?.trim() || null,
      opening_directive: parsed.data.opening_directive?.trim() || null,
      is_active: true,
      created_by: user.id,
      tenant_id: user.role === 'super_admin' ? null : user.tenant_id,
    })
    .select('id')
    .single()

  if (personaError || !persona) {
    console.error('Persona Error:', personaError)
    return { error: 'Persona oluşturulamadı.' }
  }

  // 2. KPIs
  if (parsed.data.kpis.length > 0) {
    await supabase.from('persona_kpis').insert(
      parsed.data.kpis.map((k, idx) => ({
        persona_id: persona.id,
        kpi_code: (k.is_custom ? 'ozel_kpi' : k.code) as any,
        kpi_name: k.name,
        value: k.value,
        is_custom: k.is_custom,
        sort_order: idx,
      }))
    )
  }

  // 3. System Prompt
  const { error: promptError } = await supabase.from('persona_prompt_versions').insert({
    persona_id: persona.id,
    version_number: 1,
    content_encrypted: encrypt(parsed.data.system_prompt),
    is_active: true,
    created_by: user.id,
  })

  if (promptError) console.error('Prompt Error:', promptError)

  revalidatePath('/tenant/personas')
  return { success: 'Persona başarıyla oluşturuldu.' }
}

export async function updatePersonaAction(personaId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const parsed = PersonaSchema.safeParse(parseRaw(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('personas')
    .update({
      name: parsed.data.name,
      title: parsed.data.title,
      department: parsed.data.department ?? null,
      location: parsed.data.location ?? null,
      experience_years: parsed.data.experience_years ?? null,
      growth_type: parsed.data.growth_type as any,
      emotional_baseline: parsed.data.emotional_baseline as any,
      scenario_description: parsed.data.scenario_description ?? null,
      coaching_context: parsed.data.coaching_context ?? null,
      coaching_tips: parsed.data.coaching_tips,
      trigger_behaviors: parsed.data.trigger_behaviors,
      difficulty: parsed.data.difficulty,
      resistance_level: parsed.data.resistance_level,
      cooperativeness: parsed.data.cooperativeness,
      avatar_image_url: parsed.data.avatar_image_url || null,
      voice_id: parsed.data.voice_id?.trim() || null,
      roleplay_contract: parsed.data.roleplay_contract?.trim() || null,
      opening_directive: parsed.data.opening_directive?.trim() || null,
    })
    .eq('id', personaId)

  if (updateError) return { error: 'Persona güncellenemedi.' }

  // 2. Sync KPIs
  await supabase.from('persona_kpis').delete().eq('persona_id', personaId)
  if (parsed.data.kpis.length > 0) {
    await supabase.from('persona_kpis').insert(
      parsed.data.kpis.map((k, idx) => ({
        persona_id: personaId,
        kpi_code: (k.is_custom ? 'ozel_kpi' : k.code) as any,
        kpi_name: k.name,
        value: k.value,
        is_custom: k.is_custom,
        sort_order: idx,
      }))
    )
  }

  // 3. System Prompt Versioning
  const { data: latestVersion } = await supabase
    .from('persona_prompt_versions')
    .select('version_number')
    .eq('persona_id', personaId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  await supabase
    .from('persona_prompt_versions')
    .update({ is_active: false })
    .eq('persona_id', personaId)
    .eq('is_active', true)

  await supabase.from('persona_prompt_versions').insert({
    persona_id: personaId,
    version_number: (latestVersion?.version_number ?? 0) + 1,
    content_encrypted: encrypt(parsed.data.system_prompt),
    is_active: true,
    created_by: user.id,
  })

  revalidatePath('/tenant/personas')
  revalidatePath(`/tenant/personas/${personaId}/edit`)
  return { success: 'Persona başarıyla güncellendi.' }
}

export async function getPersonas() {
  const user = await getCurrentUser()
  if (!user) return []

  // Service client kullan: JWT tabanlı RLS yerine kod seviyesinde erişim kontrolü
  const service = await createServiceClient()

  const PERSONA_SELECT = '*, persona_kpis(kpi_code, kpi_name, value, unit, is_custom)'

  if (user.role === 'super_admin') {
    const { data, error } = await service
      .from('personas')
      .select(PERSONA_SELECT)
      .order('created_at', { ascending: false })
    if (error) return []
    return data ?? []
  }

  const { data: mappings } = await service
    .from('persona_tenant_mapping')
    .select('persona_id')
    .eq('tenant_id', user.tenant_id)
    .eq('is_active', true)

  if (mappings && mappings.length > 0) {
    const { data, error } = await service
      .from('personas')
      .select(PERSONA_SELECT)
      .in('id', mappings.map((m) => m.persona_id))
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (error) return []
    return data ?? []
  }

  // Atama yoksa: global personaları göster (tenant_id = null)
  const { data, error } = await service
    .from('personas')
    .select(PERSONA_SELECT)
    .is('tenant_id', null)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) return []
  return data ?? []
}

export async function getPersonaWithPrompt(personaId: string) {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const [{ data: persona }, { data: promptVersion }, { data: kpis }] = await Promise.all([
    supabase.from('personas').select('*').eq('id', personaId).single(),
    supabase
      .from('persona_prompt_versions')
      .select('content_encrypted')
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase.from('persona_kpis').select('*').eq('persona_id', personaId).order('sort_order', { ascending: true })
  ])

  if (!persona) return null

  let systemPrompt = ''
  if (promptVersion?.content_encrypted) {
    try {
      systemPrompt = decrypt(promptVersion.content_encrypted)
    } catch {
      systemPrompt = promptVersion.content_encrypted
    }
  }

  const coachingTips = Array.isArray(persona.coaching_tips)
    ? persona.coaching_tips
    : (typeof persona.coaching_tips === 'string' && persona.coaching_tips)
      ? [persona.coaching_tips]
      : []

  return {
    ...persona,
    coaching_tips: coachingTips,
    system_prompt: systemPrompt,
    kpis: kpis?.map(k => ({
      code: k.kpi_code === 'ozel_kpi' ? 'ozel_kpi' : k.kpi_code,
      name: k.kpi_name,
      value: Number(k.value),
      is_custom: k.is_custom
    })) ?? []
  }
}

export async function togglePersonaStatusAction(personaId: string, isActive: boolean) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('personas')
    .update({ is_active: !isActive })
    .eq('id', personaId)

  if (error) return { error: 'Durum güncellenemedi.' }

  revalidatePath('/tenant/personas')
  return { success: `Persona ${!isActive ? 'aktifleştirildi' : 'pasifleştirildi'}.` }
}

export async function assignPersonaToTenantAction(personaId: string, tenantId: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Sadece Super Admin bu işlemi yapabilir.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('persona_tenant_mapping').upsert({
    persona_id: personaId,
    tenant_id: tenantId,
    assigned_by: user.id,
    is_active: true,
  }, { onConflict: 'persona_id,tenant_id' })

  if (error) return { error: 'Persona tenant\'a atanamadı.' }

  revalidatePath('/admin/personas')
  return { success: 'Persona başarıyla tenant\'a atandı.' }
}

export async function removePersonaFromTenantAction(personaId: string, tenantId: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Sadece Super Admin bu işlemi yapabilir.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('persona_tenant_mapping')
    .delete()
    .eq('persona_id', personaId)
    .eq('tenant_id', tenantId)

  if (error) return { error: 'Persona tenant\'dan kaldırılamadı.' }

  revalidatePath('/admin/personas')
  return { success: 'Persona başarıyla tenant\'dan kaldırıldı.' }
}

export async function getTenantPersonas(tenantId: string) {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenant_available_personas')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('assigned_at', { ascending: false })

  if (error) return []
  return data
}

export async function getPersonaTenantMappings() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('persona_tenant_mapping')
    .select('persona_id, tenant_id, is_active')
    .eq('is_active', true)

  if (error) return []
  return data
}
