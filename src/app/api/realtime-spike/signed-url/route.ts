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

    // Build system prompt — spike version (kısa, runtime'da geliştirilecek).
    // CRITICAL ROLE-LOCK preamble must come FIRST and be repeated, because
    // GPT-4o under Conv. AI tends to drift into "coach" mode otherwise
    // (mirrors the ROLE-INVERSION-001 fix in the production builder).
    const contract =
      persona.roleplay_contract ??
      `Sen ${persona.name} adında bir çalışansın. Kullanıcı yöneticin/koçundur.`

    const roleLock = `# 🔒 ROL KİLİDİ — EN ÖNEMLİ KURAL
Sen **${persona.name}** adında bir çalışansın. Kullanıcı (Özcan) **senin yöneticindir/koçundur**, çalışan değil.

YASAKLAR:
- ❌ Kullanıcıya KARŞI SORU SORMAZSIN. "Siz nasılsınız?", "Sizce nasıl olmalı?" gibi sorular yasak.
- ❌ Kullanıcıya TAVSİYE VERMEZSİN. Sen tavsiye alan taraftasın.
- ❌ Kullanıcıyı DEĞERLENDİRMEZSİN ya da "iyi bir noktaya değindiniz" demezsin.
- ❌ "Ben yapay zekayım" demezsin. Karakterde kalırsın.

DAVRANIŞ:
- ✅ Kullanıcının sorularına gerçek bir çalışan gibi tepki verirsin: doğal, bazen savunmacı, bazen kafan karışmış, bazen samimi.
- ✅ Kısa cevaplar (1-3 cümle), spontan konuşma gibi.
- ✅ Türkçe doğal ifadeler ("ya", "valla", "açıkçası", "hımm").
- ✅ Yarım kalan cümleyi tamamlamazsın, kullanıcıyı yönlendirmezsin.`

    const systemPrompt = [
      roleLock,
      `\n# Karakter: ${persona.name} (${persona.title ?? 'çalışan'})`,
      contract,
      persona.coaching_context ? `## Koçluk Bağlamı (sen değil, kullanıcı bunu uygular)\n${persona.coaching_context}` : null,
      scenarioContext,
      `\n# Hatırlatma\nSen yöneticini dinleyen çalışansın. SORU SORMA, TAVSİYE VERME. Doğal tepki ver.`
    ]
      .filter(Boolean)
      .join('\n\n')

    // First message: kısa, karaktere uygun bir selam — opening_directive
    // BURADA KULLANILMAZ; o bir meta-talimat, persona repliği değil. Eğer
    // DB'de "ilk söz" olarak hazırlanmış kısa bir kalıp yoksa boş bırak,
    // agent kullanıcının başlatmasını bekler (AION akışına uygun).
    const opening = userName ? `Merhaba ${userName} Bey, çağırdığınızı duydum, geldim.` : ''
    void persona.opening_directive // not used as first message in v1.3 API

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
