import { NextRequest } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { createServiceRoleClient } from '@/lib/supabase/server'

const receiver = new Receiver({
  currentSigningKey: process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY!,
})

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('upstash-signature') ?? ''

  try {
    await receiver.verify({ signature, body, url: req.url })
  } catch {
    return new Response('Invalid signature', { status: 401 })
  }

  const supabase = await createServiceRoleClient()

  // Haftanın başlangıç/bitiş tarihleri (Pazartesi–Pazar, UTC)
  const now = new Date()
  const monday = new Date(now)
  const day = now.getUTCDay()
  monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1))
  monday.setUTCHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)

  // Aktif kullanıcıları getir (manager + user rolü)
  const { data: users } = await supabase
    .from('users')
    .select('id, tenant_id')
    .in('role', ['manager', 'user', 'hr_admin']) // Genişletildi
    .eq('is_active', true)

  if (!users?.length) return Response.json({ assigned: 0 })

  // Global haftalık görevleri getir
  const { data: globalChallenges } = await supabase
    .from('challenges')
    .select('id, challenge_type, xp_reward, target_value')
    .is('tenant_id', null)
    .eq('is_weekly', true)
    .eq('is_active', true)

  if (!globalChallenges?.length) return Response.json({ assigned: 0, reason: 'No challenges' })

  const mandatory = (globalChallenges as any[]).filter((c) => c.challenge_type === 'complete_sessions' && c.target_value === 1)
  const optional = (globalChallenges as any[]).filter((c) => !mandatory.find((m) => m.id === c.id))

  let totalAssigned = 0

  for (const user of users) {
    // Bu hafta zaten atanmış mı?
    const { count } = await supabase
      .from('user_challenges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('assigned_at', monday.toISOString())

    if ((count ?? 0) > 0) continue // Bu hafta zaten görev var

    // Tenant'a özel görevleri de al
    const { data: tenantChallenges } = await supabase
      .from('challenges')
      .select('id, challenge_type, xp_reward, target_value')
      .eq('tenant_id', user.tenant_id)
      .eq('is_weekly', true)
      .eq('is_active', true)

    const allOptional = [...optional, ...((tenantChallenges as any[]) ?? [])]

    // 2 rastgele opsiyonel seç
    const shuffled = allOptional.sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, 2)

    // Atanacak görevler
    const toAssign = [
      ...mandatory,
      ...selected,
    ]

    const inserts = toAssign.map((c) => ({
      user_id: user.id,
      tenant_id: user.tenant_id,
      challenge_id: c.id,
      progress: 0,
      target_value: c.target_value,
      status: 'active',
      assigned_at: monday.toISOString(),
      expires_at: sunday.toISOString(),
    }))

    if (inserts.length > 0) {
      const { error } = await supabase.from('user_challenges').insert(inserts)
      if (!error) totalAssigned += inserts.length
    }
  }

  console.log(`[assign-weekly-challenges] ${totalAssigned} görev ${users.length} kullanıcıya atandı`)
  return Response.json({ assigned: totalAssigned, users: users.length })
}
