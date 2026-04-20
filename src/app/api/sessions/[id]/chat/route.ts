import { NextRequest } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getLLMAdapter } from '@/adapters/llm'
import { saveSessionMessage, getSessionHistory } from '@/lib/session/message.service'
import { endSessionAction } from '@/lib/actions/session.actions'
import type { SessionPhase } from '@/lib/session/message.service'
import { decrypt } from '@/lib/encryption'

const PHASE_MARKER_REGEX = /\[PHASE:(opening|exploration|deepening|action|closing)\]/
const SESSION_END_MARKER = '[SESSION_END]'

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
    .eq('prompt_type', 'system')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!promptLog?.encrypted_content) {
    return new Response('Sistem prompt bulunamadı', { status: 500 })
  }

  const systemPrompt = decrypt(promptLog.encrypted_content)

  // Mesaj tarihçesi
  const history = await getSessionHistory(sessionId, 40)

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

          // Faz marker'ı ve SESSION_END marker'ı içermeyen kısmı stream et
          const cleanText = text
            .replace(PHASE_MARKER_REGEX, '')
            .replace(SESSION_END_MARKER, '')

          if (cleanText) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: cleanText })}\n\n`))
          }
        }

        // Faz marker'ını parse et
        const phaseMatch = fullResponse.match(PHASE_MARKER_REGEX)
        if (phaseMatch) {
          detectedPhase = phaseMatch[1] as SessionPhase
        }

        // SESSION_END kontrolü
        sessionEnded = fullResponse.includes(SESSION_END_MARKER)

        // Temiz yanıtı oluştur (marker'lar olmadan)
        const cleanResponse = fullResponse
          .replace(PHASE_MARKER_REGEX, '')
          .replace(SESSION_END_MARKER, '')
          .trim()

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
        console.error('Streaming Chat Error:', error)
        // Hata durumunda seans FAILED'a al
        await supabase
          .from('sessions')
          .update({ status: 'failed' })
          .eq('id', sessionId)

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Yanıt üretilemedi' })}\n\n`)
        )
        controller.close()
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
