import { PageHeader } from '@/components/admin/PageHeader'
import { TenantTable } from '@/components/admin/TenantTable'
import { getTenants } from '@/lib/actions/tenant.actions'
import { getRubricTemplatesForSelect } from '@/lib/actions/rubric.actions'
import { CreateTenantButton } from './CreateTenantButton'

export const dynamic = 'force-dynamic'

export default async function TenantsPage() {
  const [tenants, rubricTemplates] = await Promise.all([
    getTenants(),
    getRubricTemplatesForSelect(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kurum Yönetimi"
        description="Platform kurumlarını görüntüleyin ve yönetin"
        action={<CreateTenantButton rubricTemplates={rubricTemplates} />}
      />
      <TenantTable tenants={tenants} rubricTemplates={rubricTemplates} />
    </div>
  )
}
