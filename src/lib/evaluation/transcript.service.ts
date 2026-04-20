import { createServiceRoleClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'

export type MessageRole = 'user' | 'assistant'
export type SessionPhase = 'opening' | 'exploration' | 'deepening' | 'action' | 'closing'

export interface TranscriptMessage {
  role: MessageRole
  content: string
  phase: SessionPhase
  sequenceNumber: number
}

export interface PhaseGroup {
  phase: SessionPhase
  messages: TranscriptMessage[]
}

export interface NormalizedTranscript {
  messages: TranscriptMessage[]
  phaseGroups: PhaseGroup[]
  totalMessages: number
  userMessageCount: number
  assistantMessageCount: number
}

export async function getDecryptedTranscript(sessionId: string): Promise<NormalizedTranscript> {
  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase
    .from('session_messages')
    .select('role, content, phase, sequence_number')
    .eq('session_id', sessionId)
    .in('role', ['user', 'assistant'])
    .order('sequence_number', { ascending: true })

  if (error) throw new Error(`Transcript okunamadı: ${error.message}`)
  if (!data?.length) throw new Error('Seans mesajı bulunamadı')

  const messages: TranscriptMessage[] = (data as any[]).map((row) => ({
    role: row.role as MessageRole,
    content: decrypt(row.content),
    phase: (row.phase ?? 'opening') as SessionPhase,
    sequenceNumber: row.sequence_number,
  }))

  // Faz bazlı gruplama
  const phaseOrder: SessionPhase[] = ['opening', 'exploration', 'deepening', 'action', 'closing']
  const phaseMap = new Map<SessionPhase, TranscriptMessage[]>()

  for (const msg of messages) {
    const existing = phaseMap.get(msg.phase) ?? []
    phaseMap.set(msg.phase, [...existing, msg])
  }

  const phaseGroups: PhaseGroup[] = phaseOrder
    .filter((p) => phaseMap.has(p))
    .map((p) => ({ phase: p, messages: phaseMap.get(p)! }))

  return {
    messages,
    phaseGroups,
    totalMessages: messages.length,
    userMessageCount: messages.filter((m) => m.role === 'user').length,
    assistantMessageCount: messages.filter((m) => m.role === 'assistant').length,
  }
}

// Transcript'i prompt için düz metin formatına dönüştür
export function formatTranscriptForPrompt(transcript: NormalizedTranscript): string {
  const PHASE_LABELS: Record<SessionPhase, string> = {
    opening: 'AÇILIŞ',
    exploration: 'KEŞİF',
    deepening: 'DERİNLEŞTİRME',
    action: 'AKSİYON',
    closing: 'KAPANIŞ',
  }

  return transcript.phaseGroups
    .map((group) => {
      const header = `\n=== FAZ: ${PHASE_LABELS[group.phase]} ===`
      const lines = group.messages.map(
        (m) => `${m.role === 'user' ? 'YÖNETİCİ' : 'SATŞ TEMSİLCİSİ'}: ${m.content}`
      )
      return [header, ...lines].join('\n')
    })
    .join('\n\n')
}
