import { createServiceRoleClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/encryption'

export type MessageRole = 'user' | 'assistant' | 'system'
export type SessionPhase = 'opening' | 'exploration' | 'deepening' | 'action' | 'closing'

interface SaveMessageParams {
  sessionId: string
  role: MessageRole
  content: string
  phase: SessionPhase
  metadata?: Record<string, unknown>
}

export async function saveSessionMessage(params: SaveMessageParams): Promise<void> {
  const supabase = await createServiceRoleClient()

  await supabase.from('session_messages').insert({
    session_id: params.sessionId,
    role: params.role,
    content: encrypt(params.content),
    phase: params.phase,
    metadata: params.metadata ?? null,
  })
}

// Seans tarihçesini al (OpenAI messages array formatında)
// Bu fonksiyon YALNIZCA service_role ile çağrılır
export async function getSessionHistory(
  sessionId: string,
  limit = 50
): Promise<Array<{ role: MessageRole; content: string }>> {
  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase
    .from('session_messages')
    .select('role, content, sequence_number')
    .eq('session_id', sessionId)
    .neq('role', 'system') // Sistem prompt ayrı tutulur
    .order('sequence_number', { ascending: true })
    .limit(limit)

  if (error || !data) return []

  return data.map((msg) => ({
    role: msg.role as MessageRole,
    content: decrypt(msg.content),
  }))
}

// Mevcut seans fazını mesaj geçmişinden türet
export async function getCurrentPhase(sessionId: string): Promise<SessionPhase> {
  const supabase = await createServiceRoleClient()

  const { data } = await supabase
    .from('session_messages')
    .select('phase')
    .eq('session_id', sessionId)
    .eq('role', 'assistant')
    .order('sequence_number', { ascending: false })
    .limit(1)
    .single()

  return (data?.phase as SessionPhase) ?? 'opening'
}
