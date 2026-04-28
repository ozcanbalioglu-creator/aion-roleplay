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
  const now = new Date()
  const utcDay = now.getUTCDay()    // 0=Pazar, 1=Pazartesi
  const utcDate = now.getUTCDate()  // 1-31

  const isMonday = utcDay === 1
  const isFirstOfMonth = utcDate === 1

  if (!isMonday && !isFirstOfMonth) {
    return Response.json({ skipped: true, reason: 'Not Monday or 1st of month' })
  }

  // Haftalık pencere: Pazartesi → Pazar
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - (utcDay === 0 ? 6 : utcDay - 1))
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)

  // Aylık pencere: ayın 1'i → son günü
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

  // Aktif kullanıcılar
  const { data: users } = await supabase
    .from('users')
    .select('id, tenant_id')
    .in('role', ['user', 'manager', 'hr_admin'])
    .eq('is_active', true)

  if (!users?.length) return Response.json({ assigned: 0 })

  // Global görevleri çek (haftalık + aylık ayrı ayrı)
  const { data: globalChallenges } = await supabase
    .from('challenges')
    .select('id, challenge_type, xp_reward, target_value, period')
    .is('tenant_id', null)
    .eq('is_active', true)

  const globalWeekly = (globalChallenges ?? []).filter((c: any) => c.period === 'weekly' || c.is_weekly === true)
  const globalMonthly = (globalChallenges ?? []).filter((c: any) => c.period === 'monthly')

  let totalAssigned = 0

  for (const user of users) {
    // Tenant'a özel görevler
    const { data: tenantChallenges } = await supabase
      .from('challenges')
      .select('id, challenge_type, xp_reward, target_value, period')
      .eq('tenant_id', user.tenant_id)
      .eq('is_active', true)

    const tenantWeekly = (tenantChallenges ?? []).filter((c: any) => c.period === 'weekly' || c.is_weekly === true)
    const tenantMonthly = (tenantChallenges ?? []).filter((c: any) => c.period === 'monthly')

    // ── Haftalık görev ataması (Pazartesi) ───────────────────────────────────
    if (isMonday) {
      const { count: weeklyCount } = await supabase
        .from('user_challenges')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('assigned_at', weekStart.toISOString())
        .lte('assigned_at', weekEnd.toISOString())
        .in('challenge_id', [...globalWeekly, ...tenantWeekly].map((c: any) => c.id))

      if ((weeklyCount ?? 0) === 0) {
        const mandatory = globalWeekly.filter((c: any) => c.challenge_type === 'complete_sessions' && c.target_value === 1)
        const optional = [...globalWeekly, ...tenantWeekly].filter((c: any) => !mandatory.find((m: any) => m.id === c.id))
        const selected = optional.sort(() => Math.random() - 0.5).slice(0, 2)
        const toAssign = [...mandatory, ...selected]

        if (toAssign.length > 0) {
          const { error } = await supabase.from('user_challenges').insert(
            toAssign.map((c: any) => ({
              user_id: user.id,
              tenant_id: user.tenant_id,
              challenge_id: c.id,
              progress: 0,
              target_value: c.target_value,
              status: 'active',
              assigned_at: weekStart.toISOString(),
              expires_at: weekEnd.toISOString(),
            }))
          )
          if (!error) totalAssigned += toAssign.length
        }
      }
    }

    // ── Aylık görev ataması (Ayın 1'i) ───────────────────────────────────────
    if (isFirstOfMonth) {
      const allMonthly = [...globalMonthly, ...tenantMonthly]
      if (allMonthly.length === 0) continue

      const { count: monthlyCount } = await supabase
        .from('user_challenges')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('assigned_at', monthStart.toISOString())
        .in('challenge_id', allMonthly.map((c: any) => c.id))

      if ((monthlyCount ?? 0) === 0) {
        const { error } = await supabase.from('user_challenges').insert(
          allMonthly.map((c: any) => ({
            user_id: user.id,
            tenant_id: user.tenant_id,
            challenge_id: c.id,
            progress: 0,
            target_value: c.target_value,
            status: 'active',
            assigned_at: monthStart.toISOString(),
            expires_at: monthEnd.toISOString(),
          }))
        )
        if (!error) totalAssigned += allMonthly.length
      }
    }
  }

  console.log(`[assign-challenges] ${totalAssigned} görev ${users.length} kullanıcıya atandı`)
  return Response.json({ assigned: totalAssigned, users: users.length })
}
