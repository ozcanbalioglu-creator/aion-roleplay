import { createServiceRoleClient } from '@/lib/supabase/server'
import { updateChallengeProgress, notifyBadgeEarned } from '@/lib/gamification/challenge.service'

interface AwardXPParams {
  userId: string
  tenantId: string
  sessionId: string
  overallScore: number
  durationSeconds: number | null
  personaId: string
}

interface AwardResult {
  xpEarned: number
  newLevel: number
  badgesEarned: string[]
}

// XP hesaplama: baz + puan bonusu + süre bonusu
function calculateXP(overallScore: number, durationSeconds: number | null): number {
  const baseXP = 50
  const scoreBonus = Math.round((overallScore - 1) * 25) // 0-100 arası (skor 1→0, skor 5→100)
  const durationBonus = durationSeconds && durationSeconds >= 900 ? 20 : 0 // 15+ dakika bonusu
  return baseXP + scoreBonus + durationBonus
}

// Seviye eşikleri: 1→0 XP, 2→300, 3→800, 4→1800, 5→3500
function calculateLevel(totalXP: number): number {
  if (totalXP >= 3500) return 5
  if (totalXP >= 1800) return 4
  if (totalXP >= 800) return 3
  if (totalXP >= 300) return 2
  return 1
}

export async function awardXPAndBadges(params: AwardXPParams): Promise<AwardResult> {
  const supabase = await createServiceRoleClient()
  const xpEarned = calculateXP(params.overallScore, params.durationSeconds)

  // Mevcut profili al
  const { data: profile } = await supabase
    .from('gamification_profiles')
    .select('xp_points, level, current_streak, weekly_session_count, last_session_date')
    .eq('user_id', params.userId)
    .single()

  if (!profile) return { xpEarned: 0, newLevel: 1, badgesEarned: [] }

  const newXP = profile.xp_points + xpEarned
  const newLevel = calculateLevel(newXP)

  // Streak hesapla
  const today = new Date().toISOString().split('T')[0]
  const lastDate = profile.last_session_date
  const isConsecutiveDay =
    lastDate &&
    new Date(today).getTime() - new Date(lastDate).getTime() <= 86400000 * 1.5
  const newStreak = isConsecutiveDay ? profile.current_streak + 1 : 1

  // Profili güncelle
  await supabase
    .from('gamification_profiles')
    .update({
      xp_points: newXP,
      level: newLevel,
      current_streak: newStreak,
      weekly_session_count: profile.weekly_session_count + 1,
      last_session_date: today,
    })
    .eq('user_id', params.userId)

  // users tablosunu da güncelle (XP ve level senkronize)
  await supabase
    .from('users')
    .update({ xp_points: newXP, level: newLevel })
    .eq('id', params.userId)

  // XP transaction kaydı
  await supabase.from('point_transactions').insert({
    user_id: params.userId,
    tenant_id: params.tenantId,
    session_id: params.sessionId,
    points: xpEarned,
    transaction_type: 'session_completion',
    description: `Seans tamamlandı (puan: ${params.overallScore.toFixed(1)})`,
  })

  // Badge kontrolü
  const badgesEarned: string[] = []

  // Tüm aktif badge'leri getir
  const { data: badges } = await supabase
    .from('badges')
    .select('id, badge_code, criteria, xp_reward')
    .eq('is_active', true)

  // Kullanıcının mevcut badge'leri
  const { data: userBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', params.userId)

  const earnedBadgeIds = new Set((userBadges as any[])?.map((b: any) => b.badge_id) ?? [])

  // Kazanılmamış badge'ler için kriter kontrolü
  for (const badge of (badges || []) as any[]) {
    if (earnedBadgeIds.has(badge.id)) continue

    const criteria = badge.criteria as Record<string, unknown>
    let earned = false

    // Kriter tipleri
    if (criteria.type === 'min_score' && params.overallScore >= (criteria.value as number)) {
      earned = true
    } else if (criteria.type === 'streak' && newStreak >= (criteria.value as number)) {
      earned = true
    } else if (criteria.type === 'level' && newLevel >= (criteria.value as number)) {
      earned = true
    } else if (criteria.type === 'xp' && newXP >= (criteria.value as number)) {
      earned = true
    }

    if (earned) {
      await supabase.from('user_badges').insert({
        user_id: params.userId,
        badge_id: badge.id,
        earned_at: new Date().toISOString(),
        session_id: params.sessionId,
      })

      // Badge XP bonusu
      if (badge.xp_reward > 0) {
        await supabase.from('point_transactions').insert({
          user_id: params.userId,
          tenant_id: params.tenantId,
          session_id: params.sessionId,
          points: badge.xp_reward,
          transaction_type: 'badge_earned',
          description: `Rozet kazanıldı: ${badge.badge_code}`,
        })
      }

      badgesEarned.push(badge.badge_code)
    }
  }

  // Kazanılan her rozet için bildirim
  for (const badgeCode of badgesEarned) {
    const earnedBadge = (badges as any[])?.find((b: any) => b.badge_code === badgeCode)
    if (earnedBadge) {
      await notifyBadgeEarned(params.userId, params.tenantId, badgeCode, (earnedBadge as any).name ?? badgeCode)
    }
  }

  // Görev ilerleme güncelleme — persona istatistiğini kontrol et
  const { data: personaStat } = await supabase
    .from('user_persona_stats')
    .select('completed_sessions')
    .eq('user_id', params.userId)
    .eq('persona_id', params.personaId)
    .single()

  // Bu seansdan önce 0 completed_sessions -> yeni persona denemesi
  const isNewPersona = !personaStat || (personaStat as any).completed_sessions <= 1

  await updateChallengeProgress({
    userId: params.userId,
    tenantId: params.tenantId,
    sessionId: params.sessionId,
    overallScore: params.overallScore,
    personaId: params.personaId,
    isNewPersona,
  })

  return { xpEarned, newLevel, badgesEarned }
}
