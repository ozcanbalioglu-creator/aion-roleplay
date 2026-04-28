import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { buildReportNarration } from '@/lib/session/report-audio.builder'

export const maxDuration = 60

const BUCKET = 'report-audio'

async function getSignedUrl(serviceSupabase: Awaited<ReturnType<typeof createServiceRoleClient>>, path: string) {
  const { data } = await serviceSupabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600) // 1 saat geçerli
  return data?.signedUrl ?? null
}

// GET — Mevcut audio var mı kontrol et, varsa imzalı URL döndür
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  const currentUser = await getCurrentUser()
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerClient()
  const { data: session } = await supabase
    .from('sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .single()

  if (!session || session.user_id !== currentUser.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const serviceSupabase = await createServiceRoleClient()
  const { data: evaluation } = await serviceSupabase
    .from('evaluations')
    .select('report_audio_path')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!evaluation?.report_audio_path) {
    return NextResponse.json({ audioUrl: null })
  }

  const audioUrl = await getSignedUrl(serviceSupabase, evaluation.report_audio_path)
  return NextResponse.json({ audioUrl })
}

// POST — Ses dosyasını oluştur, storage'a yükle, imzalı URL döndür
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  const currentUser = await getCurrentUser()
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerClient()
  const { data: session } = await supabase
    .from('sessions')
    .select('id, user_id, persona_id, scenario_id')
    .eq('id', sessionId)
    .single()

  if (!session || session.user_id !== currentUser.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const serviceSupabase = await createServiceRoleClient()

  // Değerlendirme verilerini çek
  const [{ data: evaluation }, { data: persona }, { data: scenario }, { data: dimMeta }] =
    await Promise.all([
      serviceSupabase
        .from('evaluations')
        .select(
          'id, report_audio_path, coaching_note, strengths, development_areas, dimension_scores(dimension_code, feedback)'
        )
        .eq('session_id', sessionId)
        .maybeSingle(),
      serviceSupabase.from('personas').select('name').eq('id', session.persona_id).single(),
      serviceSupabase.from('scenarios').select('title').eq('id', session.scenario_id).single(),
      serviceSupabase.from('rubric_dimensions').select('dimension_code, dimension_name'),
    ])

  if (!evaluation) {
    return NextResponse.json({ error: 'Değerlendirme henüz hazır değil' }, { status: 409 })
  }

  // Zaten oluşturulduysa mevcut URL'yi döndür
  if (evaluation.report_audio_path) {
    const audioUrl = await getSignedUrl(serviceSupabase, evaluation.report_audio_path)
    return NextResponse.json({ audioUrl })
  }

  // Boyut adı haritası
  const dimNameMap = new Map(
    (dimMeta ?? []).map((d) => [d.dimension_code, d.dimension_name])
  )

  const dimScores = Array.isArray(evaluation.dimension_scores)
    ? evaluation.dimension_scores
    : []

  const dimensionFeedbacks = dimScores
    .filter((d: any) => d.feedback)
    .map((d: any) => ({
      code: d.dimension_code,
      name: dimNameMap.get(d.dimension_code) ?? d.dimension_code,
      feedback: d.feedback,
    }))

  const narration = buildReportNarration({
    firstName: currentUser.full_name?.split(' ')[0] ?? 'Kullanıcı',
    personaName: persona?.name ?? 'Ekip Üyesi',
    scenarioTitle: scenario?.title ?? 'Seans',
    coachingNote: evaluation.coaching_note ?? '',
    strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths : [],
    developmentAreas: Array.isArray(evaluation.development_areas)
      ? evaluation.development_areas
      : [],
    dimensionFeedbacks,
  })

  // ElevenLabs TTS
  const apiKey = process.env.ELEVENLABS_API_KEY!
  const voiceId =
    process.env.ELEVENLABS_DEBRIEF_COACH_VOICE_ID || process.env.ELEVENLABS_DEFAULT_VOICE_ID!
  const model = process.env.ELEVENLABS_MODEL ?? 'eleven_turbo_v2_5'

  const ttsRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: narration,
        model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true },
        output_format: 'mp3_44100_128',
      }),
    }
  )

  if (!ttsRes.ok) {
    const err = await ttsRes.text()
    console.error('[report-audio] TTS hatası:', err)
    return NextResponse.json({ error: 'Ses üretimi başarısız' }, { status: 500 })
  }

  // Buffer'a topla ve storage'a yükle
  const audioBuffer = Buffer.from(await ttsRes.arrayBuffer())
  const storagePath = `sessions/${sessionId}/report.mp3`

  const { error: uploadError } = await serviceSupabase.storage
    .from(BUCKET)
    .upload(storagePath, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

  if (uploadError) {
    console.error('[report-audio] Upload hatası:', uploadError.message)
    return NextResponse.json({ error: 'Ses yüklenemedi' }, { status: 500 })
  }

  // Yolu evaluations tablosuna kaydet
  await serviceSupabase
    .from('evaluations')
    .update({ report_audio_path: storagePath })
    .eq('id', evaluation.id)

  const audioUrl = await getSignedUrl(serviceSupabase, storagePath)
  return NextResponse.json({ audioUrl })
}
