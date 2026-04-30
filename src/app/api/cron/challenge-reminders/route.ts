import { NextRequest } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { createServiceRoleClient } from '@/lib/supabase/server'

const receiver = new Receiver({
  currentSigningKey: process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY!,
})

// Haftalık görev → 2 gün kaldığında, aylık görev → 5 gün kaldığında bildirim
const WEEKLY_REMIND_DAYS = 2
const MONTHLY_REMIND_DAYS = 5

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('upstash-signature') ?? ''

  try {
    await receiver.verify({ signature, body, url: req.url })
  } catch {
    return new Response('Invalid signature', { status: 401 })
  }

  const supabase = await createServiceRoleClient()
  const now = new Date()

  // expires_at değeri [now + REMIND_DAYS] içinde olan, henüz tamamlanmamış,
  // reminder henüz gönderilmemiş user_challenges'ları bul.
  // Haftalık (7 gün pencere) ve aylık (30 gün pencere) için eşiği dinamik hesapla.
  // Basit yaklaşım: expires_at ile assigned_at farkına bakarak periyot tahmin et.
  const { data: upcomingChallenges } = await supabase
    .from('user_challenges')
    .select(`
      id, user_id, tenant_id, expires_at, assigned_at, reminder_sent_at,
      challenges(title, period, xp_reward)
    `)
    .eq('status', 'active')
    .is('reminder_sent_at', null)
    .gt('expires_at', now.toISOString())

  if (!upcomingChallenges?.length) {
    return Response.json({ reminders_sent: 0 })
  }

  let remindersSent = 0

  for (const uc of upcomingChallenges) {
    const challenge = (uc as any).challenges
    if (!challenge) continue

    const expiresAt = new Date(uc.expires_at as string)
    const hoursLeft = (expiresAt.getTime() - now.getTime()) / 3_600_000

    const period: string = challenge.period ?? 'weekly'
    const thresholdHours = period === 'monthly' ? MONTHLY_REMIND_DAYS * 24 : WEEKLY_REMIND_DAYS * 24

    if (hoursLeft > thresholdHours) continue  // henüz erken

    const daysLeft = Math.ceil(hoursLeft / 24)
    const daysLabel = daysLeft === 1 ? '1 gün' : `${daysLeft} gün`

    // Bildirim ekle
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: uc.user_id,
      tenant_id: uc.tenant_id,
      type: 'challenge_reminder',
      title: 'Görev Hatırlatması ⏰',
      body: `"${challenge.title}" adlı görevini bitirmene ${daysLabel} kaldı! +${challenge.xp_reward ?? 0} DP kazanmayı kaçırma.`,
      is_read: false,
      metadata: {
        challenge_title: challenge.title,
        expires_at: uc.expires_at,
        days_left: daysLeft,
        xp_reward: challenge.xp_reward,
      },
    })

    if (!notifError) {
      // Tekrar gönderme
      await supabase
        .from('user_challenges')
        .update({ reminder_sent_at: now.toISOString() })
        .eq('id', uc.id)

      remindersSent++
    }
  }

  console.log(`[challenge-reminders] ${remindersSent} hatırlatma gönderildi`)
  return Response.json({ reminders_sent: remindersSent })
}
