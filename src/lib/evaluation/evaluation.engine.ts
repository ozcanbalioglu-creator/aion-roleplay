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
  const supabase = await createServiceRoleClient()

  // İdempotans kontrolü
  const { data: existing } = await supabase
    .from('evaluations')
    .select('id, overall_score')
    .eq('session_id', sessionId)
    .single()

  if (existing) {
    return {
      evaluationId: existing.id,
      overallScore: existing.overall_score,
      dimensionCount: 0,
    }
  }

  // Seans bilgisini al — debrief flow'unda status 'debrief_active' veya 'debrief_completed' olur,
  // legacy 'completed' de kabul edilir.
  const { data: session } = await supabase
    .from('sessions')
    .select('id, user_id, tenant_id, persona_id, scenario_id, duration_seconds, status')
    .eq('id', sessionId)
    .in('status', ['completed', 'debrief_active', 'debrief_completed'])
    .single()

  if (!session) throw new Error(`Değerlendirilebilir seans bulunamadı (sessionId=${sessionId})`)

  // Transcript
  const transcript = await getDecryptedTranscript(sessionId)
  if (transcript.totalMessages < 4) throw new Error('Değerlendirme için yeterli mesaj yok (min 4)')

  // Değerlendirme promptu
  const promptData = await buildEvaluationPrompt(sessionId, session.tenant_id, transcript)

  // GPT JSON mode çağrısı
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const startTime = Date.now()

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4o', // Model ismini güncel tutalım
    messages: [
      { role: 'system', content: promptData.systemPrompt },
      { role: 'user', content: promptData.userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 2000,
  })

  const latencyMs = Date.now() - startTime
  const rawJson = response.choices[0]?.message?.content ?? ''

  // Parse
  let parsed: {
    dimensions: Array<{
      dimension_code: string
      score: number
      evidence: string[]
      feedback: string
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
    throw new Error('GPT yanıtı geçerli JSON değil')
  }

  // Skor validasyonu
  const overallScore = Math.min(5, Math.max(1, Number(parsed.overall_score) || 0))
  if (!overallScore) throw new Error('overall_score geçersiz')

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

  // Dimension scores yaz
  // Şema (migration 008): evaluation_id, dimension_code, score, evidence_quotes,
  // rationale, improvement_tip — session_id ve tenant_id YOK; evidence/feedback yanlış adlar.
  // Eski koddaki insert sessizce fail ediyordu; rapor boyut analizi hep boş geliyordu.
  type ParsedDimension = { dimension_code: string; score: number; evidence: string[]; feedback: string }
  const dimensionInserts = (parsed.dimensions ?? []).map((d: ParsedDimension) => ({
    evaluation_id: evaluation.id,
    dimension_code: d.dimension_code,
    score: Math.min(5, Math.max(1, Number(d.score) || 3)),
    evidence_quotes: d.evidence ?? [],
    improvement_tip: d.feedback ?? '',
    rationale: d.feedback ?? '',
  }))

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

  // Kullanım metriğini kaydet
  await supabase.from('usage_metrics').insert({
    session_id: sessionId,
    tenant_id: session.tenant_id,
    user_id: session.user_id,
    event_type: 'evaluation',
    prompt_tokens: response.usage?.prompt_tokens ?? 0,
    completion_tokens: response.usage?.completion_tokens ?? 0,
    model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.5',
    latency_ms: latencyMs,
  })

  // Değerlendirme promptunu şifreli logla
  await supabase.from('prompt_logs').insert({
    session_id: sessionId,
    tenant_id: session.tenant_id,
    user_id: session.user_id,
    prompt_type: 'evaluation_scoring',
    encrypted_content: encrypt(promptData.userPrompt),
    model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.5',
    provider: 'openai',
  })

  // Bildirim: değerlendirme tamamlandı (fire-and-forget)
  const appUrl = process.env.QSTASH_RECEIVER_URL ?? ''
  createNotification(session.user_id, session.tenant_id, 'evaluation_completed', {
    sessionId,
    reportUrl: `${appUrl}/dashboard/sessions/${sessionId}/report`,
  }).catch((e) => console.error('[eval] Bildirim gönderilemedi:', e))

  return {
    evaluationId: evaluation.id,
    overallScore,
    dimensionCount: dimensionInserts.length,
  }
}
