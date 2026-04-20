'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

const PERSONA_TYPES = [
  'falling_performance',
  'rising_performance',
  'resistant_experience',
  'new_to_role',
  'motivation_crisis',
] as const

const PersonaSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter olmalı'),
  surname: z.string().optional(),
  title: z.string().min(2, 'Unvan en az 2 karakter olmalı'),
  department: z.string().optional(),
  location: z.string().optional(),
  experience_years: z.coerce.number().min(0).max(50).optional(),
  personality_type: z.enum(PERSONA_TYPES),
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
    surname: (formData.get('surname') as string) || undefined,
    title: formData.get('title') as string,
    department: (formData.get('department') as string) || undefined,
    location: (formData.get('location') as string) || undefined,
    experience_years: formData.get('experience_years') || undefined,
    personality_type: formData.get('personality_type'),
    emotional_baseline: formData.get('emotional_baseline') || 'neutral',
    scenario_description: (formData.get('scenario_description') as string) || undefined,
    coaching_context: (formData.get('coaching_context') as string) || undefined,
    coaching_tips: [(formData.get('coaching_tips') as string) || ''].filter(Boolean),
    difficulty: formData.get('difficulty'),
    resistance_level: formData.get('resistance_level') || 3,
    cooperativeness: formData.get('cooperativeness') || 3,
    system_prompt: formData.get('system_prompt') as string,
    avatar_image_url: formData.get('avatar_image_url') as string,
    kpis: JSON.parse((formData.get('kpis') as string) || '[]'),
  }
}

export async function createPersonaAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const parsed = PersonaSchema.safeParse(parseRaw(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .insert({
      name: parsed.data.name,
      surname: parsed.data.surname ?? null,
      title: parsed.data.title,
      department: parsed.data.department ?? null,
      location: parsed.data.location ?? null,
      experience_years: parsed.data.experience_years ?? null,
      personality_type: parsed.data.personality_type,
      emotional_baseline: parsed.data.emotional_baseline as any,
      scenario_description: parsed.data.scenario_description ?? null,
      coaching_context: parsed.data.coaching_context ?? null,
      coaching_tips: parsed.data.coaching_tips,
      difficulty: parsed.data.difficulty,
      resistance_level: parsed.data.resistance_level,
      cooperativeness: parsed.data.cooperativeness,
      avatar_image_url: parsed.data.avatar_image_url || null,
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
    content: parsed.data.system_prompt,
    content_encrypted: parsed.data.system_prompt, // Geriye uyumluluk için ikisini de yazıyoruz
    is_active: true,
    created_by: user.id,
  })

  if (promptError) console.error('Prompt Error:', promptError)

  revalidatePath('/tenant/personas')
  return { success: 'Persona başarıyla oluşturuldu.' }
}

export async function updatePersonaAction(personaId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const parsed = PersonaSchema.safeParse(parseRaw(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('personas')
    .update({
      name: parsed.data.name,
      surname: parsed.data.surname ?? null,
      title: parsed.data.title,
      department: parsed.data.department ?? null,
      location: parsed.data.location ?? null,
      experience_years: parsed.data.experience_years ?? null,
      personality_type: parsed.data.personality_type,
      emotional_baseline: parsed.data.emotional_baseline as any,
      scenario_description: parsed.data.scenario_description ?? null,
      coaching_context: parsed.data.coaching_context ?? null,
      coaching_tips: parsed.data.coaching_tips,
      difficulty: parsed.data.difficulty,
      resistance_level: parsed.data.resistance_level,
      cooperativeness: parsed.data.cooperativeness,
      avatar_image_url: parsed.data.avatar_image_url || null,
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
  const { data: existing } = await supabase
    .from('persona_prompt_versions')
    .select('content, content_encrypted')
    .eq('persona_id', personaId)
    .eq('is_active', true)
    .maybeSingle()

  const existingContent = existing?.content || existing?.content_encrypted || ''

  if (existingContent !== parsed.data.system_prompt) {
    await supabase
      .from('persona_prompt_versions')
      .update({ is_active: false })
      .eq('persona_id', personaId)
      .eq('is_active', true)

    const { data: latestVersion } = await supabase
      .from('persona_prompt_versions')
      .select('version_number')
      .eq('persona_id', personaId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    await supabase.from('persona_prompt_versions').insert({
      persona_id: personaId,
      version_number: (latestVersion?.version_number ?? 0) + 1,
      content: parsed.data.system_prompt,
      content_encrypted: parsed.data.system_prompt,
      is_active: true,
      created_by: user.id,
    })
  }

  revalidatePath('/tenant/personas')
  return { success: 'Persona başarıyla güncellendi.' }
}

export async function getPersonas() {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()
  const query = supabase
    .from('personas')
    .select('*')
    .order('created_at', { ascending: false })

  if (user.role !== 'super_admin') {
    query.or(`tenant_id.eq.${user.tenant_id},tenant_id.is.null`)
  }

  const { data, error } = await query

  if (error) return []
  return data
}

export async function getPersonaWithPrompt(personaId: string) {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const [{ data: persona }, { data: promptVersion }, { data: kpis }] = await Promise.all([
    supabase.from('personas').select('*').eq('id', personaId).single(),
    supabase
      .from('persona_prompt_versions')
      .select('content, content_encrypted')
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase.from('persona_kpis').select('*').eq('persona_id', personaId).order('sort_order', { ascending: true })
  ])

  if (!persona) return null
  return {
    ...persona,
    system_prompt: promptVersion?.content || promptVersion?.content_encrypted || '',
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
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
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
