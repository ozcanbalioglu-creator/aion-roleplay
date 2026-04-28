import { NextRequest } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getLLMAdapter } from '@/adapters/llm'
import { encrypt, decrypt } from '@/lib/encryption'

const receiver = new Receiver({
  currentSigningKey: process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY!,
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  // QStash imza doğrulama
  const body = await req.text()
  const signature = req.headers.get('upstash-signature') ?? ''

  try {
    await receiver.verify({ signature, body, url: req.url })
  } catch {
    return new Response('Invalid QStash signature', { status: 401 })
  }

  let parsedBody: { sessionId?: string }
  try {
    parsedBody = JSON.parse(body)
  } catch {
    return new Response('Invalid body', { status: 400 })
  }

  if (parsedBody.sessionId !== sessionId) {
    return new Response('Session ID mismatch', { status: 400 })
  }

  const supabase = await createServiceRoleClient()

  // Seans bilgisi
  const { data: session } = await supabase
    .from('sessions')
    .select('id, tenant_id, status')
    .eq('id', sessionId)
    .single()

  if (!session) return new Response('Seans bulunamadı', { status: 404 })

  // Son özet indeksini bul (son covers_messages_to + 1 = yeni başlangıç)
  const { data: lastSummary } = await supabase
    .from('session_summaries')
    .select('summary_index, covers_messages_to')
    .eq('session_id', sessionId)
    .order('summary_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastCoveredTo = lastSummary?.covers_messages_to ?? 0
  const nextSummaryIndex = (lastSummary?.summary_index ?? 0) + 1
  const newFrom = lastCoveredTo + 1
  const newTo = lastCoveredTo + 5

  // Özetlenecek 5 mesajı sıra numarasıyla al (system hariç)
  const { data: rawMessages } = await supabase
    .from('session_messages')
    .select('role, content, sequence_number')
    .eq('session_id', sessionId)
    .neq('role', 'system')
    .order('sequence_number', { ascending: true })
    .range(newFrom - 1, newTo - 1) // range is 0-based

  if (!rawMessages || rawMessages.length < 5) {
    // Henüz 5 tam mesaj yok, atla
    return new Response(JSON.stringify({ skipped: true, reason: 'not_enough_messages' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Mesajları şifre çöz
  const messages = rawMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: decrypt(m.content),
  }))

  // Tenant'ın aktif rubric boyutlarını al
  const { data: rubricTemplate } = await supabase
    .from('rubric_templates')
    .select('rubric_dimensions(dimension_code, name)')
    .or(`tenant_id.eq.${session.tenant_id},tenant_id.is.null`)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const dimensions: string[] = (rubricTemplate as any)?.rubric_dimensions?.map(
    (d: { dimension_code: string; name: string }) => d.dimension_code
  ) ?? []

  const dimensionList = dimensions.length > 0
    ? `Rubric boyutları: ${dimensions.join(', ')}`
    : 'ICF koçluk yetkinlikleri boyutları'

  // Özetleme promptu
  const transcriptText = messages
    .map((m) => `${m.role === 'user' ? 'Koç' : 'Danışan'}: ${m.content}`)
    .join('\n')

  const summarizePrompt = `Aşağıdaki 5 mesajlık koçluk konuşmasını analiz et ve JSON formatında özetle.

${dimensionList}

Konuşma:
${transcriptText}

Şu kriterlere göre özetle:
(a) Koçun sorduğu güçlü sorular
(b) Yapılan yansıtmalar ve empati anları
(c) Danışanın ifade ettiği duygu veya bakış açısı değişimi
(d) Oluşturulan anlaşma veya aksiyon çerçevesi işaretleri

Yanıtı YALNIZCA şu JSON formatında ver (başka metin ekleme):
{
  "summary": "Konuşmanın koçluk bağlamındaki kısa özeti (2-4 cümle)",
  "rubric_signals": {
    "dimension_code": ["evidence1", "evidence2"]
  }
}`

  // LLM çağrısı (JSON formatında, non-streaming)
  const llm = getLLMAdapter()
  let summaryText = ''
  let rubricSignals: Record<string, string[]> = {}

  try {
    const response = await llm.chat({
      systemPrompt: 'Sen bir koçluk seansı analisti ve değerlendiricisin. Verilen konuşmayı rubric boyutlarına göre analiz ederek özet çıkarsın.',
      messages: [{ role: 'user', content: summarizePrompt }],
      responseFormat: 'json_object',
      temperature: 0.3,
      maxTokens: 600,
    })

    const parsed = JSON.parse(response.content)
    summaryText = parsed.summary ?? ''
    rubricSignals = parsed.rubric_signals ?? {}
  } catch (err) {
    console.error('[summarize] LLM veya JSON parse hatası:', err)
    return new Response('Özetleme başarısız', { status: 500 })
  }

  // Özeti şifrele ve kaydet
  const encryptedContent = encrypt(JSON.stringify({ summary: summaryText, rubric_signals: rubricSignals }))

  const { error: insertError } = await supabase.from('session_summaries').insert({
    session_id: sessionId,
    tenant_id: session.tenant_id,
    summary_index: nextSummaryIndex,
    covers_messages_from: newFrom,
    covers_messages_to: newTo,
    encrypted_content: encryptedContent,
    rubric_signals: rubricSignals,
  })

  if (insertError) {
    console.error('[summarize] DB insert hatası:', insertError)
    return new Response('Özet kaydedilemedi', { status: 500 })
  }

  return new Response(
    JSON.stringify({ ok: true, summaryIndex: nextSummaryIndex, from: newFrom, to: newTo }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
