import { PageHeader } from '@/components/admin/PageHeader'
import { TenantTable } from '@/components/admin/TenantTable'
import { CreateTenantDialog } from '@/components/admin/CreateTenantDialog'
import { getTenants } from '@/lib/actions/tenant.actions'
import { CreateTenantButton } from './CreateTenantButton'

export const dynamic = 'force-dynamic'

export default async function TenantsPage() {
  const tenants = await getTenants()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Yönetimi"
        description="Platform kurumlarını görüntüleyin ve yönetin"
        action={<CreateTenantButton />}
      />
      <TenantTable tenants={tenants} />
    </div>
  )
}
