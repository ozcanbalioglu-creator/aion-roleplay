import { NextRequest } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { runEvaluation } from '@/lib/evaluation/evaluation.engine'
import { awardXPAndBadges } from '@/lib/evaluation/gamification.service'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { scheduleDevelopmentPlanJob } from '@/lib/development-plan/plan.queue'

export const maxDuration = 60 // Vercel max: free=10s, pro=60s, enterprise=300s

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

  const supabase = await createServiceRoleClient()

  // Session'ı başta çek — hem success hem failure path'inde lazım
  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, tenant_id, duration_seconds, persona_id, scenario_id')
    .eq('id', sessionId)
    .single()

  // QStash son retry mi? (retries:3 → son denemede Upstash-Retried: 3)
  const retriedCount = parseInt(req.headers.get('upstash-retried') ?? '0', 10)
  const isLastRetry = retriedCount >= 3

  try {
    // Değerlendirme motoru
    const evalResult = await runEvaluation(sessionId)

    if (session) {
      await awardXPAndBadges({
        userId: session.user_id as string,
        tenantId: session.tenant_id as string,
        sessionId,
        overallScore: evalResult.overallScore,
        durationSeconds: session.duration_seconds as number,
        personaId: session.persona_id as string,
        scenarioId: session.scenario_id as string,
      })

      // Gelişim planı aggregate worker (fire-and-forget)
      scheduleDevelopmentPlanJob(
        session.user_id as string,
        session.tenant_id as string
      ).catch((e) => console.error('Dev plan job kuyruğa alınamadı:', e))
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
    console.error(`Evaluation failed for session ${sessionId} (retry ${retriedCount}):`, message)

    // Son retry'da kalıcı hata kaydı oluştur
    if (isLastRetry && session) {
      await supabase.from('evaluations').upsert(
        {
          session_id: sessionId,
          user_id: session.user_id,
          tenant_id: session.tenant_id,
          rubric_template_id: (await supabase
            .from('sessions')
            .select('rubric_template_id')
            .eq('id', sessionId)
            .single()
            .then((r) => r.data?.rubric_template_id ?? null)),
          overall_score: null,
          strengths: [],
          development_areas: [],
          coaching_note: '',
          status: 'evaluation_failed',
        },
        { onConflict: 'session_id', ignoreDuplicates: false }
      )
    }

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
