import { PageHeader } from '@/components/admin/PageHeader'
import { getAuthSession } from '@/modules/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function TenantAdminDashboard() {
  const session = await getAuthSession()
  const supabase = await createClient()
  const tenantId = session!.tenant!.id

  const [{ count: userCount }, { count: personaCount }, { count: sessionCount }] =
    await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('personas').select('*', { count: 'exact', head: true }).or(`tenant_id.is.null,tenant_id.eq.${tenantId}`),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ])

  const stats = [
    { label: 'Kullanıcılar', value: userCount ?? 0 },
    { label: 'Personalar', value: personaCount ?? 0 },
    { label: 'Seanslar', value: sessionCount ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Yönetimi"
        description="Kurumunuzun kullanıcı ve içerik yönetimi"
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