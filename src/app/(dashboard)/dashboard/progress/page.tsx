import { notFound, redirect } from 'next/navigation'
import { features } from '@/lib/features'
import { getCurrentUser } from '@/lib/auth'
import { getScoreTrend, getDimensionAverages, getDimensionDelta, getRecentSessions } from '@/lib/queries/dashboard.queries'
import { getGamificationProfile } from '@/lib/queries/gamification.queries'
import { getMyDevelopmentPlan } from '@/lib/queries/development-plan.queries'
import { getMyCancellationStats } from '@/lib/queries/cancellation.queries'
import { DevelopmentPlanWidget } from '@/components/dashboard/DevelopmentPlanWidget'
import { DimensionProgressCards } from '@/components/dashboard/DimensionProgressCards'
import { CancellationStatsWidget } from '@/components/dashboard/CancellationStatsWidget'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Star, TrendingUp, Target } from 'lucide-react'
import Link from 'next/link'
import {
  ScoreTrendChartLazy as ScoreTrendChart,
  DimensionRadarChartLazy as DimensionRadarChart,
} from '@/components/dashboard/DashboardCharts'

export const dynamic = 'force-dynamic'

export default async function ProgressPage() {
  if (!features.progressPage) notFound()

  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const [
    scoreTrend,
    dimensionAvgs,
    dimensionDelta,
    recentSessions,
    gamProfile,
    devPlan,
    cancelStats,
  ] = await Promise.all([
    getScoreTrend('all'),
    getDimensionAverages('all'),
    getDimensionDelta(),
    getRecentSessions(20),
    getGamificationProfile(),
    getMyDevelopmentPlan(),
    getMyCancellationStats(),
  ])

  const scores = recentSessions
    .map((s) => {
      const ev = Array.isArray((s as { evaluations?: unknown }).evaluations)
        ? ((s as { evaluations: Array<{ overall_score?: number | null }> }).evaluations)[0]
        : null
      return typeof ev?.overall_score === 'number' ? ev.overall_score : null
    })
    .filter((s): s is number => s !== null)

  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null

  return (
    <div className="flex-1 space-y-8 p-8 md:p-12 pb-20 max-w-[1400px] mx-auto overflow-y-auto">
      <div>
        <h1 className="text-3xl font-headline italic tracking-tight">Gelişimim</h1>
        <p className="text-sm text-muted-foreground mt-1">Tüm zamanların istatistikleri ve ilerleme özeti</p>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <Trophy className="h-4 w-4" />
              <span className="text-2xl font-bold">{gamProfile?.level ?? 1}</span>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Seviye</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-primary mb-1">
              <Star className="h-4 w-4" />
              <span className="text-2xl font-bold">{gamProfile?.xp_points ?? 0}</span>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Toplam DP</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-green-500 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-2xl font-bold">{recentSessions.length}</span>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Tamamlanan Seans</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-blue-500 mb-1">
              <Target className="h-4 w-4" />
              <span className="text-2xl font-bold">{avgScore ?? '—'}</span>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Ortalama Puan</p>
          </CardContent>
        </Card>
      </div>

      {/* Ana Grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* Sol — Grafikler + Tablo */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {scoreTrend.length > 0 && <ScoreTrendChart data={scoreTrend} />}
          {dimensionDelta.length > 0 && <DimensionProgressCards dimensions={dimensionDelta} />}

          {/* Son seanslar tablosu */}
          {recentSessions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Seans Geçmişi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="text-left pb-2 font-medium">Persona / Senaryo</th>
                        <th className="text-right pb-2 font-medium">Puan</th>
                        <th className="text-right pb-2 font-medium">Tarih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {recentSessions.map((session) => {
                        const s = session as {
                          id: string
                          completed_at: string | null
                          personas: { name?: string } | null
                          scenarios: { title?: string } | null
                          evaluations: Array<{ overall_score?: number | null }> | null
                        }
                        const ev = Array.isArray(s.evaluations) ? s.evaluations[0] : null
                        const score = typeof ev?.overall_score === 'number' ? ev.overall_score : null
                        return (
                          <tr key={s.id} className="hover:bg-muted/30">
                            <td className="py-2 pr-4">
                              <Link href={`/dashboard/sessions/${s.id}/report`} className="font-medium hover:underline">
                                {(s.personas as { name?: string } | null)?.name ?? '—'}
                              </Link>
                              <p className="text-xs text-muted-foreground">
                                {(s.scenarios as { title?: string } | null)?.title ?? '—'}
                              </p>
                            </td>
                            <td className="text-right py-2">
                              {score !== null ? (
                                <span className={`font-semibold ${score >= 4 ? 'text-green-600' : score >= 3 ? 'text-amber-600' : 'text-red-500'}`}>
                                  {score}/5
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="text-right py-2 text-xs text-muted-foreground whitespace-nowrap">
                              {s.completed_at ? new Date(s.completed_at).toLocaleDateString('tr-TR') : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sağ — Radar + Gelişim planı + İptal */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {dimensionAvgs.length > 0 && <DimensionRadarChart data={dimensionAvgs} />}
          <DevelopmentPlanWidget plan={devPlan} />
          <CancellationStatsWidget stats={cancelStats} />
        </div>
      </div>

      {/* DP terminoloji dipnotu */}
      <p className="text-[11px] text-muted-foreground/60 italic mt-4 text-center">
        DP = Deneyim Puanı
      </p>
    </div>
  )
}
