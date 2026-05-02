/**
 * ElevenLabs Conversational AI — Signed URL endpoint (spike).
 *
 * Persona ID alır, ElevenLabs API'sinden agent için signed URL üretir,
 * mevcut buildSystemPrompt() zincirini çalıştırıp runtime override
 * payload'unu hazırlar. Client tarafı bu payload'u useConversation'a
 * overrides olarak geçer.
 *
 * Production'a alınmaz — branch: feat/voice-elevenlabs-spike.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { personaId, scenarioId } = await request.json().catch(() => ({}))
    if (!personaId) {
      return NextResponse.json({ error: 'personaId required' }, { status: 400 })
    }

    const agentId = process.env.ELEVENLABS_SPIKE_AGENT_ID
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!agentId || !apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_SPIKE_AGENT_ID or ELEVENLABS_API_KEY missing' },
        { status: 500 }
      )
    }

    // Auth + persona fetch
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data: persona, error: personaErr } = await supabase
      .from('personas')
      .select('id, name, title, voice_id, roleplay_contract, opening_directive, coaching_context')
      .eq('id', personaId)
      .single()
    if (personaErr || !persona) {
      return NextResponse.json({ error: 'persona not found' }, { status: 404 })
    }

    // Optional scenario context
    let scenarioContext: string | null = null
    if (scenarioId) {
      const { data: scenario } = await supabase
        .from('scenarios')
        .select('title, context_setup, role_context')
        .eq('id', scenarioId)
        .single()
      if (scenario) {
        scenarioContext = [
          scenario.title ? `# Senaryo: ${scenario.title}` : null,
          scenario.context_setup ? `## Bağlam\n${scenario.context_setup}` : null,
          scenario.role_context ? `## Rol Notu\n${scenario.role_context}` : null
        ]
          .filter(Boolean)
          .join('\n\n')
      }
    }

    // Get user display name for opening directive interpolation
    const { data: appUser } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()
    const userName = appUser?.full_name?.split(' ')[0] ?? ''

    // Build system prompt — spike version (kısa, runtime'da geliştirilecek)
    const contract =
      persona.roleplay_contract ??
      `Sen ${persona.name} adında bir çalışansın. Kullanıcı yöneticin/koçundur. Sen soru sormazsın, tavsiye vermezsin. Karakterinde kal, doğal tepki ver.`

    const systemPrompt = [
      `# Karakter: ${persona.name} (${persona.title ?? 'çalışan'})`,
      contract,
      persona.coaching_context ? `## Koçluk Bağlamı\n${persona.coaching_context}` : null,
      scenarioContext,
      `\n# Önemli\n- Türkçe konuş, doğal ifade kullan.\n- Kısa cevaplar ver (1-3 cümle), gerçek bir konuşma gibi.\n- Kullanıcının sorularına savunmacı/duygusal/şüpheci tepki ver — gerçek bir çalışan gibi.\n- Rolden çıkma. "Ben yapay zekayım" deme.`
    ]
      .filter(Boolean)
      .join('\n\n')

    // First message: opening directive {USER_NAME} interpolation
    const opening = persona.opening_directive
      ? persona.opening_directive.replace(/\{USER_NAME\}/g, userName).replace(/\(\s*\)/g, '').trim()
      : ''

    // Get signed URL from ElevenLabs
    const elResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: 'GET',
        headers: { 'xi-api-key': apiKey }
      }
    )

    if (!elResponse.ok) {
      const errText = await elResponse.text().catch(() => '')
      return NextResponse.json(
        { error: 'elevenlabs signed-url failed', status: elResponse.status, detail: errText.slice(0, 500) },
        { status: 502 }
      )
    }

    const { signed_url: signedUrl } = (await elResponse.json()) as { signed_url: string }

    return NextResponse.json({
      signedUrl,
      overrides: {
        agent: {
          prompt: { prompt: systemPrompt },
          firstMessage: opening,
          language: 'tr'
        },
        // tts.voice_id override mümkün değilse agent'ın default voice'u kullanılır
        ...(persona.voice_id ? { tts: { voiceId: persona.voice_id } } : {})
      },
      meta: {
        personaName: persona.name,
        personaTitle: persona.title,
        personaVoiceId: persona.voice_id,
        userName,
        promptLength: systemPrompt.length
      }
    })
  } catch (err) {
    console.error('[realtime-spike/signed-url] error', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
