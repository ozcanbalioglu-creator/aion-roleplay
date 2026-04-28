import { notFound } from 'next/navigation'
import { PeriodFilter } from '@/components/dashboard/PeriodFilter'
import { CSVExportButton } from '@/components/reports/CSVExportButton'
import { TeamDimensionChart } from '@/components/reports/TeamDimensionChart'
import { TeamLeaderboard } from '@/components/reports/TeamLeaderboard'
import { TeamMemberTable } from '@/components/reports/TeamMemberTable'
import { TeamStatCards } from '@/components/reports/TeamStatCards'
import { getCurrentUser } from '@/lib/auth'
import {
  getTeamDimensionAverages,
  getTeamLeaderboard,
  getTeamMembers,
  getTeamStats,
  type ReportPeriod,
} from '@/lib/queries/reports.queries'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['manager', 'hr_viewer', 'tenant_admin', 'super_admin']
const EXPORT_ROLES = ['hr_viewer', 'tenant_admin', 'super_admin']

interface ReportsPageProps {
  searchParams: Promise<{ period?: string; sort?: string }>
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !ALLOWED_ROLES.includes(currentUser.role)) notFound()

  const { period: rawPeriod, sort: rawSort } = await searchParams
  const period: ReportPeriod = rawPeriod === 'week' || rawPeriod === 'month' ? rawPeriod : 'all'
  const sortBy: 'score' | 'xp' | 'sessions' =
    rawSort === 'xp' || rawSort === 'sessions' ? rawSort : 'score'

  const supabase = await createServerClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('settings, name')
    .eq('id', currentUser.tenant_id)
    .single()

  const isAnonymous = (tenant?.settings as Record<string, unknown> | null)?.leaderboard_anonymous === true

  const [stats, members, leaderboard, dimensionAvgs] = await Promise.all([
    getTeamStats(period),
    getTeamMembers(period),
    getTeamLeaderboard(period, sortBy),
    getTeamDimensionAverages(period),
  ])

  const scopeLabel =
    currentUser.role === 'manager'
      ? 'Takımım'
      : currentUser.role === 'hr_viewer'
        ? tenant?.name ?? 'Kurum'
        : 'Tüm Kullanıcılar'

  return (
    <div className="space-y-6 pb-8 px-4 lg:px-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Raporlar</h1>
          <p className="text-sm text-muted-foreground">
            {scopeLabel} - {members.length} üye
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {EXPORT_ROLES.includes(currentUser.role) && <CSVExportButton period={period} />}
          <PeriodFilter currentPeriod={period} />
        </div>
      </div>

      {stats && (
        <TeamStatCards
          totalUsers={stats.totalUsers}
          activeUsers={stats.activeUsers}
          avgScore={stats.avgScore}
          totalSessions={stats.totalSessions}
          weeklyCompletionRate={stats.weeklyCompletionRate}
        />
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TeamMemberTable members={members} />
          <TeamDimensionChart data={dimensionAvgs} />
        </div>

        <div>
          <TeamLeaderboard entries={leaderboard} anonymous={isAnonymous} sortBy={sortBy} />
        </div>
      </div>
    </div>
  )
}
