import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export interface Notification {
  id: string
  type: 'evaluation_completed' | 'account_created' | 'dev_plan_ready'
  payload: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  evaluation_completed: 'Değerlendirme Hazır',
  account_created: 'Hesap Oluşturuldu',
  dev_plan_ready: 'Gelişim Planı Güncellendi',
}

export function getNotificationLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

export async function getMyNotifications(limit = 30): Promise<Notification[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, type, payload, is_read, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type as Notification['type'],
    payload: (n.payload ?? {}) as Record<string, unknown>,
    isRead: n.is_read,
    createdAt: n.created_at,
  }))
}

export async function getUnreadCount(): Promise<number> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return 0

  const supabase = await createServerClient()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', currentUser.id)
    .eq('is_read', false)

  return count ?? 0
}
