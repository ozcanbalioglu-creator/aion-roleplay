import { NextRequest } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { createServiceRoleClient } from '@/lib/supabase/server'

const receiver = new Receiver({
  currentSigningKey: process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY!,
})

const TIMEOUT_MINUTES = 30

export async function POST(req: NextRequest) {
  // QStash imza doğrulama
  const body = await req.text()
  const signature = req.headers.get('upstash-signature') ?? ''

  try {
    await receiver.verify({ signature, body, url: req.url })
  } catch {
    return new Response('Invalid signature', { status: 401 })
  }

  const supabase = await createServiceRoleClient()
  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000).toISOString()

  // Timeout olan aktif seansları bul
  const { data: staleSessions, error: fetchError } = await supabase
    .from('sessions')
    .select('id, user_id, tenant_id, started_at, last_activity_at')
    .eq('status', 'active')
    .lt('last_activity_at', cutoff)

  if (fetchError) {
    console.error('Timeout cron fetch hatası:', fetchError.message)
    return new Response('DB error', { status: 500 })
  }

  if (!staleSessions?.length) {
    return Response.json({ dropped: 0, message: 'Timeout olan seans yok' })
  }

  // Batch DROPPED güncellemesi
  const staleIds = staleSessions.map((s) => s.id)

  const { error: updateError } = await supabase
    .from('sessions')
    .update({
      status: 'dropped',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'timeout',
    })
    .in('id', staleIds)
    .eq('status', 'active') // Race condition koruması

  if (updateError) {
    console.error('Timeout güncelleme hatası:', updateError.message)
    return new Response('Update error', { status: 500 })
  }

  console.log(`[session-timeout] ${staleIds.length} seans DROPPED yapıldı:`, staleIds)

  return Response.json({
    dropped: staleIds.length,
    sessionIds: staleIds,
  })
}
