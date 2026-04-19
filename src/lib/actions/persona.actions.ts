'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const PersonaKPISchema = z.object({
  kpi_code: z.string(),
  kpi_name: z.string(),
  value: z.coerce.number(),
  unit: z.string().optional(),
  is_custom: z.boolean().default(false),
})

const CreatePersonaSchema = z.object({
  name: z.string().min(2).max(100),
  title: z.string().min(2).max(150),
  department: z.string().optional(),
  age_range: z.string().optional(),
  experience_years: z.coerce.number().optional(),
  personality_type: z.enum(['analytical', 'driver', 'expressive', 'amiable', 'resistant', 'indifferent']),
  emotional_baseline: z.enum(['positive', 'neutral', 'negative', 'volatile']),
  resistance_level: z.coerce.number().int().min(1).max(5),
  cooperativeness_level: z.coerce.number().int().min(1).max(5),
  trigger_behaviors: z.string().transform((s) => s.split('\n').filter(Boolean)),
  system_prompt: z.string().min(50),
  kpis: z.string().transform((s) => {
    try {
      return JSON.parse(s)
    } catch {
      return []
    }
  }),
})

export async function createPersonaAction(formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['super_admin', 'tenant_admin'].includes(currentUser.role)) {
    return { error: 'Yetkisiz erişim' }
  }

  const parsed = CreatePersonaSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const {
    name,
    title,
    department,
    age_range,
    experience_years,
    personality_type,
    emotional_baseline,
    resistance_level,
    cooperativeness_level,
    trigger_behaviors,
    system_prompt,
    kpis,
  } = parsed.data

  const tenantId = currentUser.role === 'super_admin'
    ? (formData.get('tenant_id') as string)
    : currentUser.tenant_id

  const supabase = await createServerClient()

  // Persona kaydı
  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .insert({
      tenant_id: tenantId,
      name,
      title,
      department,
      age_range,
      experience_years,
      personality_type,
      emotional_baseline,
      resistance_level,
      cooperativeness_level,
      trigger_behaviors,
    })
    .select()
    .single()

  if (personaError || !persona) {
    return { error: 'Persona oluşturulamadı' }
  }

  // KPI'ları kaydet
  if (kpis.length > 0) {
    await supabase.from('persona_kpis').insert(
      kpis.map((kpi: any) => ({ ...kpi, persona_id: persona.id }))
    )
  }

  // System prompt'u kaydet (şifresiz V1 - şifreleme adımı omitted)
  await supabase.from('persona_prompt_versions').insert({
    persona_id: persona.id,
    content: system_prompt,
    version_number: 1,
    is_active: true,
    created_by: currentUser.id,
  })

  revalidatePath('/tenant/personas')
  return { success: true, personaId: persona.id }
}

export async function updatePersonaAction(personaId: string, formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['super_admin', 'tenant_admin'].includes(currentUser.role)) {
    return { error: 'Yetkisiz erişim' }
  }

  const parsed = CreatePersonaSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const { system_prompt, kpis, trigger_behaviors, ...personaFields } = parsed.data
  const supabase = await createServerClient()

  // Persona temel bilgileri güncelle
  const { error: updateError } = await supabase
    .from('personas')
    .update({ ...personaFields, trigger_behaviors })
    .eq('id', personaId)

  if (updateError) return { error: updateError.message }

  // KPI'ları yeniden yaz
  await supabase.from('persona_kpis').delete().eq('persona_id', personaId)
  if (kpis.length > 0) {
    await supabase.from('persona_kpis').insert(
      kpis.map((kpi: any) => ({ ...kpi, persona_id: personaId }))
    )
  }

  // System prompt değiştiyse yeni versiyon oluştur
  const { data: currentVersion } = await supabase
    .from('persona_prompt_versions')
    .select('version_number, content')
    .eq('persona_id', personaId)
    .eq('is_active', true)
    .single()

  if (currentVersion?.content !== system_prompt) {
    // Eski versiyonu pasife al
    await supabase
      .from('persona_prompt_versions')
      .update({ is_active: false })
      .eq('persona_id', personaId)
      .eq('is_active', true)

    // Yeni versiyon ekle
    await supabase.from('persona_prompt_versions').insert({
      persona_id: personaId,
      content: system_prompt,
      version_number: (currentVersion?.version_number ?? 0) + 1,
      is_active: true,
      created_by: currentUser.id,
    })
  }

  revalidatePath('/tenant/personas')
  revalidatePath(`/tenant/personas/${personaId}`)
  return { success: true }
}

export async function togglePersonaStatusAction(personaId: string, isActive: boolean) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['super_admin', 'tenant_admin'].includes(currentUser.role)) {
    return { error: 'Yetkisiz erişim' }
  }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('personas')
    .update({ is_active: isActive })
    .eq('id', personaId)

  if (error) return { error: error.message }
  revalidatePath('/tenant/personas')
  return { success: true }
}

export async function getPersonaWithPrompt(personaId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const supabase = await createServerClient()

  const { data: persona } = await supabase
    .from('personas')
    .select(`*, persona_kpis(*), persona_prompt_versions(*)`)
    .eq('id', personaId)
    .single()

  if (!persona) return null

  const activeVersion = persona.persona_prompt_versions.find((v: any) => v.is_active)
  const systemPrompt = activeVersion?.content ?? ''

  return { ...persona, system_prompt: systemPrompt }
}
