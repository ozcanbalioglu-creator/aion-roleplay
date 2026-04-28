import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export const CANCEL_REASON_LABELS: Record<string, string> = {
  technical_issue: 'Teknik Sorun',
  persona_wrong_fit: 'Persona Uyumsuz',
  scenario_too_hard: 'Senaryo Çok Zor',
  user_interrupted: 'Dışarıdan Kesinti',
  manual_cancel: 'Manuel İptal',
  drop_off: 'Bağlantı Kesildi',
  technical_failure: 'Teknik Arıza',
}

export interface CancellationStats {
  totalCancelled: number
  byPersona: Array<{
    personaId: string
    personaName: string
    cancelled: number
    total: number
    rate: number
  }>
  byReason: Array<{
    reason: string
    label: string
    count: number
  }>
}

export async function getMyCancellationStats(): Promise<CancellationStats | null> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null
  return getCancellationStatsForUser(currentUser.id, currentUser.tenant_id)
}

export async function getCancellationStatsForUser(
  targetUserId: string,
  tenantId: string
): Promise<CancellationStats | null> {
  const supabase = await createServerClient()

  const { data: allSessions } = await supabase
    .from('sessions')
    .select('id, status, cancellation_reason, persona_id, personas(id, name)')
    .eq('user_id', targetUserId)
    .eq('tenant_id', tenantId)
    .in('status', ['completed', 'cancelled', 'debrief_completed', 'debrief_active'])

  if (!allSessions?.length) return { totalCancelled: 0, byPersona: [], byReason: [] }

  const cancelled = allSessions.filter((s) => s.status === 'cancelled')

  if (cancelled.length === 0) return { totalCancelled: 0, byPersona: [], byReason: [] }

  // Per-persona stats
  const personaMap = new Map<string, { name: string; total: number; cancelled: number }>()
  for (const s of allSessions) {
    const persona = Array.isArray(s.personas) ? s.personas[0] : s.personas
    const pid = s.persona_id
    const name = (persona as { name?: string } | null)?.name ?? pid
    const entry = personaMap.get(pid) ?? { name, total: 0, cancelled: 0 }
    entry.total++
    if (s.status === 'cancelled') entry.cancelled++
    personaMap.set(pid, entry)
  }

  const byPersona = Array.from(personaMap.entries())
    .filter(([, v]) => v.cancelled > 0)
    .map(([id, v]) => ({
      personaId: id,
      personaName: v.name,
      cancelled: v.cancelled,
      total: v.total,
      rate: Math.round((v.cancelled / v.total) * 100),
    }))
    .sort((a, b) => b.cancelled - a.cancelled)

  // Reason breakdown
  const reasonMap = new Map<string, number>()
  for (const s of cancelled) {
    const r = (s.cancellation_reason as string | null) ?? 'unknown'
    reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1)
  }

  const byReason = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({
      reason,
      label: CANCEL_REASON_LABELS[reason] ?? reason,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  return { totalCancelled: cancelled.length, byPersona, byReason }
}
