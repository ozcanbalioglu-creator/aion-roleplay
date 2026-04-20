'use client'

import { useNotifications } from '@/hooks/useNotifications'

export function NotificationPoller({ userId }: { userId: string | undefined }) {
  useNotifications(userId ?? null)
  return null
}
