import { getUserSessions, getWeeklySessionStatus } from '@/lib/queries/session.queries'
import { getCurrentUser } from '@/lib/auth'
import { PageHeader } from '@/components/admin/PageHeader'
import { SessionList } from '@/components/sessions/SessionList'
import { WeeklyStatusBanner } from '@/components/sessions/WeeklyStatusBanner'
import { Button } from '@/components/ui/button'
import { PlusIcon, AlertCircleIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface SessionsPageProps {
  searchParams: Promise<{ error?: string; cancelled?: string }>
}

export default async function SessionsPage({ searchParams }: SessionsPageProps) {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const [{ error: sessionError }, sessions, weeklyStatus] = await Promise.all([
    searchParams,
    getUserSessions(),
    getWeeklySessionStatus(currentUser.id),
  ])

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <PageHeader
        title="Koçluk Seanslarım"
        description={`${sessions.length} seans tamamlandı`}
        action={
          <Button asChild>
            <Link href="/dashboard/sessions/new">
              <PlusIcon className="mr-2 h-4 w-4" />
              Yeni Seans
            </Link>
          </Button>
        }
      />
      {sessionError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Seans başlatılamadı</p>
            <p className="mt-0.5 text-destructive/80">{decodeURIComponent(sessionError)}</p>
          </div>
        </div>
      )}
      <WeeklyStatusBanner
        completedThisWeek={weeklyStatus.completedThisWeek}
        weekStart={weeklyStatus.weekStart}
      />
      <SessionList sessions={sessions} />
    </div>
  )
}
