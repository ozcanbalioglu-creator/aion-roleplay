import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PeriodFilter } from '@/components/dashboard/PeriodFilter'
import { DimensionScoreBar } from '@/components/sessions/report/DimensionScoreBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth'
import { getUserReportData, type ReportPeriod } from '@/lib/queries/reports.queries'
import { ArrowLeft, Calendar, Star } from 'lucide-react'

interface UserReportPageProps {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ period?: string }>
}

interface ReportDimensionScore {
  dimension_code: string
  score: number
}

interface ReportEvaluation {
  overall_score: number | null
  dimension_scores?: ReportDimensionScore[] | ReportDimensionScore | null
}

interface ReportSession {
  id: string
  completed_at: string | null
  duration_seconds: number | null
  personas: { name?: string | null } | { name?: string | null }[] | null
  scenarios: { title?: string | null } | { title?: string | null }[] | null
  evaluations: ReportEvaluation[] | ReportEvaluation | null
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function getEvaluation(session: ReportSession) {
  return asArray(session.evaluations)[0]
}

export default async function UserReportPage({ params, searchParams }: UserReportPageProps) {
  const { userId } = await params
  const { period: rawPeriod } = await searchParams
  const period: ReportPeriod = rawPeriod === 'week' || rawPeriod === 'month' ? rawPeriod : 'all'

  const currentUser = await getCurrentUser()
  if (!currentUser) notFound()

  const data = await getUserReportData(userId, period)
  if (!data) notFound()

  const { user } = data
  const sessions = data.sessions as unknown as ReportSession[]
  const scoredSessions = sessions.filter((session) => getEvaluation(session)?.overall_score != null)
  const scores = scoredSessions.map((session) => getEvaluation(session)?.overall_score as number)
  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null

  const dimMap = new Map<string, number[]>()
  for (const session of scoredSessions) {
    const dimensions = asArray(getEvaluation(session)?.dimension_scores)
    for (const dimension of dimensions) {
      const scores = dimMap.get(dimension.dimension_code) ?? []
      scores.push(dimension.score)
      dimMap.set(dimension.dimension_code, scores)
    }
  }

  const dimensionAvgs = Array.from(dimMap.entries()).map(([code, values]) => ({
    dimension_code: code,
    score: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
  }))

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 px-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground">
          <Link href="/reports">
            <ArrowLeft className="h-4 w-4" />
            Raporlar
          </Link>
        </Button>
        <PeriodFilter currentPeriod={period} />
      </div>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
          {user.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <h1 className="text-xl font-bold">{user.name ?? user.email}</h1>
          <p className="text-sm text-muted-foreground">
            {user.email} - Seviye {user.level}
          </p>
        </div>
      </div>

      {avgScore != null && (
        <Card className="bg-card/60">
          <CardContent className="pt-5 pb-4 flex items-center gap-6 flex-wrap">
            <div className="flex items-end gap-1.5">
              <span className="text-4xl font-bold text-amber-400">{avgScore.toFixed(1)}</span>
              <span className="text-muted-foreground mb-1">/5.0 ort.</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="h-4 w-4" />
              {scoredSessions.length} değerlendirme
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {sessions.length} seans (bu dönem)
            </div>
          </CardContent>
        </Card>
      )}

      {dimensionAvgs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Boyut Ortalamaları
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dimensionAvgs
              .sort((a, b) => b.score - a.score)
              .map((dimension) => (
                <DimensionScoreBar
                  key={dimension.dimension_code}
                  dimensionCode={dimension.dimension_code}
                  score={dimension.score}
                  evidence={[]}
                  feedback=""
                />
              ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Seans Geçmişi
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Bu dönemde seans yok</p>
          ) : (
            sessions.map((session) => {
              const score = getEvaluation(session)?.overall_score
              const persona = asArray(session.personas)[0]
              const scenario = asArray(session.scenarios)[0]
              const durationMin = session.duration_seconds ? Math.round(session.duration_seconds / 60) : null

              return (
                <div key={session.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {persona?.name} - {scenario?.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.completed_at
                        ? new Date(session.completed_at).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : ''}
                      {durationMin ? ` - ${durationMin}dk` : ''}
                    </p>
                  </div>
                  {score != null ? (
                    <span className="text-sm font-bold text-amber-400 flex-shrink-0 tabular-nums">
                      {score.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground flex-shrink-0">-</span>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
