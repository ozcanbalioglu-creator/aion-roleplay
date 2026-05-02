/**
 * ElevenLabs Conversational AI — Signed URL endpoint (spike Faz B).
 *
 * Production buildSystemPrompt() zincirini doğrudan çağırır — tenant
 * context + persona contract + ICF rubric + role-reminder + faz
 * direktifleri (~5000+ char). Çıktıyı override.prompt olarak Conv. AI
 * agent'ına gönderir.
 *
 * sessionId parametresi buildSystemPrompt fonksiyonunda tanımlı ama
 * gövdesinde kullanılmıyor (yalnızca persona/scenario/tenant ID'leri
 * ile DB sorguları yapılıyor) — bu yüzden spike'tan dummy bir değer
 * geçmek güvenli. Production'a alınmaz, sadece feat/voice-elevenlabs-spike
 * branch'inde yaşar.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt } from '@/lib/session/system-prompt.builder'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { personaId, scenarioId } = (await request
      .json()
      .catch(() => ({}))) as { personaId?: string; scenarioId?: string }

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

    // Auth + tenant resolution
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data: appUser, error: appUserErr } = await supabase
      .from('users')
      .select('id, full_name, tenant_id')
      .eq('id', user.id)
      .single()
    if (appUserErr || !appUser?.tenant_id) {
      return NextResponse.json(
        { error: 'tenant not found for user', detail: appUserErr?.message },
        { status: 400 }
      )
    }

    // Persona meta (voice_id + name for response payload)
    const { data: persona, error: personaErr } = await supabase
      .from('personas')
      .select('id, name, title, voice_id')
      .eq('id', personaId)
      .single()
    if (personaErr || !persona) {
      return NextResponse.json({ error: 'persona not found' }, { status: 404 })
    }

    // Resolve scenario: if not provided, fall back to first scenario tied
    // to this persona for the tenant. Spike URL params keep things simple.
    let resolvedScenarioId = scenarioId
    if (!resolvedScenarioId) {
      const { data: defaultScenario } = await supabase
        .from('scenarios')
        .select('id')
        .or(`tenant_id.eq.${appUser.tenant_id},tenant_id.is.null`)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()
      if (defaultScenario) resolvedScenarioId = defaultScenario.id
    }
    if (!resolvedScenarioId) {
      return NextResponse.json(
        { error: 'no scenario available — pass ?scenario=<id> in URL' },
        { status: 400 }
      )
    }

    // Build the FULL production prompt — same chain prod uses:
    //   tenant context_profile + persona contract + behavior params +
    //   KPIs + scenario context + role context + rubric + phase directives
    let prodPrompt: string
    let scenarioTitle: string
    try {
      const built = await buildSystemPrompt({
        sessionId: 'spike-not-used', // intentionally dummy — see file header
        personaId,
        scenarioId: resolvedScenarioId,
        tenantId: appUser.tenant_id
      })
      prodPrompt = built.systemPrompt
      scenarioTitle = built.scenarioTitle
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'buildSystemPrompt failed'
      return NextResponse.json(
        { error: 'prompt build failed', detail: msg },
        { status: 500 }
      )
    }

    const userName = appUser.full_name?.split(' ')[0] ?? ''
    const opening = userName
      ? `Merhaba ${userName} Bey, çağırdığınızı duydum, geldim.`
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
        {
          error: 'elevenlabs signed-url failed',
          status: elResponse.status,
          detail: errText.slice(0, 500)
        },
        { status: 502 }
      )
    }

    const { signed_url: signedUrl } = (await elResponse.json()) as {
      signed_url: string
    }

    return NextResponse.json({
      signedUrl,
      overrides: {
        agent: {
          prompt: { prompt: prodPrompt },
          firstMessage: opening,
          language: 'tr'
        },
        ...(persona.voice_id ? { tts: { voiceId: persona.voice_id } } : {})
      },
      meta: {
        personaName: persona.name,
        personaTitle: persona.title,
        personaVoiceId: persona.voice_id,
        scenarioId: resolvedScenarioId,
        scenarioTitle,
        userName,
        promptLength: prodPrompt.length,
        promptSource: 'production-buildSystemPrompt'
      }
    })
  } catch (err) {
    console.error('[realtime-spike/signed-url] error', err)
    const msg = err instanceof Error ? err.message : 'internal'
    return NextResponse.json({ error: 'internal', detail: msg }, { status: 500 })
  }
}
