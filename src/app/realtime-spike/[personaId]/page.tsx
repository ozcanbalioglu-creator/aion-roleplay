/**
 * ElevenLabs Conversational AI — POC sayfası (spike).
 *
 * /realtime-spike/[personaId] adresinde mikrofon butonu, transkript
 * akışı, latency telemetrisi gösterir. Mevcut prod akışıyla yan yana
 * (aynı persona, aynı senaryo) karşılaştırma yapmak için kullanılır.
 *
 * Production'a alınmaz — branch: feat/voice-elevenlabs-spike.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RealtimeSpikeClient } from './RealtimeSpikeClient'

interface Props {
  params: Promise<{ personaId: string }>
  searchParams: Promise<{ scenario?: string }>
}

export default async function RealtimeSpikePage({ params, searchParams }: Props) {
  const { personaId } = await params
  const { scenario: scenarioId } = await searchParams

  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: persona } = await supabase
    .from('personas')
    .select('id, name, title, voice_id')
    .eq('id', personaId)
    .single()

  if (!persona) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-headline italic">Persona bulunamadı</h1>
        <p className="mt-2 text-on-surface-variant">ID: {personaId}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="text-xs font-label uppercase tracking-widest text-on-primary-container">
            ElevenLabs Conv. AI · Spike
          </div>
          <h1 className="text-3xl font-headline italic">{persona.name}</h1>
          <p className="text-sm text-on-surface-variant">
            {persona.title} · voice: <code className="text-xs">{persona.voice_id ?? '—'}</code>
          </p>
        </header>

        <RealtimeSpikeClient personaId={personaId} scenarioId={scenarioId ?? null} />
      </div>
    </div>
  )
}
