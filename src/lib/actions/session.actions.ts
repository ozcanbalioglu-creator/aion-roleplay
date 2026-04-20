'use server'

import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { buildSystemPrompt } from '@/lib/session/system-prompt.builder'
import { encrypt } from '@/lib/encryption'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { scheduleEvaluationJob } from '@/lib/evaluation/evaluation.queue'

const CreateSessionSchema = z.object({
  personaId: z.string().uuid(),
  scenarioId: z.string().uuid(),
  sessionMode: z.enum(['text', 'voice']).default('text'),
})

export async function createSessionAction(input: z.infer<typeof CreateSessionSchema>) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Oturum açılı değil' }
  if (!['manager', 'user'].includes(currentUser.role)) {
    return { error: 'Bu işlemi yapmaya yetkiniz yok' }
  }

  const parsed = CreateSessionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { personaId, scenarioId, sessionMode } = parsed.data
  const supabase = await createServerClient()

  // Persona ve senaryo bu tenant'a ait mi kontrolü
  const [{ data: persona }, { data: scenario }] = await Promise.all([
    supabase
      .from('personas')
      .select('id, is_active')
      .eq('id', personaId)
      .eq('tenant_id', currentUser.tenant_id)
      .single(),
    supabase
      .from('scenarios')
      .select('id, is_active, estimated_duration_min')
      .eq('id', scenarioId)
      .eq('tenant_id', currentUser.tenant_id)
      .single(),
  ])

  if (!persona || !persona.is_active) return { error: 'Geçersiz veya pasif persona' }
  if (!scenario || !scenario.is_active) return { error: 'Geçersiz veya pasif senaryo' }

  // Tenant'ın aktif rubric template'ini bul
  const { data: rubricTemplate } = await supabase
    .from('rubric_templates')
    .select('id')
    .eq('tenant_id', currentUser.tenant_id)
    .eq('is_active', true)
    .limit(1)
    .single()

  let finalRubricId = rubricTemplate?.id ?? null

  // Tenant'a ait aktif rubric yoksa global (tenant_id NULL) kullan
  if (!finalRubricId) {
    const { data: globalRubric } = await supabase
      .from('rubric_templates')
      .select('id')
      .is('tenant_id', null)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!globalRubric) return { error: 'Aktif rubric şablonu bulunamadı' }
    finalRubricId = globalRubric.id
  }

  // Session oluştur (PENDING)
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: currentUser.id,
      tenant_id: currentUser.tenant_id,
      persona_id: personaId,
      scenario_id: scenarioId,
      rubric_template_id: finalRubricId,
      status: 'pending',
      session_mode: sessionMode,
    })
    .select('id')
    .single()

  if (sessionError || !session) {
    return { error: 'Seans oluşturulamadı: ' + (sessionError?.message ?? 'bilinmeyen hata') }
  }

  return { success: true as const, sessionId: session.id }
}

export async function cancelSessionAction(sessionId: string, reason: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Oturum açılı değil' }

  const supabase = await createServerClient()

  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'cancelled',
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .eq('user_id', currentUser.id)
    .in('status', ['pending', 'active'])

  if (error) return { error: error.message }

  revalidatePath('/sessions')
  return { success: true as const }
}

// PENDING → ACTIVE geçişi
export async function activateSessionAction(sessionId: string): Promise<
  { success: true; systemPromptHash: string } | { success: false; error: string }
> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: 'Oturum açılmamış' }

  const supabase = await createServerClient()

  // Seans kaydını al ve doğrula
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('id, status, persona_id, scenario_id, user_id, tenant_id, session_mode')
    .eq('id', sessionId)
    .single()

  if (fetchError || !session) return { success: false, error: 'Seans bulunamadı' }
  if (session.user_id !== currentUser.id) return { success: false, error: 'Yetkisiz erişim' }
  if (session.status !== 'pending') return { success: false, error: `Seans zaten ${session.status} durumunda` }

  // Sistem promptunu oluştur
  let promptData: Awaited<ReturnType<typeof buildSystemPrompt>>
  try {
    promptData = await buildSystemPrompt({
      sessionId,
      personaId: session.persona_id,
      scenarioId: session.scenario_id,
      tenantId: session.tenant_id
    })
  } catch (e) {
    return { success: false, error: `Sistem prompt hatası: ${(e as Error).message}` }
  }

  // Sistem promptunu şifreli olarak prompt_logs'a kaydet
  const serviceSupabase = await createServiceRoleClient()
  await serviceSupabase.from('prompt_logs').insert({
    session_id: sessionId,
    tenant_id: session.tenant_id,
    user_id: currentUser.id,
    prompt_type: 'system',
    encrypted_content: encrypt(promptData.systemPrompt),
    model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.5',
    provider: 'openai'
  })

  // PENDING → ACTIVE
  const { error: updateError } = await supabase
    .from('sessions')
    .update({
      status: 'active',
      phase: 'opening',
      started_at: new Date().toISOString()
    })
    .eq('id', sessionId)

  if (updateError) return { success: false, error: 'Seans başlatılamadı' }

  // Sistem prompt hash'ini döndür (client bunu session storage'da saklar, API çağrısında gönderir)
  const crypto = await import('crypto')
  const promptHash = crypto.createHash('sha256').update(promptData.systemPrompt).digest('hex').slice(0, 16)

  revalidatePath(`/sessions/${sessionId}`)
  return { success: true, systemPromptHash: promptHash }
}

// ACTIVE → COMPLETED geçişi
export async function endSessionAction(
  sessionId: string,
  reason: 'user_ended' | 'ai_ended' = 'user_ended'
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: 'Oturum açılmamış' }

  const supabase = await createServerClient()

  // Seans doğrulama
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, user_id, started_at')
    .eq('id', sessionId)
    .single()

  if (!session || session.user_id !== currentUser.id) return { success: false, error: 'Yetkisiz' }
  if (session.status !== 'active') return { success: false, error: 'Aktif seans değil' }

  // Süreyi hesapla
  const durationSeconds = session.started_at
    ? Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)
    : null

  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'completed',
      phase: 'closing',
      completed_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      cancellation_reason: reason
    })
    .eq('id', sessionId)

  if (error) return { success: false, error: 'Seans tamamlanamadı' }

  if (!error) {
    // Değerlendirme job'ını kuyruğa al (fire-and-forget)
    scheduleEvaluationJob(sessionId).catch((e) =>
      console.error('Evaluation job kuyruğa alınamadı:', e)
    )
  }

  revalidatePath(`/sessions/${sessionId}`)
  revalidatePath('/sessions')
  return { success: true }
}

// DROPPED → ACTIVE (Resume)
export async function resumeSessionAction(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: 'Oturum açılmamış' }

  const supabase = await createServerClient()

  // Seans doğrula
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, user_id, started_at')
    .eq('id', sessionId)
    .single()

  if (!session || session.user_id !== currentUser.id) {
    return { success: false, error: 'Yetkisiz' }
  }

  if (session.status !== 'dropped') {
    return { success: false, error: 'Yalnızca DROPPED seanslar devam ettirilebilir' }
  }

  // Maksimum kurtarılabilir süre: 2 saat
  const startedAt = session.started_at ? new Date(session.started_at) : null
  if (startedAt && Date.now() - startedAt.getTime() > 2 * 60 * 60 * 1000) {
    return { success: false, error: 'Seans çok eski, devam ettirilemez (max 2 saat)' }
  }

  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'active',
      cancelled_at: null,
      cancellation_reason: null,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) return { success: false, error: 'Resume başarısız' }

  revalidatePath(`/sessions/${sessionId}`)
  return { success: true }
}

// DROPPED → CANCELLED (Kapat, değerlendirme yok)
export async function closeDroppedSessionAction(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, error: 'Oturum açılmamış' }

  const supabase = await createServerClient()

  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'closed_after_drop',
    })
    .eq('id', sessionId)
    .eq('user_id', currentUser.id)
    .eq('status', 'dropped')

  if (error) return { success: false, error: 'Kapatma başarısız' }

  revalidatePath('/sessions')
  return { success: true }
}

