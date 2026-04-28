import { createServiceRoleClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/encryption'
import { scheduleSummarizeJob } from './summarize.queue'

export type MessageRole = 'user' | 'assistant' | 'system'
export type SessionPhase = 'opening' | 'exploration' | 'deepening' | 'action' | 'closing'

// Summarization eşiği: bu sayının altındaki seanslar için summary çağırılmaz.
// Karar (2026-04-27): 13-25 mesajlık tipik seanslar için summary lossy compression yapıyordu;
// modern LLM'ler 128k context'i sorunsuz taşıyor, $0.005-0.01/seans maliyet farkı önemsiz.
// 50+ mesajlık uzun seanslarda summary tekrar devreye girer (token patlamasını önlemek için).
const SUMMARIZATION_THRESHOLD = 50

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

  // Summarization: yalnızca uzun seanslarda (50+ mesaj) tetiklenir.
  // 13-25 mesajlık tipik seanslar için summary devre dışı — basitlik + bağlam bütünlüğü kazanılıyor.
  if (params.role === 'assistant') {
    const { count } = await supabase
      .from('session_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', params.sessionId)
      .neq('role', 'system')

    // Eşiği geçtikten sonra her 10 mesajda bir özetle (5'ten 10'a çıkarıldı: daha az iş)
    if (count && count >= SUMMARIZATION_THRESHOLD && count % 10 === 0) {
      scheduleSummarizeJob(params.sessionId).catch((e) =>
        console.error('[message.service] Summarize job kuyruğa alınamadı:', e)
      )
    }
  }
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

// Özet + son 5 ham mesaj (chat API için)
export async function getSessionHistoryWithSummary(
  sessionId: string
): Promise<Array<{ role: MessageRole; content: string }>> {
  const supabase = await createServiceRoleClient()

  // En son özeti al
  const { data: lastSummary } = await supabase
    .from('session_summaries')
    .select('encrypted_content, covers_messages_to')
    .eq('session_id', sessionId)
    .order('summary_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Özet sonrasındaki ham mesajları al — özet yoksa tüm mesajlardan son 5'i.
  // ÖNEMLİ: range(0, 4) ROW POSITION pagination yapar; sequence_number filter'ı için gt() lazım.
  // Yanlış kullanım, konuşma uzayınca hep ilk 5 mesajı dönüyordu → AI bağlamı kaybediyordu.
  const afterIndex = lastSummary?.covers_messages_to ?? 0

  const { data: recentMessagesDesc } = await supabase
    .from('session_messages')
    .select('role, content, sequence_number')
    .eq('session_id', sessionId)
    .neq('role', 'system')
    .gt('sequence_number', afterIndex)
    .order('sequence_number', { ascending: false })
    .limit(5)

  // DB'den DESC geliyor; LLM'e kronolojik (eski → yeni) gönderilmeli
  const recent = (recentMessagesDesc ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role as MessageRole,
      content: decrypt(m.content),
    }))

  if (!lastSummary) return recent

  // Özeti şifre çöz
  let summaryText = ''
  try {
    const parsed = JSON.parse(decrypt(lastSummary.encrypted_content))
    summaryText = parsed.summary ?? ''
  } catch {
    summaryText = ''
  }

  if (!summaryText) return recent

  // Özeti sentetik bir assistant context mesajı olarak öne ekle
  return [
    {
      role: 'assistant' as MessageRole,
      content: `[Önceki görüşme bağlamı]\n${summaryText}`,
    },
    ...recent,
  ]
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
