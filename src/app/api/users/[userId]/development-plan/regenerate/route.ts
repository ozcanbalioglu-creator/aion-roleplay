import { NextRequest } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getLLMAdapter } from '@/adapters/llm'

export const maxDuration = 60

const receiver = new Receiver({
  currentSigningKey: process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY!,
})

const SYSTEM_PROMPT = `Sen bir profesyonel koçluk uzmanısın. Kullanıcının son roleplay seanslarından elde edilen değerlendirme verilerini analiz edecek ve kişiselleştirilmiş bir gelişim planı oluşturacaksın.

Yanıtını MUTLAKA şu JSON formatında ver (başka hiçbir şey ekleme):
{
  "top_strengths": ["güçlü yan 1", "güçlü yan 2", "güçlü yan 3"],
  "priority_development_areas": ["gelişim alanı 1", "gelişim alanı 2", "gelişim alanı 3"],
  "training_recommendations": [
    {"topic": "Eğitim konusu", "format": "online course", "reason": "Neden bu eğitim öneriliyor"},
    {"topic": "Eğitim konusu 2", "format": "workshop", "reason": "Neden bu eğitim öneriliyor"}
  ],
  "book_recommendations": [
    {"title": "Kitap Adı", "author": "Yazar Adı", "reason": "Neden bu kitap öneriliyor"},
    {"title": "Kitap Adı 2", "author": "Yazar Adı 2", "reason": "Neden bu kitap öneriliyor"}
  ],
  "coach_note": "Kullanıcıya özel motivasyonel ve yönlendirici kısa not (2-3 cümle)"
}

format değerleri: "online course", "workshop", "practice", "mentoring"`

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const body = await req.text()
  const signature = req.headers.get('upstash-signature') ?? ''

  try {
    await receiver.verify({ signature, body, url: req.url })
  } catch {
    return new Response('Invalid QStash signature', { status: 401 })
  }

  let parsed: { userId?: string; tenantId?: string }
  try {
    parsed = JSON.parse(body)
  } catch {
    return new Response('Invalid body', { status: 400 })
  }

  if (parsed.userId !== userId || !parsed.tenantId) {
    return new Response('Invalid payload', { status: 400 })
  }

  const tenantId = parsed.tenantId
  const serviceSupabase = await createServiceRoleClient()

  // Son 5 tamamlanmış seansın değerlendirmelerini al
  const { data: sessions } = await serviceSupabase
    .from('sessions')
    .select('id, completed_at, personas(name), scenarios(title)')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('status', 'debrief_completed')
    .order('completed_at', { ascending: false })
    .limit(5)

  if (!sessions?.length) {
    return new Response(JSON.stringify({ skipped: true, reason: 'No completed sessions' }), {
      status: 200,
    })
  }

  const sessionIds = sessions.map((s) => s.id)

  const { data: evaluations } = await serviceSupabase
    .from('evaluations')
    .select(
      'id, session_id, overall_score, strengths, development_areas, coaching_note, dimension_scores(dimension_code, score, improvement_tip, rationale)'
    )
    .in('session_id', sessionIds)

  if (!evaluations?.length) {
    return new Response(JSON.stringify({ skipped: true, reason: 'No evaluations' }), {
      status: 200,
    })
  }

  // Boyut adları için rubric meta — `dimension_name` değil `name` (migration 026)
  const { data: dimMeta } = await serviceSupabase
    .from('rubric_dimensions')
    .select('dimension_code, name')

  const dimNameMap = new Map(dimMeta?.map((d) => [d.dimension_code, d.name]) ?? [])

  // LLM için veri özetini hazırla
  const evalSummary = evaluations.map((ev) => {
    const session = sessions.find((s) => s.id === ev.session_id)
    const dimScores = Array.isArray(ev.dimension_scores) ? ev.dimension_scores : []
    return {
      seans: `${(session?.personas as any)?.name ?? '?'} — ${(session?.scenarios as any)?.title ?? '?'}`,
      genel_puan: ev.overall_score,
      guclu_yanlar: Array.isArray(ev.strengths) ? ev.strengths : [],
      gelisim_alanlari: Array.isArray(ev.development_areas) ? ev.development_areas : [],
      boyutlar: dimScores.map((d: any) => ({
        boyut: dimNameMap.get(d.dimension_code) ?? d.dimension_code,
        puan: d.score,
        geri_bildirim: d.improvement_tip || d.rationale || '',
      })),
    }
  })

  const userPrompt = `Kullanıcının son ${evalSummary.length} seansının değerlendirme verisi:

${JSON.stringify(evalSummary, null, 2)}

Bu verileri analiz ederek kişiselleştirilmiş gelişim planı oluştur. Önerilerin somut, uygulanabilir ve bu kullanıcının özel örüntülerine dayalı olmasına dikkat et.`

  const llm = getLLMAdapter()
  let rawJson = ''

  try {
    const result = await llm.chat({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.7,
      maxTokens: 1200,
      responseFormat: 'json_object',
    })
    rawJson = result.content
  } catch (err) {
    console.error('[dev-plan] LLM hatası:', err)
    return new Response(JSON.stringify({ error: 'LLM failed' }), { status: 500 })
  }

  let plan: {
    top_strengths: string[]
    priority_development_areas: string[]
    training_recommendations: object[]
    book_recommendations: object[]
    coach_note: string
  }

  try {
    plan = JSON.parse(rawJson)
  } catch {
    console.error('[dev-plan] JSON parse hatası:', rawJson)
    return new Response(JSON.stringify({ error: 'Invalid LLM JSON' }), { status: 500 })
  }

  // Upsert — her kullanıcı için tek kayıt (en yeni)
  // Önce eskiyi sil
  await serviceSupabase
    .from('user_development_plans')
    .delete()
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)

  const { error: insertError } = await serviceSupabase
    .from('user_development_plans')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      sessions_considered: sessionIds,
      top_strengths: plan.top_strengths ?? [],
      priority_development_areas: plan.priority_development_areas ?? [],
      training_recommendations: plan.training_recommendations ?? [],
      book_recommendations: plan.book_recommendations ?? [],
      coach_note: plan.coach_note ?? null,
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })

  if (insertError) {
    console.error('[dev-plan] DB insert hatası:', insertError.message)
    return new Response(JSON.stringify({ error: 'DB insert failed' }), { status: 500 })
  }

  return new Response(JSON.stringify({ success: true, sessionsConsidered: sessionIds.length }), {
    status: 200,
  })
}
