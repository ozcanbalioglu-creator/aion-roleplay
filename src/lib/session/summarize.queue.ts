import { Client } from '@upstash/qstash'

export async function scheduleSummarizeJob(sessionId: string): Promise<void> {
  const token = process.env.UPSTASH_QSTASH_TOKEN
  const receiverUrl = process.env.QSTASH_RECEIVER_URL

  if (!token || !receiverUrl) {
    console.warn('[summarize.queue] UPSTASH_QSTASH_TOKEN veya QSTASH_RECEIVER_URL tanımlı değil')
    return
  }

  const qstash = new Client({ token })

  await qstash.publishJSON({
    url: `${receiverUrl}/api/sessions/${sessionId}/summarize`,
    body: { sessionId },
    retries: 2,
  })
}
