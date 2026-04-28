import { getGamificationProfile, getUserBadges, getXPHistory } from '@/lib/queries/gamification.queries'
import { getCurrentUser } from '@/lib/auth'
import { LevelBar } from '@/components/ui/LevelBar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Zap, Trophy } from 'lucide-react'
import { redirect, notFound } from 'next/navigation'
import { features } from '@/lib/features'

const DEFAULT_PROFILE = {
  xp_points: 0,
  level: 1,
  current_streak: 0,
  weekly_session_count: 0,
  currentLevelXP: 0,
  nextLevelXP: 300,
  progressPercent: 0,
}

export default async function AchievementsPage() {
  if (!features.gamification) notFound()
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const [profileRaw, userBadges, xpHistory] = await Promise.all([
    getGamificationProfile(),
    getUserBadges(),
    getXPHistory(),
  ])

  const profile = profileRaw ?? DEFAULT_PROFILE

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 py-8 px-6 md:px-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline italic text-foreground tracking-tight">Başarılarım</h1>
        <p className="text-sm text-muted-foreground font-body">Gelişim serüvenini ve kazandığın ödülleri buradan takip edebilirsin.</p>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Sol Kolon: Profil ve XP Geçmişi */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <Card className="bg-surface-container-low border-border/40 overflow-hidden shadow-sm">
            <CardContent className="pt-8 pb-6">
              <div className="flex flex-col items-center text-center gap-4 mb-8">
                <div className="relative">
                  <div className="absolute -inset-4 bg-amber-500/10 rounded-full blur-2xl animate-pulse" />
                  <div className="relative h-24 w-24 rounded-full bg-on-background/5 border border-amber-500/20 flex items-center justify-center text-5xl shadow-inner">
                    {['', '🌱', '⭐', '🏅', '🏆', '👑'][profile.level] ?? '🎖️'}
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center text-white font-bold text-xs shadow-lg">
                    {profile.level}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h2 className="text-xl font-bold">{currentUser.full_name ?? currentUser.email}</h2>
                  <p className="text-[10px] uppercase font-black tracking-widest text-amber-500">
                    {['', 'Koçluk Yolcusu', 'Gelişen Koç', 'Yetkin Koç', 'Uzman Koç', 'Usta Koç'][profile.level] ?? 'Koç'}
                  </p>
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold tabular-nums">{profile.xp_points}</span>
                    <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Toplam XP</span>
                  </div>
                  <div className="h-8 w-px bg-border/40" />
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold tabular-nums">{profile.current_streak}</span>
                    <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Gün Seri</span>
                  </div>
                  <div className="h-8 w-px bg-border/40" />
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold tabular-nums">{userBadges.length}</span>
                    <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Rozet</span>
                  </div>
                </div>
              </div>

              <LevelBar
                level={profile.level}
                progressPercent={profile.progressPercent}
                xpPoints={profile.xp_points}
                nextLevelXP={profile.nextLevelXP}
              />
            </CardContent>
          </Card>

          <Card className="bg-surface-container-low border-border/40 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                XP Akışı
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
                <p className="text-xs text-muted-foreground text-center py-4 italic opacity-50">Henüz XP hareketi yok.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sağ Kolon: Rozet Koleksiyonu */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
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
                    <p className="text-sm font-medium text-muted-foreground">
                      Şu an henüz bir rozet kazanmadın. 
                      <br />
                      Seanslara devam ederek koleksiyonunu oluştur!
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
