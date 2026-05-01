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
import { LevelBar } from '@/components/ui/LevelBar'
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

      {/* ROW 1: Profile + KPI yatay (full width) */}
      <Card className="bg-surface-container-low border-border/40 overflow-hidden shadow-sm">
        <CardContent className="pt-8 pb-6">
          <div className="flex flex-col md:flex-row items-center md:items-stretch gap-8">
            {/* Sol: Avatar + isim */}
            <div className="flex items-center gap-5 md:flex-shrink-0 md:pr-8 md:border-r md:border-border/30">
              <div className="relative">
                <div className="absolute -inset-3 bg-amber-500/10 rounded-full blur-2xl animate-pulse" />
                <div className="relative h-20 w-20 rounded-full bg-on-background/5 border border-amber-500/20 flex items-center justify-center text-4xl shadow-inner">
                  {LEVEL_EMOJI[profile.level] ?? '🎖️'}
                </div>
                <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center text-white font-bold text-xs shadow-lg">
                  {profile.level}
                </div>
              </div>
              <div className="space-y-1 text-center md:text-left">
                <h2 className="text-xl font-bold leading-tight">
                  {currentUser.full_name ?? currentUser.email}
                </h2>
                <p className="text-[10px] uppercase font-black tracking-widest text-amber-500">
                  {LEVEL_TITLE[profile.level] ?? 'Koç'}
                </p>
              </div>
            </div>

            {/* Sağ: KPI metrikleri yataya yayılmış */}
            <div className="flex-1 grid grid-cols-3 gap-4 md:gap-8">
              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-bold tabular-nums text-foreground leading-none">
                  {profile.xp_points.toLocaleString('tr-TR')}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-2">
                  Deneyim Puanı
                </span>
              </div>
              <div className="flex flex-col items-center justify-center text-center border-x border-border/30">
                <span className="text-3xl font-bold tabular-nums text-foreground leading-none">
                  {profile.current_streak}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-2">
                  Gün Seri
                </span>
              </div>
              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-bold tabular-nums text-foreground leading-none">
                  {userBadges.length}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-2">
                  Rozet
                </span>
              </div>
            </div>
          </div>

          {/* LevelBar — full width */}
          <div className="mt-8">
            <LevelBar
              level={profile.level}
              progressPercent={profile.progressPercent}
              xpPoints={profile.xp_points}
              nextLevelXP={profile.nextLevelXP}
            />
          </div>
        </CardContent>
      </Card>

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
