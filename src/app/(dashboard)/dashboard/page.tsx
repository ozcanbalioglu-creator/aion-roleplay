import { Suspense } from 'react'
import { getGamificationProfile, getWeeklyChallenges } from '@/lib/queries/gamification.queries'
import {
  getDashboardStats, getScoreTrend, getDimensionAverages,
  getPersonaScoreComparison, getRecentSessions, getDimensionDelta,
  type DashboardPeriod,
} from '@/lib/queries/dashboard.queries'
import { getActiveOrPendingSession } from '@/lib/queries/session.queries'
import { DashboardStatCards } from '@/components/dashboard/DashboardStatCards'
import { WeeklyChallengesWidget } from '@/components/dashboard/WeeklyChallengesWidget'
import { RecentSessionsList } from '@/components/dashboard/RecentSessionsList'
import { DimensionProgressCards } from '@/components/dashboard/DimensionProgressCards'
import { PeriodFilter } from '@/components/dashboard/PeriodFilter'
import { Button } from '@/components/ui/button'
import { PlayCircle, PlusCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  ScoreTrendChartLazy as ScoreTrendChart,
  DimensionRadarChartLazy as DimensionRadarChart,
  PersonaScoreChartLazy as PersonaScoreChart,
} from '@/components/dashboard/DashboardCharts'

interface DashboardPageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { period: rawPeriod } = await searchParams
  const period: DashboardPeriod =
    rawPeriod === 'week' || rawPeriod === 'month' ? rawPeriod : 'all'

  // Tüm veriyi paralel çek
  const [
    gamProfile,
    stats,
    scoreTrend,
    dimensionAvgs,
    personaComparison,
    recentSessions,
    dimensionDelta,
    weeklyChallenges,
    activeSession,
  ] = await Promise.all([
    getGamificationProfile(),
    getDashboardStats(period),
    getScoreTrend(period),
    getDimensionAverages(period),
    getPersonaScoreComparison(period),
    getRecentSessions(5),
    getDimensionDelta(),
    getWeeklyChallenges(),
    getActiveOrPendingSession(),
  ])

  return (
    <div className="flex-1 space-y-10 p-8 md:p-12 pb-20 max-w-[1600px] mx-auto overflow-y-auto">
      {/* Başlık + Filtre + CTA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/30 pb-8">
        <div className="space-y-1">
          <h1 className="text-4xl font-headline italic tracking-tight text-foreground">Ayna Paneli</h1>
          <p className="text-[11px] uppercase tracking-[0.3em] font-black text-muted-foreground/60">
            Professional Performance & Analytics Hub
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <PeriodFilter currentPeriod={period} />
          
          {activeSession ? (
            <Button asChild size="lg" className={cn(
              'rounded-full px-8 font-black uppercase tracking-widest text-[10px] shadow-xl transition-all hover:scale-105 active:scale-95',
              activeSession.status === 'dropped'
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                : 'bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/20'
            )}>
              <Link href={`/dashboard/sessions/${activeSession.id}`} className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4" />
                {activeSession.status === 'dropped' ? 'Yansımaya Dön' : 'Seans Devam Ediyor'}
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="rounded-full px-8 font-black uppercase tracking-widest text-[10px] bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
              <Link href="/dashboard/sessions/new" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Yeni Yansıma Başlat
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stat kartları */}
      <DashboardStatCards
        totalSessions={stats?.totalSessions ?? 0}
        avgScore={stats?.avgScore ?? null}
        currentStreak={gamProfile?.current_streak ?? 0}
        xpPoints={gamProfile?.xp_points ?? 0}
        level={gamProfile?.level ?? 1}
      />

      {/* Ana Veri Gridi */}
      <div className="grid grid-cols-12 gap-8">
        {/* Sol Sütun: Gelişim ve Geçmiş */}
        <div className="col-span-12 lg:col-span-7 xl:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="col-span-1 md:col-span-2">
               <ScoreTrendChart data={scoreTrend} />
            </div>
            <PersonaScoreChart data={personaComparison} />
            <RecentSessionsList sessions={recentSessions} />
          </div>
          
          {/* Boyut İlerleme Kartları */}
          {dimensionDelta.length > 0 && (
            <DimensionProgressCards dimensions={dimensionDelta} />
          )}
        </div>

        {/* Sağ Sütun: Hedefler ve Yetkinlikler */}
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 space-y-8">
          <DimensionRadarChart data={dimensionAvgs} />
          <WeeklyChallengesWidget challenges={weeklyChallenges} />
          
          {/* Motivational Quote or Insight */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-amber-500/10 to-primary/5 border border-amber-500/10 relative overflow-hidden group">
            <Sparkles className="absolute -right-4 -top-4 h-24 w-24 text-amber-500/5 rotate-12 transition-transform group-hover:rotate-45" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-4">Günün İçgörüsü</h3>
            <p className="text-sm font-medium italic text-foreground leading-relaxed relative z-10">
              "Kendi yansımanla her gün yüzleşmek, profesyonel ustalığa giden en hızlı yoldur. Bugün odaklandığın her soru, yarınki başarının temelidir."
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
