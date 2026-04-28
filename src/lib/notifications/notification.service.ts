import { createServiceRoleClient } from '@/lib/supabase/server'
import { getEmailAdapter } from '@/adapters/email'

export type NotificationType = 'evaluation_completed' | 'account_created' | 'dev_plan_ready'

interface NotificationPayload {
  sessionId?: string
  reportUrl?: string
  [key: string]: unknown
}

const EMAIL_SUBJECTS: Record<NotificationType, string> = {
  evaluation_completed: 'Değerlendirme Raporun Hazır — AION Mirror',
  account_created: 'Hesabın Oluşturuldu — AION Mirror',
  dev_plan_ready: 'Gelişim Planın Güncellendi — AION Mirror',
}

function buildEmailHtml(type: NotificationType, userName: string, payload: NotificationPayload): string {
  if (type === 'evaluation_completed') {
    const reportUrl = payload.reportUrl ?? ''
    return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
      <h2 style="font-size:20px;font-weight:700;color:#1a1a1a">Değerlendirme Raporun Hazır</h2>
      <p style="color:#555;line-height:1.6">Merhaba ${userName},<br/>Son roleplay seansının değerlendirmesi tamamlandı. ICF koçluk boyutlarına göre hazırlanan raporunu inceleyebilirsin.</p>
      ${reportUrl ? `<a href="${reportUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Raporu Görüntüle</a>` : ''}
      <p style="margin-top:24px;font-size:12px;color:#999">AION Mirror — mirror.aionmore.com</p>
    </div>`
  }

  if (type === 'account_created') {
    return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
      <h2 style="font-size:20px;font-weight:700;color:#1a1a1a">Hesabın Oluşturuldu</h2>
      <p style="color:#555;line-height:1.6">Merhaba ${userName},<br/>AION Mirror hesabın başarıyla oluşturuldu. Giriş yapmak için e-postana gönderilen davet linkini kullanabilirsin.</p>
      <p style="margin-top:24px;font-size:12px;color:#999">AION Mirror — mirror.aionmore.com</p>
    </div>`
  }

  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
    <h2 style="font-size:20px;font-weight:700;color:#1a1a1a">Bildirim</h2>
    <p style="color:#555">Merhaba ${userName}, yeni bir güncelleme var.</p>
  </div>`
}

function buildEmailText(type: NotificationType, userName: string): string {
  if (type === 'evaluation_completed')
    return `Merhaba ${userName}, değerlendirme raporun hazır. AION Mirror'a giriş yaparak inceleyebilirsin.`
  if (type === 'account_created')
    return `Merhaba ${userName}, AION Mirror hesabın oluşturuldu. Davet linki için e-postanı kontrol et.`
  return `Merhaba ${userName}, yeni bir güncelleme var.`
}

export async function createNotification(
  userId: string,
  tenantId: string,
  type: NotificationType,
  payload: NotificationPayload = {}
): Promise<void> {
  const supabase = await createServiceRoleClient()

  // Kullanıcı adı + e-postasını al (e-posta için)
  const { data: user } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', userId)
    .single()

  if (!user) {
    console.error('[notification] Kullanıcı bulunamadı:', userId)
    return
  }

  const userName = user.full_name ?? user.email

  // DB'ye yaz
  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, tenant_id: tenantId, type, payload })
    .select('id')
    .single()

  if (error) {
    console.error('[notification] DB insert hatası:', error.message)
    return
  }

  // E-posta gönder (RESEND_API_KEY yoksa atla)
  const email = getEmailAdapter()
  if (!email) {
    console.warn('[notification] RESEND_API_KEY tanımlanmamış, e-posta atlandı')
    return
  }

  const result = await email.send({
    to: user.email,
    subject: EMAIL_SUBJECTS[type],
    html: buildEmailHtml(type, userName, payload),
    text: buildEmailText(type, userName),
  })

  if (result.delivered && notification) {
    await supabase
      .from('notifications')
      .update({ email_sent: true })
      .eq('id', notification.id)
  }
}
