import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getSTTAdapter } from '@/adapters/stt'

// Maksimum ses boyutu: 25MB (Whisper limiti)
export const maxDuration = 30 // Vercel function timeout

// Whisper Türkçe halüsinasyon imzaları — YouTube altyazı kredilerinden öğrenilmiş.
// Bu pattern'lere matchleyen transkriptler boş kabul edilir (kullanıcı sustuğunda Whisper'ın ürettiği phantom output).
// Genişletmeden önce: prod'da gerçek phantom örneklerini kontrol et, false-negative riskini değerlendir.
const WHISPER_PHANTOM_PATTERNS: RegExp[] = [
  // Türkçe altyazı kredisi pattern'leri
  /^alty[aâ]z[ıi]\s*[:.]?\s*m\.?\s*k\.?$/i,
  /^[çc]eviri\s*(ve|:)?\s*alty[aâ]z[ıi]/i,
  /^t[üu]rk[çc]e\s*alty[aâ]z[ıi]/i,
  /^alty[aâ]z[ıi]:?\s*[a-zçğıöşü.\s]{0,40}$/i,
  /^kut\b\.?!?$/i,
  /^([çc]ok\s+)?te[şs]ekk[üu]rler\.?$/i,
  /^izledi[ğg]iniz\s+i[çc]in/i,
  /^alt[\s-]?yaz[ıi]/i,
  // YouTube outro pattern'leri (Whisper YouTube CC'lerinden öğrenmiş)
  // Daraltma stratejisi: bu kalıplar koçluk diyaloğunda neredeyse hiç geçmez; geçse de
  // beğen/abone/yorum kombinasyonu özel YouTube outro signature'ı.
  /\babone\s+ol(may[ıi])?/i,                                 // "Abone olmayı unutmayın"
  /\bbe[ğg]en\s+butonu/i,                                    // "beğen butonuna tıklayın"
  /\bvideoyu\s+be[ğg]en/i,                                   // "videoyu beğenmeyi unutmayın"
  /\byorum\s+yap(may[ıi])?\s+unutmay[ıi]n/i,                 // "yorum yapmayı unutmayın"
  /\bkanal[ıi]m[ıi]z[aıe]?\s*abone/i,                        // "kanalımıza abone olun"
  /\bbir\s+sonraki\s+videoda/i,                              // "bir sonraki videoda görüşmek üzere"
]

const MIN_TRANSCRIPT_LENGTH = 3 // 1-2 karakterlik transkriptler genelde gürültü

// Whisper'ı altyazı tarzı outputtan caydıran kısa anti-prompt.
// Whisper bu prompt'u "önceki context" sayar; altyazı yapımı yerine konuşma tarzını taklit eder.
const ANTI_PHANTOM_PROMPT = 'Bu bir koçluk diyaloğudur. Sadece konuşulanı yazıya dök.'

function isPhantomTranscript(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < MIN_TRANSCRIPT_LENGTH) return true
  // Türkçe locale-aware lowercase: JS default `toLowerCase()` "İ" → combining char yapar,
  // /i flag bunu yakalayamaz. Örnek: "İzlediğiniz" phantom'ı default lowercase'le filtreyi geçiyordu.
  // tr-TR locale "İ" → "i" doğru çevirir.
  const normalized = trimmed.toLocaleLowerCase('tr-TR')
  return WHISPER_PHANTOM_PATTERNS.some((re) => re.test(normalized))
}

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
  if (session.status !== 'active' && session.status !== 'debrief_active') {
    return new Response(`Seans aktif değil (current=${session.status})`, { status: 409 })
  }
  if (session.session_mode !== 'voice') return new Response('Voice seans değil', { status: 400 })

  // Multipart form'dan ses dosyasını al
  let audioBlob: Blob
  let originalName = 'audio.webm'
  let originalType = 'audio/webm'
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
    if (audioFile instanceof File && audioFile.name) originalName = audioFile.name
    if (audioFile.type) originalType = audioFile.type
  } catch {
    return new Response('Form data parse hatası', { status: 400 })
  }

  // Whisper transkripsiyon
  try {
    const stt = getSTTAdapter()
    const audioBuffer = Buffer.from(await audioBlob.arrayBuffer())
    const result = await stt.transcribe(audioBuffer, {
      language: 'tr',
      filename: originalName,
      mimeType: originalType,
      prompt: ANTI_PHANTOM_PROMPT,
    })
    const transcript = result.text

    if (!transcript.trim()) {
      return Response.json({ transcript: '', isEmpty: true })
    }

    // Phantom filter: Whisper'ın boş ses üzerinde ürettiği halüsinasyonları boş say.
    if (isPhantomTranscript(transcript)) {
      console.log(`[STT] Phantom transcript filtrelendi: "${transcript.trim()}"`)
      return Response.json({ transcript: '', isEmpty: true, filteredAs: 'phantom' })
    }

    return Response.json({ transcript, isEmpty: false })
  } catch (err) {
    console.error('STT hatası:', (err as Error).message)
    return new Response('Transkripsiyon başarısız', { status: 500 })
  }
}
