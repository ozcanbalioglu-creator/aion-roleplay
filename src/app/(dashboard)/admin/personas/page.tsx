import { PageHeader } from '@/components/admin/PageHeader'
import { TenantPersonaAssignment } from '@/components/admin/TenantPersonaAssignment'
import { getPersonas, getPersonaTenantMappings } from '@/lib/actions/persona.actions'
import { getTenants } from '@/lib/actions/tenant.actions'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminPersonasPage() {
  const [user, personas, tenants, mappings] = await Promise.all([
    getCurrentUser(),
    getPersonas(),
    getTenants(),
    getPersonaTenantMappings(),
  ])

  if (!user || user.role !== 'super_admin') {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kurum Persona Yönetimi"
        description="Şirket seçin, hangi personaların o şirkete atanacağını belirleyin"
      />
      <TenantPersonaAssignment personas={personas.filter((p) => p.is_active)} tenants={tenants.filter(t => t.is_active)} initialMappings={mappings} />
    </div>
  )
}
