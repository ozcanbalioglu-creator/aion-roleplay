import { notFound, redirect } from 'next/navigation'
import { features } from '@/lib/features'
import { getCurrentUser } from '@/lib/auth'
import { getTeamMembers } from '@/lib/queries/reports.queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  user: 'Kullanıcı',
  manager: 'Yönetici',
  hr_admin: 'İK Admin',
  hr_viewer: 'İK Görüntüleyici',
  tenant_admin: 'Kurum Admin',
}

export default async function TeamPage() {
  if (!features.managerPages) notFound()

  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const members = await getTeamMembers('all')

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-headline font-semibold">Ekibim</h1>
          <p className="text-sm text-muted-foreground">{members.length} ekip üyesi</p>
        </div>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Ekibinizde henüz kullanıcı yok.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <Card key={member.id}>
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/tenant/users/${member.id}`}
                        className="font-medium hover:underline truncate"
                      >
                        {member.name}
                      </Link>
                      <Badge variant="outline" className="text-[10px]">
                        {ROLE_LABELS[member.role] ?? member.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 text-center">
                    <div>
                      <p className="text-lg font-bold">{member.sessionCount}</p>
                      <p className="text-[10px] text-muted-foreground">Seans</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">
                        {member.avgScore !== null ? member.avgScore : '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Ort. Puan</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-500" />
                      <p className="text-sm font-semibold">{member.xpPoints}</p>
                    </div>
                    {member.trend && (
                      <div>
                        {member.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                        {member.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                        {member.trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
