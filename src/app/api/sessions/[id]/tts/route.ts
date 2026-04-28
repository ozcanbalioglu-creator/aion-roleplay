import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getTTSAdapter } from '@/adapters/tts'

export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  const currentUser = await getCurrentUser()
  if (!currentUser) return new Response('Unauthorized', { status: 401 })

  // Seans doğrulama — persona voice_id ile birlikte
  const supabase = await createServerClient()
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, user_id, session_mode, persona:personas(voice_id)')
    .eq('id', sessionId)
    .single<{
      id: string
      status: string
      user_id: string
      session_mode: string | null
      persona: { voice_id: string | null } | null
    }>()

  if (!session) return new Response('Seans bulunamadı', { status: 404 })
  if (session.user_id !== currentUser.id) return new Response('Yetkisiz', { status: 403 })
  // Hem 'active' hem 'debrief_active' kabul edilir — AI [SESSION_END] gönderdiğinde server status'u
  // anında 'debrief_active' yapıyor ama AI'ın son veda cümlesinin TTS'i hâlâ ihtiyaç duyuluyor.
  // Race window: chat route status'u değiştiriyor → client TTS isteği atıyor → eskiden 409 alıyordu.
  if (!['active', 'debrief_active'].includes(session.status)) {
    return new Response(`Seans aktif değil (current=${session.status})`, { status: 409 })
  }

  // Body parse
  const body = await req.json().catch(() => null)
  const text: string = body?.text?.trim()
  if (!text) return new Response('Metin boş', { status: 400 })
  if (text.length > 5000) return new Response('Metin çok uzun (max 5000 karakter)', { status: 400 })

  // Persona'nın atanmış voice_id'sini kullan; yoksa env default'a düş.
  const personaVoiceId = session.persona?.voice_id?.trim() || undefined

  // ElevenLabs TTS — tam buffer dönüyoruz (chunked yerine).
  // Safari, chunked Transfer-Encoding ile gelen audio/mpeg'i Content-Length bilmeden çalmıyor.
  // Tam buffer + Content-Length, hem Safari'de hem Chrome'da güvenilir çalar.
  try {
    const tts = getTTSAdapter()
    const result = await tts.synthesize(text, { voiceId: personaVoiceId })

    return new Response(new Uint8Array(result.audio), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
        'Content-Length': String(result.audio.length),
      },
    })
  } catch (err) {
    const msg = (err as Error).message
    console.error('TTS hatası:', msg)
    return new Response(`Ses üretimi başarısız: ${msg}`, { status: 500 })
  }
}
