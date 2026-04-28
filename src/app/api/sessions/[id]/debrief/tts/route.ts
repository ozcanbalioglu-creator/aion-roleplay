import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  const currentUser = await getCurrentUser()
  if (!currentUser) return new Response('Unauthorized', { status: 401 })

  const supabase = await createServerClient()
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, user_id')
    .eq('id', sessionId)
    .single()

  if (!session) return new Response('Seans bulunamadı', { status: 404 })
  if (session.user_id !== currentUser.id) return new Response('Yetkisiz', { status: 403 })
  if (session.status !== 'debrief_active') {
    return new Response('Seans debrief modunda değil', { status: 409 })
  }

  const body = await req.json().catch(() => null)
  const text: string = body?.text?.trim()
  if (!text) return new Response('Metin boş', { status: 400 })
  if (text.length > 5000) return new Response('Metin çok uzun', { status: 400 })

  const apiKey = process.env.ELEVENLABS_API_KEY!
  const voiceId =
    process.env.ELEVENLABS_DEBRIEF_COACH_VOICE_ID ||
    process.env.ELEVENLABS_DEFAULT_VOICE_ID!
  const model = process.env.ELEVENLABS_MODEL ?? 'eleven_turbo_v2_5'

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true,
        },
        output_format: 'mp3_44100_128',
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`ElevenLabs TTS hatası: ${response.status} ${err}`)
    }

    if (!response.body) throw new Error('ElevenLabs: boş stream')

    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err) {
    console.error('[debrief/tts] Hata:', (err as Error).message)
    return new Response('Ses üretimi başarısız', { status: 500 })
  }
}
