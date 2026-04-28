'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const AddFeedbackSchema = z.object({
  personaId: z.string().uuid(),
  scenarioId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  feedbackText: z.string().min(10, 'En az 10 karakter giriniz').max(2000),
})

export async function addPersonaFeedbackAction(
  input: z.infer<typeof AddFeedbackSchema>
): Promise<{ success?: true; error?: string }> {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'super_admin') return { error: 'Yetkisiz' }

  const parsed = AddFeedbackSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { personaId, scenarioId, sessionId, feedbackText } = parsed.data
  const serviceSupabase = await createServiceRoleClient()

  const { error } = await serviceSupabase.from('persona_prompt_feedback').insert({
    persona_id: personaId,
    scenario_id: scenarioId ?? null,
    session_id: sessionId ?? null,
    super_admin_user_id: currentUser.id,
    feedback_text: feedbackText,
    status: 'open',
  })

  if (error) return { error: 'Geri bildirim kaydedilemedi' }

  revalidatePath('/admin/feedback')
  return { success: true }
}

export async function updateFeedbackStatusAction(
  feedbackId: string,
  status: 'open' | 'applied' | 'dismissed'
): Promise<{ success?: true; error?: string }> {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'super_admin') return { error: 'Yetkisiz' }

  const serviceSupabase = await createServiceRoleClient()
  const { error } = await serviceSupabase
    .from('persona_prompt_feedback')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', feedbackId)

  if (error) return { error: 'Durum güncellenemedi' }

  revalidatePath('/admin/feedback')
  return { success: true }
}
