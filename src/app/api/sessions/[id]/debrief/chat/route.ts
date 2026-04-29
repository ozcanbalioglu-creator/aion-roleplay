import { NextRequest } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getLLMAdapter } from '@/adapters/llm'
import { buildDebriefSystemPrompt } from '@/lib/session/debrief-prompt.builder'
import { encrypt, decrypt } from '@/lib/encryption'

// Tolerant regex: bracket varyantları ("[DEBRIEF_END]", "[ DEBRIEF END ]", "[debrief-end]"),
// naked ifade ("DEBRIEF_END", "DEBRIEF END") — TTS/UI leak'i önlemek için tüm formları yakalar.
const DEBRIEF_END_BRACKET_REGEX = /\[\s*DEBRIEF[\s_-]?END\s*\]/gi
const DEBRIEF_END_NAKED_REGEX = /\bDEBRIEF[\s_-]?END\b/gi
// Stream chunk boundary'sinde marker bölünebileceği için tail buffer:
// "[DEBRIEF_END]" 13 karakter; bracket+boşluk varyantı 16'ya çıkar; güvenli pay 20 char.
const MARKER_TAIL_HOLD = 20

function stripDebriefMarkers(text: string): string {
  return text.replace(DEBRIEF_END_BRACKET_REGEX, '').replace(DEBRIEF_END_NAKED_REGEX, '')
}

// En az 6 mesaj (3 tur: kullanıcı+koç x3) olmadan debrief bitmez.
const DEBRIEF_END_MIN_MESSAGES = 6

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  const currentUser = await getCurrentUser()
  if (!currentUser) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const userMessage: string = body.message?.trim()
  if (!userMessage) return new Response('Mesaj boş olamaz', { status: 400 })

  const supabase = await createServerClient()
  const serviceSupabase = await createServiceRoleClient()

  // Seans doğrulama
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, user_id, persona_id, scenario_id')
    .eq('id', sessionId)
    .single()

  if (!session) return new Response('Seans bulunamadı', { status: 404 })
  if (session.user_id !== currentUser.id) return new Response('Yetkisiz', { status: 403 })
  if (session.status !== 'debrief_active') {
    return new Response('Seans debrief modunda değil', { status: 409 })
  }

  // Persona + senaryo bilgisi
  const [{ data: persona }, { data: scenario }] = await Promise.all([
    serviceSupabase.from('personas').select('name').eq('id', session.persona_id).single(),
    serviceSupabase.from('scenarios').select('title').eq('id', session.scenario_id).single(),
  ])

  const debriefSystemPrompt = buildDebriefSystemPrompt({
    personaName: persona?.name ?? 'Persona',
    scenarioTitle: scenario?.title ?? 'Senaryo',
    userName: currentUser.full_name?.split(' ')[0] ?? '',
  })

  // Debrief sohbet geçmişini al (şifre çöz)
  const { data: history } = await serviceSupabase
    .from('debrief_messages')
    .select('role, encrypted_content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(20)

  const historyMessages = (history ?? []).map((m) => ({
    role: m.role === 'coach' ? ('assistant' as const) : ('user' as const),
    content: decrypt(m.encrypted_content),
  }))

  // Kullanıcı mesajını kaydet (init mesajları hariç)
  const isInit = userMessage.startsWith('[DEBRIEF_INIT]')
  const chatMessage = isInit ? userMessage.slice('[DEBRIEF_INIT]'.length) : userMessage

  if (!isInit) {
    await serviceSupabase.from('debrief_messages').insert({
      session_id: sessionId,
      role: 'user',
      encrypted_content: encrypt(chatMessage),
      phase: 'feedback',
    })
  }

  // SSE stream
  const llm = getLLMAdapter()
  let fullResponse = ''
  let debriefEnded = false

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const openaiStream = llm.streamChat({
          systemPrompt: debriefSystemPrompt,
          messages: [
            ...historyMessages,
            { role: 'user', content: chatMessage },
          ],
          temperature: 0.85,
          maxTokens: 400,
        })

        // Tail buffer pattern: marker chunk boundary'sinde bölünürse de yakalanır.
        // Her chunk geldiğinde pending'e ekle, marker variants'larını strip et,
        // son MARKER_TAIL_HOLD karakteri tut (potansiyel kısmi marker olabilir),
        // gerisini client'a emit et. Stream sonunda buffer'ı flush et.
        let pending = ''

        for await (const chunk of openaiStream) {
          if (!chunk) continue
          fullResponse += chunk
          pending += chunk

          // Tam marker varsa strip et
          pending = stripDebriefMarkers(pending)

          // Tail'i tut, gerisini emit et
          if (pending.length > MARKER_TAIL_HOLD) {
            const emit = pending.slice(0, pending.length - MARKER_TAIL_HOLD)
            pending = pending.slice(pending.length - MARKER_TAIL_HOLD)
            if (emit) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: emit })}\n\n`))
            }
          }
        }

        // Stream bitti — kalan tail'i temizle ve flush et
        pending = stripDebriefMarkers(pending)
        if (pending) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: pending })}\n\n`))
        }

        // String.match stateless; global regex .test() lastIndex sızıntısını engellemek için.
        const markerPresent =
          fullResponse.match(DEBRIEF_END_BRACKET_REGEX) !== null ||
          fullResponse.match(DEBRIEF_END_NAKED_REGEX) !== null

        if (markerPresent) {
          const { count } = await serviceSupabase
            .from('debrief_messages')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', sessionId)
          if ((count ?? 0) < DEBRIEF_END_MIN_MESSAGES) {
            console.log(`[debrief/chat] DEBRIEF_END guardrail: msgCount=${count} < ${DEBRIEF_END_MIN_MESSAGES}, marker ignored`)
          } else {
            debriefEnded = true
          }
        }

        const cleanResponse = stripDebriefMarkers(fullResponse).trim()

        // Koç yanıtını kaydet
        const phase = historyMessages.length < 4 ? 'intro' : debriefEnded ? 'closing' : 'feedback'
        await serviceSupabase.from('debrief_messages').insert({
          session_id: sessionId,
          role: 'coach',
          encrypted_content: encrypt(cleanResponse),
          phase,
        })

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ debriefEnded, done: true })}\n\n`)
        )
        controller.close()
      } catch (err) {
        console.error('[debrief/chat] Hata:', err)
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
