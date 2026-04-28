import { notFound, redirect } from 'next/navigation'
import { features } from '@/lib/features'
import { getCurrentUser } from '@/lib/auth'
import { getTeamStats, getTeamLeaderboard, getTeamDimensionAverages, type ReportPeriod } from '@/lib/queries/reports.queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Users, TrendingUp, Medal } from 'lucide-react'
import Link from 'next/link'
import { DimensionRadarChartLazy as DimensionRadarChart } from '@/components/dashboard/DashboardCharts'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  week: 'Bu Hafta',
  month: 'Bu Ay',
  all: 'Tüm Zamanlar',
}

const MEDAL_COLORS = ['text-amber-400', 'text-slate-400', 'text-orange-600']

export default async function ManagerReportsPage({ searchParams }: PageProps) {
  if (!features.managerPages) notFound()

  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const { period: rawPeriod } = await searchParams
  const period: ReportPeriod = rawPeriod === 'week' || rawPeriod === 'month' ? rawPeriod : 'all'

  const [stats, leaderboard, dimensionAvgs] = await Promise.all([
    getTeamStats(period),
    getTeamLeaderboard(period, 'score'),
    getTeamDimensionAverages(period),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-headline font-semibold">Ekip Raporları</h1>
        </div>
        {/* Period filter */}
        <div className="flex gap-2">
          {(['week', 'month', 'all'] as const).map((p) => (
            <Link
              key={p}
              href={`?period=${p}`}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                period === p
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-foreground'
              }`}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
      </div>

      {/* Stat kartları */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Users className="h-4 w-4" />
                <span className="text-2xl font-bold">{stats.totalUsers}</span>
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Toplam Üye</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-green-500 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-2xl font-bold">{stats.activeUsers}</span>
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Aktif Üye</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-2xl font-bold mb-1">{stats.totalSessions}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Tamamlanan Seans</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-2xl font-bold mb-1">{stats.avgScore ?? '—'}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Ort. Puan</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Liderlik tablosu */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Medal className="h-4 w-4 text-amber-500" />
              Performans Sıralaması
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz tamamlanmış seans yok.</p>
            ) : (
              <div className="space-y-3">
                {leaderboard.slice(0, 10).map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-6 ${MEDAL_COLORS[member.rank - 1] ?? 'text-muted-foreground'}`}>
                      {member.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link href={`/tenant/users/${member.id}`} className="text-sm font-medium hover:underline truncate block">
                        {member.name}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">{member.sessionCount} seans</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {member.avgScore ?? '—'}/5
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Boyut ortalamaları */}
        {dimensionAvgs.length > 0 && (
          <DimensionRadarChart data={dimensionAvgs} />
        )}
      </div>
    </div>
  )
}
