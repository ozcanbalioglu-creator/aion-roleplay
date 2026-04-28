import { createServiceRoleClient } from '@/lib/supabase/server'

interface UpdateChallengeParams {
  userId: string
  tenantId: string
  sessionId: string
  overallScore: number
  personaId: string
  scenarioId: string
  isNewPersona: boolean
  isNewScenario: boolean
}

export async function updateChallengeProgress(params: UpdateChallengeParams): Promise<string[]> {
  const supabase = await createServiceRoleClient()
  const now = new Date().toISOString()
  const completedChallenges: string[] = []

  // Kullanıcının aktif görevlerini getir
  const { data: activeChallenges } = await supabase
    .from('user_challenges')
    .select(`
      id, progress, target_value,
      challenges(challenge_type, title, xp_reward)
    `)
    .eq('user_id', params.userId)
    .eq('status', 'active')
    .gt('expires_at', now)

  if (!activeChallenges?.length) return []

  for (const uc of activeChallenges) {
    const challenge = uc.challenges as any
    if (!challenge) continue

    let newProgress = uc.progress
    let shouldComplete = false

    switch (challenge.challenge_type) {
      case 'complete_sessions':
        newProgress = uc.progress + 1
        shouldComplete = newProgress >= uc.target_value
        break

      case 'achieve_score':
        // Hedef puanı aştıysa tamamlandı
        if (params.overallScore >= uc.target_value) {
          newProgress = uc.target_value
          shouldComplete = true
        }
        break

      case 'try_persona':
        if (params.isNewPersona) {
          newProgress = uc.target_value
          shouldComplete = true
        }
        break

      case 'try_scenario':
        if (params.isNewScenario) {
          newProgress = uc.target_value
          shouldComplete = true
        }
        break

      case 'streak_maintain': {
        // Mevcut streak'i gamification_profiles'tan al
        const { data: profile } = await supabase
          .from('gamification_profiles')
          .select('current_streak')
          .eq('user_id', params.userId)
          .single()

        if (profile && profile.current_streak >= uc.target_value) {
          newProgress = uc.target_value
          shouldComplete = true
        }
        break
      }
    }

    // İlerlemeyi kaydet
    if (newProgress !== uc.progress || shouldComplete) {
      await supabase
        .from('user_challenges')
        .update({
          progress: newProgress,
          status: shouldComplete ? 'completed' : 'active',
          completed_at: shouldComplete ? now : null,
        })
        .eq('id', uc.id)

      // Tamamlandıysa XP ve bildirim
      if (shouldComplete) {
        completedChallenges.push(challenge.title)

        // Görev XP bonusu
        await supabase.from('point_transactions').insert({
          user_id: params.userId,
          tenant_id: params.tenantId,
          session_id: params.sessionId,
          points: challenge.xp_reward ?? 0,
          transaction_type: 'challenge_completed',
          description: `Görev tamamlandı: ${challenge.title}`,
        })

        // gamification_profiles XP güncelle (veya users tablosu, hangisini seçtiysek)
        // Projede gamification_profiles kullanılıyor, ancak önceki promptta 'users' demiş.
        // gamification_profiles daha doğru.
        const { data: profile } = await supabase
          .from('gamification_profiles')
          .select('xp_points')
          .eq('user_id', params.userId)
          .single()

        if (profile) {
          await supabase
            .from('gamification_profiles')
            .update({ xp_points: profile.xp_points + (challenge.xp_reward ?? 0) })
            .eq('user_id', params.userId)
        }

        // Bildirim oluştur
        await createGamificationNotification({
          userId: params.userId,
          tenantId: params.tenantId,
          type: 'challenge_completed',
          title: 'Görev Tamamlandı! 🎯',
          body: `"${challenge.title}" görevini tamamladın. +${challenge.xp_reward} XP`,
          metadata: { challenge_title: challenge.title, xp_earned: challenge.xp_reward },
        })
      }
    }
  }

  return completedChallenges
}

// Bildirim oluşturma yardımcısı
export async function createGamificationNotification(params: {
  userId: string
  tenantId: string
  type: string
  title: string
  body: string
  metadata?: Record<string, unknown>
}) {
  const supabase = await createServiceRoleClient()
  await supabase.from('notifications').insert({
    user_id: params.userId,
    tenant_id: params.tenantId,
    type: params.type,
    title: params.title,
    body: params.body,
    is_read: false,
    metadata: params.metadata ?? {},
  })
}

// Rozet kazanılınca bildirim — Faz 8'deki awardXPAndBadges()'den çağrılır
export async function notifyBadgeEarned(
  userId: string,
  tenantId: string,
  badgeCode: string,
  badgeName: string
) {
  await createGamificationNotification({
    userId,
    tenantId,
    type: 'badge_earned',
    title: 'Yeni Rozet Kazandın! 🏅',
    body: `"${badgeName}" rozetini kazandın. Tebrikler!`,
    metadata: { badge_code: badgeCode },
  })
}
