import { NextRequest } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getLLMAdapter } from '@/adapters/llm'
import { saveSessionMessage, getSessionHistory } from '@/lib/session/message.service'
import { endSessionAction } from '@/lib/actions/session.actions'
import type { SessionPhase } from '@/lib/session/message.service'
import { decrypt } from '@/lib/encryption'

export const maxDuration = 60

// Geniş tolerant: bracket varyasyonları, boşluk, büyük/küçük harf, çoklu eşleşme.
// Faz çıkarımı için ayrı bir bracket-strict regex kullanılır.
const PHASE_MARKER_STRIP_REGEX = /\[\s*PHASE\s*:?\s*[a-zA-Z_]+\s*\]/gi
const PHASE_MARKER_PARSE_REGEX = /\[PHASE:(opening|exploration|deepening|action|closing)\]/i
// Naked "Phase Opening", "Faz: opening" gibi bracket'sız ifadeler — TTS leak'i önlemek için.
const NAKED_PHASE_REGEX = /\b(?:phase|faz)\s*[:\-]?\s*(?:opening|exploration|deepening|action|closing|a[çc][ıi]l[ıi][şs]|ke[şs]if|derinle[şs]me|aksiyon|kapan[ıi][şs])\b\.?/gi
const SESSION_END_MARKER = '[SESSION_END]'
const SESSION_END_NAKED_REGEX = /\bSESSION[\s_-]?END\b/gi

function stripMarkers(text: string): string {
  return text
    .replace(PHASE_MARKER_STRIP_REGEX, '')
    .replace(NAKED_PHASE_REGEX, '')
    .replace(SESSION_END_MARKER, '')
    .replace(SESSION_END_NAKED_REGEX, '')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  // Auth kontrolü
  const currentUser = await getCurrentUser()
  if (!currentUser) return new Response('Unauthorized', { status: 401 })

  // Body parse
  const body = await req.json()
  const userMessage: string = body.message?.trim()
  if (!userMessage) return new Response('Mesaj boş olamaz', { status: 400 })

  // Seans doğrulama
  const supabase = await createServerClient()
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, phase, persona_id, scenario_id, tenant_id, user_id')
    .eq('id', sessionId)
    .single()

  if (!session) return new Response('Seans bulunamadı', { status: 404 })
  if (session.user_id !== currentUser.id) return new Response('Yetkisiz', { status: 403 })
  if (session.status !== 'active') return new Response('Seans aktif değil', { status: 409 })

  // Mevcut seans fazı
  const currentPhase = (session.phase as SessionPhase) ?? 'opening'

  // Şifreli sistem promptunu prompt_logs'tan al
  const serviceSupabase = await createServiceRoleClient()
  const { data: promptLog } = await serviceSupabase
    .from('prompt_logs')
    .select('encrypted_content')
    .eq('session_id', sessionId)
    .eq('prompt_type', 'role_play_system')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!promptLog?.encrypted_content) {
    return new Response('Sistem prompt bulunamadı', { status: 500 })
  }

  const systemPrompt = decrypt(promptLog.encrypted_content)

  // Mesaj tarihçesi: tam ham mesaj geçmişi (50 mesaj limit).
  // Karar (2026-04-27): tipik 13-25 turlık seanslar için summary lossy compression yapıyordu —
  // gpt-4o 128k context taşıyor, full history daha güvenilir bağlam veriyor.
  // Summary worker uzun seanslar için (50+) hâlâ devrede; bu noktadan sonra summary+ham karışımı sağlar.
  const history = await getSessionHistory(sessionId, 50)

  // Kullanıcı mesajını kaydet
  await saveSessionMessage({
    sessionId,
    role: 'user',
    content: userMessage,
    phase: currentPhase,
  })

  // OpenAI streaming
  const llm = getLLMAdapter()
  
  const startTime = Date.now()
  let fullResponse = ''
  let detectedPhase: SessionPhase = currentPhase
  let sessionEnded = false

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const openaiStream = llm.streamChat({
          systemPrompt,
          messages: [
            ...history as any,
            { role: 'user', content: userMessage }
          ],
          temperature: 0.85,
          maxTokens: 800
        })

        for await (const chunk of openaiStream) {
          const text = chunk
          if (!text) continue

          fullResponse += text

          // Stream tarafında marker leak'i — chunk-bazlı strip ediyoruz ama
          // marker iki chunk'a bölünmüşse bu chunk'ta tutmayabilir; client tarafında da
          // accumulated text üzerinde tekrar strip yapılır (defansif çoklu katman).
          const cleanText = stripMarkers(text)

          if (cleanText) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: cleanText })}\n\n`))
          }
        }

        // Faz marker'ını parse et
        const phaseMatch = fullResponse.match(PHASE_MARKER_PARSE_REGEX)
        if (phaseMatch) {
          detectedPhase = phaseMatch[1].toLowerCase() as SessionPhase
        }

        // SESSION_END kontrolü (bracket veya naked)
        const aiRequestedEnd =
          fullResponse.includes(SESSION_END_MARKER) || SESSION_END_NAKED_REGEX.test(fullResponse)
        SESSION_END_NAKED_REGEX.lastIndex = 0 // global regex stateful — sıfırla

        // GUARDRAIL: AI [SESSION_END] göndermiş olsa bile, konuşma çok kısa ise saygı gösterme.
        // PROMPT-EARLYEND-001 prompt'ta 13 tur kuralı koyduk ama LLM bunu her zaman dinlemiyor.
        // Server-side hard floor: en az 8 user-assistant alışverişi (~16 mesaj) tamamlanmadan
        // [SESSION_END] göz ardı edilir, AI konuşmaya devam eder. Kısa cutoff cevaplarında
        // yanlışlıkla seans bitmez.
        const SESSION_END_MIN_MESSAGES = 16
        const { count: msgCount } = await supabase
          .from('session_messages')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionId)
          .neq('role', 'system')

        sessionEnded = aiRequestedEnd && (msgCount ?? 0) >= SESSION_END_MIN_MESSAGES

        if (aiRequestedEnd && !sessionEnded) {
          console.log(
            `[Chat] AI [SESSION_END] guardrail tetiklendi: msgCount=${msgCount} < ${SESSION_END_MIN_MESSAGES}, marker yok sayıldı`
          )
        }

        // Temiz yanıtı oluştur (marker'lar olmadan)
        const cleanResponse = stripMarkers(fullResponse).trim()

        // AI yanıtını kaydet
        const latencyMs = Date.now() - startTime
        await saveSessionMessage({
          sessionId,
          role: 'assistant',
          content: cleanResponse,
          phase: detectedPhase,
          metadata: { latency_ms: latencyMs },
        })

        // Faz güncellemesi
        if (detectedPhase !== currentPhase) {
          await supabase
            .from('sessions')
            .update({ phase: detectedPhase })
            .eq('id', sessionId)
        }

        // Seans sonu
        if (sessionEnded) {
          await endSessionAction(sessionId, 'ai_ended')
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sessionEnded: true })}\n\n`))
        }

        // Faz bilgisini client'a ilet
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ phase: detectedPhase, done: true })}\n\n`)
        )
        controller.close()
      } catch (error) {
        // Client abort'ı (kullanıcının pencereyi kapatması, yeni istek başlatması, barge-in)
        // gerçek bir hata DEĞİL — session'ı 'failed' yapmamalıyız.
        const errName = (error as Error)?.name ?? ''
        const isClientAbort =
          req.signal.aborted ||
          errName === 'AbortError' ||
          errName === 'ResponseAborted' ||
          /aborted|closed/i.test((error as Error)?.message ?? '')

        if (isClientAbort) {
          console.log('[Chat] Client aborted; session preserved')
          try { controller.close() } catch {}
          return
        }

        const errMsg = (error as Error)?.message ?? 'unknown'
        console.error('Streaming Chat Error:', errMsg, error)
        await supabase
          .from('sessions')
          .update({ status: 'failed' })
          .eq('id', sessionId)

        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: `Yanıt üretilemedi: ${errMsg}` })}\n\n`)
          )
          controller.close()
        } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
