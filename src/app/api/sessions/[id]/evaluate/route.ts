import { NextRequest } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { runEvaluation } from '@/lib/evaluation/evaluation.engine'
import { awardXPAndBadges } from '@/lib/evaluation/gamification.service'
import { createServiceRoleClient } from '@/lib/supabase/server'

const receiver = new Receiver({
  currentSigningKey: process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY!,
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  // QStash imza doğrulama
  const body = await req.text()
  const signature = req.headers.get('upstash-signature') ?? ''

  try {
    await receiver.verify({ signature, body, url: req.url })
  } catch {
    return new Response('Invalid QStash signature', { status: 401 })
  }

  // İstek body'sinden sessionId doğrulama
  let parsedBody: { sessionId?: string }
  try {
    parsedBody = JSON.parse(body)
  } catch {
    return new Response('Invalid body', { status: 400 })
  }

  if (parsedBody.sessionId !== sessionId) {
    return new Response('Session ID mismatch', { status: 400 })
  }

  try {
    // Değerlendirme motoru
    const evalResult = await runEvaluation(sessionId)

    // Gamification
    const supabase = await createServiceRoleClient()
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id, tenant_id, duration_seconds, persona_id')
      .eq('id', sessionId)
      .single()

    if (session) {
      await awardXPAndBadges({
        userId: (session as any).user_id,
        tenantId: (session as any).tenant_id,
        sessionId,
        overallScore: evalResult.overallScore,
        durationSeconds: (session as any).duration_seconds,
        personaId: (session as any).persona_id,
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        evaluationId: evalResult.evaluationId,
        overallScore: evalResult.overallScore,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = (err as Error).message
    console.error(`Evaluation failed for session ${sessionId}:`, message)

    // Hata durumunda sessions.status = 'failed' DEĞİL — sadece evaluation eksik kalır
    // QStash retry mekanizması 3 deneme daha yapacak
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
