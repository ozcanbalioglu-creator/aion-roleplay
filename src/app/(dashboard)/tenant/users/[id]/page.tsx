import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserReportData } from '@/lib/queries/reports.queries'
import { getDevelopmentPlanForUser } from '@/lib/queries/development-plan.queries'
import { getCancellationStatsForUser } from '@/lib/queries/cancellation.queries'
import { DevelopmentPlanWidget } from '@/components/dashboard/DevelopmentPlanWidget'
import { CancellationStatsWidget } from '@/components/dashboard/CancellationStatsWidget'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Trophy, Star, CalendarCheck, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { DimensionRadarChartLazy as DimensionRadarChart } from '@/components/dashboard/DashboardCharts'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'tenant_admin', 'hr_admin', 'hr_viewer', 'manager']

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Süper Admin',
  tenant_admin: 'Kurum Admin',
  hr_admin: 'İK Admin',
  hr_viewer: 'İK Görüntüleyici',
  manager: 'Yönetici',
  user: 'Kullanıcı',
}

function computeDimensionAverages(sessions: NonNullable<Awaited<ReturnType<typeof getUserReportData>>>['sessions']) {
  const map = new Map<string, { name: string; scores: number[] }>()

  for (const session of sessions) {
    const evaluation = Array.isArray(session.evaluations)
      ? session.evaluations[0]
      : session.evaluations
    if (!evaluation) continue

    const dimScores = Array.isArray(evaluation.dimension_scores)
      ? evaluation.dimension_scores
      : evaluation.dimension_scores
        ? [evaluation.dimension_scores]
        : []

    type DimScore = { dimension_code: string; score: number }
    for (const ds of dimScores as DimScore[]) {
      const existing = map.get(ds.dimension_code) ?? { name: ds.dimension_code, scores: [] }
      existing.scores.push(ds.score)
      map.set(ds.dimension_code, existing)
    }
  }

  return Array.from(map.entries()).map(([code, { name, scores }]) => ({
    code,
    dimension: name,
    avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
    count: scores.length,
  }))
}

type EvalRecord = { overall_score?: number | null }

function getScore(evaluations: unknown): number | null {
  const ev = (Array.isArray(evaluations) ? evaluations[0] : evaluations) as EvalRecord | null
  return typeof ev?.overall_score === 'number' ? ev.overall_score : null
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: PageProps) {
  const { id: targetUserId } = await params

  const currentUser = await getCurrentUser()
  if (!currentUser || !ALLOWED_ROLES.includes(currentUser.role)) notFound()

  const [reportData, devPlan] = await Promise.all([
    getUserReportData(targetUserId, 'all'),
    getDevelopmentPlanForUser(targetUserId),
  ])

  if (!reportData) notFound()

  // notFound() is `never`; TypeScript needs explicit narrowing here
  const { user, sessions } = reportData!

  const cancelStats = await getCancellationStatsForUser(targetUserId, user.tenant_id)
  const dimensionAvgs = computeDimensionAverages(sessions)

  const completedSessions = sessions.filter((s) => getScore(s.evaluations) !== null)
  const scores = completedSessions.map((s) => getScore(s.evaluations) as number)
  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/tenant/users" className="hover:underline">Kullanıcılar</Link>
        <span>/</span>
        <span className="text-foreground">{user.full_name ?? user.email}</span>
      </div>

      {/* Kullanıcı Profil Kartı */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-2xl font-semibold">{user.full_name ?? '—'}</h1>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
              </div>
            </div>
            <div className="flex gap-6 sm:gap-8 shrink-0">
              <div className="text-center">
                <div className="flex items-center gap-1 text-amber-500">
                  <Trophy className="h-4 w-4" />
                  <span className="text-xl font-bold">{user.level ?? 1}</span>
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Seviye</p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-primary">
                  <Star className="h-4 w-4" />
                  <span className="text-xl font-bold">{user.xpPoints ?? 0}</span>
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">DP</p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-green-500">
                  <CalendarCheck className="h-4 w-4" />
                  <span className="text-xl font-bold">{completedSessions.length}</span>
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Seans</p>
              </div>
              {avgScore !== null && (
                <div className="text-center">
                  <div className="flex items-center gap-1 text-blue-500">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xl font-bold">{avgScore}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Ort. Puan</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ana Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sol — Seans Tablosu */}
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Son Seanslar</CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz tamamlanmış seans yok.</p>
              ) : (
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
                      {sessions.slice(0, 10).map((session) => {
                        const persona = (Array.isArray(session.personas) ? session.personas[0] : session.personas) as { name?: string } | null
                        const scenario = (Array.isArray(session.scenarios) ? session.scenarios[0] : session.scenarios) as { title?: string } | null
                        const score = getScore(session.evaluations)
                        return (
                          <tr key={session.id} className="hover:bg-muted/30">
                            <td className="py-2 pr-4">
                              <p className="font-medium">{persona?.name ?? '—'}</p>
                              <p className="text-xs text-muted-foreground">{scenario?.title ?? '—'}</p>
                            </td>
                            <td className="text-right py-2">
                              {score !== null ? (
                                <span className={`font-semibold ${score >= 4 ? 'text-green-600' : score >= 3 ? 'text-amber-600' : 'text-red-500'}`}>
                                  {score}/5
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="text-right py-2 text-muted-foreground text-xs whitespace-nowrap">
                              {session.completed_at
                                ? new Date(session.completed_at).toLocaleDateString('tr-TR')
                                : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {dimensionAvgs.length > 0 && (
            <DimensionRadarChart data={dimensionAvgs} />
          )}
        </div>

        {/* Sağ — Gelişim Planı + İptal İstatistikleri */}
        <div className="space-y-6">
          <DevelopmentPlanWidget plan={devPlan} />
          <CancellationStatsWidget stats={cancelStats} />
        </div>
      </div>
    </div>
  )
}
