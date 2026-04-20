import { Client } from '@upstash/qstash'

export async function scheduleEvaluationJob(sessionId: string): Promise<void> {
  const qstash = new Client({ token: process.env.UPSTASH_QSTASH_TOKEN! })

  const receiverUrl = process.env.QSTASH_RECEIVER_URL
  if (!receiverUrl) {
    console.error('QSTASH_RECEIVER_URL tanımlanmamış — değerlendirme kuyruğa alınamadı')
    return
  }

  await qstash.publishJSON({
    url: `${receiverUrl}/api/sessions/${sessionId}/evaluate`,
    body: { sessionId },
    delay: 5, // 5 saniye gecikme
    retries: 3,
  })
}
