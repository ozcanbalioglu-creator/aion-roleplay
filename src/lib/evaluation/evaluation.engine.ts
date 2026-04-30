import { createServiceRoleClient } from '@/lib/supabase/server'
import { OpenAI } from 'openai'
import { buildEvaluationPrompt } from './evaluation-prompt.builder'
import { getDecryptedTranscript } from './transcript.service'
import { encrypt } from '@/lib/encryption'
import { createNotification } from '@/lib/notifications/notification.service'

interface EvaluationResult {
  evaluationId: string
  overallScore: number
  dimensionCount: number
}

export async function runEvaluation(sessionId: string): Promise<EvaluationResult> {
  const t0 = Date.now()
  console.log(`[runEvaluation] START sessionId=${sessionId}`)
  const supabase = await createServiceRoleClient()

  // İdempotans kontrolü — maybeSingle: row yoksa null döner, error fırlatmaz
  const { data: existing, error: existingErr } = await supabase
    .from('evaluations')
    .select('id, overall_score, status')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (existingErr) {
    console.error('[runEvaluation] idempotency check error:', existingErr)
  }

  if (existing && existing.status === 'completed') {
    console.log(`[runEvaluation] EXIST (already completed) — id=${existing.id}`)
    return {
      evaluationId: existing.id,
      overallScore: existing.overall_score ?? 0,
      dimensionCount: 0,
    }
  }

  // Seans bilgisini al — debrief flow'unda status 'debrief_active' veya 'debrief_completed' olur,
  // legacy 'completed' de kabul edilir.
  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .select('id, user_id, tenant_id, persona_id, scenario_id, duration_seconds, status')
    .eq('id', sessionId)
    .in('status', ['completed', 'debrief_active', 'debrief_completed'])
    .maybeSingle()

  if (sessionErr) console.error('[runEvaluation] session fetch error:', sessionErr)
  if (!session) {
    console.error(`[runEvaluation] FAIL: Değerlendirilebilir seans bulunamadı (sessionId=${sessionId})`)
    throw new Error(`Değerlendirilebilir seans bulunamadı (sessionId=${sessionId})`)
  }
  console.log(`[runEvaluation] session OK — status=${session.status}, tenant=${session.tenant_id}`)

  // Transcript
  let transcript: Awaited<ReturnType<typeof getDecryptedTranscript>>
  try {
    transcript = await getDecryptedTranscript(sessionId)
  } catch (err) {
    console.error('[runEvaluation] FAIL transcript decrypt:', (err as Error).message)
    throw err
  }
  console.log(`[runEvaluation] transcript OK — totalMessages=${transcript.totalMessages}, user=${transcript.userMessageCount}, assistant=${transcript.assistantMessageCount}`)

  if (transcript.totalMessages < 4) {
    console.error(`[runEvaluation] FAIL: yetersiz mesaj (${transcript.totalMessages})`)
    throw new Error('Değerlendirme için yeterli mesaj yok (min 4)')
  }

  // Değerlendirme promptu
  let promptData: Awaited<ReturnType<typeof buildEvaluationPrompt>>
  try {
    promptData = await buildEvaluationPrompt(sessionId, session.tenant_id, transcript)
  } catch (err) {
    console.error('[runEvaluation] FAIL buildEvaluationPrompt:', (err as Error).message)
    throw err
  }
  console.log(`[runEvaluation] prompt OK — rubricTemplateId=${promptData.rubricTemplateId}, dimensions=${promptData.dimensions.length}`)

  // GPT JSON mode çağrısı
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const llmStart = Date.now()
  console.log(`[runEvaluation] LLM call başlatıldı — model=${process.env.OPENAI_LLM_MODEL ?? 'gpt-4o'}`)

  let response
  try {
    response = await client.chat.completions.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4o',
      messages: [
        { role: 'system', content: promptData.systemPrompt },
        { role: 'user', content: promptData.userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    })
  } catch (err) {
    console.error('[runEvaluation] FAIL OpenAI çağrısı:', (err as Error).message)
    throw err
  }

  const latencyMs = Date.now() - llmStart
  const rawJson = response.choices[0]?.message?.content ?? ''
  console.log(`[runEvaluation] LLM tamam — ${latencyMs}ms, ${rawJson.length} char, tokens prompt=${response.usage?.prompt_tokens}, completion=${response.usage?.completion_tokens}`)

  // Parse
  // Şemada: improvement_tip + rationale AYRI alanlar (önceki feedback tek alanı kaldırıldı).
  // Geriye dönük uyumluluk: eski log'larda "feedback" varsa onu rationale'e fallback yap.
  let parsed: {
    dimensions: Array<{
      dimension_code: string
      score: number
      evidence: string[]
      improvement_tip?: string
      rationale?: string
      // Eski şemadan gelirse (geçiş süresi):
      feedback?: string
    }>
    overall_score: number
    strengths: string[]
    development_areas: string[]
    coaching_note: string
    manager_insight: string
  }

  try {
    parsed = JSON.parse(rawJson)
  } catch {
    console.error('[runEvaluation] FAIL JSON parse — raw:', rawJson.slice(0, 500))
    throw new Error('GPT yanıtı geçerli JSON değil')
  }
  console.log(`[runEvaluation] JSON parse OK — dim=${parsed.dimensions?.length}, overall=${parsed.overall_score}`)

  // Skor validasyonu
  const overallScore = Math.min(5, Math.max(1, Number(parsed.overall_score) || 0))
  if (!overallScore) {
    console.error(`[runEvaluation] FAIL overall_score: ${parsed.overall_score}`)
    throw new Error('overall_score geçersiz')
  }

  // Evaluations tablosuna yaz
  // KRİTİK: rubric_template_id NOT NULL (migration 008) — buildEvaluationPrompt'tan gelen
  // ID burada zorunlu. Eksik bırakılırsa her insert silently fail olur, evaluation oluşmaz.
  const { data: evaluation, error: evalError } = await supabase
    .from('evaluations')
    .insert({
      session_id: sessionId,
      user_id: session.user_id,
      tenant_id: session.tenant_id,
      rubric_template_id: promptData.rubricTemplateId,
      overall_score: overallScore,
      strengths: parsed.strengths ?? [],
      development_areas: parsed.development_areas ?? [],
      coaching_note: parsed.coaching_note ?? '',
      manager_insight: parsed.manager_insight ?? '',
      status: 'completed',
    })
    .select('id')
    .single()

  if (evalError || !evaluation) {
    console.error('[runEvaluation] evaluations insert FAIL:', evalError, {
      sessionId,
      rubric_template_id: promptData.rubricTemplateId,
    })
    throw new Error(`Değerlendirme kaydedilemedi: ${evalError?.message}`)
  }
  console.log(`[runEvaluation] evaluations insert OK — evaluationId=${evaluation.id}`)

  // Dimension scores yaz
  // Şema (migration 008): evaluation_id, dimension_code, score, evidence_quotes,
  // rationale, improvement_tip.
  // improvement_tip ve rationale AYRI alanlar — prompt schema'sında ayrılığı zorunlu kıldık.
  // Geriye dönük uyumluluk: eski LLM yanıtında sadece `feedback` varsa onu rationale'e fallback,
  // improvement_tip boş kalsın (eski raporlarda zaten kopyaydı).
  type ParsedDimension = {
    dimension_code: string
    score: number
    evidence: string[]
    improvement_tip?: string
    rationale?: string
    feedback?: string
  }
  const dimensionInserts = (parsed.dimensions ?? []).map((d: ParsedDimension) => {
    const tip = (d.improvement_tip ?? '').trim()
    const reason = (d.rationale ?? '').trim()
    // Geriye dönük: yeni alanlar boşsa eski feedback'i rationale'e ata.
    const fallbackReason = !tip && !reason ? (d.feedback ?? '').trim() : reason
    return {
      evaluation_id: evaluation.id,
      dimension_code: d.dimension_code,
      score: Math.min(5, Math.max(1, Number(d.score) || 3)),
      evidence_quotes: d.evidence ?? [],
      improvement_tip: tip,
      rationale: fallbackReason,
    }
  })

  if (dimensionInserts.length > 0) {
    const { error: dimError } = await supabase
      .from('dimension_scores')
      .insert(dimensionInserts)

    if (dimError) {
      // Dimension yazımı başarısız — evaluation kaydı silinmez, uyarı loglanır
      console.error('[runEvaluation] dimension_scores insert FAIL:', dimError.message, {
        evaluationId: evaluation.id,
        dimensionCount: dimensionInserts.length,
      })
    }
  }

  // Kullanım metriğini kaydet — non-fatal: evaluation zaten yazıldı,
  // bu insert fail olursa runEvaluation'ı çökertmemeli (idempotency kırılır).
  // Şema (migration 010): metric_type (event_type DEĞİL) + provider zorunlu.
  try {
    const { error: usageErr } = await supabase.from('usage_metrics').insert({
      session_id: sessionId,
      tenant_id: session.tenant_id,
      user_id: session.user_id,
      metric_type: 'evaluation',
      provider: 'openai',
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4o',
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
      latency_ms: latencyMs,
    })
    if (usageErr) console.error('[runEvaluation] usage_metrics insert FAIL (non-fatal):', usageErr.message)
  } catch (err) {
    console.error('[runEvaluation] usage_metrics throw (non-fatal):', (err as Error).message)
  }

  // Değerlendirme promptunu şifreli logla — non-fatal
  try {
    const { error: promptLogErr } = await supabase.from('prompt_logs').insert({
      session_id: sessionId,
      tenant_id: session.tenant_id,
      user_id: session.user_id,
      prompt_type: 'evaluation_scoring',
      encrypted_content: encrypt(promptData.userPrompt),
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4o',
      provider: 'openai',
    })
    if (promptLogErr) console.error('[runEvaluation] prompt_logs insert FAIL (non-fatal):', promptLogErr.message)
  } catch (err) {
    console.error('[runEvaluation] prompt_logs throw (non-fatal):', (err as Error).message)
  }

  // Bildirim: değerlendirme tamamlandı (fire-and-forget)
  const appUrl = process.env.QSTASH_RECEIVER_URL ?? ''
  createNotification(session.user_id, session.tenant_id, 'evaluation_completed', {
    sessionId,
    reportUrl: `${appUrl}/dashboard/sessions/${sessionId}/report`,
  }).catch((e) => console.error('[eval] Bildirim gönderilemedi (non-fatal):', e))

  console.log(`[runEvaluation] DONE — evaluationId=${evaluation.id}, total=${Date.now() - t0}ms`)
  return {
    evaluationId: evaluation.id,
    overallScore,
    dimensionCount: dimensionInserts.length,
  }
}
