'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function finishDebriefAction(
  sessionId: string
): Promise<{ success: boolean; evaluationReady: boolean; error?: string }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false, evaluationReady: false, error: 'Yetkisiz' }

  const supabase = await createServerClient()

  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'debrief_completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', currentUser.id)
    .eq('status', 'debrief_active')

  if (error) {
    return { success: false, evaluationReady: false, error: 'Debrief tamamlanamadı' }
  }

  // Değerlendirme hazır mı?
  const { data: evaluation } = await supabase
    .from('evaluations')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle()

  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, evaluationReady: !!evaluation }
}

export async function checkEvaluationReadyAction(sessionId: string): Promise<boolean> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return false

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('evaluations')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle()

  return !!data
}
