'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { ReactNode } from 'react'

const POLL_INTERVAL_MS = 15_000 // 15 saniye
const TYPE_ICONS: Record<string, string> = {
  badge_earned: '🏅',
  challenge_completed: '🎯',
}

export function useNotifications(userId: string | null) {
  const lastCheckedRef = useRef<string>(new Date().toISOString())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userId) return

    const checkNotifications = async () => {

      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body')
        .eq('user_id', userId)
        .eq('is_read', false)
        .in('type', ['badge_earned', 'challenge_completed'])
        .gt('created_at', lastCheckedRef.current)
        .order('created_at', { ascending: true })
        .limit(5)

      if (error || !data?.length) return

      // Toast göster
      for (const notif of data) {
        const icon = TYPE_ICONS[notif.type] ?? '🔔'
        const iconNode: ReactNode = <span className="text-xl" role="img" aria-label={notif.type}>{icon}</span>
        toast(notif.title, {
          description: notif.body,
          icon: iconNode,
          duration: 6000,
        })
      }

      // Okundu işaretle
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', data.map((n: any) => n.id))

      lastCheckedRef.current = new Date().toISOString()
    }

    // İlk check
    checkNotifications()

    intervalRef.current = setInterval(checkNotifications, POLL_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [userId])
}
