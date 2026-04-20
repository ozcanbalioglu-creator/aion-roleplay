import { PageHeader } from '@/components/admin/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function SuperAdminDashboard() {
  const supabase = await createClient()

  const [{ count: tenantCount }, { count: userCount }, { count: sessionCount }] =
    await Promise.all([
      supabase.from('tenants').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('sessions').select('*', { count: 'exact', head: true }),
    ])

  const stats = [
    { label: 'Toplam Tenant', value: tenantCount ?? 0 },
    { label: 'Toplam Kullanıcı', value: userCount ?? 0 },
    { label: 'Toplam Seans', value: sessionCount ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin"
        description="Platform geneli yönetim merkezi"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{s.value.toLocaleString('tr-TR')}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}