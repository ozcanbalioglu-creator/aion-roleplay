import { notFound } from 'next/navigation'
import { features } from '@/lib/features'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getMyNotifications, getNotificationLabel } from '@/lib/queries/notification.queries'
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/lib/actions/notification.actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, CheckCheck, FileText, UserPlus, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  evaluation_completed: FileText,
  account_created: UserPlus,
  dev_plan_ready: TrendingUp,
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export default async function NotificationsPage() {
  if (!features.notificationsPage) notFound()

  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const notifications = await getMyNotifications(50)
  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-semibold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Bildirimler
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">{unreadCount} okunmamış bildirim</p>
          )}
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-4 w-4" />
              Tümünü okundu işaretle
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Henüz bildirim yok.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? Bell
            const reportUrl = n.payload.reportUrl as string | undefined
            return (
              <Card
                key={n.id}
                className={n.isRead ? 'opacity-70' : 'border-primary/30 bg-primary/2'}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    <div className={`shrink-0 p-2 rounded-lg ${n.isRead ? 'bg-muted' : 'bg-primary/10'}`}>
                      <Icon className={`h-4 w-4 ${n.isRead ? 'text-muted-foreground' : 'text-primary'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{getNotificationLabel(n.type)}</p>
                        {!n.isRead && (
                          <Badge variant="default" className="text-[10px] h-4 px-1.5">Yeni</Badge>
                        )}
                      </div>
                      {reportUrl && (
                        <Link href={reportUrl} className="text-xs text-primary hover:underline mt-0.5 block">
                          Raporu görüntüle →
                        </Link>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">{formatDate(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <form action={markNotificationReadAction.bind(null, n.id)}>
                        <button
                          type="submit"
                          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          title="Okundu işaretle"
                        >
                          <CheckCheck className="h-4 w-4" />
                        </button>
                      </form>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
