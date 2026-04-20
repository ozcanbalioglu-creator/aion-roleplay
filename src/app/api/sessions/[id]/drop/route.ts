import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Bu route sendBeacon'dan çağrılır — Auth header gönderilemez.
// Güvenlik: sessionId + IP rate limiting yeterlidir.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  // Body parse (beacon text/plain gönderir)
  let reason = 'page_unload'
  try {
    const text = await req.text()
    const parsed = JSON.parse(text)
    reason = parsed.reason ?? 'page_unload'
  } catch { /* ignore */ }

  const supabase = await createServiceRoleClient()

  // Sadece ACTIVE seansları DROPPED yap
  await supabase
    .from('sessions')
    .update({
      status: 'dropped',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq('id', sessionId)
    .eq('status', 'active')

  return new Response(null, { status: 204 })
}
