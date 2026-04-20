import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  const currentUser = await getCurrentUser()
  if (!currentUser) return new Response('Unauthorized', { status: 401 })

  const supabase = await createServerClient()

  const { error } = await supabase
    .from('sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', currentUser.id)
    .eq('status', 'active')

  if (error) return new Response('Heartbeat başarısız', { status: 500 })

  return new Response(null, { status: 204 })
}
