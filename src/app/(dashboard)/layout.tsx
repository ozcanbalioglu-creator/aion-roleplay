import { redirect } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { getAuthSession } from '@/modules/auth'
import { logoutAction } from '@/modules/auth/actions'

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

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>
        <AppHeader
          user={session.user}
          tenant={session.tenant}
          unreadCount={0}
          onSignOut={logoutAction}
        />
        <main className="flex-1 overflow-auto p-4 lg:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  )
}
