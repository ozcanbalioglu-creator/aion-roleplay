import { createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export type LeaderboardPeriod = 'week' | 'month' | 'all'

export interface LeaderboardEntry {
  user_id: string
  full_name: string
  avatar_url: string | null
  xp: number
  level: number
  rank: number
  is_current_user: boolean
}

export interface LeaderboardResult {
  period: LeaderboardPeriod
  entries: LeaderboardEntry[]
  current_user_entry: LeaderboardEntry | null
  total_users: number
}

/**
 * Aynı tenant içindeki kullanıcıların XP'ye göre sıralaması.
 *
 * - `all`: gamification_profiles.xp_points kümülatif (tüm zamanlar)
 * - `week`: point_transactions'tan bu hafta kazanılan XP toplamı
 * - `month`: point_transactions'tan son 30 gün
 *
 * Top 10 + current user'ın kendi sırası (ilk 10'da değilse ekstra entry).
 *
 * Service role client kullanıyoruz çünkü gamification_profiles + users
 * cross-user okuma gerekiyor (RLS standart user'ı sadece kendi satırına izin verir).
 * Tenant izolasyonu kod seviyesinde garanti: WHERE tenant_id = currentUser.tenant_id.
 */
export async function getLeaderboard(period: LeaderboardPeriod = 'all'): Promise<LeaderboardResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { period, entries: [], current_user_entry: null, total_users: 0 }
  }

  const service = await createServiceRoleClient()

  if (period === 'all') {
    // Kümülatif sıralama — gamification_profiles.xp_points doğrudan
    const { data, error } = await service
      .from('gamification_profiles')
      .select(`
        user_id, xp_points, level,
        users!inner(full_name, avatar_url, tenant_id, is_active)
      `)
      .eq('users.tenant_id', currentUser.tenant_id)
      .eq('users.is_active', true)
      .order('xp_points', { ascending: false })
      .limit(100)

    if (error || !data) {
      console.error('[getLeaderboard all] err:', error)
      return { period, entries: [], current_user_entry: null, total_users: 0 }
    }

    return shapeResult(data, currentUser.id, period)
  }

  // Periodic — point_transactions'tan periodSum hesapla
  const since = period === 'week'
    ? startOfWeek(new Date()).toISOString()
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 gün

  // Tüm tenant kullanıcılarını çek
  const { data: tenantUsers, error: usersErr } = await service
    .from('users')
    .select('id, full_name, avatar_url')
    .eq('tenant_id', currentUser.tenant_id)
    .eq('is_active', true)

  if (usersErr || !tenantUsers || tenantUsers.length === 0) {
    return { period, entries: [], current_user_entry: null, total_users: 0 }
  }

  const userIds = tenantUsers.map(u => u.id)

  // Period içindeki point_transactions'ları sum et
  const { data: txData, error: txErr } = await service
    .from('point_transactions')
    .select('user_id, points')
    .in('user_id', userIds)
    .gte('created_at', since)

  if (txErr) {
    console.error('[getLeaderboard period] tx err:', txErr)
  }

  // Per-user sum
  const periodSum = new Map<string, number>()
  for (const tx of (txData ?? []) as Array<{ user_id: string; points: number }>) {
    periodSum.set(tx.user_id, (periodSum.get(tx.user_id) ?? 0) + tx.points)
  }

  // Profile ve level bilgisi için gamification_profiles'tan level çek
  const { data: profiles } = await service
    .from('gamification_profiles')
    .select('user_id, level')
    .in('user_id', userIds)

  const levelByUser = new Map<string, number>()
  for (const p of (profiles ?? []) as Array<{ user_id: string; level: number }>) {
    levelByUser.set(p.user_id, p.level ?? 1)
  }

  // Birleştir — period XP'si 0 olanlar da gözüksün ki kullanıcı kendi 0 puanını görsün
  const merged = tenantUsers.map(u => {
    const u2 = u as { id: string; full_name: string; avatar_url: string | null }
    return {
      user_id: u2.id,
      xp_points: periodSum.get(u2.id) ?? 0,
      level: levelByUser.get(u2.id) ?? 1,
      users: { full_name: u2.full_name, avatar_url: u2.avatar_url },
    }
  })

  // Sırala
  merged.sort((a, b) => b.xp_points - a.xp_points)

  return shapeResult(merged, currentUser.id, period)
}

function shapeResult(
  rows: Array<{
    user_id: string
    xp_points: number
    level: number
    users: { full_name: string; avatar_url: string | null } | { full_name: string; avatar_url: string | null }[] | null
  }>,
  currentUserId: string,
  period: LeaderboardPeriod,
): LeaderboardResult {
  const entries: LeaderboardEntry[] = rows.map((row, idx) => {
    const userObj = Array.isArray(row.users) ? row.users[0] : row.users
    return {
      user_id: row.user_id,
      full_name: userObj?.full_name ?? '—',
      avatar_url: userObj?.avatar_url ?? null,
      xp: row.xp_points,
      level: row.level,
      rank: idx + 1,
      is_current_user: row.user_id === currentUserId,
    }
  })

  const top10 = entries.slice(0, 10)
  const currentUserEntry = entries.find(e => e.is_current_user) ?? null

  return {
    period,
    entries: top10,
    current_user_entry: currentUserEntry,
    total_users: entries.length,
  }
}

function startOfWeek(date: Date): Date {
  // Pazartesi 00:00 (Turkish locale)
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = (day + 6) % 7 // Pazartesiden gün farkı
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}
