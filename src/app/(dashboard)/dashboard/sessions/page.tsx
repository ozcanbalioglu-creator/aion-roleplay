import { getUserSessions, getWeeklySessionStatus } from '@/lib/queries/session.queries'
import { getCurrentUser } from '@/lib/auth'
import { PageHeader } from '@/components/admin/PageHeader'
import { SessionList } from '@/components/sessions/SessionList'
import { WeeklyStatusBanner } from '@/components/sessions/WeeklyStatusBanner'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SessionsPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const [sessions, weeklyStatus] = await Promise.all([
    getUserSessions(),
    getWeeklySessionStatus(currentUser.id),
  ])

  return (
    <div className="space-y-6">
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
      <WeeklyStatusBanner
        completedThisWeek={weeklyStatus.completedThisWeek}
        weekStart={weeklyStatus.weekStart}
      />
      <SessionList sessions={sessions} />
    </div>
  )
}
