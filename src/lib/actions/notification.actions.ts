'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function markNotificationReadAction(notificationId: string, _formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return

  const supabase = await createServerClient()
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', currentUser.id)

  revalidatePath('/dashboard/notifications')
}

export async function markAllNotificationsReadAction() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return

  const supabase = await createServerClient()
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', currentUser.id)
    .eq('is_read', false)

  revalidatePath('/dashboard/notifications')
}
