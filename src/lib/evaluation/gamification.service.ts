import { createServiceRoleClient } from '@/lib/supabase/server'
import { updateChallengeProgress, notifyBadgeEarned } from '@/lib/gamification/challenge.service'

interface AwardXPParams {
  userId: string
  tenantId: string
  sessionId: string
  overallScore: number
  durationSeconds: number | null
  personaId: string
  scenarioId: string
}

interface AwardResult {
  xpEarned: number
  newLevel: number
  badgesEarned: string[]
}

// Persona zorluk çarpanı — yönetmesi daha zor karakterler daha fazla XP
const PERSONA_DIFFICULTY_MULTIPLIER: Record<number, number> = {
  1: 1.00,
  2: 1.15,
  3: 1.30,
  4: 1.50,
  5: 2.00,
}

// Senaryo zorluk çarpanı — daha karmaşık durumlar daha fazla XP
const SCENARIO_DIFFICULTY_MULTIPLIER: Record<number, number> = {
  1: 1.00,
  2: 1.10,
  3: 1.20,
  4: 1.35,
  5: 1.60,
}

// XP hesaplama: baz + puan bonusu + süre bonusu
function calculateBaseXP(overallScore: number, durationSeconds: number | null): number {
  const baseXP = 50
  const scoreBonus = Math.round((overallScore - 1) * 25)
  const durationBonus = durationSeconds && durationSeconds >= 900 ? 20 : 0
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

  // Persona ve senaryo zorluk derecelerini paralel çek
  const [personaResult, scenarioResult] = await Promise.all([
    supabase.from('personas').select('difficulty').eq('id', params.personaId).single(),
    supabase.from('scenarios').select('difficulty_level').eq('id', params.scenarioId).single(),
  ])

  const personaDifficulty: number = (personaResult.data as any)?.difficulty ?? 1
  const scenarioDifficulty: number = (scenarioResult.data as any)?.difficulty_level ?? 1

  const personaMult = PERSONA_DIFFICULTY_MULTIPLIER[personaDifficulty] ?? 1.0
  const scenarioMult = SCENARIO_DIFFICULTY_MULTIPLIER[scenarioDifficulty] ?? 1.0
  const baseXP = calculateBaseXP(params.overallScore, params.durationSeconds)
  const xpEarned = Math.round(baseXP * personaMult * scenarioMult)

  const hasBonus = personaMult > 1.0 || scenarioMult > 1.0
  const bonusLabel = hasBonus
    ? ` [Persona ×${personaMult.toFixed(2)} · Senaryo ×${scenarioMult.toFixed(2)}]`
    : ''

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

  // users tablosunu senkronize et
  await supabase
    .from('users')
    .update({ xp_points: newXP, level: newLevel })
    .eq('id', params.userId)

  // XP transaction — çarpan detayı description'a yazılır (kullanıcıya şeffaf)
  await supabase.from('point_transactions').insert({
    user_id: params.userId,
    tenant_id: params.tenantId,
    session_id: params.sessionId,
    points: xpEarned,
    transaction_type: 'session_completion',
    description: `Seans tamamlandı (puan: ${params.overallScore.toFixed(1)})${bonusLabel}`,
  })

  // Badge kontrolü
  const badgesEarned: string[] = []

  const { data: badges } = await supabase
    .from('badges')
    .select('id, badge_code, name, criteria, xp_reward')
    .eq('is_active', true)

  const { data: userBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', params.userId)

  const earnedBadgeIds = new Set((userBadges as any[])?.map((b: any) => b.badge_id) ?? [])

  for (const badge of (badges || []) as any[]) {
    if (earnedBadgeIds.has(badge.id)) continue

    const criteria = badge.criteria as Record<string, unknown>
    let earned = false

    if (criteria.type === 'min_score' && params.overallScore >= (criteria.value as number)) {
      earned = true
    } else if (criteria.type === 'streak' && newStreak >= (criteria.value as number)) {
      earned = true
    } else if (criteria.type === 'level' && newLevel >= (criteria.value as number)) {
      earned = true
    } else if (criteria.type === 'xp' && newXP >= (criteria.value as number)) {
      earned = true
    } else if (criteria.type === 'session_count') {
      const { count } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', params.userId)
        .eq('status', 'completed')
      if ((count ?? 0) >= (criteria.value as number)) earned = true
    } else if (criteria.type === 'persona_difficulty_min') {
      // Kullanıcı bu seansda yeterince zor persona ile çalıştı mı?
      if (personaDifficulty >= (criteria.value as number)) earned = true
    } else if (criteria.type === 'scenario_difficulty_min') {
      // Kullanıcı bu seansda yeterince zor senaryo denedi mi?
      if (scenarioDifficulty >= (criteria.value as number)) earned = true
    }

    if (earned) {
      await supabase.from('user_badges').insert({
        user_id: params.userId,
        badge_id: badge.id,
        earned_at: new Date().toISOString(),
        session_id: params.sessionId,
      })

      if ((badge.xp_reward ?? 0) > 0) {
        await supabase.from('point_transactions').insert({
          user_id: params.userId,
          tenant_id: params.tenantId,
          session_id: params.sessionId,
          points: badge.xp_reward,
          transaction_type: 'badge_earned',
          description: `Rozet kazanıldı: ${badge.name ?? badge.badge_code}`,
        })
      }

      badgesEarned.push(badge.badge_code)
    }
  }

  for (const badgeCode of badgesEarned) {
    const earnedBadge = (badges as any[])?.find((b: any) => b.badge_code === badgeCode)
    if (earnedBadge) {
      await notifyBadgeEarned(params.userId, params.tenantId, badgeCode, earnedBadge.name ?? badgeCode)
    }
  }

  // Görev ilerleme — persona + senaryo yenilik kontrolü
  const [personaStatResult, scenarioStatResult] = await Promise.all([
    supabase
      .from('user_persona_stats')
      .select('completed_sessions')
      .eq('user_id', params.userId)
      .eq('persona_id', params.personaId)
      .single(),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', params.userId)
      .eq('scenario_id', params.scenarioId)
      .eq('status', 'completed')
      .neq('id', params.sessionId),
  ])

  const isNewPersona = !personaStatResult.data || (personaStatResult.data as any).completed_sessions <= 1
  const isNewScenario = (scenarioStatResult.count ?? 0) === 0

  await updateChallengeProgress({
    userId: params.userId,
    tenantId: params.tenantId,
    sessionId: params.sessionId,
    overallScore: params.overallScore,
    personaId: params.personaId,
    scenarioId: params.scenarioId,
    isNewPersona,
    isNewScenario,
  })

  return { xpEarned, newLevel, badgesEarned }
}
