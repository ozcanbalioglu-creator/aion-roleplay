import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { ElevenLabsAdapter } from '@/lib/adapters/tts.adapter'

export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  const currentUser = await getCurrentUser()
  if (!currentUser) return new Response('Unauthorized', { status: 401 })

  // Seans doğrulama
  const supabase = await createServerClient()
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, user_id, session_mode')
    .eq('id', sessionId)
    .single()

  if (!session) return new Response('Seans bulunamadı', { status: 404 })
  if (session.user_id !== currentUser.id) return new Response('Yetkisiz', { status: 403 })
  if (session.status !== 'active') return new Response('Seans aktif değil', { status: 409 })

  // Body parse
  const body = await req.json().catch(() => null)
  const text: string = body?.text?.trim()
  if (!text) return new Response('Metin boş', { status: 400 })
  if (text.length > 5000) return new Response('Metin çok uzun (max 5000 karakter)', { status: 400 })

  // ElevenLabs TTS stream
  try {
    const tts = new ElevenLabsAdapter()
    const audioStream = await tts.synthesize(text)

    return new Response(audioStream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err) {
    console.error('TTS hatası:', (err as Error).message)
    return new Response('Ses üretimi başarısız', { status: 500 })
  }
}
