import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/admin/PageHeader'
import { TenantTable } from '@/components/admin/TenantTable'
import { CreateTenantDialog } from '@/components/admin/CreateTenantDialog'

export default async function TenantsPage() {
  const supabase = await createClient()

  const { data: tenants } = await supabase
    .from('tenants')
    .select(`
      id, name, slug, plan, is_active, max_users, created_at,
      users(count)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Yönetimi"
        description="Platformdaki tüm kurumları yönetin"
        action={<CreateTenantDialog />}
      />
      <div className="rounded-md border">
        <TenantTable tenants={tenants || []} />
      </div>
    </div>
  )
}