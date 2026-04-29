'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { scheduleEvaluationJob } from '@/lib/evaluation/evaluation.queue'
import { runEvaluation } from '@/lib/evaluation/evaluation.engine'
import { awardXPAndBadges } from '@/lib/evaluation/gamification.service'

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
  const { data: existingEvaluation } = await supabase
    .from('evaluations')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (existingEvaluation) {
    revalidatePath(`/dashboard/sessions/${sessionId}`)
    return { success: true, evaluationReady: true }
  }

  // Senkron fallback: QStash başarısız olabilir (env, network, plan limiti).
  // Burada doğrudan engine'i çalıştır → kullanıcı debrief'i bitirdiğinde hemen rapor hazır.
  // QStash'i de paralel kuyruğa atıyoruz; idempotent runEvaluation çift çalışsa da bir tane evaluation kaydı tutar.
  try {
    console.log('[finishDebriefAction] sync evaluation başlatılıyor:', sessionId)
    const result = await runEvaluation(sessionId)
    console.log('[finishDebriefAction] sync evaluation tamamlandı:', result)

    // Sessions tablosundan ihtiyaç duyulan bilgileri al (XP/badge için)
    const { data: sess } = await supabase
      .from('sessions')
      .select('user_id, tenant_id, persona_id, scenario_id')
      .eq('id', sessionId)
      .single()

    if (sess) {
      await awardXPAndBadges({
        userId: sess.user_id,
        tenantId: sess.tenant_id,
        sessionId,
        personaId: sess.persona_id,
        scenarioId: sess.scenario_id,
        overallScore: result.overallScore,
      }).catch((e) => console.error('[finishDebriefAction] XP/badge fail (non-fatal):', e))
    }

    revalidatePath(`/dashboard/sessions/${sessionId}`)
    return { success: true, evaluationReady: true }
  } catch (syncErr) {
    console.error('[finishDebriefAction] sync evaluation FAIL — QStash fallback:', syncErr)
    // Sync başarısız → QStash'e tekrar at
    scheduleEvaluationJob(sessionId).catch((e) =>
      console.error('[finishDebriefAction] QStash fallback da fail:', e)
    )
    revalidatePath(`/dashboard/sessions/${sessionId}`)
    return { success: true, evaluationReady: false }
  }
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
