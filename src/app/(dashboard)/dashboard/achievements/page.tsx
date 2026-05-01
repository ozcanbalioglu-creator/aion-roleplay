import { redirect, notFound } from 'next/navigation'
import { features } from '@/lib/features'
import { getCurrentUser } from '@/lib/auth'
import {
  getGamificationProfile,
  getUserBadges,
  getXPHistory,
  getCompletedChallenges,
} from '@/lib/queries/gamification.queries'
import { getLeaderboard } from '@/lib/queries/leaderboard.queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Zap, Trophy } from 'lucide-react'
import { Leaderboard } from '@/components/dashboard/Leaderboard'
import { CompletedChallengesGrid } from '@/components/dashboard/CompletedChallengesGrid'

const DEFAULT_PROFILE = {
  xp_points: 0,
  level: 1,
  current_streak: 0,
  weekly_session_count: 0,
  currentLevelXP: 0,
  nextLevelXP: 300,
  progressPercent: 0,
}

const LEVEL_EMOJI: Record<number, string> = {
  1: '🌱',
  2: '⭐',
  3: '🏅',
  4: '🏆',
  5: '👑',
}

const LEVEL_TITLE: Record<number, string> = {
  1: 'Koçluk Yolcusu',
  2: 'Gelişen Koç',
  3: 'Yetkin Koç',
  4: 'Uzman Koç',
  5: 'Usta Koç',
}

export default async function AchievementsPage() {
  if (!features.gamification) notFound()
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const [
    profileRaw,
    userBadges,
    xpHistory,
    completedChallenges,
    leaderboardWeek,
    leaderboardMonth,
    leaderboardAll,
  ] = await Promise.all([
    getGamificationProfile(),
    getUserBadges(),
    getXPHistory(),
    getCompletedChallenges(),
    getLeaderboard('week'),
    getLeaderboard('month'),
    getLeaderboard('all'),
  ])

  const profile = profileRaw ?? DEFAULT_PROFILE

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 py-8 px-6 md:px-12">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline italic text-foreground tracking-tight">Başarılarım</h1>
        <p className="text-sm text-muted-foreground font-body">
          Gelişim serüvenini ve kazandığın ödülleri buradan takip edebilirsin.
        </p>
      </div>

      {/* ROW 1: Profile Hero — site renk paleti ile dark celebratory card.
          Site renkleri: tertiary-container (#191936) + primary-container (#2A0056)
          gradient + accent purple (#9D6BDF) glow + amber-500 gamification vurgusu. */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#1a1a2e] via-[#1f1140] to-[#0f0e22] shadow-2xl">
        {/* Dekoratif radial glow'lar */}
        <div className="absolute -left-20 top-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-[#9D6BDF]/20 blur-3xl pointer-events-none" />
        <div className="absolute -right-32 -bottom-20 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative p-8 md:p-10">
          <div className="flex flex-col lg:flex-row gap-8 lg:items-center">
            {/* Sol: PROFİL ÖZETİ label + Avatar */}
            <div className="flex flex-col items-center lg:items-start gap-4 lg:flex-shrink-0">
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/50">
                Profil Özeti
              </span>
              <div className="relative">
                {/* Mor radial glow */}
                <div className="absolute -inset-4 bg-[#9D6BDF]/30 rounded-full blur-2xl" />
                {/* Avatar circle */}
                <div className="relative h-24 w-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-5xl shadow-2xl backdrop-blur-sm">
                  {LEVEL_EMOJI[profile.level] ?? '🎖️'}
                </div>
                {/* Level badge */}
                <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-amber-500 border-[3px] border-[#1a1a2e] flex items-center justify-center text-white font-black text-sm shadow-xl">
                  {profile.level}
                </div>
              </div>
            </div>

            {/* Orta: İsim + Subtitle + Progress bar */}
            <div className="flex-1 min-w-0 space-y-5">
              <div className="space-y-1 text-center lg:text-left">
                <h2 className="text-3xl md:text-4xl font-headline italic text-white tracking-tight leading-tight">
                  {currentUser.full_name ?? currentUser.email}
                </h2>
                <p className="text-base font-headline italic text-[#B990F0]">
                  {LEVEL_TITLE[profile.level] ?? 'Koç'}
                </p>
              </div>

              {/* Progress bar bölümü */}
              <div className="space-y-2">
                <div className="flex items-end justify-between gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-[0.25em] font-black text-amber-400">
                    {profile.level >= 5
                      ? 'Seviye Tamamlandı'
                      : `Seviye ${profile.level + 1} İçin`}
                  </span>
                  <span className="text-xs tabular-nums font-bold text-amber-400">
                    {profile.xp_points.toLocaleString('tr-TR')} / {profile.nextLevelXP.toLocaleString('tr-TR')} Deneyim Puanı
                  </span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-[#9D6BDF] transition-all duration-500"
                    style={{ width: `${profile.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Sağ: 3 KPI mini-kartı */}
            <div className="grid grid-cols-3 gap-3 lg:flex-shrink-0">
              <div className="flex flex-col items-center justify-center px-5 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm min-w-[100px]">
                <Zap className="h-4 w-4 text-amber-400 mb-2" />
                <span className="text-2xl font-bold tabular-nums text-white leading-none">
                  {profile.xp_points.toLocaleString('tr-TR')}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-white/50 font-bold mt-2 text-center">
                  Deneyim Puanı
                </span>
              </div>
              <div className="flex flex-col items-center justify-center px-5 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm min-w-[100px]">
                <span className="text-base mb-1.5">🔥</span>
                <span className="text-2xl font-bold tabular-nums text-white leading-none">
                  {profile.current_streak}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-white/50 font-bold mt-2 text-center">
                  Gün Serisi
                </span>
              </div>
              <div className="flex flex-col items-center justify-center px-5 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm min-w-[100px]">
                <Trophy className="h-4 w-4 text-amber-400 mb-2" />
                <span className="text-2xl font-bold tabular-nums text-white leading-none">
                  {userBadges.length}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-white/50 font-bold mt-2 text-center">
                  Rozet
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: Rozet | Görev (yan yana 2 kutu) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Rozet Koleksiyonu */}
        <Card className="bg-surface-container-low border-border/40 min-h-[500px] shadow-sm">
          <CardHeader className="pb-2 border-b border-border/20 mb-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                Rozet Koleksiyonu
              </CardTitle>
              <span className="text-[10px] font-black tabular-nums bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full border border-amber-500/20">
                {userBadges.length} Ödül
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {userBadges.map((ub) => {
                const badge = ub.badges as any
                return (
                  <div
                    key={ub.id}
                    className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border/40 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300"
                  >
                    <div className="relative h-16 w-16 mb-2">
                      <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative h-full w-full rounded-2xl bg-surface-container-low border border-border/40 flex items-center justify-center text-3xl shadow-sm transition-transform group-hover:scale-110 group-hover:-rotate-3">
                        {badge?.icon ?? '🏅'}
                      </div>
                    </div>
                    <div className="text-center space-y-0.5">
                      <p className="text-xs font-bold text-foreground leading-tight">{badge?.name}</p>
                      <p className="text-[9px] text-muted-foreground line-clamp-2 italic px-1 h-6">
                        {badge?.description}
                      </p>
                    </div>
                    <div className="mt-2 text-[8px] font-bold uppercase tracking-wider text-muted-foreground/40 border-t border-border/20 pt-2 w-full text-center">
                      {new Date(ub.earned_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                )
              })}

              {userBadges.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center gap-4 border-2 border-dashed border-border/30 rounded-3xl opacity-50">
                  <Trophy className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground text-center">
                    Şu an henüz bir rozet kazanmadın.
                    <br />
                    Seanslara devam ederek koleksiyonunu oluştur!
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Görev Tamamlamaları */}
        <CompletedChallengesGrid challenges={completedChallenges} />
      </div>

      {/* ROW 3: Leaderboard (8 col) | Deneyim Puanı Akışı (4 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <Leaderboard
            data={{ week: leaderboardWeek, month: leaderboardMonth, all: leaderboardAll }}
            initialPeriod="week"
          />
        </div>

        <div className="lg:col-span-4">
          <Card className="bg-surface-container-low border-border/40 shadow-sm h-full">
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Deneyim Puanı Akışı
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {xpHistory.map((tx, i) => (
                <div key={i} className="flex items-center justify-between text-sm group">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium text-foreground truncate">{tx.description}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">
                      {new Date(tx.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="font-bold text-amber-500 tabular-nums flex-shrink-0 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 transition-colors group-hover:bg-amber-500/10">
                    +{tx.points}
                  </span>
                </div>
              ))}
              {xpHistory.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 italic opacity-50">
                  Henüz deneyim puanı hareketi yok.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Terminoloji açıklaması */}
      <p className="text-[11px] text-muted-foreground/60 italic mt-4 text-center">
        Deneyim Puanı (DP) — Tamamladığın seanslara ve görevlere göre kazandığın gelişim puanı.
      </p>
    </div>
  )
}
