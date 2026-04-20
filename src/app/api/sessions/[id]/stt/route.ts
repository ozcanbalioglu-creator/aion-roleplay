import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { OpenAIWhisperAdapter } from '@/lib/adapters/stt.adapter'

// Maksimum ses boyutu: 25MB (Whisper limiti)
export const maxDuration = 30 // Vercel function timeout

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
  if (session.session_mode !== 'voice') return new Response('Voice seans değil', { status: 400 })

  // Multipart form'dan ses dosyasını al
  let audioBlob: Blob
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio')
    if (!audioFile || !(audioFile instanceof Blob)) {
      return new Response('Ses dosyası bulunamadı', { status: 400 })
    }
    if (audioFile.size < 1000) {
      return new Response('Ses çok kısa (min 1KB)', { status: 400 })
    }
    if (audioFile.size > 25 * 1024 * 1024) {
      return new Response('Ses çok büyük (max 25MB)', { status: 413 })
    }
    audioBlob = audioFile
  } catch {
    return new Response('Form data parse hatası', { status: 400 })
  }

  // Whisper transkripsiyon
  try {
    const stt = new OpenAIWhisperAdapter()
    const transcript = await stt.transcribe(audioBlob, 'tr')

    if (!transcript.trim()) {
      return Response.json({ transcript: '', isEmpty: true })
    }

    return Response.json({ transcript, isEmpty: false })
  } catch (err) {
    console.error('STT hatası:', (err as Error).message)
    return new Response('Transkripsiyon başarısız', { status: 500 })
  }
}
