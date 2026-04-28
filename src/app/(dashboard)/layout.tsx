import { redirect } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { NotificationPoller } from '@/components/common/NotificationPoller'
import { IdleTimeoutGuard } from '@/components/common/IdleTimeoutGuard'
import { getAuthSession } from '@/modules/auth'
import { logoutAction } from '@/modules/auth/actions'
import { getGamificationProfile } from '@/lib/queries/gamification.queries'
import { features } from '@/lib/features'

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()

  if (!session) {
    redirect('/login')
  }

  if (!session.hasConsent) {
    redirect('/consent')
  }

  const gamProfile = await getGamificationProfile()

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} gamProfile={gamProfile} flags={features} />
      <SidebarInset className="bg-background flex flex-col min-h-screen">
        <AppHeader
          user={session.user}
          tenant={session.tenant}
          unreadCount={0}
          onSignOut={logoutAction}
        />
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </SidebarInset>
      <MobileNav />
      <NotificationPoller userId={session.user.id} />
      <IdleTimeoutGuard />
    </SidebarProvider>
  )
}
