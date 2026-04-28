import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/admin/PageHeader'
import { TenantContextForm } from '@/components/admin/TenantContextForm'
import { getCurrentUser } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { TenantContextProfile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TenantSettingsPage() {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    redirect('/dashboard')
  }

  const supabase = await createServiceRoleClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, context_profile')
    .eq('id', user.tenant_id)
    .single()

  if (!tenant) redirect('/dashboard')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kurum Profili"
        description="AI konuşmalarına enjekte edilecek şirket bağlamını tanımlayın"
      />
      <TenantContextForm
        tenantId={tenant.id}
        initialProfile={(tenant.context_profile ?? null) as TenantContextProfile | null}
      />
    </div>
  )
}
