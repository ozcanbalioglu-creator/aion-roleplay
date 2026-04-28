import { Client } from '@upstash/qstash'

export async function scheduleDevelopmentPlanJob(
  userId: string,
  tenantId: string
): Promise<void> {
  const receiverUrl = process.env.QSTASH_RECEIVER_URL
  if (!receiverUrl) {
    console.error('QSTASH_RECEIVER_URL tanımlanmamış — gelişim planı kuyruğa alınamadı')
    return
  }

  const qstash = new Client({ token: process.env.UPSTASH_QSTASH_TOKEN! })

  await qstash.publishJSON({
    url: `${receiverUrl}/api/users/${userId}/development-plan/regenerate`,
    body: { userId, tenantId },
    delay: 10, // evaluation tamamlandıktan 10 saniye sonra
    retries: 2,
  })
}
